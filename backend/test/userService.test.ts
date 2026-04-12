import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptUserInvite,
  changeUserPassword,
  resetUserPassword,
  sendUserInvite,
} from '../src/services/userService'

const {
  prismaUserUpdate,
  prismaUserFindFirst,
  prismaUserFindUnique,
  sendMail,
  comparePassword,
  hashPassword,
} = vi.hoisted(() => ({
  prismaUserUpdate: vi.fn(),
  prismaUserFindFirst: vi.fn(),
  prismaUserFindUnique: vi.fn(),
  sendMail: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      update: prismaUserUpdate,
      findFirst: prismaUserFindFirst,
      findUnique: prismaUserFindUnique,
    },
  },
}))

vi.mock('../src/services/smtpService', () => ({
  sendMail,
}))

vi.mock('../src/services/authService', () => ({
  comparePassword,
  hashPassword,
}))

vi.mock('../src/services/cryptoService', () => ({
  generateRandomToken: vi.fn(() => 'invite-token'),
  hashToken: vi.fn(() => 'hashed-token'),
}))

describe('userService', () => {
  beforeEach(() => {
    prismaUserUpdate.mockReset()
    prismaUserFindFirst.mockReset()
    prismaUserFindUnique.mockReset()
    sendMail.mockReset()
    comparePassword.mockReset()
    hashPassword.mockReset()
  })

  it('invia un invito con link di attivazione e salva token/scadenza', async () => {
    prismaUserUpdate.mockResolvedValue({})
    sendMail.mockResolvedValue(undefined)

    await sendUserInvite(
      { id: 'user-1', email: 'utente@example.com', name: 'Mario' },
      'http://localhost:5473',
    )

    expect(prismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        inviteTokenHash: 'hashed-token',
        invitedAt: expect.any(Date),
        inviteExpiresAt: expect.any(Date),
      }),
    })

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'utente@example.com',
      subject: 'Sei stato invitato su MindCalm',
      text: expect.stringContaining('/accept-invite?token=invite-token'),
      html: expect.stringContaining('/accept-invite?token=invite-token'),
    }))
  })

  it('accetta un invito, imposta la password e invalida token precedenti', async () => {
    prismaUserFindFirst.mockResolvedValue({
      id: 'user-1',
      isActive: true,
    })
    hashPassword.mockResolvedValue('hashed-password')
    prismaUserUpdate.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Mario',
      role: 'STANDARD',
      sessionVersion: 4,
    })

    const user = await acceptUserInvite('invite-token', 'NuovaPassword123')

    expect(hashPassword).toHaveBeenCalledWith('NuovaPassword123')
    expect(prismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-password',
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
    expect(user.sessionVersion).toBe(4)
  })

  it('resetta la password incrementando sessionVersion', async () => {
    prismaUserFindFirst.mockResolvedValue({
      id: 'user-1',
      isActive: true,
    })
    hashPassword.mockResolvedValue('hashed-reset-password')
    prismaUserUpdate.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Mario',
      role: 'STANDARD',
      sessionVersion: 5,
    })

    const user = await resetUserPassword('reset-token', 'PasswordNuova!')

    expect(prismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-reset-password',
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
    expect(user.sessionVersion).toBe(5)
  })

  it('cambia la password e restituisce i dati aggiornati della sessione', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Mario',
      role: 'STANDARD',
      isActive: true,
      password: 'stored-hash',
    })
    comparePassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    hashPassword.mockResolvedValue('hashed-new-password')
    prismaUserUpdate.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Mario',
      role: 'STANDARD',
      sessionVersion: 7,
    })

    const user = await changeUserPassword('user-1', 'Attuale123', 'Nuova1234')

    expect(comparePassword).toHaveBeenNthCalledWith(1, 'Attuale123', 'stored-hash')
    expect(comparePassword).toHaveBeenNthCalledWith(2, 'Nuova1234', 'stored-hash')
    expect(prismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-new-password',
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
    expect(user.sessionVersion).toBe(7)
  })

  it('rifiuta il cambio password se la password attuale è errata', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      password: 'stored-hash',
    })
    comparePassword.mockResolvedValue(false)

    await expect(changeUserPassword('user-1', 'Errata', 'Nuova1234'))
      .rejects
      .toThrow('Password attuale non corretta')

    expect(prismaUserUpdate).not.toHaveBeenCalled()
  })
})
