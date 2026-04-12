import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { config } from '../config'

type CleanupTarget = {
  type: 'file' | 'dir'
  path: string
  reason: string
}

type CliOptions = {
  apply: boolean
  minAgeHours: number
  tmpMinAgeHours: number
}

const DEFAULT_MIN_AGE_HOURS = 24
const DEFAULT_TMP_MIN_AGE_HOURS = 2

function parseHoursOption(rawValue: string | undefined, optionName: string, fallback: number): number {
  if (!rawValue) return fallback

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Valore non valido per ${optionName}: ${rawValue}`)
  }

  return parsed
}

function parseCliOptions(argv: string[]): CliOptions {
  let apply = false
  let minAgeHours = DEFAULT_MIN_AGE_HOURS
  let tmpMinAgeHours = DEFAULT_TMP_MIN_AGE_HOURS

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true
      continue
    }

    if (arg.startsWith('--min-age-hours=')) {
      minAgeHours = parseHoursOption(arg.split('=')[1], '--min-age-hours', DEFAULT_MIN_AGE_HOURS)
      continue
    }

    if (arg.startsWith('--tmp-min-age-hours=')) {
      tmpMinAgeHours = parseHoursOption(arg.split('=')[1], '--tmp-min-age-hours', DEFAULT_TMP_MIN_AGE_HOURS)
      continue
    }

    if (arg === '--help') {
      console.log('Uso: npm run storage:cleanup -- [--apply] [--min-age-hours=24] [--tmp-min-age-hours=2]')
      process.exit(0)
    }

    throw new Error(`Argomento non riconosciuto: ${arg}`)
  }

  return { apply, minAgeHours, tmpMinAgeHours }
}

function isOlderThanHours(targetPath: string, hours: number): boolean {
  if (hours <= 0) return true
  const stats = fs.statSync(targetPath)
  const thresholdMs = hours * 60 * 60 * 1000
  return Date.now() - stats.mtimeMs >= thresholdMs
}

function listDirectoryEntries(rootPath: string): fs.Dirent[] {
  if (!fs.existsSync(rootPath)) {
    return []
  }

  return fs.readdirSync(rootPath, { withFileTypes: true })
}

function addOrphanedFiles(
  targets: CleanupTarget[],
  rootPath: string,
  referencedFileNames: Set<string>,
  minAgeHours: number,
  label: string,
) {
  for (const entry of listDirectoryEntries(rootPath)) {
    if (entry.name === '.gitkeep') continue

    const fullPath = path.join(rootPath, entry.name)

    if (entry.isFile() && !referencedFileNames.has(entry.name) && isOlderThanHours(fullPath, minAgeHours)) {
      targets.push({
        type: 'file',
        path: fullPath,
        reason: `${label} non referenziato nel database`,
      })
      continue
    }

    if (entry.isDirectory() && isOlderThanHours(fullPath, minAgeHours)) {
      targets.push({
        type: 'dir',
        path: fullPath,
        reason: `directory inattesa in ${label}`,
      })
    }
  }
}

function addOrphanedHlsDirectories(
  targets: CleanupTarget[],
  hlsRootPath: string,
  referencedDirectoryNames: Set<string>,
  minAgeHours: number,
  tmpMinAgeHours: number,
) {
  for (const entry of listDirectoryEntries(hlsRootPath)) {
    if (entry.name === '.gitkeep') continue

    const fullPath = path.join(hlsRootPath, entry.name)

    if (entry.isFile()) {
      if (isOlderThanHours(fullPath, minAgeHours)) {
        targets.push({
          type: 'file',
          path: fullPath,
          reason: 'file inatteso nella root HLS',
        })
      }
      continue
    }

    if (!entry.isDirectory()) continue

    if (entry.name.includes('__tmp_')) {
      if (isOlderThanHours(fullPath, tmpMinAgeHours)) {
        targets.push({
          type: 'dir',
          path: fullPath,
          reason: 'directory temporanea HLS abbandonata',
        })
      }
      continue
    }

    if (!referencedDirectoryNames.has(entry.name) && isOlderThanHours(fullPath, minAgeHours)) {
      targets.push({
        type: 'dir',
        path: fullPath,
        reason: 'directory HLS orfana',
      })
    }
  }
}

function removeTarget(target: CleanupTarget) {
  fs.rmSync(target.path, { recursive: target.type === 'dir', force: true })
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))

  const [audios, articles] = await Promise.all([
    prisma.audio.findMany({
      select: {
        id: true,
        audioFile: true,
        coverImage: true,
      },
    }),
    prisma.article.findMany({
      select: {
        coverImage: true,
      },
    }),
  ])

  const referencedAudioFiles = new Set(audios.map(audio => path.basename(audio.audioFile)))
  const referencedImageFiles = new Set(
    [...audios.map(audio => audio.coverImage), ...articles.map(article => article.coverImage)]
      .filter((value): value is string => Boolean(value))
      .map(filePath => path.basename(filePath)),
  )
  const referencedHlsDirectories = new Set(audios.map(audio => path.basename(audio.id)))

  const cleanupTargets: CleanupTarget[] = []

  addOrphanedFiles(
    cleanupTargets,
    config.storage.audioPath,
    referencedAudioFiles,
    options.minAgeHours,
    'storage audio',
  )
  addOrphanedFiles(
    cleanupTargets,
    config.storage.imagesPath,
    referencedImageFiles,
    options.minAgeHours,
    'storage immagini',
  )
  addOrphanedHlsDirectories(
    cleanupTargets,
    config.storage.hlsPath,
    referencedHlsDirectories,
    options.minAgeHours,
    options.tmpMinAgeHours,
  )

  console.log(`[storage-cleanup] Modalita': ${options.apply ? 'apply' : 'dry-run'}`)
  console.log(`[storage-cleanup] File audio referenziati: ${referencedAudioFiles.size}`)
  console.log(`[storage-cleanup] File immagine referenziati: ${referencedImageFiles.size}`)
  console.log(`[storage-cleanup] Directory HLS referenziate: ${referencedHlsDirectories.size}`)
  console.log(`[storage-cleanup] Candidati alla rimozione: ${cleanupTargets.length}`)

  for (const target of cleanupTargets) {
    console.log(`[storage-cleanup] ${options.apply ? 'REMOVE' : 'KEEP'} ${target.path} (${target.reason})`)
    if (options.apply) {
      removeTarget(target)
    }
  }
}

main()
  .catch((error) => {
    console.error('[storage-cleanup] Errore fatale', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
