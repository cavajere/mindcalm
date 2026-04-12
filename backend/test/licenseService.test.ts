import { describe, expect, it } from 'vitest'
import { UserRole } from '@prisma/client'
import { isLicenseExpired, parseLicenseExpiresAtInput } from '../src/services/licenseService'

describe('licenseService', () => {
  it('interpreta una data senza orario come fine giornata locale', () => {
    const expiresAt = parseLicenseExpiresAtInput('2026-04-30')

    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt?.getHours()).toBe(23)
    expect(expiresAt?.getMinutes()).toBe(59)
    expect(expiresAt?.getSeconds()).toBe(59)
  })

  it('considera scaduta solo la licenza standard oltre la data limite', () => {
    expect(isLicenseExpired({
      role: UserRole.STANDARD,
      licenseExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    }, new Date('2026-04-02T00:00:00.000Z'))).toBe(true)

    expect(isLicenseExpired({
      role: UserRole.ADMIN,
      licenseExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    }, new Date('2026-04-02T00:00:00.000Z'))).toBe(false)
  })
})
