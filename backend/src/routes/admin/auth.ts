import { Router, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { AuditAction, AuditEntityType, AuditOutcome, UserRole } from '@prisma/client'
import {
  acceptInviteValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  loginValidation,
  resetPasswordValidation,
} from '../../utils/validators'
import { comparePassword, generateToken } from '../../services/authService'
import { authMiddleware, requireAdmin } from '../../middleware/auth'
import { loginRateLimiter } from '../../middleware/rateLimiter'
import { prisma } from '../../lib/prisma'
import { getSingleString } from '../../utils/request'
import {
  acceptUserInvite,
  changeUserPassword,
  createPasswordReset,
  getInviteDetails,
  resetUserPassword,
} from '../../services/userService'
import { sendMail } from '../../services/smtpService'
import { config } from '../../config'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { revokeAllPlaybackSessionsForUser } from '../../services/playbackSessionService'

const router = Router()

const appCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.isProduction,
  path: '/',
}

// POST /api/v1/auth/login
router.post('/login', loginRateLimiter, loginValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || user.role !== UserRole.ADMIN || !user.isActive || !(await comparePassword(password, user.password))) {
    await logAuditEventSafe({
      req,
      action: AuditAction.LOGIN_FAILED,
      entityType: AuditEntityType.AUTH,
      entityLabel: email,
      outcome: AuditOutcome.FAILURE,
      actorEmail: email,
      metadata: { channel: 'ADMIN_PORTAL' },
    })
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  })

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.LOGIN_SUCCEEDED,
    entityType: AuditEntityType.AUTH,
    entityId: user.id,
    entityLabel: user.email,
    actorUserId: user.id,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    metadata: { channel: 'ADMIN_PORTAL' },
  })
})

// POST /api/v1/auth/app-login
router.post('/app-login', loginRateLimiter, loginValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.isActive || !(await comparePassword(password, user.password))) {
    await logAuditEventSafe({
      req,
      action: AuditAction.LOGIN_FAILED,
      entityType: AuditEntityType.AUTH,
      entityLabel: email,
      outcome: AuditOutcome.FAILURE,
      actorEmail: email,
      metadata: { channel: 'APP' },
    })
    res.status(401).json({ error: 'Credenziali non valide' })
    return
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  })

  res.cookie(config.jwt.appCookieName, token, appCookieOptions)

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.LOGIN_SUCCEEDED,
    entityType: AuditEntityType.AUTH,
    entityId: user.id,
    entityLabel: user.email,
    actorUserId: user.id,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    metadata: { channel: 'APP' },
  })
})

// GET /api/v1/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.adminUser!.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })

  if (!user || !user.isActive || user.role !== UserRole.ADMIN) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  res.json(user)
})

// GET /api/v1/auth/app-me
router.get('/app-me', authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.adminUser!.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })

  if (!user || !user.isActive) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  res.json(user)
})

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  await logAuditEventSafe({
    req,
    action: AuditAction.LOGOUT,
    entityType: AuditEntityType.AUTH,
    entityId: req.adminUser!.id,
    entityLabel: req.adminUser!.email,
    ...getAuditActorFromRequest(req),
    metadata: { channel: 'ADMIN_PORTAL' },
  })

  res.json({ message: 'Logout effettuato' })
})

