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

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null
  const cookieToken = req.cookies?.[config.jwt.appCookieName]
  const token = bearerToken || cookieToken
  const requestLabel = `${req.method} ${req.originalUrl}`

  if (!token) {
    console.warn(`[Auth] Token mancante su ${requestLabel}`)
    res.status(401).json({ error: 'Token mancante' })
    return
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as AuthPayload
    const tokenSessionVersion = typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 0

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, licenseExpiresAt: true, sessionVersion: true },
    })

    if (!user) {
      console.warn(`[Auth] Utente non trovato per token valido su ${requestLabel} (userId=${payload.id})`)
      res.status(401).json({ error: 'Utente non autorizzato' })
      return
    }

    if (!user.isActive) {
      console.warn(`[Auth] Utente inattivo su ${requestLabel} (userId=${user.id}, email=${user.email})`)
      res.status(401).json({ error: 'Utente non autorizzato' })
      return
    }

    if (user.sessionVersion !== tokenSessionVersion) {
      console.warn(
        `[Auth] Session version non valida su ${requestLabel} (userId=${user.id}, email=${user.email}, token=${tokenSessionVersion}, db=${user.sessionVersion})`,
      )
      res.status(401).json({ error: 'Utente non autorizzato' })
      return
    }

    if (isLicenseExpired(user)) {
      console.warn(`[Auth] Licenza scaduta su ${requestLabel} (userId=${user.id}, email=${user.email})`)
      if (cookieToken) {
        res.clearCookie(config.jwt.appCookieName, {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.isProduction,
          path: '/',
        })
      }

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
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Errore sconosciuto'
    console.warn(`[Auth] Token non valido o scaduto su ${requestLabel}: ${reason}`)
    res.status(401).json({ error: 'Token non valido o scaduto' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.adminUser?.role !== UserRole.ADMIN) {
    res.status(403).json({ error: 'Operazione riservata agli amministratori' })
    return
  }

  next()
}
