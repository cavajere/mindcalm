import fs from 'fs'
import path from 'path'
import { gzipSync, gunzipSync } from 'zlib'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { config } from '../config'

const BACKUP_APP_ID = 'mindcalm'
const BACKUP_FORMAT = 'full-backup'
const BACKUP_VERSION = 1
const BACKUP_SETTINGS_FILE = 'backup-settings.json'

const BACKUP_TABLES = [
  '"playback_sessions"',
  '"audit_logs"',
  '"analytics_events"',
  '"pending_registrations"',
  '"invite_codes"',
  '"article_tags"',
  '"audio_tags"',
  '"tag_aliases"',
  '"audio"',
  '"articles"',
  '"tags"',
  '"categories"',
  '"smtp_settings"',
  '"album_images"',
  '"admin_users"',
] as const

export type BackupFrequency = 'DAILY' | 'WEEKLY'
export type BackupSource = 'manual' | 'scheduled' | 'imported'

type StorageArea = 'audio' | 'images' | 'hls'

type BackupFileEntry = {
  path: string
  size: number
  contentsBase64: string
}

type BackupPayload = {
  app: typeof BACKUP_APP_ID
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  createdAt: string
  data: {
    users: Prisma.UserUncheckedCreateInput[]
    smtpSettings: Prisma.SmtpSettingsUncheckedCreateInput[]
    categories: Prisma.CategoryUncheckedCreateInput[]
    tags: Prisma.TagUncheckedCreateInput[]
    tagAliases: Prisma.TagAliasUncheckedCreateInput[]
    albumImages: Prisma.AlbumImageUncheckedCreateInput[]
    articles: Prisma.ArticleUncheckedCreateInput[]
    articleTags: Prisma.ArticleTagUncheckedCreateInput[]
    audios: Prisma.AudioUncheckedCreateInput[]
    audioTags: Prisma.AudioTagUncheckedCreateInput[]
    inviteCodes: Prisma.InviteCodeUncheckedCreateInput[]
    pendingRegistrations: Prisma.PendingRegistrationUncheckedCreateInput[]
    analyticsEvents: Prisma.AnalyticsEventUncheckedCreateInput[]
    auditLogs: Prisma.AuditLogUncheckedCreateInput[]
    playbackSessions: Prisma.PlaybackSessionUncheckedCreateInput[]
  }
  storage: {
    files: BackupFileEntry[]
  }
}

export type BackupSummary = {
  exportedAt: string
  counts: Record<string, number>
  storageFiles: number
}

export type BackupAutomationSettings = {
  enabled: boolean
  frequency: BackupFrequency
  timeOfDay: string
  dayOfWeek: number
  retentionCount: number
  retentionDays: number | null
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
}

export type LocalBackupFileMetadata = {
  fileName: string
  filePath: string
  size: number
  createdAt: string
  source: BackupSource | 'unknown'
}

export type BackupOverview = {
  storagePath: string
  settings: BackupAutomationSettings
  runtime: {
    schedulerRunning: boolean
    jobRunning: boolean
  }
  files: LocalBackupFileMetadata[]
}

const defaultBackupSettings: BackupAutomationSettings = {
  enabled: false,
  frequency: 'DAILY',
  timeOfDay: '02:00',
  dayOfWeek: 1,
  retentionCount: 14,
  retentionDays: 30,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
}

let schedulerTimer: NodeJS.Timeout | null = null
let schedulerJobRunning = false

function getBackupSettingsPath() {
  return path.join(config.storage.backupsPath, BACKUP_SETTINGS_FILE)
}

async function ensureDirectory(directoryPath: string) {
  await fs.promises.mkdir(directoryPath, { recursive: true })
}

async function ensureStorageDirectories() {
  await Promise.all([
    ensureDirectory(config.storage.audioPath),
    ensureDirectory(config.storage.imagesPath),
    ensureDirectory(config.storage.hlsPath),
    ensureDirectory(config.storage.backupsPath),
  ])
}

