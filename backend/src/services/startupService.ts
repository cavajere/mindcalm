import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'

type PrismaMigrationRow = {
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
}

function getMigrationsDirectoryPath() {
  return path.resolve(__dirname, '../../prisma/migrations')
}

async function getExpectedMigrations() {
  const migrationsDir = getMigrationsDirectoryPath()
  const entries = await fs.promises.readdir(migrationsDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

async function getAppliedMigrations() {
  const rows = await prisma.$queryRaw<PrismaMigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
  `

  const applied = rows
    .filter((row) => row.finished_at && !row.rolled_back_at)
    .map((row) => row.migration_name)

  return new Set(applied)
}

export async function ensureDatabaseReady() {
  await prisma.$connect()

  try {
    const [expectedMigrations, appliedMigrations] = await Promise.all([
      getExpectedMigrations(),
      getAppliedMigrations(),
    ])

    const pendingMigrations = expectedMigrations.filter((migration) => !appliedMigrations.has(migration))
    if (!pendingMigrations.length) {
      return
    }

    throw new Error(
      [
        'Schema database non aggiornata.',
        `Migration Prisma mancanti: ${pendingMigrations.join(', ')}.`,
        'Esegui `npm --workspace=backend run db:migrate:deploy` prima di avviare il backend.',
      ].join(' '),
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Schema database non aggiornata')) {
      throw error
    }

    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      [
        'Impossibile verificare lo stato delle migration Prisma.',
        `Dettagli: ${reason}.`,
        'Verifica che il database sia raggiungibile e che `_prisma_migrations` esista.',
      ].join(' '),
    )
  }
}
