import crypto from 'crypto'
import { Prisma, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { config } from '../config'

export const BOOTSTRAP_ADMIN_ID = 'bootstrap-admin'

export interface BootstrapAdminIdentity {
  id: string
  email: string
  name: string
  role: UserRole
  isBootstrap: true
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function isBootstrapAdminConfigured() {
  return Boolean(config.bootstrapAdmin.email && config.bootstrapAdmin.password)
}

export async function hasActiveAdminUsers(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const count = await tx.user.count({
    where: {
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  return count > 0
}

export function buildBootstrapAdminIdentity(): BootstrapAdminIdentity {
  return {
    id: BOOTSTRAP_ADMIN_ID,
    email: config.bootstrapAdmin.email,
    name: config.bootstrapAdmin.name,
    role: UserRole.ADMIN,
    isBootstrap: true,
  }
}

export async function isBootstrapAdminAvailable(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!isBootstrapAdminConfigured()) {
    return false
  }

  return !(await hasActiveAdminUsers(tx))
}

export async function validateBootstrapAdminCredentials(email: string, password: string) {
  if (!(await isBootstrapAdminAvailable())) {
    return null
  }

  const normalizedEmail = email.trim().toLowerCase()
  const expectedEmail = config.bootstrapAdmin.email.trim().toLowerCase()

  if (!timingSafeEqualString(normalizedEmail, expectedEmail)) {
    return null
  }

  if (!timingSafeEqualString(password, config.bootstrapAdmin.password)) {
    return null
  }

  return buildBootstrapAdminIdentity()
}

export async function canUseBootstrapAdminToken(payload: { id?: string; email?: string; bootstrap?: boolean }) {
  if (!payload.bootstrap) {
    return false
  }

  if (!(await isBootstrapAdminAvailable())) {
    return false
  }

  if (payload.id !== BOOTSTRAP_ADMIN_ID) {
    return false
  }

  return payload.email?.trim().toLowerCase() === config.bootstrapAdmin.email.trim().toLowerCase()
}