// POST /api/v1/auth/app-logout
router.post('/app-logout', authMiddleware, async (req: Request, res: Response) => {
  await revokeAllPlaybackSessionsForUser(req.adminUser!.id)

  await logAuditEventSafe({
    req,
    action: AuditAction.LOGOUT,
    entityType: AuditEntityType.AUTH,
    entityId: req.adminUser!.id,
    entityLabel: req.adminUser!.email,
    ...getAuditActorFromRequest(req),
    metadata: { channel: 'APP' },
  })

  res.clearCookie(config.jwt.appCookieName, appCookieOptions)
  res.json({ message: 'Logout effettuato' })
})

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const email = getSingleString(req.body.email)
  const resetBaseUrl = getSingleString(req.body.resetBaseUrl)

  const user = await prisma.user.findUnique({ where: { email: email! } })
  if (!user || !user.isActive) {
    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: AuditEntityType.AUTH,
      entityLabel: email,
      outcome: AuditOutcome.FAILURE,
      actorEmail: email,
      metadata: { channel: 'SELF_SERVICE' },
    })
    res.json({ message: 'Se l’email esiste, riceverai un link per reimpostare la password' })
    return
  }

  try {
    const { token, expiresAt } = await createPasswordReset(user.id)
    const resetUrl = `${resetBaseUrl!.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
    const expiresMinutes = config.resetPassword.expiresInMinutes

    await sendMail({
      to: user.email,
      subject: 'Reimposta la password di MindCalm',
      text:
        `Hai richiesto il reset della password.\n\n` +
        `Usa questo link entro ${expiresMinutes} minuti:\n${resetUrl}\n\n` +
        `Se non hai richiesto il reset, ignora questa email.`,
      html:
        `<p>Hai richiesto il reset della password.</p>` +
        `<p>Usa questo link entro <strong>${expiresMinutes} minuti</strong>:</p>` +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
        `<p>Scadenza: ${expiresAt.toLocaleString('it-IT')}</p>` +
        `<p>Se non hai richiesto il reset, ignora questa email.</p>`,
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      entityLabel: user.email,
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      metadata: { channel: 'SELF_SERVICE' },
    })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      entityLabel: user.email,
      outcome: AuditOutcome.FAILURE,
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      metadata: { channel: 'SELF_SERVICE', error: (error as Error).message },
    })
    res.status(400).json({ error: (error as Error).message })
    return
  }

  res.json({ message: 'Se l’email esiste, riceverai un link per reimpostare la password' })
})

// POST /api/v1/auth/reset-password
router.post('/reset-password', resetPasswordValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const token = getSingleString(req.body.token)
  const password = getSingleString(req.body.password)

  try {
    const user = await resetUserPassword(token!, password!)
    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      entityLabel: user.email,
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      metadata: { channel: 'SELF_SERVICE' },
    })
    res.json({ message: 'Password aggiornata' })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      entityType: AuditEntityType.AUTH,
      entityLabel: 'Password reset',
      outcome: AuditOutcome.FAILURE,
      metadata: { channel: 'SELF_SERVICE', error: (error as Error).message },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

// GET /api/v1/auth/invite-details
router.get('/invite-details', async (req: Request, res: Response) => {
  const token = getSingleString(req.query.token)
  if (!token) {
    res.status(400).json({ error: 'Token invito mancante' })
    return
  }

  try {
    const invite = await getInviteDetails(token)
    res.json(invite)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

// POST /api/v1/auth/accept-invite
router.post('/accept-invite', acceptInviteValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const token = getSingleString(req.body.token)
  const password = getSingleString(req.body.password)

  try {
    const user = await acceptUserInvite(token!, password!)
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    })

    res.cookie(config.jwt.appCookieName, authToken, appCookieOptions)
    res.json({
      message: 'Invito accettato',
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_ACCEPTED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      entityLabel: user.email,
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      metadata: { channel: 'APP' },
    })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_ACCEPTED,
      entityType: AuditEntityType.USER,
      entityLabel: 'Invito utente',
      outcome: AuditOutcome.FAILURE,
      metadata: { channel: 'APP', error: (error as Error).message },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

// POST /api/v1/auth/app-change-password
router.post('/app-change-password', authMiddleware, changePasswordValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const currentPassword = getSingleString(req.body.currentPassword)
  const newPassword = getSingleString(req.body.newPassword)

  try {
    const user = await changeUserPassword(req.adminUser!.id, currentPassword!, newPassword!)
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    })

    res.cookie(config.jwt.appCookieName, token, appCookieOptions)
    res.json({ message: 'Password aggiornata' })

    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      entityLabel: user.email,
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      metadata: { channel: 'APP' },
    })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: AuditEntityType.USER,
      entityId: req.adminUser!.id,
      entityLabel: req.adminUser!.email,
      ...getAuditActorFromRequest(req),
      outcome: AuditOutcome.FAILURE,
      metadata: { channel: 'APP', error: (error as Error).message },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

export default router
