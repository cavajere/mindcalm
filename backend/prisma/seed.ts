import path from 'path'
import { PrismaClient, AudioProcessingStatus, Level, Status, StreamingFormat, UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'
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

async function main() {
  await seedUsers()
  await seedCategories()
  await seedTags()
  await seedDemoAudio()
  await seedSmtpSettings()

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
