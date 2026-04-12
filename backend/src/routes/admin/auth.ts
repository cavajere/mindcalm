import { Router, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { AuditAction, AuditEntityType, AuditOutcome, UserRole } from '@prisma/client'
import {
  acceptInviteValidation,
  bootstrapAdminSetupValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  inviteCodeLookupValidation,
  loginValidation,
  registerWithInviteCodeValidation,
  resetPasswordValidation,
  verifyRegistrationValidation,
} from '../../utils/validators'
import { comparePassword, generateToken, hashPassword } from '../../services/authService'
import {
  adminAuthMiddleware,
  appAuthMiddleware,
  clearAuthCookie,
  getAuthCookieOptions,
  requireAdmin,
  requireBootstrapAdmin,
  resolveAdminRequest,
} from '../../middleware/auth'
import {
  inviteCodeValidationRateLimiter,
  loginRateLimiter,
  registrationRateLimiter,
  registrationVerificationRateLimiter,
} from '../../middleware/rateLimiter'
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
import { getLicenseExpiredPayload, isLicenseExpired } from '../../services/licenseService'
import { getPublicInviteCodeDetails } from '../../services/inviteCodeService'
import { hasActiveAdminUsers, isBootstrapAdminConfigured, validateBootstrapAdminCredentials } from '../../services/bootstrapAdminService'
import {
  completeInviteCodeRegistration,
  getRegistrationVerificationDetails,
  startInviteCodeRegistration,
} from '../../services/registrationService'

const router = Router()

const appCookieOptions = getAuthCookieOptions(config.jwt.appCookieName)
const adminCookieOptions = getAuthCookieOptions(config.jwt.adminCookieName)

type AdminSessionMode = 'anonymous' | 'bootstrap' | 'admin'

function buildAdminSessionResponse(input: {
  authenticated: boolean
  mode: AdminSessionMode
  user?: { id: string; email: string; name: string; role: UserRole; isBootstrap?: boolean } | null
  bootstrapEnabled: boolean
  hasActiveAdmin: boolean
}) {
  return {
    authenticated: input.authenticated,
    mode: input.mode,
    user: input.user ?? null,
    bootstrapEnabled: input.bootstrapEnabled,
    hasActiveAdmin: input.hasActiveAdmin,
  }
}

function setAppAuthSession(
  res: Response,
  user: { id: string; email: string; name: string; role: UserRole; sessionVersion: number },
) {
  const authToken = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  })

  res.cookie(config.jwt.appCookieName, authToken, appCookieOptions)
}

function setAdminAuthSession(
  res: Response,
  user: { id: string; email: string; name: string; role: UserRole; sessionVersion: number; bootstrap?: boolean },
) {
  const authToken = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
    bootstrap: user.bootstrap,
  })

  res.cookie(config.jwt.adminCookieName, authToken, adminCookieOptions)
}

// POST /api/auth/login
router.post('/login', loginRateLimiter, loginValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  const hasRealAdmin = await hasActiveAdminUsers()
  const bootstrapEnabled = !hasRealAdmin && isBootstrapAdminConfigured()

  if (user && user.role === UserRole.ADMIN && user.isActive && (await comparePassword(password, user.password))) {
    setAdminAuthSession(res, user)

    res.json(buildAdminSessionResponse({
      authenticated: true,
      mode: 'admin',
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isBootstrap: false },
      bootstrapEnabled,
      hasActiveAdmin: hasRealAdmin,
    }))

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
    return
  }

  const bootstrapAdmin = await validateBootstrapAdminCredentials(email, password)
  if (bootstrapAdmin) {
    setAdminAuthSession(res, {
      ...bootstrapAdmin,
      sessionVersion: 0,
      bootstrap: true,
    })

    res.json(buildAdminSessionResponse({
      authenticated: true,
      mode: 'bootstrap',
      user: bootstrapAdmin,
      bootstrapEnabled: true,
      hasActiveAdmin: false,
    }))

    await logAuditEventSafe({
      req,
      action: AuditAction.LOGIN_SUCCEEDED,
      entityType: AuditEntityType.AUTH,
      entityLabel: bootstrapAdmin.email,
      actorEmail: bootstrapAdmin.email,
      actorName: bootstrapAdmin.name,
      actorRole: bootstrapAdmin.role,
      metadata: {
        channel: 'ADMIN_PORTAL',
        bootstrap: true,
      },
    })
    return
  }

  clearAuthCookie(res, config.jwt.adminCookieName)
  await logAuditEventSafe({
    req,
    action: AuditAction.LOGIN_FAILED,
    entityType: AuditEntityType.AUTH,
    entityLabel: email,
    outcome: AuditOutcome.FAILURE,
    actorEmail: email,
    metadata: {
      channel: 'ADMIN_PORTAL',
      bootstrapAvailable: bootstrapEnabled,
    },
  })
  res.status(401).json({ error: 'Credenziali non valide' })
})

