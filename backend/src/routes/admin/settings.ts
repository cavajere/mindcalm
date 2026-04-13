import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import {
  AuditAction,
  AuditEntityType,
  NotificationDispatchStatus,
} from '@prisma/client'
import fs from 'fs'
import os from 'os'
import path from 'path'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, clearAuthCookie, requireAdmin } from '../../middleware/auth'
import { config } from '../../config'
import {
  exportLocalBackup,
  generateLocalBackup,
  getBackupMimeType,
  getBackupOverview,
  importLocalBackup,
  readBackupSettings,
  restoreLocalBackup,
  saveBackupSettings,
} from '../../services/backupService'
import { getPaginatedUnlinkedStorageItems, getStorageOverview } from '../../services/storageOverviewService'
import { notificationScheduleValidation, paginationQuery, smtpSettingsValidation } from '../../utils/validators'
import { getBoolean, getNumber, getSingleString } from '../../utils/request'
import { getSmtpSettingsForAdmin, saveSmtpSettings, sendTestMail } from '../../services/smtpService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import {
  getNotificationDispatchStats,
  getNotificationScheduleSettings,
  listNotificationDispatchJobs,
  retryFailedNotificationDispatchJob,
  updateNotificationScheduleSettings,
} from '../../services/notificationService'

const backupUploadDir = path.join(os.tmpdir(), 'mindcalm-admin-backups')

fs.mkdirSync(backupUploadDir, { recursive: true })

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, backupUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase()
      cb(null, `${uuidv4()}${ext || '.json.gz'}`)
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
})

const router = createAsyncRouter()

router.use(adminAuthMiddleware, requireAdmin)

function buildNotificationSettingsInput(req: Request) {
  return {
    immediateHourUtc: getNumber(req.body.immediateHourUtc) ?? 9,
    weeklyHourUtc: getNumber(req.body.weeklyHourUtc) ?? 9,
    weeklyDayOfWeek: getNumber(req.body.weeklyDayOfWeek) ?? 1,
    monthlyHourUtc: getNumber(req.body.monthlyHourUtc) ?? 9,
    monthlyDayOfMonth: getNumber(req.body.monthlyDayOfMonth) ?? 1,
    batchSize: getNumber(req.body.batchSize) ?? 20,
    maxAttempts: getNumber(req.body.maxAttempts) ?? 5,
    retryBaseDelayMinutes: getNumber(req.body.retryBaseDelayMinutes) ?? 5,
    lockTimeoutMinutes: getNumber(req.body.lockTimeoutMinutes) ?? 15,
    retentionDays: getNumber(req.body.retentionDays) ?? 30,
  }
}

router.get('/smtp', async (_req: Request, res: Response) => {
  const settings = await getSmtpSettingsForAdmin()
  res.json(settings)
})

router.put('/smtp', smtpSettingsValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const settings = await saveSmtpSettings({
    host: getSingleString(req.body.host)!,
    port: getNumber(req.body.port)!,
    secure: getBoolean(req.body.secure) ?? false,
    username: getSingleString(req.body.username),
    password: getSingleString(req.body.password),
    fromEmail: getSingleString(req.body.fromEmail)!,
    fromName: getSingleString(req.body.fromName),
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.SMTP_SETTINGS_UPDATED,
    entityType: AuditEntityType.SETTINGS,
    entityId: String(settings.id),
    entityLabel: settings.fromEmail,
    ...getAuditActorFromRequest(req),
    metadata: {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      hasPassword: Boolean(settings.passwordEncrypted),
    },
  })

  res.json({
    id: settings.id,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    hasPassword: Boolean(settings.passwordEncrypted),
    updatedAt: settings.updatedAt,
  })
})

router.post('/smtp/test', async (req: Request, res: Response) => {
  const email = getSingleString(req.body.email) || req.adminUser?.email

  if (!email) {
    res.status(400).json({ error: 'Email test non valida' })
    return
  }

  await sendTestMail(email)

  await logAuditEventSafe({
    req,
    action: AuditAction.SMTP_TEST_SENT,
    entityType: AuditEntityType.SETTINGS,
    entityLabel: email,
    ...getAuditActorFromRequest(req),
    metadata: {
      recipient: email,
    },
  })

  res.json({ message: `Email di test inviata a ${email}` })
})

router.get('/backup', async (_req: Request, res: Response) => {
  const overview = await getBackupOverview()
  res.json(overview)
})

router.get('/storage', async (_req: Request, res: Response) => {
  const overview = await getStorageOverview()
  res.json(overview)
})

router.get('/storage/unlinked', paginationQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri paginazione non validi', details: errors.array() })
    return
  }

  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 20
  const result = await getPaginatedUnlinkedStorageItems(page, limit)
  res.json(result)
})

