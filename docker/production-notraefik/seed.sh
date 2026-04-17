#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${SCRIPT_DIR}"
ENV_FILE="${COMPOSE_DIR}/.env"

# Sezioni selezionate (default: nessuna, l'utente deve scegliere)
SEED_ADMIN=false
SEED_USERS=false
SEED_CATEGORIES=false
SEED_TAGS=false
SEED_SMTP=false
SEED_POLICIES=false
SEED_DEMO=false
SHOW_STATUS=false
AUTO_YES=false

API_CONTAINER="mindcalm_notraefik_api"
PG_CONTAINER="mindcalm_notraefik_postgres"

compose() {
  docker compose -f "${COMPOSE_DIR}/docker-compose.yml" --env-file "${ENV_FILE}" "$@"
}

usage() {
  cat <<'EOF'
Usage: ./seed.sh [opzioni] <sezioni>

Sezioni (almeno una richiesta, oppure --all):
  --admin        Crea/aggiorna l'utente ADMIN da ADMIN_EMAIL/ADMIN_PASSWORD nel .env
                 (attenzione: disattiva il bootstrap admin perche introduce un admin reale)
  --users        Crea/aggiorna utenti STANDARD di prova (mantiene il bootstrap admin attivo)
  --categories   Seed categorie predefinite
  --tags         Seed tag predefiniti
  --smtp         Seed impostazioni SMTP
  --policies     Seed Terms Policy + Subscription Policy con consensi
  --demo         Seed dati demo (audio, post, eventi, contatti, codici invito, analytics, audit log)
  --all          Tutti i dati di prova ESCLUSI gli utenti (mantiene il bootstrap admin attivo):
                 categories + tags + smtp + policies + demo

Opzioni:
  --status       Mostra conteggio righe nel database ed esce
  --yes          Salta la conferma interattiva
  --help         Mostra questo messaggio

Esempi:
  ./seed.sh --all --yes                 # Dati di prova senza utenti (bootstrap admin attivo)
  ./seed.sh --users --yes               # Solo utenti STANDARD di prova
  ./seed.sh --all --users --yes         # Dati di prova + utenti STANDARD
  ./seed.sh --admin --yes               # Solo admin reale da .env (disattiva bootstrap)
  ./seed.sh --status                    # Mostra stato DB
EOF
}

log() {
  printf '[seed] %s\n' "$*"
}

die() {
  printf '[seed] Errore: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local line_no="${1:-unknown}"
  log "Seed fallito (exit ${exit_code}, linea ${line_no})"
  exit "${exit_code}"
}

trap 'on_error $LINENO' ERR

confirm() {
  local prompt="$1"
  if [[ "${AUTO_YES}" == "true" ]]; then
    log "Conferma automatica abilitata con --yes"
    return 0
  fi
  read -r -p "${prompt} [y/N] " answer
  case "${answer}" in
    y|Y|yes|YES) return 0 ;;
    *) die "Operazione annullata" ;;
  esac
}

parse_args() {
  local has_section=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --admin)      SEED_ADMIN=true; has_section=true ;;
      --users)      SEED_USERS=true; has_section=true ;;
      --categories) SEED_CATEGORIES=true; has_section=true ;;
      --tags)       SEED_TAGS=true; has_section=true ;;
      --smtp)       SEED_SMTP=true; has_section=true ;;
      --policies)   SEED_POLICIES=true; has_section=true ;;
      --demo)       SEED_DEMO=true; has_section=true ;;
      --all)
        SEED_CATEGORIES=true; SEED_TAGS=true
        SEED_SMTP=true; SEED_POLICIES=true; SEED_DEMO=true
        has_section=true
        ;;
      --status) SHOW_STATUS=true; has_section=true ;;
      --yes)    AUTO_YES=true ;;
      --help|-h) usage; exit 0 ;;
      *) usage; die "Opzione non riconosciuta: $1" ;;
    esac
    shift
  done

  if [[ "${has_section}" == "false" ]]; then
    usage
    die "Specificare almeno una sezione (es. --admin, --all)"
  fi
}

check_prerequisites() {
  command -v docker >/dev/null 2>&1 || die "Docker non trovato"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 non disponibile"
  [[ -f "${ENV_FILE}" ]] || die "File .env non trovato in ${COMPOSE_DIR}"
}

load_env_file() {
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
}

