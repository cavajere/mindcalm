import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../lib/prisma'
import { getLicenseExpiredPayload, isLicenseExpired } from '../services/licenseService'
import { canUseBootstrapAdminToken, buildBootstrapAdminIdentity } from '../services/bootstrapAdminService'

export interface AuthPayload {
  id: string
  email: string
  name: string
  role: UserRole
  sessionVersion?: number
  bootstrap?: boolean
  isBootstrap?: boolean
}

export interface AuthPrincipal extends AuthPayload {
  isBootstrap?: boolean
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthPrincipal
    }
  }
}

type AuthCandidate = {
  token: string
  source: 'bearer' | 'cookie'
  cookieName?: string
}

type ResolveAuthOptions = {
  allowBearer: boolean
  allowAppCookie: boolean
  allowAdminCookie: boolean
  allowBootstrap: boolean
  requireAdminRole: boolean
  enforceLicense: boolean
  logMissingToken: boolean
}

type ResolveSuccess = {
  kind: 'authenticated'
  principal: AuthPrincipal
}

type ResolveFailure = {
  kind: 'missing' | 'unauthorized' | 'forbidden'
  status: number
  body: Record<string, unknown>
  clearCookieName?: string
}

export type ResolveAuthResult = ResolveSuccess | ResolveFailure

function getAuthCandidates(req: Request, options: ResolveAuthOptions): AuthCandidate[] {
  const candidates: AuthCandidate[] = []
  const header = req.headers.authorization
  const bearerToken = options.allowBearer && header?.startsWith('Bearer ') ? header.slice(7) : null

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

export function getAuthCookieOptions(cookieName: string) {
  return {
    httpOnly: true,
    sameSite: cookieName === config.jwt.adminCookieName ? ('strict' as const) : ('lax' as const),
    secure: config.isProduction,
    path: '/',
  }
}

function clearCookieIfNeeded(res: Response, cookieName?: string) {
  if (!cookieName) return
  res.clearCookie(cookieName, getAuthCookieOptions(cookieName))
}

async function resolveCandidate(candidate: AuthCandidate, options: ResolveAuthOptions, requestLabel: string): Promise<ResolveAuthResult> {
  try {
    const payload = jwt.verify(candidate.token, config.jwt.secret) as AuthPayload

    if (payload.bootstrap || payload.isBootstrap) {
      if (!options.allowBootstrap) {
        return {
          kind: 'unauthorized',
          status: 401,
          body: { error: 'Utente non autorizzato' },
          clearCookieName: candidate.cookieName,
        }
      }

      const canUseBootstrap = await canUseBootstrapAdminToken(payload)
      if (!canUseBootstrap) {
        return {
          kind: 'unauthorized',
          status: 401,
          body: { error: 'Utente non autorizzato' },
          clearCookieName: candidate.cookieName,
        }
      }

      return {
        kind: 'authenticated',
        principal: buildBootstrapAdminIdentity(),
      }
    }

    const tokenSessionVersion = typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 0
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, licenseExpiresAt: true, sessionVersion: true },
    })

    if (!user) {
      console.warn(`[Auth] Utente non trovato per token valido su ${requestLabel} (userId=${payload.id})`)
      return {
        kind: 'unauthorized',
        status: 401,
        body: { error: 'Utente non autorizzato' },
        clearCookieName: candidate.cookieName,
      }
    }

    if (!user.isActive) {
      console.warn(`[Auth] Utente inattivo su ${requestLabel} (userId=${user.id}, email=${user.email})`)
      return {
        kind: 'unauthorized',
        status: 401,
        body: { error: 'Utente non autorizzato' },
        clearCookieName: candidate.cookieName,
      }
    }

    if (user.sessionVersion !== tokenSessionVersion) {
      console.warn(
        `[Auth] Session version non valida su ${requestLabel} (userId=${user.id}, email=${user.email}, token=${tokenSessionVersion}, db=${user.sessionVersion})`,
      )
      return {
        kind: 'unauthorized',
        status: 401,
        body: { error: 'Utente non autorizzato' },
        clearCookieName: candidate.cookieName,
      }
    }

    if (options.requireAdminRole && user.role !== UserRole.ADMIN) {
      return {
        kind: 'unauthorized',
        status: 401,
        body: { error: 'Utente non autorizzato' },
        clearCookieName: candidate.cookieName,
      }
    }

    if (options.enforceLicense && isLicenseExpired(user)) {
      console.warn(`[Auth] Licenza scaduta su ${requestLabel} (userId=${user.id}, email=${user.email})`)
      return {
        kind: 'forbidden',
        status: 403,
        body: getLicenseExpiredPayload(user.licenseExpiresAt!),
        clearCookieName: candidate.cookieName,
      }
    }

    return {
      kind: 'authenticated',
      principal: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isBootstrap: false,
      },
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Errore sconosciuto'
    console.warn(`[Auth] Token non valido o scaduto su ${requestLabel}: ${reason}`)
    return {
      kind: 'unauthorized',
      status: 401,
      body: { error: 'Token non valido o scaduto' },
      clearCookieName: candidate.cookieName,
    }
  }
}

