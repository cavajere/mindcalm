import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType, AuditOutcome, NotificationFrequency, UserRole } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { paginationQuery, userCreateValidation, userUpdateValidation } from '../../utils/validators'
import { prisma } from '../../lib/prisma'
import { getBoolean, getSingleString } from '../../utils/request'
import { hashPassword } from '../../services/authService'
import { getAdminUsersCount, sendUserInvite } from '../../services/userService'
import { generateRandomToken } from '../../services/cryptoService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { parseLicenseExpiresAtInput } from '../../services/licenseService'
import { updateUserNotificationPreferences } from '../../services/notificationService'
import { resolveAppBaseUrl } from '../../utils/appUrls'
import { config } from '../../config'

function serializeUser(user: {
  id: string
  email: string
  name: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  notes: string | null
  role: UserRole
  isActive: boolean
  licenseExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  invitedAt: Date | null
  inviteTokenHash: string | null
  notificationPreference: {
    notifyOnAudio: boolean
    notifyOnThoughts: boolean
    frequency: NotificationFrequency
  } | null
}) {
  const fallbackName = user.name.trim().replace(/\s+/g, ' ')
  const { firstName, lastName } = getResolvedNameParts(user)
  const fullName = `${firstName} ${lastName}`.trim() || fallbackName
  const notificationPreferences = serializeNotificationPreferences(user.notificationPreference)

  return {
    id: user.id,
    email: user.email,
    name: fullName,
    firstName,
    lastName,
    phone: user.phone || '',
    notes: user.notes || '',
    role: user.role,
    isActive: user.isActive,
    licenseExpiresAt: user.licenseExpiresAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    invitedAt: user.invitedAt,
    hasPendingInvite: Boolean(user.inviteTokenHash),
    notificationPreferences,
  }
}

const router = createAsyncRouter()
const userSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  notes: true,
  role: true,
  isActive: true,
  licenseExpiresAt: true,
  createdAt: true,
  updatedAt: true,
  invitedAt: true,
  inviteTokenHash: true,
  notificationPreference: {
    select: {
      notifyOnAudio: true,
      notifyOnThoughts: true,
      frequency: true,
    },
  },
} as const

function normalizeNamePart(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return { firstName: '', lastName: '' }
  }

  const [firstName, ...lastNameParts] = normalized.split(' ')
  return {
    firstName,
    lastName: lastNameParts.join(' '),
  }
}

function getResolvedNameParts(user: { name: string; firstName: string | null; lastName: string | null }) {
  const fallback = splitFullName(user.name)

  return {
    firstName: user.firstName?.trim() || fallback.firstName,
    lastName: user.lastName?.trim() || fallback.lastName,
  }
}

