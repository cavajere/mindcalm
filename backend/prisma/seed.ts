import path from 'path'
import { PrismaClient, AudioProcessingStatus, Level, Status, StreamingFormat, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'
import { getAudioDuration, getAudioFormat } from '../src/services/audioService'

const prisma = new PrismaClient()

const DEMO_AUDIO_FILENAME = '6ccc6f43-0b47-49a4-9d21-d3ffe17f6918.mp3'

async function seedUsers() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mindcalm.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123!'
  const demoUserEmail = process.env.DEMO_USER_EMAIL || 'user@mindcalm.com'
  const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'user123!'

  const [adminHash, demoUserHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(demoUserPassword, 12),
  ])

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: adminHash,
      name: 'Admin MindCalm',
      firstName: 'Admin',
      lastName: 'MindCalm',
      phone: '+390000000000',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      password: adminHash,
      name: 'Admin MindCalm',
      firstName: 'Admin',
      lastName: 'MindCalm',
      phone: '+390000000000',
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: demoUserEmail },
    update: {
      password: demoUserHash,
      name: 'Utente Demo',
      firstName: 'Utente',
      lastName: 'Demo',
      phone: '+390000000001',
      role: UserRole.STANDARD,
      isActive: true,
    },
    create: {
      email: demoUserEmail,
      password: demoUserHash,
      name: 'Utente Demo',
      firstName: 'Utente',
      lastName: 'Demo',
      phone: '+390000000001',
      role: UserRole.STANDARD,
      isActive: true,
    },
  })
}

async function seedCategories() {
  const categories = [
    { name: 'Meditazione guidata', description: 'Audio con guida vocale', color: '#4A90D9', icon: 'lotus', sortOrder: 1 },
    { name: 'Respirazione', description: 'Esercizi di respirazione consapevole', color: '#50B860', icon: 'wind', sortOrder: 2 },
    { name: 'Body scan', description: 'Scansione corporea guidata', color: '#E8A040', icon: 'body', sortOrder: 3 },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    })
  }
}

async function seedTags() {
  const tags = [
    { label: 'Ansia', aliases: ['stress', 'agitazione'], sortOrder: 1 },
    { label: 'Respirazione', aliases: ['respiro', 'breathing'], sortOrder: 2 },
    { label: 'Principianti', aliases: ['inizio', 'base'], sortOrder: 3 },
  ]

  for (const tag of tags) {
    const slug = slugify(tag.label, { lower: true, strict: true, trim: true })
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
    })
  }
}

async function seedDemoAudio() {
  const category = await prisma.category.findUnique({
    where: { name: 'Meditazione guidata' },
  })

  if (!category) {
    throw new Error('Categoria demo non trovata')
  }

  const demoAudioPath = path.resolve(process.cwd(), 'storage/audio', DEMO_AUDIO_FILENAME)
  const durationSec = await getAudioDuration(demoAudioPath)
  const audioFormat = getAudioFormat('audio/mpeg')

  const selectedTags = await prisma.tag.findMany({
    where: { slug: { in: ['ansia', 'principianti'] } },
  })

  await prisma.audio.upsert({
    where: { id: 'demo-audio-grounding' },
    update: {
      title: 'Grounding di 5 minuti',
      description: 'Una pratica breve per rallentare il respiro e tornare al corpo.',
      categoryId: category.id,
      level: Level.BEGINNER,
      durationSec,
      audioFile: `audio/${DEMO_AUDIO_FILENAME}`,
      audioOriginalName: DEMO_AUDIO_FILENAME,
      audioDisplayName: DEMO_AUDIO_FILENAME,
      audioFormat,
      audioSize: 8201194,
      streamingFormat: StreamingFormat.DIRECT,
      processingStatus: AudioProcessingStatus.READY,
      hlsManifestPath: null,
      processingError: null,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-12T08:00:00Z'),
      audioTags: {
        deleteMany: {},
        create: selectedTags.map(tag => ({
          tag: { connect: { id: tag.id } },
        })),
      },
    },
    create: {
      id: 'demo-audio-grounding',
      title: 'Grounding di 5 minuti',
      description: 'Una pratica breve per rallentare il respiro e tornare al corpo.',
      categoryId: category.id,
      level: Level.BEGINNER,
      durationSec,
      audioFile: `audio/${DEMO_AUDIO_FILENAME}`,
      audioOriginalName: DEMO_AUDIO_FILENAME,
      audioDisplayName: DEMO_AUDIO_FILENAME,
      audioFormat,
      audioSize: 8201194,
      streamingFormat: StreamingFormat.DIRECT,
      processingStatus: AudioProcessingStatus.READY,
      hlsManifestPath: null,
      processingError: null,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-12T08:00:00Z'),
      audioTags: {
        create: selectedTags.map(tag => ({
          tag: { connect: { id: tag.id } },
        })),
      },
    },
  })
}