async function resolveRequestAuth(req: Request, options: ResolveAuthOptions): Promise<ResolveAuthResult> {
  const candidates = getAuthCandidates(req, options)
  const requestLabel = `${req.method} ${req.originalUrl}`

  if (!candidates.length) {
    if (options.logMissingToken) {
      console.warn(`[Auth] Token mancante su ${requestLabel}`)
    }
    return {
      kind: 'missing',
      status: 401,
      body: { error: 'Token mancante' },
    }
  }

  let rejection: ResolveFailure = {
    kind: 'unauthorized',
    status: 401,
    body: { error: 'Token non valido o scaduto' },
  }

  for (const candidate of candidates) {
    const result = await resolveCandidate(candidate, options, requestLabel)
    if (result.kind === 'authenticated') {
      return result
    }

    rejection = result
  }

  return rejection
}

function buildAuthMiddleware(options: ResolveAuthOptions) {
  return async function scopedAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const result = await resolveRequestAuth(req, options)

    if (result.kind === 'authenticated') {
      req.adminUser = result.principal
      next()
      return
    }

    clearCookieIfNeeded(res, result.clearCookieName)
    res.status(result.status).json(result.body)
  }
}

const adminResolveOptions: ResolveAuthOptions = {
  allowBearer: true,
  allowAppCookie: false,
  allowAdminCookie: true,
  allowBootstrap: true,
  requireAdminRole: true,
  enforceLicense: false,
  logMissingToken: true,
}

const appResolveOptions: ResolveAuthOptions = {
  allowBearer: true,
  allowAppCookie: true,
  allowAdminCookie: false,
  allowBootstrap: false,
  requireAdminRole: false,
  enforceLicense: true,
  logMissingToken: true,
}

const sharedResolveOptions: ResolveAuthOptions = {
  allowBearer: true,
  allowAppCookie: true,
  allowAdminCookie: true,
  allowBootstrap: false,
  requireAdminRole: false,
  enforceLicense: true,
  logMissingToken: true,
}

export async function resolveAdminRequest(req: Request) {
  return resolveRequestAuth(req, {
    ...adminResolveOptions,
    allowBearer: false,
    logMissingToken: false,
  })
}

export const authMiddleware = buildAuthMiddleware(sharedResolveOptions)

export const appAuthMiddleware = buildAuthMiddleware(appResolveOptions)

export const adminAuthMiddleware = buildAuthMiddleware(adminResolveOptions)

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.adminUser?.role !== UserRole.ADMIN || req.adminUser?.isBootstrap) {
    res.status(403).json({ error: 'Operazione riservata agli amministratori' })
    return
  }

  next()
}

export function requireBootstrapAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.adminUser?.isBootstrap) {
    res.status(403).json({ error: 'Operazione riservata alla configurazione iniziale admin' })
    return
  }

  next()
}

export function clearAuthCookie(res: Response, cookieName: string) {
  clearCookieIfNeeded(res, cookieName)
}
