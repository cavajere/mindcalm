import { Router, Request, Response } from 'express'
import { AuditAction, AuditEntityType } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { smtpSettingsValidation } from '../../utils/validators'
import { getBoolean, getNumber, getSingleString } from '../../utils/request'
import { getSmtpSettingsForAdmin, saveSmtpSettings, sendTestMail } from '../../services/smtpService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

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

export default router