async function seedPosts() {
  const tags = await prisma.tag.findMany()
  const tagMap = Object.fromEntries(tags.map(t => [t.slug, t.id]))

  const posts = [
    {
      id: 'demo-post-1',
      title: 'Cos\'è la mindfulness e perché fa bene',
      body: '<h2>Introduzione alla mindfulness</h2><p>La mindfulness è la pratica di portare l\'attenzione al momento presente in modo intenzionale e senza giudizio. Nata dalla tradizione meditativa buddhista, oggi è riconosciuta dalla comunità scientifica come uno strumento efficace per ridurre stress e ansia.</p><p>Numerosi studi hanno dimostrato che la pratica regolare della mindfulness può migliorare la concentrazione, ridurre i livelli di cortisolo e favorire un maggiore equilibrio emotivo.</p><p>Non serve essere esperti per iniziare: bastano pochi minuti al giorno di attenzione consapevole al respiro per notare i primi benefici.</p>',
      bodyText: 'Introduzione alla mindfulness. La mindfulness è la pratica di portare l\'attenzione al momento presente in modo intenzionale e senza giudizio. Nata dalla tradizione meditativa buddhista, oggi è riconosciuta dalla comunità scientifica come uno strumento efficace per ridurre stress e ansia. Numerosi studi hanno dimostrato che la pratica regolare della mindfulness può migliorare la concentrazione, ridurre i livelli di cortisolo e favorire un maggiore equilibrio emotivo. Non serve essere esperti per iniziare: bastano pochi minuti al giorno di attenzione consapevole al respiro per notare i primi benefici.',
      excerpt: 'Scopri cos\'è la mindfulness, come funziona e quali benefici può portare nella tua vita quotidiana.',
      author: 'Dr.ssa Maria Rossi',
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-01T09:00:00Z'),
      tagSlugs: ['principianti'],
    },
    {
      id: 'demo-post-2',
      title: 'Respirazione diaframmatica: guida pratica',
      body: '<h2>Impara a respirare con il diaframma</h2><p>La respirazione diaframmatica è una tecnica fondamentale per calmare il sistema nervoso. Quando respiriamo profondamente usando il diaframma, attiviamo la risposta parasimpatica del corpo, riducendo la frequenza cardiaca e la pressione sanguigna.</p><p><strong>Come praticarla:</strong></p><ol><li>Siediti o sdraiati in posizione comoda</li><li>Appoggia una mano sul petto e una sull\'addome</li><li>Inspira lentamente dal naso per 4 secondi, sentendo l\'addome sollevarsi</li><li>Espira dalla bocca per 6 secondi, sentendo l\'addome abbassarsi</li><li>Ripeti per 5-10 minuti</li></ol><p>Con la pratica costante, questa respirazione diventerà naturale e potrai usarla in qualsiasi momento di stress.</p>',
      bodyText: 'Impara a respirare con il diaframma. La respirazione diaframmatica è una tecnica fondamentale per calmare il sistema nervoso. Quando respiriamo profondamente usando il diaframma, attiviamo la risposta parasimpatica del corpo, riducendo la frequenza cardiaca e la pressione sanguigna. Come praticarla: siediti o sdraiati in posizione comoda, appoggia una mano sul petto e una sull\'addome, inspira lentamente dal naso per 4 secondi, espira dalla bocca per 6 secondi, ripeti per 5-10 minuti.',
      excerpt: 'Una guida passo-passo alla respirazione diaframmatica per ridurre stress e ansia.',
      author: 'Marco Bianchi',
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-10T09:00:00Z'),
      tagSlugs: ['respirazione', 'principianti'],
    },
    {
      id: 'demo-post-3',
      title: 'Gestire l\'ansia con la meditazione',
      body: '<h2>Meditazione come strumento anti-ansia</h2><p>L\'ansia è una risposta naturale del corpo allo stress, ma quando diventa cronica può compromettere la qualità della vita. La meditazione offre un approccio non farmacologico per gestirla.</p><p>La tecnica del <em>body scan</em> è particolarmente efficace: consiste nel portare attenzione a ogni parte del corpo, dalla testa ai piedi, notando le sensazioni senza cercare di cambiarle.</p><p>Un altro approccio utile è la meditazione di <em>ancoraggio al respiro</em>: quando noti che la mente vaga verso pensieri ansiosi, riporta gentilmente l\'attenzione al respiro. Non si tratta di eliminare i pensieri, ma di osservarli senza identificarsi con essi.</p><p>Anche solo 10 minuti al giorno possono fare la differenza nel tempo.</p>',
      bodyText: 'Meditazione come strumento anti-ansia. L\'ansia è una risposta naturale del corpo allo stress, ma quando diventa cronica può compromettere la qualità della vita. La meditazione offre un approccio non farmacologico per gestirla. La tecnica del body scan è particolarmente efficace. Un altro approccio utile è la meditazione di ancoraggio al respiro. Anche solo 10 minuti al giorno possono fare la differenza nel tempo.',
      excerpt: 'Come la meditazione può aiutarti a gestire l\'ansia quotidiana con tecniche semplici ed efficaci.',
      author: 'Dr.ssa Maria Rossi',
      visibility: 'REGISTERED' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-18T09:00:00Z'),
      tagSlugs: ['ansia'],
    },
    {
      id: 'demo-post-4',
      title: 'Meditazione camminata: muoversi in consapevolezza',
      body: '<h2>Meditare senza stare fermi</h2><p>Non tutte le meditazioni richiedono di stare seduti. La meditazione camminata è una pratica antica che unisce movimento e consapevolezza, ideale per chi fatica a rimanere immobile.</p><p><strong>Come iniziare:</strong></p><ul><li>Scegli un percorso breve (10-20 passi)</li><li>Cammina lentamente, prestando attenzione a ogni fase del passo: sollevamento, spostamento, appoggio</li><li>Sincronizza il respiro con il ritmo dei passi</li><li>Quando la mente vaga, riporta l\'attenzione alle sensazioni dei piedi a contatto con il suolo</li></ul><p>Questa pratica è perfetta per le pause durante la giornata lavorativa o per una passeggiata nel parco.</p>',
      bodyText: 'Meditare senza stare fermi. Non tutte le meditazioni richiedono di stare seduti. La meditazione camminata è una pratica antica che unisce movimento e consapevolezza. Scegli un percorso breve, cammina lentamente, sincronizza il respiro con il ritmo dei passi. Questa pratica è perfetta per le pause durante la giornata lavorativa.',
      excerpt: 'Scopri come praticare la meditazione camminata, una tecnica ideale per chi preferisce meditare in movimento.',
      author: 'Luca Verdi',
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-01T09:00:00Z'),
      tagSlugs: ['principianti'],
    },
    {
      id: 'demo-post-5',
      title: 'Il potere del silenzio nella vita moderna',
      body: '<h2>Riscoprire il silenzio</h2><p>Viviamo in un mondo saturo di stimoli sonori: notifiche, traffico, musica di sottofondo. Il silenzio è diventato un lusso raro, eppure è uno degli strumenti più potenti per il benessere mentale.</p><p>La neuroscienza ha dimostrato che periodi di silenzio favoriscono la rigenerazione neurale e migliorano la capacità di elaborazione delle informazioni. Anche soli 2 minuti di silenzio possono abbassare la pressione sanguigna più della musica rilassante.</p><p><strong>Suggerimenti pratici:</strong></p><ul><li>Inizia la giornata senza accendere subito lo smartphone</li><li>Dedica 5 minuti al silenzio prima di dormire</li><li>Prova a mangiare un pasto in silenzio, assaporando ogni boccone</li><li>Crea una "zona silenziosa" in casa, anche piccola</li></ul><p>Il silenzio non è assenza, ma spazio per ascoltare sé stessi.</p>',
      bodyText: 'Riscoprire il silenzio. Viviamo in un mondo saturo di stimoli sonori. Il silenzio è diventato un lusso raro, eppure è uno degli strumenti più potenti per il benessere mentale. La neuroscienza ha dimostrato che periodi di silenzio favoriscono la rigenerazione neurale. Il silenzio non è assenza, ma spazio per ascoltare sé stessi.',
      excerpt: 'Perché il silenzio è fondamentale per la salute mentale e come integrarlo nella routine quotidiana.',
      author: 'Dr.ssa Maria Rossi',
      visibility: 'REGISTERED' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-10T09:00:00Z'),
      tagSlugs: ['ansia'],
    },
  ]

  for (const post of posts) {
    const slug = slugify(post.title, { lower: true, strict: true, trim: true })
    const tagConnections = post.tagSlugs
      .filter(s => tagMap[s])
      .map(s => ({ tag: { connect: { id: tagMap[s] } } }))

    await prisma.post.upsert({
      where: { id: post.id },
      update: {
        title: post.title,
        slug,
        body: post.body,
        bodyText: post.bodyText,
        excerpt: post.excerpt,
        author: post.author,
        visibility: post.visibility,
        status: post.status,
        publishedAt: post.publishedAt,
        postTags: {
          deleteMany: {},
          create: tagConnections,
        },
      },
      create: {
        id: post.id,
        title: post.title,
        slug,
        body: post.body,
        bodyText: post.bodyText,
        excerpt: post.excerpt,
        author: post.author,
        visibility: post.visibility,
        status: post.status,
        publishedAt: post.publishedAt,
        postTags: {
          create: tagConnections,
        },
      },
    })
  }
}

