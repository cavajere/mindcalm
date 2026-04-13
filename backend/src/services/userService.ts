import { UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { config } from '../config'
import { generateRandomToken, hashToken } from './cryptoService'
import { comparePassword, hashPassword } from './authService'
import { sendMail } from './smtpService'
import { buildUserInviteEmail } from './email/templates'
import { buildAppUrl } from '../utils/appUrls'

function formatInvitationExpiry(expiresInHours: number) {
  if (expiresInHours % 24 === 0) {
    const days = expiresInHours / 24
    return `${days} ${days === 1 ? 'giorno' : 'giorni'}`
  }

  return `${expiresInHours} ${expiresInHours === 1 ? 'ora' : 'ore'}`
}

export async function createPasswordReset(userId: string) {
  const token = generateRandomToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + config.resetPassword.expiresInMinutes * 60 * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: expiresAt,
    },
  })

  return { token, expiresAt }
}

export async function createUserInvite(userId: string) {
  const token = generateRandomToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + config.invitation.expiresInHours * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: expiresAt,
      invitedAt: new Date(),
    },
  })

  return { token, expiresAt }
}

export async function sendUserInvite(user: { id: string; email: string; name: string }, inviteBaseUrl: string) {
  const { token, expiresAt } = await createUserInvite(user.id)
  const inviteUrl = `${buildAppUrl(inviteBaseUrl, '/accept-invite')}?token=${encodeURIComponent(token)}`
  const expiresIn = formatInvitationExpiry(config.invitation.expiresInHours)
  const template = buildUserInviteEmail({
    name: user.name,
    inviteUrl,
    expiresAt,
    expiresIn,
  })

  await sendMail({
    to: user.email,
    ...template,
  })

  return { expiresAt }
}

export async function resetUserPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token)
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { gt: new Date() },
      isActive: true,
    },
  })

  if (!user) {
    throw new Error('Token reset password non valido o scaduto')
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
    },
  })
}

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user || !user.isActive) {
    throw new Error('Utente non trovato')
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, user.password)
  if (!isCurrentPasswordValid) {
    throw new Error('Password attuale non corretta')
  }

  const isSamePassword = await comparePassword(newPassword, user.password)
  if (isSamePassword) {
    throw new Error('La nuova password deve essere diversa da quella attuale')
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
    },
  })

  return updatedUser
}

export async function getInviteDetails(token: string) {
  const tokenHash = hashToken(token)
  const user = await prisma.user.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      inviteExpiresAt: true,
    },
  })

  if (!user) {
    throw new Error('Invito non valido o scaduto')
  }

  return user
}

export async function acceptUserInvite(token: string, newPassword: string) {
  const tokenHash = hashToken(token)
  const user = await prisma.user.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { gt: new Date() },
      isActive: true,
    },
  })

  if (!user) {
    throw new Error('Invito non valido o scaduto')
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(newPassword),
      sessionVersion: { increment: 1 },
      inviteTokenHash: null,
      inviteExpiresAt: null,
      invitedAt: null,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
    },
  })

  return updatedUser
}

export async function getAdminUsersCount() {
  return prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
    },
  })
}