router.put('/backup', async (req: Request, res: Response) => {
  const current = await readBackupSettings()
  const next = await saveBackupSettings({
    ...current,
    enabled: getBoolean(req.body.enabled) ?? current.enabled,
    frequency: getSingleString(req.body.frequency) === 'WEEKLY' ? 'WEEKLY' : 'DAILY',
    timeOfDay: getSingleString(req.body.timeOfDay) || current.timeOfDay,
    dayOfWeek: getNumber(req.body.dayOfWeek) ?? current.dayOfWeek,
    retentionCount: getNumber(req.body.retentionCount) ?? current.retentionCount,
    retentionDays: req.body.retentionDays === null || req.body.retentionDays === ''
      ? null
      : (getNumber(req.body.retentionDays) ?? current.retentionDays),
  })

  res.json(next)
})

router.post('/backup/generate', async (_req: Request, res: Response) => {
  const backup = await generateLocalBackup('manual')
  res.json({
    message: `Backup locale creato: ${backup.file.fileName}`,
    file: backup.file,
    summary: backup.summary,
  })
})

router.get('/backup/export', async (req: Request, res: Response) => {
  const requestedFileName = getSingleString(req.query.fileName)
  const backup = await exportLocalBackup(requestedFileName || undefined)

  res.setHeader('Content-Type', getBackupMimeType())
  res.setHeader('Content-Disposition', `attachment; filename="${backup.fileName}"`)
  res.setHeader('Content-Length', backup.buffer.byteLength)
  res.send(backup.buffer)
})

router.post('/backup/import', backupUpload.single('backupFile'), async (req: Request, res: Response) => {
  const uploadedFile = req.file

  if (!uploadedFile?.path) {
    res.status(400).json({ error: 'Seleziona un file di backup valido' })
    return
  }

  try {
    const imported = await importLocalBackup({
      filePath: uploadedFile.path,
      sourceFileName: uploadedFile.originalname,
    })

    res.json({
      message: `Backup importato in archivio locale: ${imported.file.fileName}`,
      file: imported.file,
      summary: imported.summary,
    })
  } finally {
    await fs.promises.rm(uploadedFile.path, { force: true }).catch(() => undefined)
  }
})

router.post('/backup/restore', async (req: Request, res: Response) => {
  const confirmationText = getSingleString(req.body.confirmationText)
  const fileName = getSingleString(req.body.fileName)

  if (confirmationText !== 'RIPRISTINA') {
    res.status(400).json({ error: 'Conferma richiesta: digita RIPRISTINA per procedere' })
    return
  }

  if (!fileName) {
    res.status(400).json({ error: 'Seleziona un backup locale da ripristinare' })
    return
  }

  try {
    const restoreResult = await restoreLocalBackup(fileName)

    clearAuthCookie(res, config.jwt.adminCookieName)

    res.json({
      message: 'Ripristino completato. Effettua di nuovo il login.',
      requiresReauth: true,
      restoredAt: restoreResult.restoredAt,
      counts: restoreResult.counts,
      storageFiles: restoreResult.storageFiles,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ripristino backup fallito'
    res.status(400).json({ error: message })
  }
})

router.get('/notifications', async (_req: Request, res: Response) => {
  const [settings, stats] = await Promise.all([
    getNotificationScheduleSettings(),
    getNotificationDispatchStats(),
  ])

  res.json({
    settings,
    stats,
  })
})

router.put('/notifications', notificationScheduleValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const schedule = await updateNotificationScheduleSettings({
    ...buildNotificationSettingsInput(req),
  })

  res.json(schedule)
})

router.get('/notifications/schedule', async (_req: Request, res: Response) => {
  const schedule = await getNotificationScheduleSettings()
  res.json(schedule)
})

router.put('/notifications/schedule', notificationScheduleValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const schedule = await updateNotificationScheduleSettings(buildNotificationSettingsInput(req))
  res.json(schedule)
})

router.get('/notifications/pipeline', paginationQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri paginazione non validi', details: errors.array() })
    return
  }

  const statusInput = getSingleString(req.query.status)?.toUpperCase()
  const status = statusInput && Object.values(NotificationDispatchStatus).includes(statusInput as NotificationDispatchStatus)
    ? (statusInput as NotificationDispatchStatus)
    : undefined

  const result = await listNotificationDispatchJobs({
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    status,
  })

  res.json(result)
})

router.post('/notifications/pipeline/:id/retry', async (req: Request, res: Response) => {
  const jobId = getSingleString(req.params.id)

  if (!jobId) {
    res.status(400).json({ error: 'ID job non valido' })
    return
  }

  try {
    const job = await retryFailedNotificationDispatchJob(jobId)

    if (!job) {
      res.status(404).json({ error: 'Job notifica non trovato' })
      return
    }

    res.json(job)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Retry job notifica fallito'
    res.status(409).json({ error: message })
  }
})

export default router