function normalizeBackupSettings(input: Partial<BackupAutomationSettings> | null | undefined): BackupAutomationSettings {
  const hourMinute = typeof input?.timeOfDay === 'string' && /^\d{2}:\d{2}$/.test(input.timeOfDay)
    ? input.timeOfDay
    : defaultBackupSettings.timeOfDay
  const [rawHour, rawMinute] = hourMinute.split(':').map((value) => Number.parseInt(value, 10))
  const hour = Number.isFinite(rawHour) ? Math.min(23, Math.max(0, rawHour)) : 2
  const minute = Number.isFinite(rawMinute) ? Math.min(59, Math.max(0, rawMinute)) : 0
  const retentionCountValue = Number(input?.retentionCount)
  const retentionDaysValue = input?.retentionDays == null ? null : Number(input.retentionDays)
  const dayOfWeekValue = Number(input?.dayOfWeek)

  return {
    enabled: Boolean(input?.enabled),
    frequency: input?.frequency === 'WEEKLY' ? 'WEEKLY' : 'DAILY',
    timeOfDay: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dayOfWeek: Number.isFinite(dayOfWeekValue) ? Math.min(6, Math.max(0, Math.trunc(dayOfWeekValue))) : defaultBackupSettings.dayOfWeek,
    retentionCount: Number.isFinite(retentionCountValue) ? Math.max(1, Math.trunc(retentionCountValue)) : defaultBackupSettings.retentionCount,
    retentionDays: retentionDaysValue == null || !Number.isFinite(retentionDaysValue)
      ? null
      : Math.max(1, Math.trunc(retentionDaysValue)),
    lastRunAt: typeof input?.lastRunAt === 'string' ? input.lastRunAt : null,
    lastSuccessAt: typeof input?.lastSuccessAt === 'string' ? input.lastSuccessAt : null,
    lastError: typeof input?.lastError === 'string' ? input.lastError : null,
  }
}

export async function readBackupSettings() {
  await ensureStorageDirectories()
  const settingsPath = getBackupSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    await fs.promises.writeFile(settingsPath, JSON.stringify(defaultBackupSettings, null, 2), 'utf8')
    return { ...defaultBackupSettings }
  }

  const raw = await fs.promises.readFile(settingsPath, 'utf8')
  return normalizeBackupSettings(JSON.parse(raw) as Partial<BackupAutomationSettings>)
}

async function writeBackupSettings(settings: BackupAutomationSettings) {
  await ensureStorageDirectories()
  await fs.promises.writeFile(getBackupSettingsPath(), JSON.stringify(settings, null, 2), 'utf8')
  return settings
}

export async function saveBackupSettings(input: Partial<BackupAutomationSettings>) {
  const current = await readBackupSettings()
  const next = normalizeBackupSettings({
    ...current,
    ...input,
  })
  await writeBackupSettings(next)
  await applyRotation(next)
  return next
}

function parseBackupSource(fileName: string): BackupSource | 'unknown' {
  if (fileName.includes('-manual.')) return 'manual'
  if (fileName.includes('-scheduled.')) return 'scheduled'
  if (fileName.includes('-imported.')) return 'imported'
  return 'unknown'
}

function sanitizeLocalBackupFileName(fileName: string) {
  const normalized = path.basename(fileName)

  if (!normalized || normalized === BACKUP_SETTINGS_FILE || normalized !== fileName) {
    throw new Error('Nome file backup non valido')
  }

  if (!normalized.endsWith('.json.gz')) {
    throw new Error('Formato file backup non supportato')
  }

  return normalized
}

function getLocalBackupFilePath(fileName: string) {
  return path.join(config.storage.backupsPath, sanitizeLocalBackupFileName(fileName))
}

export function buildBackupFilename(date = new Date(), source: BackupSource = 'manual') {
  const iso = date.toISOString().replace(/[:.]/g, '-')
  return `mindcalm-backup-${iso}-${source}.json.gz`
}

