import { describe, expect, it, vi, beforeEach } from 'vitest'
import { InviteCodeStatus } from '@prisma/client'
import {
  generateInviteCode,
  getInviteCodeEffectiveStatus,
  getPublicInviteCodeDetails,
  normalizeInviteCode,
} from '../src/services/inviteCodeService'

const { prismaInviteCodeFindUnique } = vi.hoisted(() => ({
  prismaInviteCodeFindUnique: vi.fn(),
}))

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    inviteCode: {
      findUnique: prismaInviteCodeFindUnique,
    },
  },
}))

describe('inviteCodeService', () => {
  beforeEach(() => {
    prismaInviteCodeFindUnique.mockReset()
  })

  it('normalizza il codice invito in maiuscolo', () => {
    expect(normalizeInviteCode(' g6k39c2 ')).toBe('G6K39C2')
  })

  it('genera codici di 7 caratteri senza 0 e O', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generateInviteCode()).toMatch(/^[A-NP-Z1-9]{7}$/)
    }
  })

  it('considera scaduto un codice attivo con expiresAt passato', () => {
    expect(getInviteCodeEffectiveStatus({
      status: InviteCodeStatus.ACTIVE,
      expiresAt: new Date('2026-04-10T10:00:00.000Z'),
    }, new Date('2026-04-11T10:00:00.000Z'))).toBe(InviteCodeStatus.EXPIRED)
  })

  it('restituisce i dettagli pubblici di un codice valido', async () => {
    prismaInviteCodeFindUnique.mockResolvedValue({
      id: 'invite-1',
      code: 'G6K39C2',
      licenseDurationDays: 365,
      expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      status: InviteCodeStatus.ACTIVE,
      redemptionsCount: 0,
      maxRedemptions: 1,
    })

    await expect(getPublicInviteCodeDetails('g6k39c2')).resolves.toEqual({
      id: 'invite-1',
      code: 'G6K39C2',
      licenseDurationDays: 365,
    })

    expect(prismaInviteCodeFindUnique).toHaveBeenCalledWith({
      where: { code: 'G6K39C2' },
      select: {
        id: true,
        code: true,
        licenseDurationDays: true,
        expiresAt: true,
        status: true,
        redemptionsCount: true,
        maxRedemptions: true,
      },
    })
  })
})
