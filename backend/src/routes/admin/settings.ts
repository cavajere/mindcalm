import { Router, Request, Response } from 'express'
import { AuditAction, AuditEntityType } from '@prisma/client'
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
import { smtpSettingsValidation } from '../../utils/validators'
import { getBoolean, getNumber, getSingleString } from '../../utils/request'
import { getSmtpSettingsForAdmin, saveSmtpSettings, sendTestMail } from '../../services/smtpService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

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

const router = Router()

router.use(adminAuthMiddleware, requireAdmin)

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

export default router