async function walkFiles(rootPath: string, currentPath = rootPath): Promise<string[]> {
  if (!fs.existsSync(currentPath)) {
    return []
  }

  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(currentPath, entry.name)
    if (entry.isDirectory()) {
      return walkFiles(rootPath, entryPath)
    }
    if (entry.isFile()) {
      return [path.relative(rootPath, entryPath)]
    }
    return []
  }))

  return files.flat()
}

function normalizeStorageRelativePath(area: StorageArea, relativePath: string) {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^(\.\.\/)+/, '')

  if (!normalized || normalized.startsWith('../') || normalized === '..') {
    throw new Error('Percorso file di backup non valido')
  }

  if (area === 'hls') {
    return normalized
  }

  return path.posix.basename(normalized)
}

function buildStorageEntryPath(area: StorageArea, relativePath: string) {
  return `${area}/${normalizeStorageRelativePath(area, relativePath)}`
}

function resolveStageFilePath(stageRoot: string, relativePath: string) {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'))

  if (!normalized || normalized.startsWith('../') || normalized === '..' || path.isAbsolute(normalized)) {
    throw new Error('Percorso restore non valido')
  }

  if (normalized.startsWith('audio/')) {
    return path.join(stageRoot, 'audio', path.posix.basename(normalized.slice('audio/'.length)))
  }

  if (normalized.startsWith('images/')) {
    return path.join(stageRoot, 'images', path.posix.basename(normalized.slice('images/'.length)))
  }

  if (normalized.startsWith('hls/')) {
    return path.join(stageRoot, 'hls', normalized.slice('hls/'.length))
  }

  throw new Error('Area storage backup non valida')
}

async function collectStorageFiles(): Promise<BackupFileEntry[]> {
  await ensureStorageDirectories()

  const storageRoots: { area: StorageArea; rootPath: string }[] = [
    { area: 'audio', rootPath: config.storage.audioPath },
    { area: 'images', rootPath: config.storage.imagesPath },
    { area: 'hls', rootPath: config.storage.hlsPath },
  ]

  const collected = await Promise.all(storageRoots.map(async ({ area, rootPath }) => {
    const files = await walkFiles(rootPath)

    return Promise.all(files.map(async (file) => {
      const absolutePath = path.join(rootPath, file)
      const buffer = await fs.promises.readFile(absolutePath)

      return {
        path: buildStorageEntryPath(area, file),
        size: buffer.byteLength,
        contentsBase64: buffer.toString('base64'),
      }
    }))
  }))

  return collected.flat().sort((left, right) => left.path.localeCompare(right.path))
}

function buildBackupCounts(payload: BackupPayload): Record<string, number> {
  return {
    users: payload.data.users.length,
    smtpSettings: payload.data.smtpSettings.length,
    categories: payload.data.categories.length,
    tags: payload.data.tags.length,
    tagAliases: payload.data.tagAliases.length,
    albumImages: payload.data.albumImages.length,
    articles: payload.data.articles.length,
    articleTags: payload.data.articleTags.length,
    audios: payload.data.audios.length,
    audioTags: payload.data.audioTags.length,
    inviteCodes: payload.data.inviteCodes.length,
    pendingRegistrations: payload.data.pendingRegistrations.length,
    analyticsEvents: payload.data.analyticsEvents.length,
    auditLogs: payload.data.auditLogs.length,
    playbackSessions: payload.data.playbackSessions.length,
  }
}

function serializeBackupPayload(payload: BackupPayload) {
  return gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'))
}

function deserializeBackupPayload(buffer: Buffer): BackupPayload {
  const decoded = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer
  const parsed = JSON.parse(decoded.toString('utf8')) as Partial<BackupPayload>

  if (
    parsed.app !== BACKUP_APP_ID ||
    parsed.format !== BACKUP_FORMAT ||
    parsed.version !== BACKUP_VERSION ||
    !parsed.data ||
    !parsed.storage ||
    !Array.isArray(parsed.storage.files)
  ) {
    throw new Error('File backup non valido o non supportato')
  }

  return parsed as BackupPayload
}

