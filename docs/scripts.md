# Script e comandi MindCalm

Riferimento completo dei comandi disponibili: script di deploy/seed in produzione, script di sviluppo e comandi npm del monorepo.

---

## 1. Deploy produzione — `docker/production-notraefik/deploy.sh`

Script bash per deploy/aggiornamento dello stack Docker dietro gateway esterno (Traefik gestito altrove).

**Cosa fa:**
- Verifica prerequisiti (`git`, `docker`, `docker compose v2`, `curl`).
- Se `.env` non esiste, lo crea da `.env.example`.
- Carica le variabili da `.env` (`DEPLOY_BRANCH`, `API_PORT`, `HEALTHCHECK_ATTEMPTS`, ...).
- Rifiuta il deploy se il worktree git ha modifiche tracciate non committate.
- Allinea il branch locale al branch target e fa `git pull --ff-only origin <branch>`.
- Crea le directory dati bind-mounted: `data/postgres`, `data/audio`, `data/hls`, `data/images`.
- Build immagini (`docker compose build --pull`) e riavvio stack (`docker compose up -d`).
- Attende gli health check HTTP su: `/api/health` (200), `/` (200), `/admin/` (200/302), `/admin/login` (200).

**Opzioni:**

| Flag            | Effetto                                                                                   |
|-----------------|-------------------------------------------------------------------------------------------|
| `--keep-data`   | **Default**. Aggiornamento conservativo: preserva database, storage, volumi e `.env`.     |
| `--reset-data`  | Reinstallazione totale: `docker compose down --volumes --rmi local` + `rm -rf data/` + backup e ricreazione di `.env` da `.env.example`. |
| `--yes`         | Salta la conferma interattiva.                                                            |
| `--branch NAME` | Forza il branch da deployare (default: `DEPLOY_BRANCH` da `.env` o branch locale).        |
| `--help`        | Stampa l'help.                                                                            |

**Esempi:**

```bash
cd /opt/mindcalm/docker/production-notraefik

./deploy.sh                           # deploy conservativo, chiede conferma
./deploy.sh --yes                     # deploy conservativo senza prompt
./deploy.sh --branch main --yes       # forza branch main
./deploy.sh --reset-data --yes        # DISTRUGGE dati e ricrea tutto da zero
```

**Attenzione:** `--reset-data` elimina il database, i file audio/HLS/immagini caricati, i volumi Docker e **sovrascrive il `.env` dai valori in `.env.example`** (ne salva prima un backup in `.env.bak.<timestamp>`). Non reversibile se non ripristinando manualmente il backup.

---

## 2. Seed produzione — `docker/production-notraefik/seed.sh`

Script bash per popolare il database in produzione. Esegue script Node dentro il container API (`mindcalm_notraefik_api`) usando il client Prisma già presente nell'immagine.

**Prerequisiti:**
- Container `mindcalm_notraefik_api` e `mindcalm_notraefik_postgres` in esecuzione (lancia prima `./deploy.sh`).
- `.env` presente con `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.

**Sezioni disponibili (almeno una richiesta):**

| Flag            | Cosa crea/aggiorna                                                                                           |
|-----------------|--------------------------------------------------------------------------------------------------------------|
| `--admin`       | Utente ADMIN (da `ADMIN_EMAIL`/`ADMIN_PASSWORD`). **Disattiva il bootstrap admin.**                          |
| `--users`       | Utenti STANDARD di prova (`enrico.lanni@gmail.com` / `Alt53255!`). **Mantiene il bootstrap admin attivo.**   |
| `--categories`  | 5 categorie default (Meditazione guidata, Respirazione, Body scan, Suoni natura, Sleep).                     |
| `--tags`        | 9 tag default (Ansia, Respirazione, Principianti, Sonno, Focus, Rilassamento, ...).                          |
| `--smtp`        | Record `smtpSettings` con valori da `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM_EMAIL`.                               |
| `--policies`    | Terms Policy + Subscription Policy in italiano, con formula consenso newsletter + marketing.                 |
| `--demo`        | Dati demo: notification settings, 8 contatti, 3 codici invito, 3 post, 2 eventi.                             |
| `--all`         | Tutti i dati di prova **esclusi gli utenti**: `categories + tags + smtp + policies + demo`. Il bootstrap admin resta attivo. |

**Opzioni:**

| Flag        | Effetto                                                           |
|-------------|-------------------------------------------------------------------|
| `--status`  | Mostra il conteggio righe per tabella (puo essere usato da solo). |
| `--yes`     | Salta la conferma interattiva.                                    |
| `--help`    | Stampa l'help.                                                    |

**Esempi:**

```bash
cd /opt/mindcalm/docker/production-notraefik

