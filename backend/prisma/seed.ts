import path from 'path'
import { PrismaClient, AudioProcessingStatus, Level, Status, StreamingFormat, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'
import { getAudioDuration, getAudioFormat } from '../src/services/audioService'

const prisma = new PrismaClient()

const DEMO_AUDIO_FILENAME = '6ccc6f43-0b47-49a4-9d21-d3ffe17f6918.mp3'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
async function seedCategories() {
  const categories = [
    { name: 'Meditazione guidata', description: 'Audio con guida vocale', color: '#4A90D9', icon: 'lotus', sortOrder: 1 },
    { name: 'Respirazione', description: 'Esercizi di respirazione consapevole', color: '#50B860', icon: 'wind', sortOrder: 2 },
    { name: 'Body scan', description: 'Scansione corporea guidata', color: '#E8A040', icon: 'body', sortOrder: 3 },
    { name: 'Suoni della natura', description: 'Paesaggi sonori naturali per il relax', color: '#8B5CF6', icon: 'nature', sortOrder: 4 },
    { name: 'Sleep', description: 'Audio per favorire il sonno', color: '#6366F1', icon: 'moon', sortOrder: 5 },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    })
  }
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
async function seedTags() {
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

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
async function seedAudio() {
  const categories = await prisma.category.findMany()
  const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]))

  const tags = await prisma.tag.findMany()
  const tagMap = Object.fromEntries(tags.map(t => [t.slug, t.id]))

  const demoAudioPath = path.resolve(process.cwd(), 'storage/audio', DEMO_AUDIO_FILENAME)
  const durationSec = await getAudioDuration(demoAudioPath)
  const audioFormat = getAudioFormat('audio/mpeg')

  const audioEntries = [
    {
      id: 'demo-audio-grounding',
      title: 'Grounding di 5 minuti',
      description: 'Una pratica breve per rallentare il respiro e tornare al corpo.',
      category: 'Meditazione guidata',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-01T08:00:00Z'),
      tagSlugs: ['ansia', 'principianti'],
    },
    {
      id: 'demo-audio-respiro-quadrato',
      title: 'Respirazione a quadrato',
      description: 'Tecnica di respirazione box breathing: inspira, trattieni, espira, trattieni, ciascuna fase per 4 secondi.',
      category: 'Respirazione',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-05T08:00:00Z'),
      tagSlugs: ['respirazione', 'principianti', 'ansia'],
    },
    {
      id: 'demo-audio-body-scan-completo',
      title: 'Body scan completo',
      description: 'Scansione corporea guidata dalla testa ai piedi. Ideale per rilasciare le tensioni accumulate durante la giornata.',
      category: 'Body scan',
      level: Level.INTERMEDIATE,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-10T08:00:00Z'),
      tagSlugs: ['rilassamento', 'sera'],
    },
    {
      id: 'demo-audio-pioggia-foresta',
      title: 'Pioggia nella foresta',
      description: 'Suoni di pioggia leggera tra gli alberi di una foresta di montagna. Perfetto per concentrazione o sonno.',
      category: 'Suoni della natura',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-15T08:00:00Z'),
      tagSlugs: ['rilassamento', 'sonno', 'focus'],
    },
    {
      id: 'demo-audio-ninna-nanna',
      title: 'Rilassamento per il sonno',
      description: 'Una meditazione guidata per lasciarsi andare e scivolare dolcemente nel sonno.',
      category: 'Sleep',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-20T08:00:00Z'),
      tagSlugs: ['sonno', 'sera', 'rilassamento'],
    },
    {
      id: 'demo-audio-respiro-478',
      title: 'Respirazione 4-7-8',
      description: 'La tecnica del Dr. Weil: inspira per 4, trattieni per 7, espira per 8. Potente calmante naturale.',
      category: 'Respirazione',
      level: Level.INTERMEDIATE,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-03-25T08:00:00Z'),
      tagSlugs: ['respirazione', 'ansia', 'sera'],
    },
    {
      id: 'demo-audio-meditazione-mattino',
      title: 'Meditazione del mattino',
      description: 'Inizia la giornata con intenzione. Una pratica di 10 minuti per impostare il tono della giornata.',
      category: 'Meditazione guidata',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-01T08:00:00Z'),
      tagSlugs: ['mattina', 'principianti'],
    },
    {
      id: 'demo-audio-vipassana',
      title: 'Vipassana: osservazione profonda',
      description: 'Sessione avanzata di meditazione vipassana. Osservazione delle sensazioni corporee momento per momento.',
      category: 'Meditazione guidata',
      level: Level.ADVANCED,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-05T08:00:00Z'),
      tagSlugs: ['avanzato', 'focus'],
    },
    {
      id: 'demo-audio-onde-mare',
      title: 'Onde del mare',
      description: 'Il suono ritmico delle onde che si infrangono sulla riva. Un paesaggio sonoro per il relax profondo.',
      category: 'Suoni della natura',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-08T08:00:00Z'),
      tagSlugs: ['rilassamento', 'sonno'],
    },
    {
      id: 'demo-audio-body-scan-rapido',
      title: 'Body scan rapido (5 min)',
      description: 'Una versione breve del body scan per le pause pranzo o i momenti di stress durante la giornata.',
      category: 'Body scan',
      level: Level.BEGINNER,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-10T08:00:00Z'),
      tagSlugs: ['principianti', 'rilassamento', 'focus'],
    },
    {
      id: 'demo-audio-draft',
      title: 'Meditazione sulla gratitudine',
      description: 'Bozza di una nuova meditazione sulla gratitudine quotidiana. In fase di revisione.',
      category: 'Meditazione guidata',
      level: Level.BEGINNER,
      status: Status.DRAFT,
      publishedAt: null,
      tagSlugs: ['principianti', 'mattina'],
    },
    {
      id: 'demo-audio-focus-profondo',
      title: 'Focus profondo con campane tibetane',
      description: 'Campane tibetane a intervalli per mantenere la concentrazione durante lo studio o il lavoro.',
      category: 'Suoni della natura',
      level: Level.INTERMEDIATE,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-12T08:00:00Z'),
      tagSlugs: ['focus', 'rilassamento'],
    },
  ]

  for (const entry of audioEntries) {
    const selectedTags = entry.tagSlugs
      .filter(s => tagMap[s])
      .map(s => ({ tag: { connect: { id: tagMap[s] } } }))

    await prisma.audio.upsert({
      where: { id: entry.id },
      update: {
        title: entry.title,
        description: entry.description,
        categoryId: catMap[entry.category],
        level: entry.level,
        durationSec,
        audioFile: `audio/${DEMO_AUDIO_FILENAME}`,
        audioOriginalName: DEMO_AUDIO_FILENAME,
        audioDisplayName: DEMO_AUDIO_FILENAME,
        audioFormat,
        audioSize: 8201194,
        streamingFormat: StreamingFormat.DIRECT,
        processingStatus: AudioProcessingStatus.READY,
        status: entry.status,
        publishedAt: entry.publishedAt,
        audioTags: {
          deleteMany: {},
          create: selectedTags,
        },
      },
      create: {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        categoryId: catMap[entry.category],
        level: entry.level,
        durationSec,
        audioFile: `audio/${DEMO_AUDIO_FILENAME}`,
        audioOriginalName: DEMO_AUDIO_FILENAME,
        audioDisplayName: DEMO_AUDIO_FILENAME,
        audioFormat,
        audioSize: 8201194,
        streamingFormat: StreamingFormat.DIRECT,
        processingStatus: AudioProcessingStatus.READY,
        status: entry.status,
        publishedAt: entry.publishedAt,
        audioTags: {
          create: selectedTags,
        },
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
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
    {
      id: 'demo-post-6',
      title: 'Mindfulness e alimentazione consapevole',
      body: '<h2>Mangiare con presenza</h2><p>L\'alimentazione consapevole (mindful eating) è una pratica che trasforma il modo in cui ci relazioniamo con il cibo. Invece di mangiare in automatico davanti allo schermo, impariamo a gustare ogni boccone con tutti i sensi.</p><p><strong>Esercizio pratico:</strong></p><ol><li>Prendi un chicco d\'uva o un pezzetto di cioccolato</li><li>Osservalo come se fosse la prima volta: colore, forma, consistenza</li><li>Annusalo, notando tutti gli aromi</li><li>Portalo alla bocca lentamente, sentendo la consistenza</li><li>Mastica piano, notando come cambiano i sapori</li></ol><p>Questo semplice esercizio può cambiare radicalmente il tuo rapporto con il cibo e ridurre le abbuffate emotive.</p>',
      bodyText: 'Mangiare con presenza. L\'alimentazione consapevole è una pratica che trasforma il modo in cui ci relazioniamo con il cibo. Invece di mangiare in automatico, impariamo a gustare ogni boccone con tutti i sensi.',
      excerpt: 'Come la mindfulness può trasformare il tuo rapporto con il cibo attraverso l\'alimentazione consapevole.',
      author: 'Dr.ssa Anna Colombo',
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-14T09:00:00Z'),
      tagSlugs: ['principianti', 'rilassamento'],
    },
    {
      id: 'demo-post-7',
      title: 'Meditazione e sonno: dormire meglio naturalmente',
      body: '<h2>Il sonno consapevole</h2><p>L\'insonnia affligge milioni di persone. La meditazione prima di dormire è uno degli strumenti più efficaci per migliorare la qualità del sonno senza ricorrere a farmaci.</p><p>La tecnica dello <em>yoga nidra</em> (sonno yogico) guida il corpo attraverso stati progressivi di rilassamento, portandolo naturalmente verso il sonno. A differenza dei sonniferi, non crea dipendenza e migliora la qualità del riposo nel lungo termine.</p><p><strong>Routine serale consigliata:</strong></p><ul><li>30 min prima: spegni gli schermi</li><li>15 min prima: respirazione 4-7-8 (3 cicli)</li><li>A letto: body scan dalla testa ai piedi</li><li>Se la mente vaga: conta i respiri da 10 a 1, poi ricomincia</li></ul>',
      bodyText: 'Il sonno consapevole. L\'insonnia affligge milioni di persone. La meditazione prima di dormire è uno degli strumenti più efficaci per migliorare la qualità del sonno.',
      excerpt: 'Tecniche di meditazione e mindfulness per combattere l\'insonnia e migliorare la qualità del sonno.',
      author: 'Marco Bianchi',
      visibility: 'PUBLIC' as const,
      status: Status.PUBLISHED,
      publishedAt: new Date('2026-04-15T09:00:00Z'),
      tagSlugs: ['sonno', 'sera', 'rilassamento'],
    },
    {
      id: 'demo-post-draft',
      title: 'Mindfulness per i bambini (bozza)',
      body: '<h2>In lavorazione</h2><p>Questo articolo è in fase di stesura e tratterà tecniche di mindfulness adattate per bambini dai 5 ai 12 anni.</p>',
      bodyText: 'In lavorazione. Questo articolo tratterà tecniche di mindfulness adattate per bambini.',
      excerpt: 'Tecniche di mindfulness adattate per bambini dai 5 ai 12 anni.',
      author: 'Luca Verdi',
      visibility: 'PUBLIC' as const,
      status: Status.DRAFT,
      publishedAt: null,
      tagSlugs: ['principianti'],
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

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// SMTP Settings
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Terms Policy
// ---------------------------------------------------------------------------
async function seedTermsPolicy() {
  const existingPolicy = await prisma.termsPolicy.findFirst({
    include: { currentVersion: true },
  })

  if (existingPolicy?.status === 'PUBLISHED' && existingPolicy.currentVersionId) {
    return
  }
  if (existingPolicy) return

  const policy = await prisma.termsPolicy.create({
    data: { status: 'PUBLISHED' },
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
      html: '<p>Usando MindCalm accetti i termini di utilizzo del servizio, inclusi accesso personale, corretto uso dei contenuti e rispetto delle credenziali fornite.</p><p>L\'accesso ai contenuti richiede una licenza valida e puo essere sospeso in caso di abuso o violazione delle regole d\'uso.</p>',
    },
  })

  await prisma.termsPolicy.update({
    where: { id: policy.id },
    data: { currentVersionId: version.id },
  })
}

// ---------------------------------------------------------------------------
// Invite Codes
// ---------------------------------------------------------------------------
async function seedInviteCodes() {
  const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } })
  const demoUser = await prisma.user.findFirst({ where: { role: UserRole.STANDARD } })
  if (!admin || !demoUser) return

  const codes = [
    {
      id: 'demo-invite-active-1',
      code: 'MINDCALM-PROVA-2026',
      licenseDurationDays: 90,
      maxRedemptions: 10,
      redemptionsCount: 0,
      status: 'ACTIVE' as const,
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      notes: 'Codice promozionale per il lancio',
    },
    {
      id: 'demo-invite-active-2',
      code: 'BENVENUTO-30',
      licenseDurationDays: 30,
      maxRedemptions: 50,
      redemptionsCount: 3,
      status: 'ACTIVE' as const,
      expiresAt: new Date('2026-09-30T23:59:59Z'),
      notes: 'Benvenuto 30 giorni gratuiti',
    },
    {
      id: 'demo-invite-active-3',
      code: 'WORKSHOP-ROMA',
      licenseDurationDays: 60,
      maxRedemptions: 25,
      redemptionsCount: 0,
      status: 'ACTIVE' as const,
      expiresAt: new Date('2026-06-30T23:59:59Z'),
      notes: 'Partecipanti workshop Roma',
    },
    {
      id: 'demo-invite-redeemed',
      code: 'AMICO-DEMO-001',
      licenseDurationDays: 30,
      maxRedemptions: 1,
      redemptionsCount: 1,
      status: 'REDEEMED' as const,
      expiresAt: new Date('2026-06-01T23:59:59Z'),
      redeemedAt: new Date('2026-04-10T14:30:00Z'),
      redeemedByUserId: demoUser.id,
      notes: 'Riscattato dall\'utente demo',
    },
    {
      id: 'demo-invite-expired',
      code: 'SCADUTO-2025',
      licenseDurationDays: 14,
      maxRedemptions: 5,
      redemptionsCount: 2,
      status: 'EXPIRED' as const,
      expiresAt: new Date('2025-12-31T23:59:59Z'),
      notes: 'Promozione natalizia 2025 scaduta',
    },
    {
      id: 'demo-invite-disabled',
      code: 'DISABILITATO-TEST',
      licenseDurationDays: 7,
      maxRedemptions: 100,
      redemptionsCount: 0,
      status: 'DISABLED' as const,
      expiresAt: null,
      notes: 'Codice disabilitato manualmente',
    },
  ]

  for (const code of codes) {
    const { id, ...data } = code
    await prisma.inviteCode.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...data,
        createdByUserId: admin.id,
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------
async function seedContacts() {
  const contacts = [
    { id: 'demo-contact-1', email: 'giulia.ferrari@example.com', firstName: 'Giulia', lastName: 'Ferrari', status: 'ACTIVE' as const },
    { id: 'demo-contact-2', email: 'luca.romano@example.com', firstName: 'Luca', lastName: 'Romano', status: 'ACTIVE' as const },
    { id: 'demo-contact-3', email: 'sara.colombo@example.com', firstName: 'Sara', lastName: 'Colombo', status: 'ACTIVE' as const },
    { id: 'demo-contact-4', email: 'marco.bianchi@example.com', firstName: 'Marco', lastName: 'Bianchi', status: 'ACTIVE' as const },
    { id: 'demo-contact-5', email: 'anna.ricci@example.com', firstName: 'Anna', lastName: 'Ricci', status: 'ACTIVE' as const },
    { id: 'demo-contact-6', email: 'paolo.moretti@example.com', firstName: 'Paolo', lastName: 'Moretti', status: 'ACTIVE' as const },
    { id: 'demo-contact-7', email: 'elena.galli@example.com', firstName: 'Elena', lastName: 'Galli', status: 'ACTIVE' as const },
    { id: 'demo-contact-8', email: 'disiscritto@example.com', firstName: 'Roberto', lastName: 'Neri', status: 'SUPPRESSED' as const, suppressedAt: new Date('2026-04-01T10:00:00Z'), suppressionReason: 'Richiesta utente' },
  ]

  for (const contact of contacts) {
    const { id, ...data } = contact
    await prisma.contact.upsert({
      where: { id },
      update: {},
      create: { id, ...data },
    })
  }
}

// ---------------------------------------------------------------------------
// Subscription Policy + Consent Formulas
// ---------------------------------------------------------------------------
async function seedSubscriptionPolicy() {
  const existing = await prisma.subscriptionPolicy.findFirst()
  if (existing) return

  const policy = await prisma.subscriptionPolicy.create({
    data: {
      status: 'PUBLISHED',
      subscribeEnabled: true,
      subscribeConfirmEmail: true,
    },
  })

  const policyVersion = await prisma.subscriptionPolicyVersion.create({
    data: {
      subscriptionPolicyId: policy.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-04-14T12:00:00Z'),
    },
  })

  await prisma.subscriptionPolicyVersionTranslation.create({
    data: {
      versionId: policyVersion.id,
      lang: 'it',
      title: 'Informativa sulla privacy',
      html: '<p>I tuoi dati verranno trattati nel rispetto del GDPR per l\'invio di comunicazioni relative ai servizi MindCalm.</p>',
      buttonLabel: 'Iscriviti alla newsletter',
    },
  })

  await prisma.subscriptionPolicy.update({
    where: { id: policy.id },
    data: { currentVersionId: policyVersion.id },
  })

  // Consent formula: newsletter
  const newsletterFormula = await prisma.consentFormula.create({
    data: {
      subscriptionPolicyId: policy.id,
      code: 'newsletter',
      required: false,
      status: 'ACTIVE',
    },
  })

  const newsletterVersion = await prisma.consentFormulaVersion.create({
    data: {
      consentFormulaId: newsletterFormula.id,
      subscriptionPolicyVersionId: policyVersion.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-04-14T12:00:00Z'),
    },
  })

  await prisma.consentFormulaVersionTranslation.create({
    data: {
      consentVersionId: newsletterVersion.id,
      lang: 'it',
      title: 'Newsletter',
      text: 'Desidero ricevere la newsletter di MindCalm con consigli sulla mindfulness, nuovi contenuti e aggiornamenti.',
    },
  })

  await prisma.consentFormula.update({
    where: { id: newsletterFormula.id },
    data: { currentVersionId: newsletterVersion.id },
  })

  // Consent formula: marketing
  const marketingFormula = await prisma.consentFormula.create({
    data: {
      subscriptionPolicyId: policy.id,
      code: 'marketing',
      required: false,
      status: 'ACTIVE',
    },
  })

  const marketingVersion = await prisma.consentFormulaVersion.create({
    data: {
      consentFormulaId: marketingFormula.id,
      subscriptionPolicyVersionId: policyVersion.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-04-14T12:00:00Z'),
    },
  })

  await prisma.consentFormulaVersionTranslation.create({
    data: {
      consentVersionId: marketingVersion.id,
      lang: 'it',
      title: 'Comunicazioni promozionali',
      text: 'Acconsento a ricevere comunicazioni promozionali relative a eventi, ritiri e iniziative MindCalm.',
    },
  })

  await prisma.consentFormula.update({
    where: { id: marketingFormula.id },
    data: { currentVersionId: marketingVersion.id },
  })

  // Create consents for active contacts
  const activeContacts = await prisma.contact.findMany({
    where: { status: 'ACTIVE' },
    take: 6,
  })

  for (const contact of activeContacts) {
    // All active contacts consent to newsletter
    await prisma.consent.create({
      data: {
        contactId: contact.id,
        consentFormulaId: newsletterFormula.id,
        consentFormulaVersionId: newsletterVersion.id,
        policyVersionId: policyVersion.id,
        value: 'YES',
        status: 'CONFIRMED',
        source: 'SUBSCRIBE',
      },
    })
  }

  // First 3 contacts also consent to marketing
  for (const contact of activeContacts.slice(0, 3)) {
    await prisma.consent.create({
      data: {
        contactId: contact.id,
        consentFormulaId: marketingFormula.id,
        consentFormulaVersionId: marketingVersion.id,
        policyVersionId: policyVersion.id,
        value: 'YES',
        status: 'CONFIRMED',
        source: 'SUBSCRIBE',
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Notification Settings & Preferences
// ---------------------------------------------------------------------------
async function seedNotificationSettings() {
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
  })

  const demoUser = await prisma.user.findFirst({ where: { role: UserRole.STANDARD } })
  if (!demoUser) return

  await prisma.userNotificationPreference.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      notifyOnAudio: true,
      notifyOnPosts: true,
      frequency: 'WEEKLY',
    },
  })
}

// ---------------------------------------------------------------------------
// Analytics Events
// ---------------------------------------------------------------------------
async function seedAnalyticsEvents() {
  const demoUser = await prisma.user.findFirst({ where: { role: UserRole.STANDARD } })
  const audios = await prisma.audio.findMany({ where: { status: Status.PUBLISHED }, take: 6 })
  const posts = await prisma.post.findMany({ where: { status: Status.PUBLISHED }, take: 4 })
  if (!demoUser || audios.length === 0) return

  const events: Array<{
    userId: string | null
    contentType: 'AUDIO' | 'POST' | 'SYSTEM'
    eventType: 'AUDIO_VIEW' | 'AUDIO_PLAY' | 'AUDIO_COMPLETE' | 'POST_VIEW'
    audioId?: string
    postId?: string
    occurredAt: Date
  }> = []

  // Audio views and plays spread over the last 2 weeks
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const baseDate = new Date('2026-04-16T00:00:00Z')
    baseDate.setDate(baseDate.getDate() - dayOffset)

    // Each day: 2-4 audio views, 1-3 plays, occasional completes
    const dailyAudios = audios.slice(0, 2 + (dayOffset % 3))
    for (const audio of dailyAudios) {
      const viewTime = new Date(baseDate)
      viewTime.setHours(8 + (dayOffset % 12), dayOffset * 3 % 60)
      events.push({
        userId: demoUser.id,
        contentType: 'AUDIO',
        eventType: 'AUDIO_VIEW',
        audioId: audio.id,
        occurredAt: viewTime,
      })

      const playTime = new Date(viewTime)
      playTime.setMinutes(playTime.getMinutes() + 1)
      events.push({
        userId: demoUser.id,
        contentType: 'AUDIO',
        eventType: 'AUDIO_PLAY',
        audioId: audio.id,
        occurredAt: playTime,
      })

      if (dayOffset % 3 === 0) {
        const completeTime = new Date(playTime)
        completeTime.setMinutes(completeTime.getMinutes() + 10)
        events.push({
          userId: demoUser.id,
          contentType: 'AUDIO',
          eventType: 'AUDIO_COMPLETE',
          audioId: audio.id,
          occurredAt: completeTime,
        })
      }
    }

    // Some anonymous audio views
    if (dayOffset % 2 === 0) {
      const anonTime = new Date(baseDate)
      anonTime.setHours(14, 30)
      events.push({
        userId: null,
        contentType: 'AUDIO',
        eventType: 'AUDIO_VIEW',
        audioId: audios[dayOffset % audios.length].id,
        occurredAt: anonTime,
      })
    }
  }

  // Post views
  for (let dayOffset = 10; dayOffset >= 0; dayOffset -= 2) {
    const baseDate = new Date('2026-04-16T00:00:00Z')
    baseDate.setDate(baseDate.getDate() - dayOffset)
    const post = posts[dayOffset % posts.length]
    if (!post) continue

    const viewTime = new Date(baseDate)
    viewTime.setHours(10 + dayOffset % 8, 15)
    events.push({
      userId: demoUser.id,
      contentType: 'POST',
      eventType: 'POST_VIEW',
      postId: post.id,
      occurredAt: viewTime,
    })
  }

  await prisma.analyticsEvent.createMany({
    data: events.map(e => ({
      userId: e.userId,
      contentType: e.contentType,
      eventType: e.eventType,
      audioId: e.audioId ?? null,
      postId: e.postId ?? null,
      occurredAt: e.occurredAt,
    })),
  })
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------
async function seedAuditLogs() {
  const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } })
  if (!admin) return

  const logs = [
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'LOGIN_SUCCEEDED' as const,
      entityType: 'AUTH' as const,
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T08:00:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'AUDIO_CREATED' as const,
      entityType: 'AUDIO' as const,
      entityId: 'demo-audio-grounding',
      entityLabel: 'Grounding di 5 minuti',
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T08:15:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'AUDIO_STATUS_CHANGED' as const,
      entityType: 'AUDIO' as const,
      entityId: 'demo-audio-grounding',
      entityLabel: 'Grounding di 5 minuti',
      outcome: 'SUCCESS' as const,
      metadata: { from: 'DRAFT', to: 'PUBLISHED' },
      occurredAt: new Date('2026-04-14T08:16:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'POST_CREATED' as const,
      entityType: 'POST' as const,
      entityId: 'demo-post-1',
      entityLabel: 'Cos\'è la mindfulness e perché fa bene',
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T09:00:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'EVENT_CREATED' as const,
      entityType: 'EVENT' as const,
      entityId: 'demo-event-1',
      entityLabel: 'Ritiro di meditazione primaverile',
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T09:30:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'INVITE_CODE_CREATED' as const,
      entityType: 'INVITE_CODE' as const,
      entityId: 'demo-invite-active-1',
      entityLabel: 'MINDCALM-PROVA-2026',
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T10:00:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'SMTP_SETTINGS_UPDATED' as const,
      entityType: 'SETTINGS' as const,
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T10:30:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'TERMS_POLICY_PUBLISHED' as const,
      entityType: 'TERMS_POLICY' as const,
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T11:00:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'CONSENT_POLICY_PUBLISHED' as const,
      entityType: 'SUBSCRIPTION_POLICY' as const,
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-14T11:30:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'LOGIN_SUCCEEDED' as const,
      entityType: 'AUTH' as const,
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-15T07:45:00Z'),
    },
    {
      actorEmail: 'sconosciuto@example.com',
      actorName: null,
      action: 'LOGIN_FAILED' as const,
      entityType: 'AUTH' as const,
      outcome: 'FAILURE' as const,
      occurredAt: new Date('2026-04-15T03:12:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'CATEGORY_CREATED' as const,
      entityType: 'CATEGORY' as const,
      entityLabel: 'Suoni della natura',
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-15T08:00:00Z'),
    },
    {
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: UserRole.ADMIN,
      action: 'TAG_CREATED' as const,
      entityType: 'TAG' as const,
      entityLabel: 'Sonno',
      outcome: 'SUCCESS' as const,
      occurredAt: new Date('2026-04-15T08:05:00Z'),
    },
  ]

  await prisma.auditLog.createMany({ data: logs })
}

// ---------------------------------------------------------------------------
// Content Publication Outbox
// ---------------------------------------------------------------------------
async function seedContentOutbox() {
  const audios = await prisma.audio.findMany({ where: { status: Status.PUBLISHED }, take: 3 })
  const posts = await prisma.post.findMany({ where: { status: Status.PUBLISHED }, take: 2 })

  const entries = [
    ...audios.map((a, i) => ({
      id: `demo-outbox-audio-${i + 1}`,
      dedupeKey: `audio:${a.id}`,
      contentType: 'AUDIO' as const,
      contentId: a.id,
      title: a.title,
      contentUrl: `/sessioni/${a.id}`,
      publishedAt: a.publishedAt!,
      status: 'PROCESSED' as const,
      processedAt: new Date(a.publishedAt!.getTime() + 60_000),
    })),
    ...posts.map((p, i) => ({
      id: `demo-outbox-post-${i + 1}`,
      dedupeKey: `post:${p.id}`,
      contentType: 'POST' as const,
      contentId: p.id,
      title: p.title,
      contentUrl: `/articoli/${p.slug}`,
      publishedAt: p.publishedAt!,
      status: 'PROCESSED' as const,
      processedAt: new Date(p.publishedAt!.getTime() + 60_000),
    })),
  ]

  for (const entry of entries) {
    const { id, ...data } = entry
    await prisma.contentPublicationOutbox.upsert({
      where: { id },
      update: {},
      create: { id, ...data },
    })
  }
}

// ---------------------------------------------------------------------------
// User Terms Acceptance
// ---------------------------------------------------------------------------
async function seedUserTermsAcceptance() {
  const demoUser = await prisma.user.findFirst({ where: { role: UserRole.STANDARD } })
  const termsPolicy = await prisma.termsPolicy.findFirst({ where: { status: 'PUBLISHED' } })
  if (!demoUser || !termsPolicy?.currentVersionId) return

  const existing = await prisma.userTermsAcceptance.findFirst({
    where: { userId: demoUser.id, termsPolicyVersionId: termsPolicy.currentVersionId },
  })
  if (existing) return

  await prisma.userTermsAcceptance.create({
    data: {
      userId: demoUser.id,
      termsPolicyVersionId: termsPolicy.currentVersionId,
      source: 'SELF_SERVICE',
      acceptedAt: new Date('2026-04-10T14:30:00Z'),
    },
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await seedUsers()
  await seedCategories()
  await seedTags()
  await seedAudio()
  await seedPosts()
  await seedEvents()
  await seedSmtpSettings()
  await seedTermsPolicy()
  await seedInviteCodes()
  await seedContacts()
  await seedSubscriptionPolicy()
  await seedNotificationSettings()
  await seedAnalyticsEvents()
  await seedAuditLogs()
  await seedContentOutbox()
  await seedUserTermsAcceptance()

  // Riepilogo
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.audio.count(),
    prisma.post.count(),
    prisma.event.count(),
    prisma.inviteCode.count(),
    prisma.contact.count(),
    prisma.consent.count(),
    prisma.analyticsEvent.count(),
    prisma.auditLog.count(),
    prisma.contentPublicationOutbox.count(),
  ])

  const labels = ['Utenti', 'Categorie', 'Tag', 'Audio', 'Post', 'Eventi', 'Codici invito', 'Contatti', 'Consensi', 'Analytics', 'Audit log', 'Outbox']

  console.log('\nSeed completo!')
  console.log('─'.repeat(40))
  labels.forEach((label, i) => console.log(`  ${label.padEnd(20)} ${counts[i]}`))
  console.log('─'.repeat(40))
  console.log('Admin: admin@mindcalm.com / admin123!')
  console.log('Utente demo: user@mindcalm.com / user123!')
  console.log('SMTP: MailHog su localhost:3325 (UI: http://localhost:3326)')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