// POST /api/auth/app-login
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

  if (isLicenseExpired(user)) {
    await logAuditEventSafe({
      req,
      action: AuditAction.LOGIN_FAILED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      entityLabel: user.email,
      outcome: AuditOutcome.FAILURE,
      actorUserId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      metadata: {
        channel: 'APP',
        reason: 'LICENSE_EXPIRED',
        licenseExpiresAt: user.licenseExpiresAt,
      },
    })
    res.status(403).json(getLicenseExpiredPayload(user.licenseExpiresAt!))
    return
  }

  setAppAuthSession(res, user)

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

// GET /api/admin/session
router.get('/session', async (req: Request, res: Response) => {
  const hasRealAdmin = await hasActiveAdminUsers()
  const bootstrapEnabled = !hasRealAdmin && isBootstrapAdminConfigured()
  const authResult = await resolveAdminRequest(req)

  if (authResult.kind !== 'authenticated') {
    if (authResult.clearCookieName) {
      clearAuthCookie(res, authResult.clearCookieName)
    }

    res.json(buildAdminSessionResponse({
      authenticated: false,
      mode: 'anonymous',
      bootstrapEnabled,
      hasActiveAdmin: hasRealAdmin,
    }))
    return
  }

  res.json(buildAdminSessionResponse({
    authenticated: true,
    mode: authResult.principal.isBootstrap ? 'bootstrap' : 'admin',
    user: authResult.principal,
    bootstrapEnabled,
    hasActiveAdmin: hasRealAdmin,
  }))
})