function convertDateFields<T extends Record<string, unknown>>(records: T[], fields: string[]) {
  return records.map((record) => {
    const normalized = { ...record } as Record<string, unknown>

    for (const field of fields) {
      const value = normalized[field]
      if (typeof value === 'string' && value) {
        normalized[field] = new Date(value)
      }
    }

    return normalized
  })
}

async function stageStorageFiles(files: BackupFileEntry[]) {
  const stageRoot = await fs.promises.mkdtemp(path.join(config.storage.backupsPath, '.restore-'))

  try {
    await Promise.all([
      ensureDirectory(path.join(stageRoot, 'audio')),
      ensureDirectory(path.join(stageRoot, 'images')),
      ensureDirectory(path.join(stageRoot, 'hls')),
    ])

    for (const file of files) {
      const outputPath = resolveStageFilePath(stageRoot, file.path)
      await ensureDirectory(path.dirname(outputPath))
      await fs.promises.writeFile(outputPath, Buffer.from(file.contentsBase64, 'base64'))
    }

    return stageRoot
  } catch (error) {
    await fs.promises.rm(stageRoot, { recursive: true, force: true })
    throw error
  }
}

async function replaceStorageDirectory(sourcePath: string, destinationPath: string) {
  await fs.promises.rm(destinationPath, { recursive: true, force: true })
  await fs.promises.cp(sourcePath, destinationPath, { recursive: true, force: true })
}

async function restoreStorageFromStage(stageRoot: string) {
  await ensureStorageDirectories()

  await replaceStorageDirectory(path.join(stageRoot, 'audio'), config.storage.audioPath)
  await replaceStorageDirectory(path.join(stageRoot, 'images'), config.storage.imagesPath)
  await replaceStorageDirectory(path.join(stageRoot, 'hls'), config.storage.hlsPath)
}

async function truncateAllTables(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe(`TRUNCATE TABLE ${BACKUP_TABLES.join(', ')} RESTART IDENTITY CASCADE`)
}

async function restoreDatabase(payload: BackupPayload) {
  await prisma.$transaction(async (tx) => {
    await truncateAllTables(tx)

    if (payload.data.users.length) {
      await tx.user.createMany({
        data: convertDateFields(payload.data.users, [
          'licenseExpiresAt',
          'inviteExpiresAt',
          'invitedAt',
          'resetPasswordExpiresAt',
          'createdAt',
          'updatedAt',
        ]) as Prisma.UserUncheckedCreateInput[],
      })
    }

    if (payload.data.smtpSettings.length) {
      await tx.smtpSettings.createMany({
        data: convertDateFields(payload.data.smtpSettings, ['createdAt', 'updatedAt']) as Prisma.SmtpSettingsUncheckedCreateInput[],
      })
    }

    if (payload.data.categories.length) {
      await tx.category.createMany({
        data: convertDateFields(payload.data.categories, ['createdAt', 'updatedAt']) as Prisma.CategoryUncheckedCreateInput[],
      })
    }

    if (payload.data.tags.length) {
      await tx.tag.createMany({
        data: convertDateFields(payload.data.tags, ['createdAt', 'updatedAt']) as Prisma.TagUncheckedCreateInput[],
      })
    }

    if (payload.data.albumImages.length) {
      await tx.albumImage.createMany({
        data: convertDateFields(payload.data.albumImages, ['createdAt', 'updatedAt']) as Prisma.AlbumImageUncheckedCreateInput[],
      })
    }

    if (payload.data.articles.length) {
      await tx.article.createMany({
        data: convertDateFields(payload.data.articles, ['publishedAt', 'createdAt', 'updatedAt']) as Prisma.ArticleUncheckedCreateInput[],
      })
    }

    if (payload.data.audios.length) {
      await tx.audio.createMany({
        data: convertDateFields(payload.data.audios, ['publishedAt', 'createdAt', 'updatedAt']) as Prisma.AudioUncheckedCreateInput[],
      })
    }

    if (payload.data.tagAliases.length) {
      await tx.tagAlias.createMany({
        data: convertDateFields(payload.data.tagAliases, ['createdAt']) as Prisma.TagAliasUncheckedCreateInput[],
      })
    }

    if (payload.data.articleTags.length) {
      await tx.articleTag.createMany({
        data: payload.data.articleTags,
      })
    }

    if (payload.data.audioTags.length) {
      await tx.audioTag.createMany({
        data: payload.data.audioTags,
      })
    }

    if (payload.data.inviteCodes.length) {
      await tx.inviteCode.createMany({
        data: convertDateFields(payload.data.inviteCodes, ['expiresAt', 'redeemedAt', 'createdAt', 'updatedAt']) as Prisma.InviteCodeUncheckedCreateInput[],
      })
    }

    if (payload.data.pendingRegistrations.length) {
      await tx.pendingRegistration.createMany({
        data: convertDateFields(payload.data.pendingRegistrations, [
          'verificationExpiresAt',
          'verifiedAt',
          'createdAt',
          'updatedAt',
        ]) as Prisma.PendingRegistrationUncheckedCreateInput[],
      })
    }

    if (payload.data.analyticsEvents.length) {
      await tx.analyticsEvent.createMany({
        data: convertDateFields(payload.data.analyticsEvents, ['occurredAt']) as Prisma.AnalyticsEventUncheckedCreateInput[],
      })
    }

    if (payload.data.auditLogs.length) {
      await tx.auditLog.createMany({
        data: convertDateFields(payload.data.auditLogs, ['occurredAt']) as Prisma.AuditLogUncheckedCreateInput[],
      })
    }

    if (payload.data.playbackSessions.length) {
      await tx.playbackSession.createMany({
        data: convertDateFields(payload.data.playbackSessions, [
          'expiresAt',
          'revokedAt',
          'startedAt',
          'createdAt',
          'updatedAt',
        ]) as Prisma.PlaybackSessionUncheckedCreateInput[],
      })
    }
  })
}

