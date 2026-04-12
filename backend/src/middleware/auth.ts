import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../lib/prisma'

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

  if (!token) {
    res.status(401).json({ error: 'Token mancante' })
    return
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as AuthPayload
    const tokenSessionVersion = typeof payload.sessionVersion === 'number' ? payload.sessionVersion : 0

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, sessionVersion: true },
    })

    if (!user || !user.isActive || user.sessionVersion !== tokenSessionVersion) {
      res.status(401).json({ error: 'Utente non autorizzato' })
      return
    }

    req.adminUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
    next()
  } catch {
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