function buildFullName(firstName: string, lastName: string) {
  return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim()
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeOptionalPhone(value: string | undefined) {
  const normalized = value?.trim().replace(/\s+/g, ' ')
  return normalized ? normalized : null
}

function getDefaultNotificationPreferences() {
  return {
    notifyOnAudio: true,
    notifyOnThoughts: true,
    frequency: NotificationFrequency.NONE,
  }
}

function serializeNotificationPreferences(preference: {
  notifyOnAudio: boolean
  notifyOnThoughts: boolean
  frequency: NotificationFrequency
} | null | undefined) {
  if (preference) {
    return {
      notifyOnAudio: preference.notifyOnAudio,
      notifyOnThoughts: preference.notifyOnThoughts,
      frequency: preference.frequency,
    }
  }

  return getDefaultNotificationPreferences()
}

function resolveNotificationPreferencesInput(
  body: Request['body'],
  basePreferences: {
    notifyOnAudio: boolean
    notifyOnThoughts: boolean
    frequency: NotificationFrequency
  },
) {
  const hasNotifyOnAudio = Object.prototype.hasOwnProperty.call(body, 'notifyOnAudio')
  const hasNotifyOnArticles = Object.prototype.hasOwnProperty.call(body, 'notifyOnThoughts')
  const hasFrequency = Object.prototype.hasOwnProperty.call(body, 'frequency')

  if (!hasNotifyOnAudio && !hasNotifyOnArticles && !hasFrequency) {
    return undefined
  }

  return {
    notifyOnAudio: hasNotifyOnAudio ? (getBoolean(body.notifyOnAudio) ?? basePreferences.notifyOnAudio) : basePreferences.notifyOnAudio,
    notifyOnThoughts: hasNotifyOnArticles ? (getBoolean(body.notifyOnThoughts) ?? basePreferences.notifyOnThoughts) : basePreferences.notifyOnThoughts,
    frequency: hasFrequency
      ? ((getSingleString(body.frequency) as NotificationFrequency | undefined) ?? basePreferences.frequency)
      : basePreferences.frequency,
  }
}

router.use(adminAuthMiddleware, requireAdmin)

router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: userSelect,
    }),
    prisma.user.count(),
  ])

  res.json({
    data: users.map(serializeUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/:id', async (req: Request, res: Response) => {
  const userId = getSingleString(req.params.id)
  if (!userId) {
    res.status(400).json({ error: 'ID utente non valido' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })

  if (!user) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  res.json(serializeUser(user))
})

router.post('/', userCreateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const email = getSingleString(req.body.email)!
  const firstName = normalizeNamePart(getSingleString(req.body.firstName)!)
  const lastName = normalizeNamePart(getSingleString(req.body.lastName)!)
  const phone = normalizeOptionalPhone(getSingleString(req.body.phone))
  const notes = normalizeOptionalText(getSingleString(req.body.notes))
  const role = (getSingleString(req.body.role) as UserRole | undefined) || UserRole.STANDARD
  const password = getSingleString(req.body.password)
  const isActive = getBoolean(req.body.isActive) ?? true
  const licenseExpiresAtInput = getSingleString(req.body.licenseExpiresAt)
  const sendInvite = getBoolean(req.body.sendInvite) ?? false
  let inviteBaseUrl: string | null = null
  const licenseExpiresAt = role === UserRole.STANDARD ? parseLicenseExpiresAtInput(licenseExpiresAtInput) ?? null : null
  const notificationPreferencesInput = resolveNotificationPreferencesInput(req.body, getDefaultNotificationPreferences())

  if (sendInvite && password) {
    res.status(400).json({ error: 'Scegli se impostare una password o inviare un invito, non entrambi' })
    return
  }

  if (!sendInvite && !password) {
    res.status(400).json({ error: 'Password obbligatoria se non invii un invito' })
    return
  }

  if (sendInvite && !isActive) {
    res.status(400).json({ error: 'L’utente deve essere attivo per poter ricevere un invito' })
    return
  }

  if (sendInvite) {
    try {
      inviteBaseUrl = resolveAppBaseUrl(getSingleString(req.body.inviteBaseUrl), config.appUrls.public, 'invito utente')
    } catch (error) {
      res.status(500).json({ error: (error as Error).message })
      return
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email già utilizzata' })
    return
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: buildFullName(firstName, lastName),
      firstName,
      lastName,
      phone,
      notes,
      role,
      isActive,
      licenseExpiresAt,
      password: await hashPassword(password || generateRandomToken()),
    },
    select: userSelect,
  })

  if (notificationPreferencesInput) {
    await updateUserNotificationPreferences(user.id, notificationPreferencesInput)
  }

  if (sendInvite) {
    try {
      await sendUserInvite(user, inviteBaseUrl!)
      const refreshedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: userSelect,
      })

      await logAuditEventSafe({
        req,
        action: AuditAction.USER_CREATED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        entityLabel: user.email,
        ...getAuditActorFromRequest(req),
        metadata: {
          role: user.role,
          isActive: user.isActive,
          sendInvite: true,
        },
      })

      await logAuditEventSafe({
        req,
        action: AuditAction.INVITE_SENT,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        entityLabel: user.email,
        ...getAuditActorFromRequest(req),
        metadata: {
          via: 'USER_CREATE',
        },
      })

      res.status(201).json(serializeUser(refreshedUser!))
      return
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } })
      await logAuditEventSafe({
        req,
        action: AuditAction.USER_CREATED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        entityLabel: user.email,
        ...getAuditActorFromRequest(req),
        outcome: AuditOutcome.FAILURE,
        metadata: {
          role,
          isActive,
          sendInvite: true,
          error: (error as Error).message,
        },
      })
      res.status(400).json({ error: (error as Error).message })
      return
    }
  }

  await logAuditEventSafe({
    req,
    action: AuditAction.USER_CREATED,
    entityType: AuditEntityType.USER,
    entityId: user.id,
    entityLabel: user.email,
    ...getAuditActorFromRequest(req),
    metadata: {
      role: user.role,
      isActive: user.isActive,
      sendInvite: false,
    },
  })

  res.status(201).json(serializeUser(user))
})