async function createBackupPayload(): Promise<BackupPayload> {
  await ensureStorageDirectories()

  const [
    users,
    smtpSettings,
    categories,
    tags,
    tagAliases,
    albumImages,
    articles,
    articleTags,
    audios,
    audioTags,
    inviteCodes,
    pendingRegistrations,
    analyticsEvents,
    auditLogs,
    playbackSessions,
    storageFiles,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.smtpSettings.findMany({ orderBy: { id: 'asc' } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.tag.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.tagAlias.findMany({ orderBy: [{ tagId: 'asc' }, { alias: 'asc' }] }),
    prisma.albumImage.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.article.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.articleTag.findMany({ orderBy: [{ articleId: 'asc' }, { tagId: 'asc' }] }),
    prisma.audio.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.audioTag.findMany({ orderBy: [{ audioId: 'asc' }, { tagId: 'asc' }] }),
    prisma.inviteCode.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.pendingRegistration.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.analyticsEvent.findMany({ orderBy: { occurredAt: 'asc' } }),
    prisma.auditLog.findMany({ orderBy: { occurredAt: 'asc' } }),
    prisma.playbackSession.findMany({ orderBy: { createdAt: 'asc' } }),
    collectStorageFiles(),
  ])

  return {
    app: BACKUP_APP_ID,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: {
      users: users as Prisma.UserUncheckedCreateInput[],
      smtpSettings: smtpSettings as Prisma.SmtpSettingsUncheckedCreateInput[],
      categories: categories as Prisma.CategoryUncheckedCreateInput[],
      tags: tags as Prisma.TagUncheckedCreateInput[],
      tagAliases: tagAliases as Prisma.TagAliasUncheckedCreateInput[],
      albumImages: albumImages as Prisma.AlbumImageUncheckedCreateInput[],
      articles: articles as Prisma.ArticleUncheckedCreateInput[],
      articleTags: articleTags as Prisma.ArticleTagUncheckedCreateInput[],
      audios: audios as Prisma.AudioUncheckedCreateInput[],
      audioTags: audioTags as Prisma.AudioTagUncheckedCreateInput[],
      inviteCodes: inviteCodes as Prisma.InviteCodeUncheckedCreateInput[],
      pendingRegistrations: pendingRegistrations as Prisma.PendingRegistrationUncheckedCreateInput[],
      analyticsEvents: analyticsEvents as Prisma.AnalyticsEventUncheckedCreateInput[],
      auditLogs: auditLogs as Prisma.AuditLogUncheckedCreateInput[],
      playbackSessions: playbackSessions as Prisma.PlaybackSessionUncheckedCreateInput[],
    },
    storage: {
      files: storageFiles,
    },
  }
}

export async function createSystemBackup() {
  const payload = await createBackupPayload()

  return {
    fileName: buildBackupFilename(new Date(payload.createdAt), 'manual'),
    buffer: serializeBackupPayload(payload),
    summary: {
      exportedAt: payload.createdAt,
      counts: buildBackupCounts(payload),
      storageFiles: payload.storage.files.length,
    } satisfies BackupSummary,
  }
}

async function statLocalBackup(fileName: string): Promise<LocalBackupFileMetadata> {
  const absolutePath = getLocalBackupFilePath(fileName)
  const fileStat = await fs.promises.stat(absolutePath)

  return {
    fileName,
    filePath: absolutePath,
    size: fileStat.size,
    createdAt: fileStat.birthtime.toISOString(),
    source: parseBackupSource(fileName),
  }
}

export async function listLocalBackups() {
  await ensureStorageDirectories()
  const entries = await fs.promises.readdir(config.storage.backupsPath, { withFileTypes: true })
  const backupFiles = entries
    .filter((entry) => entry.isFile() && entry.name !== BACKUP_SETTINGS_FILE && entry.name.endsWith('.json.gz'))
    .map((entry) => entry.name)

  const files = await Promise.all(backupFiles.map((fileName) => statLocalBackup(fileName)))
  return files.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

async function applyRotation(settingsInput?: BackupAutomationSettings) {
  const settings = settingsInput ?? await readBackupSettings()
  const backups = await listLocalBackups()
  const keepByCount = Math.max(1, settings.retentionCount)
  const cutoffTime = settings.retentionDays == null
    ? null
    : Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000

  const deletions = backups.filter((file, index) => {
    const overCountLimit = index >= keepByCount
    const tooOld = cutoffTime != null && new Date(file.createdAt).getTime() < cutoffTime
    return overCountLimit || tooOld
  })

  await Promise.all(deletions.map((file) => fs.promises.rm(file.filePath, { force: true })))
}

async function storeBackupBuffer(input: { buffer: Buffer; fileName: string }) {
  await ensureStorageDirectories()
  const filePath = getLocalBackupFilePath(input.fileName)
  await fs.promises.writeFile(filePath, input.buffer)
  return statLocalBackup(input.fileName)
}

export async function generateLocalBackup(source: BackupSource = 'manual') {
  const payload = await createBackupPayload()
  const fileName = buildBackupFilename(new Date(payload.createdAt), source)
  const buffer = serializeBackupPayload(payload)
  const storedFile = await storeBackupBuffer({ buffer, fileName })
  const settings = await readBackupSettings()
  await applyRotation(settings)

  return {
    file: storedFile,
    summary: {
      exportedAt: payload.createdAt,
      counts: buildBackupCounts(payload),
      storageFiles: payload.storage.files.length,
    } satisfies BackupSummary,
  }
}

export async function importLocalBackup(input: { filePath: string; sourceFileName?: string | null }) {
  const sourceBuffer = await fs.promises.readFile(input.filePath)
  const payload = deserializeBackupPayload(sourceBuffer)
  const fileName = buildBackupFilename(new Date(payload.createdAt), 'imported')
  const storedFile = await storeBackupBuffer({ buffer: serializeBackupPayload(payload), fileName })
  const settings = await readBackupSettings()
  await applyRotation(settings)

  return {
    file: storedFile,
    summary: {
      exportedAt: payload.createdAt,
      counts: buildBackupCounts(payload),
      storageFiles: payload.storage.files.length,
    } satisfies BackupSummary,
  }
}

export async function exportLocalBackup(fileName?: string) {
  if (fileName) {
    const normalized = sanitizeLocalBackupFileName(fileName)
    const filePath = getLocalBackupFilePath(normalized)
    return {
      fileName: normalized,
      buffer: await fs.promises.readFile(filePath),
    }
  }

  const generated = await generateLocalBackup('manual')
  return {
    fileName: generated.file.fileName,
    buffer: await fs.promises.readFile(generated.file.filePath),
  }
}

export async function restoreSystemBackup(input: { filePath: string }) {
  const sourceBuffer = await fs.promises.readFile(input.filePath)
  const payload = deserializeBackupPayload(sourceBuffer)
  const stageRoot = await stageStorageFiles(payload.storage.files)

  try {
    await restoreDatabase(payload)
    await restoreStorageFromStage(stageRoot)

    return {
      restoredAt: new Date().toISOString(),
      counts: buildBackupCounts(payload),
      storageFiles: payload.storage.files.length,
    }
  } finally {
    await fs.promises.rm(stageRoot, { recursive: true, force: true })
  }
}

export async function restoreLocalBackup(fileName: string) {
  return restoreSystemBackup({ filePath: getLocalBackupFilePath(fileName) })
}

export async function getBackupOverview(): Promise<BackupOverview> {
  const [settings, files] = await Promise.all([
    readBackupSettings(),
    listLocalBackups(),
  ])

  return {
    storagePath: config.storage.backupsPath,
    settings,
    runtime: {
      schedulerRunning: schedulerTimer != null,
      jobRunning: schedulerJobRunning,
    },
    files,
  }
}

function getLastScheduledOccurrence(now: Date, settings: BackupAutomationSettings) {
  const [hour, minute] = settings.timeOfDay.split(':').map((value) => Number.parseInt(value, 10))
  const scheduled = new Date(now)
  scheduled.setHours(hour, minute, 0, 0)

  if (settings.frequency === 'DAILY') {
    if (scheduled > now) {
      scheduled.setDate(scheduled.getDate() - 1)
    }
    return scheduled
  }

  const currentDay = scheduled.getDay()
  const dayOffset = (currentDay - settings.dayOfWeek + 7) % 7
  scheduled.setDate(scheduled.getDate() - dayOffset)

  if (scheduled > now) {
    scheduled.setDate(scheduled.getDate() - 7)
  }

  return scheduled
}

async function runScheduledBackupIfDue() {
  if (schedulerJobRunning) {
    return
  }

  const settings = await readBackupSettings()
  if (!settings.enabled) {
    return
  }

  const now = new Date()
  const lastScheduledOccurrence = getLastScheduledOccurrence(now, settings)
  const lastRunAt = settings.lastRunAt ? new Date(settings.lastRunAt) : null

  if (lastRunAt && lastRunAt >= lastScheduledOccurrence) {
    return
  }

  schedulerJobRunning = true

  try {
    await generateLocalBackup('scheduled')
    await saveBackupSettings({
      ...settings,
      lastRunAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      lastError: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore backup schedulato'
    await saveBackupSettings({
      ...settings,
      lastRunAt: now.toISOString(),
      lastError: message,
    })
    console.error('[Backup] Backup schedulato fallito:', error)
  } finally {
    schedulerJobRunning = false
  }
}

export async function startBackupScheduler() {
  await ensureStorageDirectories()

  if (schedulerTimer) {
    return
  }

  await runScheduledBackupIfDue().catch((error) => {
    console.error('[Backup] Errore inizializzazione scheduler:', error)
  })

  schedulerTimer = setInterval(() => {
    void runScheduledBackupIfDue()
  }, config.backups.schedulerPollMs)
}

export function stopBackupScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

export function getBackupMimeType() {
  return 'application/gzip'
}