./seed.sh --status                         # conteggio righe DB (diagnostica)
./seed.sh --all --yes                      # dati di prova senza utenti (bootstrap admin attivo)
./seed.sh --users --yes                    # solo utenti STANDARD di prova
./seed.sh --all --users --yes              # dati di prova + utenti STANDARD, bootstrap ancora attivo
./seed.sh --admin --yes                    # crea admin reale da .env (DISATTIVA il bootstrap)
```

**Upsert idempotente:** tutte le sezioni usano `prisma.*.upsert`, quindi il comando e rilanciabile senza duplicare record.

**Bootstrap admin vs admin seedato:**

- `--all` e `--users` **non creano** nessun admin reale nel DB → il bootstrap admin da `.env` resta attivo e il primo login passa dal wizard di setup (`/bootstrap-setup`).
- `--admin` crea un admin reale con email/password da `.env` → `hasActiveAdminUsers()` torna `true` → bootstrap disattivato, login diretto come admin reale.
- Il flusso consigliato per un ambiente di prova: `./seed.sh --all --users --yes`, poi login col bootstrap admin e completamento del wizard per creare l'admin reale. `--admin` si usa solo se vuoi saltare il wizard.

---

## 3. Script di sviluppo — `scripts/dev/`

Lanciati tramite npm dalla root del repo.

| Comando           | Descrizione                                                                                           |
|-------------------|-------------------------------------------------------------------------------------------------------|
| `npm run dev:start` | Avvia in parallelo backend (`:3300`), frontend (`:5473`), admin (`:5474`) gestendo i PID. Killa processi residui. |
| `npm run dev:stop`  | Stoppa tutti i processi avviati da `dev:start` e libera le porte 3300/5473/5474.                   |
| `npm run dev:backend`  | Solo backend in watch mode (`tsx watch src/index.ts`).                                          |
| `npm run dev:frontend` | Solo frontend Vite.                                                                             |
| `npm run dev:admin`    | Solo admin Vite.                                                                                |
| `npm run dev`          | Tutti e tre via `concurrently` (alternativa a `dev:start`, no PID tracking).                   |

**Flusso tipico primo avvio:**

```bash
cd docker/development && docker compose up -d       # Postgres + MailHog
cd ../..
npm install
cp .env.example .env
cd backend && npx prisma migrate dev && npx tsx prisma/seed.ts && cd ..
npm run dev:start
```

Accessi:
- Frontend: http://localhost:5473
- Admin: http://localhost:5474/admin/
- API: http://localhost:3300
- MailHog UI: http://localhost:3326

---

## 4. Comandi build e test (root)

| Comando                  | Descrizione                                                 |
|--------------------------|-------------------------------------------------------------|
| `npm run build`          | Build frontend + admin (ogni workspace).                    |
| `npm run build:frontend` | Build solo frontend (`vue-tsc --noEmit && vite build`).     |
| `npm run build:admin`    | Build solo admin.                                           |
| `npm run test:backend`   | Test backend (Vitest + `prisma generate`).                  |
| `npm run db:migrate`     | Proxy a `backend` → `prisma migrate dev` (dev).             |
| `npm run db:seed`        | Proxy a `backend` → `tsx prisma/seed.ts` (dev).             |

---

## 5. Comandi backend (`backend/package.json`)

Usabili con `npm run <script> --workspace=backend` dalla root, oppure direttamente da `backend/`.

| Comando                          | Descrizione                                                                             |
|----------------------------------|-----------------------------------------------------------------------------------------|
| `dev`                            | `tsx watch src/index.ts` — backend in hot reload.                                       |
| `build`                          | `prisma generate && tsc` — build JS in `dist/`.                                         |
| `start`                          | `node dist/index.js` — avvia build prod.                                                |
| `test`                           | `prisma generate && vitest run`.                                                        |
| `db:migrate`                     | `prisma migrate dev` — applica migrazioni in dev e rigenera client.                     |
| `db:migrate:deploy`              | `prisma migrate deploy` — applica migrazioni in produzione (no prompt, no regen).       |
| `db:seed`                        | `tsx prisma/seed.ts` — seed DB di sviluppo con admin + demo user + contenuti demo.      |
| `db:generate`                    | `prisma generate` — rigenera il client Prisma.                                          |
| `audio:backfill-hls`             | `tsx src/scripts/backfillAudioToHls.ts` — converte audio legacy in manifest HLS.        |
| `storage:cleanup`                | `tsx src/scripts/reconcileStorage.ts` — rimuove file storage orfani (senza row in DB).  |

---

## 6. Comandi frontend (`frontend/package.json`)

| Comando         | Descrizione                                |
|-----------------|--------------------------------------------|
| `dev`           | `vite --port 5473`                         |
| `build`         | `vue-tsc --noEmit && vite build`           |
| `preview`       | `vite preview` (anteprima build locale).   |
| `test`          | `vitest` (watch).                          |
| `test:run`      | `vitest run` (singola passata).            |
| `test:coverage` | `vitest run --coverage`.                   |

---

## 7. Comandi admin (`admin/package.json`)

| Comando   | Descrizione                          |
|-----------|--------------------------------------|
| `dev`     | `vite --port 5474`                   |
| `build`   | `vue-tsc --noEmit && vite build`     |
| `preview` | `vite preview`.                      |

---

## 8. Workflow operativi comuni

### Primo deploy su server pulito (pseudo-produzione, con bootstrap admin)

`.env.example` contiene gia defaults utilizzabili in pseudo-produzione
(`ADMIN_EMAIL=admin@admin.com`, `ADMIN_PASSWORD=admin`, ecc.), quindi il flusso base
non richiede modifiche manuali. Per una produzione reale, prima del deploy
sostituisci `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, `CORS_ORIGIN`.

```bash
ssh utente@server
cd /opt/mindcalm/docker/production-notraefik
./deploy.sh --yes                         # se .env non esiste, lo crea da .env.example
./seed.sh --all --users --yes             # dati + utenti test, bootstrap admin attivo
# apri /admin/login → admin@admin.com / admin (bootstrap)
# il frontend ti redirige a /setup: completa il wizard per creare il primo admin reale
```

### Primo deploy saltando il wizard di bootstrap

Se vuoi un admin reale gia pronto e bypassare il wizard:

```bash
./deploy.sh --yes
./seed.sh --all --users --admin --yes
```

### Aggiornamento produzione conservativo

```bash
cd /opt/mindcalm/docker/production-notraefik
./deploy.sh --yes
```

### Reset completo produzione (perde i dati)

```bash
cd /opt/mindcalm/docker/production-notraefik
./deploy.sh --reset-data --yes
./seed.sh --all --users --yes
```

### Aggiornare solo password admin reale su prod

```bash
cd /opt/mindcalm/docker/production-notraefik
sed -i.bak -e 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=NuovaPassword|' .env
./seed.sh --admin --yes
```

### Verifica stato DB produzione

```bash
cd /opt/mindcalm/docker/production-notraefik
./seed.sh --status
```