check_containers_running() {
  local api_status pg_status
  api_status="$(docker inspect -f '{{.State.Running}}' "${API_CONTAINER}" 2>/dev/null || echo "false")"
  pg_status="$(docker inspect -f '{{.State.Running}}' "${PG_CONTAINER}" 2>/dev/null || echo "false")"

  [[ "${pg_status}" == "true" ]] || die "Container postgres (${PG_CONTAINER}) non in esecuzione. Esegui prima il deploy."
  [[ "${api_status}" == "true" ]] || die "Container api (${API_CONTAINER}) non in esecuzione. Esegui prima il deploy."
}

# Esegue uno script Node.js dentro il container api
# Lo script ha accesso a Prisma, bcryptjs, slugify
run_node() {
  docker exec -i "${API_CONTAINER}" node -e "$1"
}

# ---------------------------------------------------------------------------
# Sezioni di seed
# ---------------------------------------------------------------------------

seed_admin() {
  log "Seeding admin user (disattiva il bootstrap admin)..."

  local admin_email="${ADMIN_EMAIL:-bootstrap-admin@example.invalid}"
  local admin_password="${ADMIN_PASSWORD:-}"
  local admin_name="${ADMIN_NAME:-MindCalm Admin}"

  [[ -n "${admin_password}" ]] || die "ADMIN_PASSWORD non impostata nel .env"

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();

    (async () => {
      const email = '${admin_email}';
      const password = '${admin_password}';
      const name = '${admin_name}';
      const hash = await bcrypt.hash(password, 12);

      const nameParts = name.split(' ');
      const firstName = nameParts[0] || name;
      const lastName = nameParts.slice(1).join(' ') || null;

      const user = await prisma.user.upsert({
        where: { email },
        update: { password: hash, name, firstName, lastName, role: 'ADMIN', isActive: true },
        create: { email, password: hash, name, firstName, lastName, role: 'ADMIN', isActive: true },
      });
      console.log('  Admin: ' + user.email + ' (id: ' + user.id + ')');
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

seed_users() {
  log "Seeding utenti STANDARD di prova..."

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();

    const testUsers = [
      { email: 'enrico.lanni@gmail.com', password: 'Alt53255!', name: 'Enrico Lanni' },
    ];

    (async () => {
      for (const u of testUsers) {
        const hash = await bcrypt.hash(u.password, 12);
        const parts = u.name.split(' ');
        const firstName = parts[0] || u.name;
        const lastName = parts.slice(1).join(' ') || null;

        const user = await prisma.user.upsert({
          where: { email: u.email },
          update: { password: hash, name: u.name, firstName, lastName, role: 'STANDARD', isActive: true },
          create: { email: u.email, password: hash, name: u.name, firstName, lastName, role: 'STANDARD', isActive: true },
        });
        console.log('  Standard: ' + user.email + ' (id: ' + user.id + ')');
      }
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

seed_categories() {
  log "Seeding categorie..."

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const categories = [
      { name: 'Meditazione guidata', description: 'Audio con guida vocale', color: '#4A90D9', icon: 'lotus', sortOrder: 1 },
      { name: 'Respirazione', description: 'Esercizi di respirazione consapevole', color: '#50B860', icon: 'wind', sortOrder: 2 },
      { name: 'Body scan', description: 'Scansione corporea guidata', color: '#E8A040', icon: 'body', sortOrder: 3 },
      { name: 'Suoni della natura', description: 'Paesaggi sonori naturali per il relax', color: '#8B5CF6', icon: 'nature', sortOrder: 4 },
      { name: 'Sleep', description: 'Audio per favorire il sonno', color: '#6366F1', icon: 'moon', sortOrder: 5 },
    ];

    (async () => {
      for (const cat of categories) {
        await prisma.category.upsert({
          where: { name: cat.name },
          update: cat,
          create: cat,
        });
        console.log('  Categoria: ' + cat.name);
      }
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

seed_tags() {
  log "Seeding tag..."

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const slugify = require('slugify');
    const prisma = new PrismaClient();

    const tags = [
      { label: 'Ansia', aliases: ['stress', 'agitazione'], sortOrder: 1 },
      { label: 'Respirazione', aliases: ['respiro', 'breathing'], sortOrder: 2 },
      { label: 'Principianti', aliases: ['inizio', 'base'], sortOrder: 3 },
      { label: 'Sonno', aliases: ['dormire', 'sleep'], sortOrder: 4 },
      { label: 'Focus', aliases: ['concentrazione', 'attenzione'], sortOrder: 5 },
      { label: 'Rilassamento', aliases: ['relax', 'calma'], sortOrder: 6 },
      { label: 'Avanzato', aliases: ['expert', 'esperto'], sortOrder: 7 },
      { label: 'Mattina', aliases: ['risveglio', 'morning'], sortOrder: 8 },
      { label: 'Sera', aliases: ['notte', 'evening'], sortOrder: 9 },
    ];

    (async () => {
      for (const tag of tags) {
        const slug = slugify(tag.label, { lower: true, strict: true, trim: true });
        await prisma.tag.upsert({
          where: { slug },
          update: {
            label: tag.label,
            sortOrder: tag.sortOrder,
            isActive: true,
            aliases: {
              deleteMany: {},
              create: tag.aliases.map(alias => ({ alias })),
            },
          },
          create: {
            label: tag.label,
            slug,
            sortOrder: tag.sortOrder,
            isActive: true,
            aliases: {
              create: tag.aliases.map(alias => ({ alias })),
            },
          },
        });
        console.log('  Tag: ' + tag.label + ' (' + slug + ')');
      }
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

seed_smtp() {
  log "Seeding impostazioni SMTP..."

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    (async () => {
      const settings = await prisma.smtpSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          host: process.env.SMTP_HOST || 'localhost',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          username: null,
          passwordEncrypted: null,
          fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@mindcalm.local',
          fromName: 'MindCalm',
        },
      });
      console.log('  SMTP: ' + settings.host + ':' + settings.port + ' from=' + settings.fromEmail);
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

seed_policies() {
  log "Seeding Terms Policy..."

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    (async () => {
      // --- Terms Policy ---
      const existingTerms = await prisma.termsPolicy.findFirst({ include: { currentVersion: true } });
      if (existingTerms?.status === 'PUBLISHED' && existingTerms.currentVersionId) {
        console.log('  Terms Policy: gia presente, skip');
      } else if (!existingTerms) {
        const policy = await prisma.termsPolicy.create({ data: { status: 'PUBLISHED' } });
        const version = await prisma.termsPolicyVersion.create({
          data: {
            termsPolicyId: policy.id,
            versionNumber: 1,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            title: 'Termini e condizioni MindCalm',
            buttonLabel: 'Accetto i termini',
            html: '<p>Usando MindCalm accetti i termini di utilizzo del servizio, inclusi accesso personale, corretto uso dei contenuti e rispetto delle credenziali fornite.</p><p>L\\'accesso ai contenuti richiede una licenza valida e puo essere sospeso in caso di abuso o violazione delle regole d\\'uso.</p>',
          },
        });
        await prisma.termsPolicy.update({
          where: { id: policy.id },
          data: { currentVersionId: version.id },
        });
        console.log('  Terms Policy: creata (v1, PUBLISHED)');
      } else {
        console.log('  Terms Policy: esiste ma non pubblicata, skip');
      }

      // --- Subscription Policy ---
      const existingSub = await prisma.subscriptionPolicy.findFirst();
      if (existingSub) {
        console.log('  Subscription Policy: gia presente, skip');
        return;
      }

      const subPolicy = await prisma.subscriptionPolicy.create({
        data: { status: 'PUBLISHED', subscribeEnabled: true, subscribeConfirmEmail: true },
      });
      const subVersion = await prisma.subscriptionPolicyVersion.create({
        data: {
          subscriptionPolicyId: subPolicy.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          title: 'Informativa sulla privacy',
          html: '<p>I tuoi dati verranno trattati nel rispetto del GDPR per l\\'invio di comunicazioni relative ai servizi MindCalm.</p>',
          buttonLabel: 'Iscriviti alla newsletter',
        },
      });
      await prisma.subscriptionPolicy.update({
        where: { id: subPolicy.id },
        data: { currentVersionId: subVersion.id },
      });

      // Consent formulas
      const newsletterFormula = await prisma.consentFormula.create({
        data: { subscriptionPolicyId: subPolicy.id, code: 'newsletter', required: false, status: 'ACTIVE' },
      });
      const nlVersion = await prisma.consentFormulaVersion.create({
        data: {
          consentFormulaId: newsletterFormula.id,
          subscriptionPolicyVersionId: subVersion.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          title: 'Newsletter',
          text: 'Desidero ricevere la newsletter di MindCalm con consigli sulla mindfulness, nuovi contenuti e aggiornamenti.',
        },
      });
      await prisma.consentFormula.update({
        where: { id: newsletterFormula.id },
        data: { currentVersionId: nlVersion.id },
      });

      const marketingFormula = await prisma.consentFormula.create({
        data: { subscriptionPolicyId: subPolicy.id, code: 'marketing', required: false, status: 'ACTIVE' },
      });
      const mkVersion = await prisma.consentFormulaVersion.create({
        data: {
          consentFormulaId: marketingFormula.id,
          subscriptionPolicyVersionId: subVersion.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          title: 'Comunicazioni promozionali',
          text: 'Acconsento a ricevere comunicazioni promozionali relative a eventi, ritiri e iniziative MindCalm.',
        },
      });
      await prisma.consentFormula.update({
        where: { id: marketingFormula.id },
        data: { currentVersionId: mkVersion.id },
      });

      console.log('  Subscription Policy: creata (v1, PUBLISHED, 2 consent formulas)');
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

seed_demo() {
  log "Seeding dati demo..."

  # Notification settings
  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    (async () => {
      await prisma.notificationScheduleSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          immediateHourUtc: 9,
          weeklyHourUtc: 9,
          weeklyDayOfWeek: 1,
          monthlyHourUtc: 9,
          monthlyDayOfMonth: 1,
          batchSize: 20,
          maxAttempts: 5,
          retryBaseDelayMinutes: 5,
          lockTimeoutMinutes: 15,
          retentionDays: 30,
        },
      });
      console.log('  Notification settings: OK');
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "

  # Contatti demo
  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const contacts = [
      { id: 'demo-contact-1', email: 'giulia.ferrari@example.com', firstName: 'Giulia', lastName: 'Ferrari', status: 'ACTIVE' },
      { id: 'demo-contact-2', email: 'luca.romano@example.com', firstName: 'Luca', lastName: 'Romano', status: 'ACTIVE' },
      { id: 'demo-contact-3', email: 'sara.colombo@example.com', firstName: 'Sara', lastName: 'Colombo', status: 'ACTIVE' },
      { id: 'demo-contact-4', email: 'marco.bianchi@example.com', firstName: 'Marco', lastName: 'Bianchi', status: 'ACTIVE' },
      { id: 'demo-contact-5', email: 'anna.ricci@example.com', firstName: 'Anna', lastName: 'Ricci', status: 'ACTIVE' },
      { id: 'demo-contact-6', email: 'paolo.moretti@example.com', firstName: 'Paolo', lastName: 'Moretti', status: 'ACTIVE' },
      { id: 'demo-contact-7', email: 'elena.galli@example.com', firstName: 'Elena', lastName: 'Galli', status: 'ACTIVE' },
      { id: 'demo-contact-8', email: 'disiscritto@example.com', firstName: 'Roberto', lastName: 'Neri', status: 'SUPPRESSED', suppressedAt: new Date('2026-04-01T10:00:00Z'), suppressionReason: 'Richiesta utente' },
    ];

    (async () => {
      for (const { id, ...data } of contacts) {
        await prisma.contact.upsert({ where: { id }, update: {}, create: { id, ...data } });
      }
      console.log('  Contatti: ' + contacts.length);
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "

  # Codici invito
  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    (async () => {
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (!admin) { console.log('  Codici invito: nessun admin, skip'); return; }

      const codes = [
        { id: 'demo-invite-active-1', code: 'MINDCALM-PROVA-2026', licenseDurationDays: 90, maxRedemptions: 10, redemptionsCount: 0, status: 'ACTIVE', expiresAt: new Date('2026-12-31T23:59:59Z'), notes: 'Codice promozionale per il lancio' },
        { id: 'demo-invite-active-2', code: 'BENVENUTO-30', licenseDurationDays: 30, maxRedemptions: 50, redemptionsCount: 3, status: 'ACTIVE', expiresAt: new Date('2026-09-30T23:59:59Z'), notes: 'Benvenuto 30 giorni gratuiti' },
        { id: 'demo-invite-active-3', code: 'WORKSHOP-ROMA', licenseDurationDays: 60, maxRedemptions: 25, redemptionsCount: 0, status: 'ACTIVE', expiresAt: new Date('2026-06-30T23:59:59Z'), notes: 'Partecipanti workshop Roma' },
      ];

      for (const { id, ...data } of codes) {
        await prisma.inviteCode.upsert({
          where: { id },
          update: {},
          create: { id, ...data, createdByUserId: admin.id },
        });
      }
      console.log('  Codici invito: ' + codes.length);
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "

  # Post demo
  run_node "
    const { PrismaClient } = require('@prisma/client');
    const slugify = require('slugify');
    const prisma = new PrismaClient();

    const posts = [
      {
        id: 'demo-post-1',
        title: 'Cos\\'e la mindfulness e perche fa bene',
        body: '<h2>Introduzione alla mindfulness</h2><p>La mindfulness e la pratica di portare l\\'attenzione al momento presente in modo intenzionale e senza giudizio.</p><p>Numerosi studi hanno dimostrato che la pratica regolare della mindfulness puo migliorare la concentrazione, ridurre i livelli di cortisolo e favorire un maggiore equilibrio emotivo.</p>',
        bodyText: 'Introduzione alla mindfulness. La mindfulness e la pratica di portare l\\'attenzione al momento presente.',
        excerpt: 'Scopri cos\\'e la mindfulness, come funziona e quali benefici puo portare nella tua vita quotidiana.',
        author: 'Dr.ssa Maria Rossi',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-01T09:00:00Z'),
        tagSlugs: ['principianti'],
      },
      {
        id: 'demo-post-2',
        title: 'Respirazione diaframmatica: guida pratica',
        body: '<h2>Impara a respirare con il diaframma</h2><p>La respirazione diaframmatica e una tecnica fondamentale per calmare il sistema nervoso.</p>',
        bodyText: 'Impara a respirare con il diaframma.',
        excerpt: 'Una guida passo-passo alla respirazione diaframmatica per ridurre stress e ansia.',
        author: 'Marco Bianchi',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-10T09:00:00Z'),
        tagSlugs: ['respirazione', 'principianti'],
      },
      {
        id: 'demo-post-3',
        title: 'Gestire l\\'ansia con la meditazione',
        body: '<h2>Meditazione come strumento anti-ansia</h2><p>L\\'ansia e una risposta naturale del corpo allo stress, ma quando diventa cronica puo compromettere la qualita della vita.</p>',
        bodyText: 'Meditazione come strumento anti-ansia.',
        excerpt: 'Come la meditazione puo aiutarti a gestire l\\'ansia quotidiana.',
        author: 'Dr.ssa Maria Rossi',
        visibility: 'REGISTERED',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-03-18T09:00:00Z'),
        tagSlugs: ['ansia'],
      },
    ];

    (async () => {
      const tags = await prisma.tag.findMany();
      const tagMap = Object.fromEntries(tags.map(t => [t.slug, t.id]));

      for (const post of posts) {
        const slug = slugify(post.title, { lower: true, strict: true, trim: true });
        const tagConnections = post.tagSlugs.filter(s => tagMap[s]).map(s => ({ tag: { connect: { id: tagMap[s] } } }));

        await prisma.post.upsert({
          where: { id: post.id },
          update: {
            title: post.title, slug, body: post.body, bodyText: post.bodyText,
            excerpt: post.excerpt, author: post.author, visibility: post.visibility,
            status: post.status, publishedAt: post.publishedAt,
            postTags: { deleteMany: {}, create: tagConnections },
          },
          create: {
            id: post.id, title: post.title, slug, body: post.body, bodyText: post.bodyText,
            excerpt: post.excerpt, author: post.author, visibility: post.visibility,
            status: post.status, publishedAt: post.publishedAt,
            postTags: { create: tagConnections },
          },
        });
      }
      console.log('  Post: ' + posts.length);
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "

  # Eventi demo
  run_node "
    const { PrismaClient } = require('@prisma/client');
    const slugify = require('slugify');
    const prisma = new PrismaClient();

    const events = [
      {
        id: 'demo-event-1',
        title: 'Ritiro di meditazione primaverile',
        body: '<h2>Un weekend di pratica immersi nella natura</h2><p>Un ritiro residenziale di due giorni dedicato alla meditazione e alla mindfulness.</p>',
        bodyText: 'Un weekend di pratica immersi nella natura.',
        excerpt: 'Due giorni di meditazione e mindfulness immersi nella natura delle colline toscane.',
        organizer: 'MindCalm',
        city: 'Firenze',
        venue: 'Agriturismo Il Silenzio',
        startsAt: new Date('2026-05-10T09:00:00Z'),
        endsAt: new Date('2026-05-11T17:00:00Z'),
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-04-01T09:00:00Z'),
      },
      {
        id: 'demo-event-2',
        title: 'Meditazione serale al parco',
        body: '<h2>Pratica guidata all\\'aperto</h2><p>Ogni mercoledi sera, ci ritroviamo al Parco Sempione per una sessione di meditazione guidata.</p>',
        bodyText: 'Pratica guidata all\\'aperto.',
        excerpt: 'Sessione settimanale di meditazione guidata all\\'aperto al Parco Sempione.',
        organizer: 'MindCalm Milano',
        city: 'Milano',
        venue: 'Parco Sempione',
        startsAt: new Date('2026-05-07T18:30:00Z'),
        endsAt: new Date('2026-05-07T19:15:00Z'),
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-04-05T09:00:00Z'),
      },
    ];

    (async () => {
      for (const event of events) {
        const slug = slugify(event.title, { lower: true, strict: true, trim: true });
        await prisma.event.upsert({
          where: { id: event.id },
          update: { ...event, slug, id: undefined },
          create: { ...event, slug },
        });
      }
      console.log('  Eventi: ' + events.length);
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "

  log "Dati demo inseriti"
}

show_db_status() {
  log "Stato database"

  run_node "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    (async () => {
      const tables = [
        ['Utenti',              prisma.user.count()],
        ['Categorie',           prisma.category.count()],
        ['Tag',                 prisma.tag.count()],
        ['Audio',               prisma.audio.count()],
        ['Post',                prisma.post.count()],
        ['Eventi',              prisma.event.count()],
        ['Codici invito',       prisma.inviteCode.count()],
        ['Contatti',            prisma.contact.count()],
        ['Consensi',            prisma.consent.count()],
        ['Analytics',           prisma.analyticsEvent.count()],
        ['Audit log',           prisma.auditLog.count()],
        ['SMTP settings',       prisma.smtpSettings.count()],
        ['Terms policy',        prisma.termsPolicy.count()],
        ['Subscription policy', prisma.subscriptionPolicy.count()],
        ['Outbox',              prisma.contentPublicationOutbox.count()],
      ];

      const counts = await Promise.all(tables.map(t => t[1]));
      const labels = tables.map(t => t[0]);

      console.log('  ' + '-'.repeat(36));
      labels.forEach((label, i) => {
        console.log('  ' + label.padEnd(24) + counts[i]);
      });
      console.log('  ' + '-'.repeat(36));
    })()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.\$disconnect());
  "
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  parse_args "$@"
  check_prerequisites
  load_env_file
  check_containers_running

  if [[ "${SHOW_STATUS}" == "true" ]]; then
    show_db_status
    # Se --status e' l'unica sezione, esci
    if [[ "${SEED_ADMIN}${SEED_USERS}${SEED_CATEGORIES}${SEED_TAGS}${SEED_SMTP}${SEED_POLICIES}${SEED_DEMO}" == "falsefalsefalsefalsefalsefalsefalse" ]]; then
      exit 0
    fi
  fi

  # Riepilogo sezioni
  local sections=""
  [[ "${SEED_ADMIN}"      == "true" ]] && sections="${sections} admin"
  [[ "${SEED_USERS}"      == "true" ]] && sections="${sections} users"
  [[ "${SEED_CATEGORIES}" == "true" ]] && sections="${sections} categories"
  [[ "${SEED_TAGS}"       == "true" ]] && sections="${sections} tags"
  [[ "${SEED_SMTP}"       == "true" ]] && sections="${sections} smtp"
  [[ "${SEED_POLICIES}"   == "true" ]] && sections="${sections} policies"
  [[ "${SEED_DEMO}"       == "true" ]] && sections="${sections} demo"

  log "Sezioni selezionate:${sections}"
  confirm "Procedere con il seeding?"

  [[ "${SEED_ADMIN}"      == "true" ]] && seed_admin
  [[ "${SEED_USERS}"      == "true" ]] && seed_users
  [[ "${SEED_CATEGORIES}" == "true" ]] && seed_categories
  [[ "${SEED_TAGS}"       == "true" ]] && seed_tags
  [[ "${SEED_SMTP}"       == "true" ]] && seed_smtp
  [[ "${SEED_POLICIES}"   == "true" ]] && seed_policies
  [[ "${SEED_DEMO}"       == "true" ]] && seed_demo

  log ""
  show_db_status
  log "Seed completato"
}

main "$@"