async function seedEvents() {
  const events = [
    {
      id: 'demo-event-1',
      title: 'Ritiro di meditazione primaverile',
      body: '<h2>Un weekend di pratica immersi nella natura</h2><p>Un ritiro residenziale di due giorni dedicato alla meditazione e alla mindfulness. Immersi nel verde delle colline toscane, esploreremo diverse tecniche meditative: dalla meditazione seduta al body scan, dalla camminata consapevole alla meditazione con i suoni della natura.</p><p><strong>Programma:</strong></p><ul><li>Sabato mattina: arrivo e meditazione di apertura</li><li>Sabato pomeriggio: workshop sulla respirazione consapevole</li><li>Domenica mattina: pratica silenziosa e body scan</li><li>Domenica pomeriggio: condivisione e chiusura</li></ul><p>Il ritiro è aperto a tutti i livelli di esperienza. Pasti vegetariani inclusi.</p>',
      bodyText: 'Un weekend di pratica immersi nella natura. Un ritiro residenziale di due giorni dedicato alla meditazione e alla mindfulness. Il ritiro è aperto a tutti i livelli di esperienza. Pasti vegetariani inclusi.',
      excerpt: 'Due giorni di meditazione e mindfulness immersi nella natura delle colline toscane.',
      organizer: 'MindCalm',
      city: 'Firenze',
      venue: 'Agriturismo Il Silenzio',
      startsAt: new Date('2026-05-10T09:00:00Z'),
      endsAt: new Date('2026-05-11T17:00:00Z'),
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-01T09:00:00Z'),
    },
    {
      id: 'demo-event-2',
      title: 'Meditazione serale al parco',
      body: '<h2>Pratica guidata all\'aperto</h2><p>Ogni mercoledì sera, ci ritroviamo al Parco Sempione per una sessione di meditazione guidata all\'aperto. La pratica dura circa 45 minuti e include esercizi di respirazione, meditazione seduta e un breve momento di condivisione.</p><p>Porta con te un tappetino o una coperta. In caso di pioggia, ci spostiamo sotto il porticato del Castello Sforzesco.</p><p>La partecipazione è gratuita e aperta a tutti.</p>',
      bodyText: 'Pratica guidata all\'aperto. Ogni mercoledì sera al Parco Sempione per una sessione di meditazione guidata. La pratica dura circa 45 minuti. La partecipazione è gratuita e aperta a tutti.',
      excerpt: 'Sessione settimanale di meditazione guidata all\'aperto al Parco Sempione.',
      organizer: 'MindCalm Milano',
      city: 'Milano',
      venue: 'Parco Sempione',
      startsAt: new Date('2026-05-07T18:30:00Z'),
      endsAt: new Date('2026-05-07T19:15:00Z'),
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-05T09:00:00Z'),
    },
    {
      id: 'demo-event-3',
      title: 'Workshop: gestire lo stress lavorativo',
      body: '<h2>Tecniche di mindfulness per il workplace</h2><p>Un workshop intensivo di mezza giornata dedicato a professionisti che vogliono integrare la mindfulness nella routine lavorativa. Impareremo tecniche pratiche per gestire lo stress, migliorare la concentrazione e prevenire il burnout.</p><p><strong>Temi trattati:</strong></p><ul><li>Micro-meditazioni da scrivania (3-5 minuti)</li><li>Respirazione per le riunioni stressanti</li><li>Gestione consapevole delle email e delle notifiche</li><li>Pause rigenerative durante la giornata</li></ul><p>Materiale didattico e accesso alle registrazioni audio inclusi.</p>',
      bodyText: 'Tecniche di mindfulness per il workplace. Un workshop intensivo dedicato a professionisti. Impareremo tecniche pratiche per gestire lo stress, migliorare la concentrazione e prevenire il burnout.',
      excerpt: 'Workshop intensivo su tecniche di mindfulness per la gestione dello stress lavorativo.',
      organizer: 'Dr.ssa Maria Rossi',
      city: 'Roma',
      venue: 'Spazio Zen, Via del Corso 120',
      startsAt: new Date('2026-05-15T09:00:00Z'),
      endsAt: new Date('2026-05-15T13:00:00Z'),
      visibility: 'REGISTERED' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-08T09:00:00Z'),
    },
    {
      id: 'demo-event-4',
      title: 'Cerchio di meditazione e condivisione',
      body: '<h2>Uno spazio sicuro per praticare insieme</h2><p>Un incontro mensile in cui pratichiamo insieme e condividiamo le esperienze del nostro percorso di mindfulness. Il cerchio è uno spazio protetto dove ognuno può esprimersi liberamente.</p><p>La sessione inizia con 20 minuti di meditazione guidata, seguiti da un momento di condivisione aperta. Non è obbligatorio parlare: ascoltare è già partecipare.</p><p>Consigliato per chi pratica già da qualche mese e desidera confrontarsi con altri praticanti.</p>',
      bodyText: 'Uno spazio sicuro per praticare insieme. Un incontro mensile per praticare e condividere. Il cerchio è uno spazio protetto dove ognuno può esprimersi liberamente.',
      excerpt: 'Incontro mensile di pratica meditativa e condivisione per praticanti di ogni livello.',
      organizer: 'MindCalm Torino',
      city: 'Torino',
      venue: 'Centro Olistico Armonia',
      startsAt: new Date('2026-05-20T19:00:00Z'),
      endsAt: new Date('2026-05-20T21:00:00Z'),
      visibility: 'REGISTERED' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-12T09:00:00Z'),
    },
    {
      id: 'demo-event-5',
      title: 'Giornata mondiale della meditazione',
      body: '<h2>Celebriamo insieme la pratica meditativa</h2><p>In occasione della Giornata Mondiale della Meditazione, MindCalm organizza una giornata intera di pratiche gratuite aperte a tutti. Dalle meditazioni guidate per principianti alle sessioni avanzate di vipassana, ci sarà qualcosa per ogni livello.</p><p><strong>Programma:</strong></p><ul><li>09:00 - Meditazione di apertura (tutti i livelli)</li><li>10:30 - Workshop respirazione per principianti</li><li>12:00 - Meditazione camminata nel giardino</li><li>14:00 - Body scan guidato</li><li>15:30 - Sessione avanzata di vipassana</li><li>17:00 - Meditazione di chiusura e cerchio finale</li></ul><p>Ingresso gratuito. Si consiglia di portare un cuscino da meditazione.</p>',
      bodyText: 'Celebriamo insieme la pratica meditativa. MindCalm organizza una giornata intera di pratiche gratuite. Dalle meditazioni per principianti alle sessioni avanzate di vipassana. Ingresso gratuito.',
      excerpt: 'Una giornata intera di pratiche meditative gratuite aperte a tutti, dal principiante all\'esperto.',
      organizer: 'MindCalm',
      city: 'Bologna',
      venue: 'Giardini Margherita',
      startsAt: new Date('2026-05-21T09:00:00Z'),
      endsAt: new Date('2026-05-21T18:00:00Z'),
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-14T09:00:00Z'),
    },
  ]

  for (const event of events) {
    const slug = slugify(event.title, { lower: true, strict: true, trim: true })

    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        title: event.title,
        slug,
        body: event.body,
        bodyText: event.bodyText,
        excerpt: event.excerpt,
        organizer: event.organizer,
        city: event.city,
        venue: event.venue,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        visibility: event.visibility,
        status: event.status,
        publishedAt: event.publishedAt,
      },
      create: {
        id: event.id,
        title: event.title,
        slug,
        body: event.body,
        bodyText: event.bodyText,
        excerpt: event.excerpt,
        organizer: event.organizer,
        city: event.city,
        venue: event.venue,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        visibility: event.visibility,
        status: event.status,
        publishedAt: event.publishedAt,
      },
    })
  }
}

