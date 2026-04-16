import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeInviteCodeRegistration,
  getRegistrationVerificationDetails,
  startInviteCodeRegistration,
} from '../src/services/registrationService'

const {
  prismaUserFindUnique,
  prismaUserCreate,
  prismaUserTermsAcceptanceCreate,
  prismaPendingRegistrationCreate,
  prismaPendingRegistrationFindFirst,
  prismaPendingRegistrationUpdate,
  prismaPendingRegistrationUpdateMany,
  prismaInviteCodeUpdateMany,
  prismaInviteCodeUpdate,
  prismaTermsPolicyFindFirst,
  prismaSubscriptionPolicyFindFirst,
  prismaTransaction,
  sendMail,
  hashPassword,
} = vi.hoisted(() => ({
  prismaUserFindUnique: vi.fn(),
  prismaUserCreate: vi.fn(),
  prismaUserTermsAcceptanceCreate: vi.fn(),
  prismaPendingRegistrationCreate: vi.fn(),
  prismaPendingRegistrationFindFirst: vi.fn(),
  prismaPendingRegistrationUpdate: vi.fn(),
  prismaPendingRegistrationUpdateMany: vi.fn(),
  prismaInviteCodeUpdateMany: vi.fn(),
  prismaInviteCodeUpdate: vi.fn(),
  prismaTermsPolicyFindFirst: vi.fn(),
  prismaSubscriptionPolicyFindFirst: vi.fn(),
  prismaTransaction: vi.fn(),
  sendMail: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUnique,
      create: prismaUserCreate,
    },
    termsPolicy: {
      findFirst: prismaTermsPolicyFindFirst,
    },
    subscriptionPolicy: {
      findFirst: prismaSubscriptionPolicyFindFirst,
    },
    userTermsAcceptance: {
      create: prismaUserTermsAcceptanceCreate,
    },
    pendingRegistration: {
      create: prismaPendingRegistrationCreate,
      findFirst: prismaPendingRegistrationFindFirst,
      update: prismaPendingRegistrationUpdate,
      updateMany: prismaPendingRegistrationUpdateMany,
    },
    inviteCode: {
      updateMany: prismaInviteCodeUpdateMany,
      update: prismaInviteCodeUpdate,
    },
    $transaction: prismaTransaction,
  },
}))

vi.mock('../src/services/smtpService', () => ({
  sendMail,
}))

vi.mock('../src/services/authService', () => ({
  hashPassword,
}))

vi.mock('../src/services/cryptoService', () => ({
  generateRandomToken: vi.fn(() => 'registration-token'),
  hashToken: vi.fn(() => 'registration-token-hash'),
}))

vi.mock('../src/services/inviteCodeService', () => ({
  getPublicInviteCodeDetails: vi.fn(async () => ({
    id: 'invite-1',
    code: 'G6K39C2',
    licenseDurationDays: 365,
  })),
  normalizeInviteCode: vi.fn((code: string) => code.trim().toUpperCase()),
}))