router.put('/:id', userUpdateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const userId = getSingleString(req.params.id)
  if (!userId) {
    res.status(400).json({ error: 'ID utente non valido' })
    return
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })
  if (!existing) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  const email = getSingleString(req.body.email)
  const firstName = getSingleString(req.body.firstName)
  const lastName = getSingleString(req.body.lastName)
  const phone = getSingleString(req.body.phone)
  const notes = Object.prototype.hasOwnProperty.call(req.body, 'notes')
    ? normalizeOptionalText(getSingleString(req.body.notes))
    : undefined
  const role = getSingleString(req.body.role) as UserRole | undefined
  const password = getSingleString(req.body.password)
  const isActive = getBoolean(req.body.isActive)
  const hasLicenseExpiresAtInput = Object.prototype.hasOwnProperty.call(req.body, 'licenseExpiresAt')
  const licenseExpiresAtInput = hasLicenseExpiresAtInput ? getSingleString(req.body.licenseExpiresAt) : undefined
  const currentNotificationPreferences = serializeNotificationPreferences(existing.notificationPreference)
  const notificationPreferencesInput = resolveNotificationPreferencesInput(req.body, currentNotificationPreferences)

  if (email && email !== existing.email) {
    const emailInUse = await prisma.user.findUnique({ where: { email } })
    if (emailInUse) {
      res.status(409).json({ error: 'Email già utilizzata' })
      return
    }
  }

  const wouldRemoveAdminPrivileges =
    existing.role === UserRole.ADMIN &&
    ((role === UserRole.STANDARD) || (isActive === false))

  if (existing.role === UserRole.ADMIN && role === UserRole.STANDARD && existing.id === req.adminUser!.id) {
    res.status(400).json({ error: 'Non puoi rimuovere il tuo ruolo admin' })
    return
  }

  if (wouldRemoveAdminPrivileges) {
    const adminCount = await getAdminUsersCount()
    const wouldDisableLastAdmin = adminCount <= 1

    if (wouldDisableLastAdmin) {
      res.status(400).json({ error: 'Deve rimanere almeno un admin attivo' })
      return
    }
  }

  const currentNames = getResolvedNameParts(existing)
  const nextRole = role ?? existing.role
  const nextLicenseExpiresAt =
    nextRole === UserRole.STANDARD
      ? (hasLicenseExpiresAtInput ? parseLicenseExpiresAtInput(licenseExpiresAtInput) : existing.licenseExpiresAt)
      : null
  const existingLicenseExpiresAt = existing.licenseExpiresAt?.getTime() ?? null
  const updatedLicenseExpiresAt = nextLicenseExpiresAt?.getTime() ?? null
  const licenseExpiresAtChanged = existingLicenseExpiresAt !== updatedLicenseExpiresAt
  const roleChanged = role !== undefined && role !== existing.role
  const shouldInvalidateSession = Boolean(password) || isActive === false || roleChanged || licenseExpiresAtChanged

  const changedFields = [
    email !== undefined && email !== existing.email ? 'email' : null,
    firstName !== undefined && normalizeNamePart(firstName) !== currentNames.firstName ? 'firstName' : null,
    lastName !== undefined && normalizeNamePart(lastName) !== currentNames.lastName ? 'lastName' : null,
    phone !== undefined && normalizeOptionalPhone(phone) !== (existing.phone ?? null) ? 'phone' : null,
    notes !== undefined && notes !== (existing.notes ?? null) ? 'notes' : null,
    role !== undefined && role !== existing.role ? 'role' : null,
    isActive !== undefined && isActive !== existing.isActive ? 'isActive' : null,
    licenseExpiresAtChanged ? 'licenseExpiresAt' : null,
    password ? 'password' : null,
    notificationPreferencesInput && notificationPreferencesInput.notifyOnAudio !== currentNotificationPreferences.notifyOnAudio ? 'notifyOnAudio' : null,
    notificationPreferencesInput && notificationPreferencesInput.notifyOnThoughts !== currentNotificationPreferences.notifyOnThoughts ? 'notifyOnThoughts' : null,
    notificationPreferencesInput && notificationPreferencesInput.frequency !== currentNotificationPreferences.frequency ? 'frequency' : null,
  ].filter((field): field is string => Boolean(field))

  const nextFirstName = firstName !== undefined ? normalizeNamePart(firstName) : currentNames.firstName
  const nextLastName = lastName !== undefined ? normalizeNamePart(lastName) : currentNames.lastName

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email: email ?? undefined,
      name: (firstName !== undefined || lastName !== undefined) ? buildFullName(nextFirstName, nextLastName) : undefined,
      firstName: firstName !== undefined ? nextFirstName : undefined,
      lastName: lastName !== undefined ? nextLastName : undefined,
      phone: phone !== undefined ? normalizeOptionalPhone(phone) : undefined,
      notes,
      role: role ?? undefined,
      isActive: isActive ?? undefined,
      licenseExpiresAt: hasLicenseExpiresAtInput || nextRole !== existing.role ? nextLicenseExpiresAt : undefined,
      password: password ? await hashPassword(password) : undefined,
      sessionVersion: shouldInvalidateSession ? { increment: 1 } : undefined,
      inviteTokenHash: (password || isActive === false) ? null : undefined,
      inviteExpiresAt: (password || isActive === false) ? null : undefined,
      invitedAt: (password || isActive === false) ? null : undefined,
      resetPasswordTokenHash: (password || isActive === false) ? null : undefined,
      resetPasswordExpiresAt: (password || isActive === false) ? null : undefined,
    },
    select: userSelect,
  })

  if (notificationPreferencesInput) {
    await updateUserNotificationPreferences(updated.id, notificationPreferencesInput)
  }

  const responseUser = notificationPreferencesInput
    ? await prisma.user.findUnique({
        where: { id: updated.id },
        select: userSelect,
      })
    : updated

  await logAuditEventSafe({
    req,
    action: AuditAction.USER_UPDATED,
    entityType: AuditEntityType.USER,
    entityId: updated.id,
    entityLabel: updated.email,
    ...getAuditActorFromRequest(req),
    metadata: {
      changedFields,
      previousRole: existing.role,
      nextRole: updated.role,
      previousIsActive: existing.isActive,
      nextIsActive: updated.isActive,
      previousLicenseExpiresAt: existing.licenseExpiresAt,
      nextLicenseExpiresAt: updated.licenseExpiresAt,
      previousNotificationFrequency: currentNotificationPreferences.frequency,
      nextNotificationFrequency: notificationPreferencesInput?.frequency ?? currentNotificationPreferences.frequency,
    },
  })

  res.json(serializeUser(responseUser!))
})

