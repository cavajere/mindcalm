import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminAuthMiddleware, appAuthMiddleware, authMiddleware } from '../src/middleware/auth'
import { config } from '../src/config'

const { prismaUserFindUnique, prismaUserCount } = vi.hoisted(() => ({
  prismaUserFindUnique: vi.fn(),
  prismaUserCount: vi.fn(),
}))

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUnique,
      count: prismaUserCount,
    },
  },
}))

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  }

  return res
}

describe('authMiddleware', () => {
  beforeEach(() => {
    prismaUserFindUnique.mockReset()
    prismaUserCount.mockReset()
    prismaUserCount.mockResolvedValue(1)
    config.bootstrapAdmin.email = ''
    config.bootstrapAdmin.password = ''
    config.bootstrapAdmin.name = 'Bootstrap Admin'
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
      isBootstrap: false,
    })
    expect(res.status).not.toHaveBeenCalled()
  })

  it('autorizza richieste admin con cookie admin valido', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
      sessionVersion: 4,
    })

    const token = jwt.sign(
      {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        sessionVersion: 4,
      },
      config.jwt.secret,
      { expiresIn: '1h' },
    )

    const req: any = {
      headers: {},
      cookies: {
        [config.jwt.adminCookieName]: token,
      },
    }
    const res = createResponse()
    const next = vi.fn()

    await adminAuthMiddleware(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.adminUser).toEqual({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isBootstrap: false,
    })
  })

  it('non accetta il cookie admin sulle rotte app', async () => {
    const token = jwt.sign(
      {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
        sessionVersion: 4,
      },
      config.jwt.secret,
      { expiresIn: '1h' },
    )

    const req: any = {
      headers: {},
      cookies: {
        [config.jwt.adminCookieName]: token,
      },
    }
    const res = createResponse()
    const next = vi.fn()

    await appAuthMiddleware(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token mancante' })
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

  it('rifiuta utenti standard con licenza scaduta e pulisce il cookie app', async () => {
    prismaUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'utente@example.com',
      name: 'Utente',
      role: 'STANDARD',
      isActive: true,
      licenseExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
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

    expect(next).not.toHaveBeenCalled()
    expect(res.clearCookie).toHaveBeenCalledWith(config.jwt.appCookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      path: '/',
    })
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Licenza scaduta',
      code: 'LICENSE_EXPIRED',
      licenseExpiresAt: '2026-04-01T00:00:00.000Z',
    })
  })

  it('pulisce il cookie admin quando il token è invalido', async () => {
    const req: any = {
      headers: {},
      cookies: {
        [config.jwt.adminCookieName]: 'token-non-valido',
      },
    }
    const res = createResponse()
    const next = vi.fn()

    await adminAuthMiddleware(req, res as any, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.clearCookie).toHaveBeenCalledWith(config.jwt.adminCookieName, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProduction,
      path: '/',
    })
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Token non valido o scaduto' })
  })

  it('autorizza la sessione bootstrap admin quando non esistono admin attivi', async () => {
    config.bootstrapAdmin.email = 'bootstrap@example.com'
    config.bootstrapAdmin.password = 'bootstrap-secret'
    prismaUserCount.mockResolvedValue(0)

    const token = jwt.sign(
      {
        id: 'bootstrap-admin',
        email: 'bootstrap@example.com',
        name: 'Bootstrap Admin',
        role: 'ADMIN',
        sessionVersion: 0,
        bootstrap: true,
      },
      config.jwt.secret,
      { expiresIn: '1h' },
    )

    const req: any = {
      headers: {},
      cookies: {
        [config.jwt.adminCookieName]: token,
      },
    }
    const res = createResponse()
    const next = vi.fn()

    await adminAuthMiddleware(req, res as any, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.adminUser).toEqual({
      id: 'bootstrap-admin',
      email: 'bootstrap@example.com',
      name: 'Bootstrap Admin',
      role: 'ADMIN',
      isBootstrap: true,
    })
  })
})