describe('registrationService', () => {
  beforeEach(() => {
    prismaUserFindUnique.mockReset()
    prismaUserCreate.mockReset()
    prismaUserTermsAcceptanceCreate.mockReset()
    prismaPendingRegistrationCreate.mockReset()
    prismaPendingRegistrationFindFirst.mockReset()
    prismaPendingRegistrationUpdate.mockReset()
    prismaPendingRegistrationUpdateMany.mockReset()
    prismaInviteCodeUpdateMany.mockReset()
    prismaInviteCodeUpdate.mockReset()
    prismaTermsPolicyFindFirst.mockReset()
    prismaSubscriptionPolicyFindFirst.mockReset()
    prismaTransaction.mockReset()
    sendMail.mockReset()
    hashPassword.mockReset()

    prismaTransaction.mockImplementation(async (callback: any) => callback({
      user: {
        findUnique: prismaUserFindUnique,
        create: prismaUserCreate,
      },
      userTermsAcceptance: {
        create: prismaUserTermsAcceptanceCreate,
      },
      pendingRegistration: {
        create: prismaPendingRegistrationCreate,
        findFirst: prismaPendingRegistrationFindFirst,
        update: prismaPendingRegistrationUpdate,
        updateMany: prismaPendingRegistrationUpdateMany,
      },
      inviteCode: {
        updateMany: prismaInviteCodeUpdateMany,
        update: prismaInviteCodeUpdate,
      },
    }))

    prismaTermsPolicyFindFirst.mockResolvedValue(null)
    prismaSubscriptionPolicyFindFirst.mockResolvedValue(null)
  })

  it('avvia una registrazione pendente e invia la mail di verifica', async () => {
    prismaUserFindUnique.mockResolvedValue(null)
    hashPassword.mockResolvedValue('hashed-password')
    prismaPendingRegistrationUpdateMany.mockResolvedValue({ count: 0 })
    prismaPendingRegistrationCreate.mockResolvedValue({
      id: 'pending-1',
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      verificationExpiresAt: new Date('2026-04-13T10:00:00.000Z'),
    })
    sendMail.mockResolvedValue(undefined)

    const result = await startInviteCodeRegistration({
      code: 'g6k39c2',
      email: 'utente@example.com',
      firstName: ' Mario ',
      lastName: ' Rossi ',
      phone: '+39 333 1234567',
      password: 'Password123!',
      verificationBaseUrl: 'http://localhost:5473',
      acceptTerms: false,
    })

    expect(hashPassword).toHaveBeenCalledWith('Password123!')
    expect(prismaPendingRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inviteCodeId: 'invite-1',
        email: 'utente@example.com',
        firstName: 'Mario',
        lastName: 'Rossi',
        phone: '+39 333 1234567',
        passwordHash: 'hashed-password',
        verificationTokenHash: 'registration-token-hash',
        verificationExpiresAt: expect.any(Date),
      }),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        verificationExpiresAt: true,
      },
    })
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'utente@example.com',
      text: expect.stringContaining('/verify-registration?token=registration-token'),
      html: expect.stringContaining('/verify-registration?token=registration-token'),
    }))
    expect(result.licenseDurationDays).toBe(365)
  })

  it('richiede l’accettazione dei termini quando esiste una versione pubblicata', async () => {
    prismaTermsPolicyFindFirst.mockResolvedValue({
      currentVersionId: 'terms-version-1',
    })

    await expect(startInviteCodeRegistration({
      code: 'g6k39c2',
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '+39 333 1234567',
      password: 'Password123!',
      verificationBaseUrl: 'http://localhost:5473',
      acceptTerms: false,
    })).rejects.toThrow('TERMS_ACCEPTANCE_REQUIRED')
  })

  it('restituisce i dettagli di verifica della registrazione', async () => {
    prismaPendingRegistrationFindFirst.mockResolvedValue({
      id: 'pending-1',
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      verificationExpiresAt: new Date('2026-04-13T10:00:00.000Z'),
      status: 'PENDING',
      inviteCode: {
        code: 'G6K39C2',
        licenseDurationDays: 365,
      },
    })

    await expect(getRegistrationVerificationDetails('registration-token')).resolves.toEqual({
      email: 'utente@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      verificationExpiresAt: new Date('2026-04-13T10:00:00.000Z'),
      code: 'G6K39C2',
      licenseDurationDays: 365,
    })
  })

  it('completa la registrazione, crea l’utente e marca il codice come riscattato', async () => {
    prismaPendingRegistrationFindFirst.mockResolvedValue({
      id: 'pending-1',
      inviteCodeId: 'invite-1',
      email: 'utente@example.com',
      passwordHash: 'hashed-password',
      firstName: 'Mario',
      lastName: 'Rossi',
      phone: '+39 333 1234567',
      inviteCode: {
        id: 'invite-1',
        code: 'G6K39C2',
        licenseDurationDays: 365,
      },
      termsPolicyVersionId: 'terms-version-1',
      termsAcceptedAt: new Date('2026-04-13T09:00:00.000Z'),
    })
    prismaPendingRegistrationUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    prismaInviteCodeUpdateMany.mockResolvedValue({ count: 1 })
    prismaUserFindUnique.mockResolvedValue(null)
    prismaUserCreate.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Mario Rossi',
      role: 'STANDARD',
      sessionVersion: 0,
    })
    prismaInviteCodeUpdate.mockResolvedValue({})

    const result = await completeInviteCodeRegistration('registration-token')

    expect(prismaUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'utente@example.com',
        name: 'Mario Rossi',
        firstName: 'Mario',
        lastName: 'Rossi',
        phone: '+39 333 1234567',
        password: 'hashed-password',
        role: 'STANDARD',
        isActive: true,
        licenseExpiresAt: expect.any(Date),
      }),
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sessionVersion: true,
      },
    })
    expect(prismaInviteCodeUpdate).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
      data: {
        redeemedByUserId: 'user-1',
      },
    })
    expect(prismaUserTermsAcceptanceCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        termsPolicyVersionId: 'terms-version-1',
        acceptedAt: new Date('2026-04-13T09:00:00.000Z'),
        source: 'SELF_SERVICE',
      },
    })
    expect(result.user.email).toBe('utente@example.com')
    expect(result.inviteCode.code).toBe('G6K39C2')
  })
})