router.post('/:id/resend-invite', async (req: Request, res: Response) => {
  const userId = getSingleString(req.params.id)
  let inviteBaseUrl: string

  if (!userId) {
    res.status(400).json({ error: 'ID utente non valido' })
    return
  }

  try {
    inviteBaseUrl = resolveAppBaseUrl(getSingleString(req.body.inviteBaseUrl), config.appUrls.public, 'invito utente')
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })

  if (!user) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  if (!user.isActive) {
    res.status(400).json({ error: 'Non puoi invitare un utente disattivato' })
    return
  }

  try {
    await sendUserInvite(user, inviteBaseUrl)
    const refreshedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect,
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.USER_INVITE_RESENT,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      entityLabel: user.email,
      ...getAuditActorFromRequest(req),
      metadata: {
        hadPendingInvite: Boolean(user.inviteTokenHash),
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_SENT,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      entityLabel: user.email,
      ...getAuditActorFromRequest(req),
      metadata: {
        via: 'USER_RESEND_INVITE',
      },
    })

    res.json({ message: 'Invito inviato', user: serializeUser(refreshedUser!) })
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.USER_INVITE_RESENT,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      entityLabel: user.email,
      ...getAuditActorFromRequest(req),
      outcome: AuditOutcome.FAILURE,
      metadata: {
        error: (error as Error).message,
      },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getSingleString(req.params.id)
  if (!userId) {
    res.status(400).json({ error: 'ID utente non valido' })
    return
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  if (existing.id === req.adminUser!.id) {
    res.status(400).json({ error: 'Non puoi eliminare il tuo account' })
    return
  }

  if (existing.role === UserRole.ADMIN) {
    const adminCount = await getAdminUsersCount()
    if (adminCount <= 1) {
      res.status(400).json({ error: 'Deve rimanere almeno un admin attivo' })
      return
    }
  }

  await prisma.user.delete({ where: { id: userId } })

  await logAuditEventSafe({
    req,
    action: AuditAction.USER_DELETED,
    entityType: AuditEntityType.USER,
    entityId: existing.id,
    entityLabel: existing.email,
    ...getAuditActorFromRequest(req),
    metadata: {
      deletedRole: existing.role,
      deletedIsActive: existing.isActive,
    },
  })

  res.json({ message: 'Utente eliminato' })
})

export default router