async function seedSmtpSettings() {
  await prisma.smtpSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 3325,
      secure: false,
      username: null,
      passwordEncrypted: null,
      fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@mindcalm.local',
      fromName: 'MindCalm',
    },
  })
}

async function seedTermsPolicy() {
  const existingPolicy = await prisma.termsPolicy.findFirst({
    include: {
      currentVersion: true,
    },
  })

  if (existingPolicy?.status === 'PUBLISHED' && existingPolicy.currentVersionId) {
    return
  }

  if (existingPolicy) {
    return
  }

  const policy = await prisma.termsPolicy.create({
    data: {
      status: 'PUBLISHED',
    },
  })

  const version = await prisma.termsPolicyVersion.create({
    data: {
      termsPolicyId: policy.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-04-14T12:00:00Z'),
    },
  })

  await prisma.termsPolicyVersionTranslation.create({
    data: {
      versionId: version.id,
      lang: 'it',
      title: 'Termini e condizioni MindCalm',
      buttonLabel: 'Accetto i termini',
      html: '<p>Usando MindCalm accetti i termini di utilizzo del servizio, inclusi accesso personale, corretto uso dei contenuti e rispetto delle credenziali fornite.</p><p>L’accesso ai contenuti richiede una licenza valida e puo essere sospeso in caso di abuso o violazione delle regole d’uso.</p>',
    },
  })

  await prisma.termsPolicy.update({
    where: { id: policy.id },
    data: {
      currentVersionId: version.id,
    },
  })
}

async function main() {
  await seedUsers()
  await seedCategories()
  await seedTags()
  await seedDemoAudio()
  await seedPosts()
  await seedEvents()
  await seedSmtpSettings()
  await seedTermsPolicy()

  console.log('Seed minimo completato')
  console.log('Admin: admin@mindcalm.com / admin123! (override con ADMIN_EMAIL/ADMIN_PASSWORD)')
  console.log('Utente demo: user@mindcalm.com / user123! (override con DEMO_USER_EMAIL/DEMO_USER_PASSWORD)')
  console.log('SMTP: MailHog su localhost:3325 (UI: http://localhost:3326)')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
