import { UserRole } from '@prisma/client'

export const LICENSE_EXPIRED_CODE = 'LICENSE_EXPIRED'

type LicensedUser = {
  role: UserRole
  licenseExpiresAt: Date | null
}

export function parseLicenseExpiresAtInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined

  const normalized = value?.trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-').map((part) => parseInt(part, 10))
    return new Date(year, month - 1, day, 23, 59, 59, 999)
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data scadenza licenza non valida')
  }

  return parsed
}

export function isLicenseExpired(user: LicensedUser, now = new Date()): boolean {
  if (user.role !== UserRole.STANDARD || !user.licenseExpiresAt) {
    return false
  }

  return user.licenseExpiresAt.getTime() <= now.getTime()
}

export function calculateLicenseExpiresAtFromActivation(activatedAt: Date, durationDays: number): Date {
  return new Date(activatedAt.getTime() + (durationDays * 24 * 60 * 60 * 1000))
}

export function getLicenseExpiredPayload(licenseExpiresAt: Date) {
  return {
    error: 'Licenza scaduta',
    code: LICENSE_EXPIRED_CODE,
    licenseExpiresAt: licenseExpiresAt.toISOString(),
  }
}
