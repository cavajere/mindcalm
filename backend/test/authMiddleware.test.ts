import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authMiddleware } from '../src/middleware/auth'
import { config } from '../src/config'

const { prismaUserFindUnique } = vi.hoisted(() => ({
  prismaUserFindUnique: vi.fn(),
}))

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUnique,
    },
  },
}))

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }

  return res
}

describe('authMiddleware', () => {
  beforeEach(() => {
    prismaUserFindUnique.mockReset()
  })

  it('autorizza richieste con cookie valido e sessionVersion corretta', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Utente',
      role: 'STANDARD',
      isActive: true,
      sessionVersion: 2,
    })

    const token = jwt.sign(
      {
        id: 'user-1',
        email: 'utente@example.com',
        name: 'Utente',
        role: 'STANDARD',
        sessionVersion: 2,
      },
      config.jwt.secret,
      { expiresIn: '1h' },
    )

    const req: any = {
      headers: {},
      cookies: {
        [config.jwt.appCookieName]: token,
      },
    }
    const res = createResponse()
    const next = vi.fn()

    await authMiddleware(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.adminUser).toEqual({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Utente',
      role: 'STANDARD',
    })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('rifiuta token con sessionVersion non più valida', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Utente',
      role: 'STANDARD',
      isActive: true,
      sessionVersion: 3,
    })

    const token = jwt.sign(
      {
        id: 'user-1',
        email: 'utente@example.com',
        name: 'Utente',
        role: 'STANDARD',
        sessionVersion: 2,
      },
      config.jwt.secret,
      { expiresIn: '1h' },
    )

    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
    }
    const res = createResponse()
    const next = vi.fn()

    await authMiddleware(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Utente non autorizzato' })
  })

  it('rifiuta richieste senza token', async () => {
    const req: any = {
      headers: {},
      cookies: {},
    }
    const res = createResponse()
    const next = vi.fn()

    await authMiddleware(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token mancante' })
  })
})
