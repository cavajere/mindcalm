import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../lib/prisma'
import { getLicenseExpiredPayload, isLicenseExpired } from '../services/licenseService'

export interface AuthPayload {
  id: string
  email: string
  name: string
  role: UserRole
  sessionVersion?: number
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthPayload
    }
  }
}

type AuthCandidate = {
  token: string
  source: 'bearer' | 'cookie'
  cookieName?: string
}

type AuthMiddlewareOptions = {
  allowAppCookie: boolean
  allowAdminCookie: boolean
}

function getCookieOptions(cookieName: string) {
  return {
    httpOnly: true,
    sameSite: cookieName === config.jwt.adminCookieName ? ('strict' as const) : ('lax' as const),
    secure: config.isProduction,
    path: cookieName === config.jwt.adminCookieName ? '/api/v1' : '/',
  }
}

function clearCookieIfNeeded(res: Response, candidate: AuthCandidate) {
  if (candidate.source !== 'cookie' || !candidate.cookieName) return
  res.clearCookie(candidate.cookieName, getCookieOptions(candidate.cookieName))
}

function getAuthCandidates(req: Request, options: AuthMiddlewareOptions): AuthCandidate[] {
  const candidates: AuthCandidate[] = []
  const header = req.headers.authorization
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (bearerToken) {
    candidates.push({ token: bearerToken, source: 'bearer' })
  }

  if (options.allowAdminCookie) {
    const adminCookieToken = req.cookies?.[config.jwt.adminCookieName]
    if (adminCookieToken) {
      candidates.push({
        token: adminCookieToken,
        source: 'cookie',
        cookieName: config.jwt.adminCookieName,
      })
    }
  }

  if (options.allowAppCookie) {
    const appCookieToken = req.cookies?.[config.jwt.appCookieName]
    if (appCookieToken) {
      candidates.push({
        token: appCookieToken,
        source: 'cookie',
        cookieName: config.jwt.appCookieName,
      })
    }
  }

  return candidates
}

function buildAuthMiddleware(options: AuthMiddlewareOptions) {
  return async function scopedAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const candidates = getAuthCandidates(req, options)
    const requestLabel = `${req.method} ${req.originalUrl}`

    if (!candidates.length) {
      console.warn(`[Auth] Token mancante su ${requestLabel}`)
      res.status(401).json({ error: 'Token mancante' })
      return
    }

    let rejection: { status: number; body: Record<string, unknown> } = {
      status: 401,
      body: { error: 'Token non valido o scaduto' },
    }

    for (const candidate of candidates) {
      try {
        const payload = jwt.verify(candidate.token, config.jwt.secret) as AuthPayload
        const tokenSessionVersion = typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 0

        const user = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { id: true, email: true, name: true, role: true, isActive: true, licenseExpiresAt: true, sessionVersion: true },
        })

        if (!user) {
          console.warn(`[Auth] Utente non trovato per token valido su ${requestLabel} (userId=${payload.id})`)
          clearCookieIfNeeded(res, candidate)
          rejection = { status: 401, body: { error: 'Utente non autorizzato' } }
          continue
        }

        if (!user.isActive) {
          console.warn(`[Auth] Utente inattivo su ${requestLabel} (userId=${user.id}, email=${user.email})`)
          clearCookieIfNeeded(res, candidate)
          rejection = { status: 401, body: { error: 'Utente non autorizzato' } }
          continue
        }

        if (user.sessionVersion !== tokenSessionVersion) {
          console.warn(
            `[Auth] Session version non valida su ${requestLabel} (userId=${user.id}, email=${user.email}, token=${tokenSessionVersion}, db=${user.sessionVersion})`,
          )
          clearCookieIfNeeded(res, candidate)
          rejection = { status: 401, body: { error: 'Utente non autorizzato' } }
          continue
        }

        if (isLicenseExpired(user)) {
          console.warn(`[Auth] Licenza scaduta su ${requestLabel} (userId=${user.id}, email=${user.email})`)
          clearCookieIfNeeded(res, candidate)
          res.status(403).json(getLicenseExpiredPayload(user.licenseExpiresAt!))
          return
        }

        req.adminUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
        next()
        return
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Errore sconosciuto'
        console.warn(`[Auth] Token non valido o scaduto su ${requestLabel}: ${reason}`)
        clearCookieIfNeeded(res, candidate)
        rejection = { status: 401, body: { error: 'Token non valido o scaduto' } }
      }
    }

    res.status(rejection.status).json(rejection.body)
  }
}

export const authMiddleware = buildAuthMiddleware({
  allowAppCookie: true,
  allowAdminCookie: true,
})

export const appAuthMiddleware = buildAuthMiddleware({
  allowAppCookie: true,
  allowAdminCookie: false,
})

export const adminAuthMiddleware = buildAuthMiddleware({
  allowAppCookie: false,
  allowAdminCookie: true,
})

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.adminUser?.role !== UserRole.ADMIN) {
    res.status(403).json({ error: 'Operazione riservata agli amministratori' })
    return
  }

  next()
}