// GET /api/auth/me
router.get('/me', adminAuthMiddleware, requireAdmin, async (req: Request, res: Response) => {
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

// GET /api/auth/app-me
router.get('/app-me', appAuthMiddleware, async (req: Request, res: Response) => {
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

// POST /api/auth/logout
router.post('/logout', adminAuthMiddleware, async (req: Request, res: Response) => {
  await logAuditEventSafe({
    req,
    action: AuditAction.LOGOUT,
    entityType: AuditEntityType.AUTH,
    entityId: req.adminUser!.isBootstrap ? null : req.adminUser!.id,
    entityLabel: req.adminUser!.email,
    ...getAuditActorFromRequest(req),
    metadata: {
      channel: 'ADMIN_PORTAL',
      bootstrap: req.adminUser?.isBootstrap ?? false,
    },
  })

  clearAuthCookie(res, config.jwt.adminCookieName)
  res.json({ message: 'Logout effettuato' })
})

// POST /api/auth/app-logout
router.post('/app-logout', appAuthMiddleware, async (req: Request, res: Response) => {
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

// POST /api/auth/bootstrap/setup
router.post('/bootstrap/setup', adminAuthMiddleware, requireBootstrapAdmin, bootstrapAdminSetupValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const email = getSingleString(req.body.email)!.trim().toLowerCase()
  const firstName = getSingleString(req.body.firstName)!.trim().replace(/\s+/g, ' ')
  const lastName = getSingleString(req.body.lastName)!.trim().replace(/\s+/g, ' ')
  const phone = getSingleString(req.body.phone)!.trim().replace(/\s+/g, ' ')
  const password = getSingleString(req.body.password)!
  const fullName = `${firstName} ${lastName}`.trim()

  try {
    const createdAdmin = await prisma.$transaction(async (tx) => {
      if (await hasActiveAdminUsers(tx)) {
        throw new Error('La configurazione iniziale è già stata completata')
      }

      const existing = await tx.user.findUnique({ where: { email } })
      if (existing) {
        throw new Error('Email già utilizzata')
      }

      return tx.user.create({
        data: {
          email,
          password: await hashPassword(password),
          name: fullName,
          firstName,
          lastName,
          phone,
          role: UserRole.ADMIN,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          sessionVersion: true,
        },
      })
    })

    setAdminAuthSession(res, createdAdmin)

    await logAuditEventSafe({
      req,
      action: AuditAction.USER_CREATED,
      entityType: AuditEntityType.USER,
      entityId: createdAdmin.id,
      entityLabel: createdAdmin.email,
      actorEmail: req.adminUser!.email,
      actorName: req.adminUser!.name,
      actorRole: req.adminUser!.role,
      metadata: {
        bootstrap: true,
        role: createdAdmin.role,
        initialSetup: true,
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.LOGIN_SUCCEEDED,
      entityType: AuditEntityType.AUTH,
      entityId: createdAdmin.id,
      entityLabel: createdAdmin.email,
      actorUserId: createdAdmin.id,
      actorEmail: createdAdmin.email,
      actorName: createdAdmin.name,
      actorRole: createdAdmin.role,
      metadata: {
        channel: 'ADMIN_PORTAL',
        via: 'BOOTSTRAP_SETUP',
      },
    })

    res.status(201).json(buildAdminSessionResponse({
      authenticated: true,
      mode: 'admin',
      user: {
        id: createdAdmin.id,
        email: createdAdmin.email,
        name: createdAdmin.name,
        role: createdAdmin.role,
        isBootstrap: false,
      },
      bootstrapEnabled: false,
      hasActiveAdmin: true,
    }))
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

// POST /api/auth/forgot-password
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

// POST /api/auth/reset-password
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

// GET /api/auth/invite-details
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

// POST /api/auth/accept-invite
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
    setAppAuthSession(res, user)
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

// POST /api/auth/validate-invite-code
router.post('/validate-invite-code', inviteCodeValidationRateLimiter, inviteCodeLookupValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const code = getSingleString(req.body.code)

  try {
    const inviteCode = await getPublicInviteCodeDetails(code!)
    res.json({
      valid: true,
      licenseDurationDays: inviteCode.licenseDurationDays,
    })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

// POST /api/auth/register-with-invite-code
router.post('/register-with-invite-code', registrationRateLimiter, registerWithInviteCodeValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const code = getSingleString(req.body.code)
  const email = getSingleString(req.body.email)
  const firstName = getSingleString(req.body.firstName)
  const lastName = getSingleString(req.body.lastName)
  const phone = getSingleString(req.body.phone)
  const password = getSingleString(req.body.password)
  const verificationBaseUrl = getSingleString(req.body.verificationBaseUrl)

  try {
    const registration = await startInviteCodeRegistration({
      code: code!,
      email: email!,
      firstName: firstName!,
      lastName: lastName!,
      phone: phone!,
      password: password!,
      verificationBaseUrl: verificationBaseUrl!,
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.REGISTRATION_STARTED,
      entityType: AuditEntityType.REGISTRATION,
      entityLabel: registration.email,
      actorEmail: registration.email,
      metadata: {
        channel: 'SELF_SERVICE',
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.REGISTRATION_VERIFICATION_SENT,
      entityType: AuditEntityType.REGISTRATION,
      entityLabel: registration.email,
      actorEmail: registration.email,
      metadata: {
        channel: 'SELF_SERVICE',
        verificationExpiresAt: registration.verificationExpiresAt,
        licenseDurationDays: registration.licenseDurationDays,
      },
    })

    res.json({ message: 'Controlla la tua email per completare la registrazione' })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.REGISTRATION_FAILED,
      entityType: AuditEntityType.REGISTRATION,
      entityLabel: email ?? 'Registrazione',
      outcome: AuditOutcome.FAILURE,
      actorEmail: email ?? null,
      metadata: {
        channel: 'SELF_SERVICE',
        stage: 'REGISTRATION_START',
        error: (error as Error).message,
      },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

// GET /api/auth/registration-verification-details
router.get('/registration-verification-details', async (req: Request, res: Response) => {
  const token = getSingleString(req.query.token)
  if (!token) {
    res.status(400).json({ error: 'Token verifica mancante' })
    return
  }

  try {
    const registration = await getRegistrationVerificationDetails(token)
    res.json(registration)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

// POST /api/auth/verify-registration
router.post('/verify-registration', registrationVerificationRateLimiter, verifyRegistrationValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const token = getSingleString(req.body.token)

  try {
    const result = await completeInviteCodeRegistration(token!)
    setAppAuthSession(res, result.user)

    res.json({
      message: 'Registrazione confermata',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.REGISTRATION_VERIFIED,
      entityType: AuditEntityType.REGISTRATION,
      entityId: result.user.id,
      entityLabel: result.user.email,
      actorUserId: result.user.id,
      actorEmail: result.user.email,
      actorName: result.user.name,
      actorRole: result.user.role,
      metadata: {
        channel: 'APP',
        licenseExpiresAt: result.licenseExpiresAt,
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_CODE_REDEEMED,
      entityType: AuditEntityType.INVITE_CODE,
      entityId: result.inviteCode.id,
      entityLabel: result.inviteCode.code,
      actorUserId: result.user.id,
      actorEmail: result.user.email,
      actorName: result.user.name,
      actorRole: result.user.role,
      metadata: {
        channel: 'APP',
      },
    })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.REGISTRATION_FAILED,
      entityType: AuditEntityType.REGISTRATION,
      entityLabel: 'Verifica registrazione',
      outcome: AuditOutcome.FAILURE,
      metadata: {
        channel: 'SELF_SERVICE',
        stage: 'REGISTRATION_VERIFY',
        error: (error as Error).message,
      },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

// POST /api/auth/app-change-password
router.post('/app-change-password', appAuthMiddleware, changePasswordValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const currentPassword = getSingleString(req.body.currentPassword)
  const newPassword = getSingleString(req.body.newPassword)

  try {
    const user = await changeUserPassword(req.adminUser!.id, currentPassword!, newPassword!)
    setAppAuthSession(res, user)
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
