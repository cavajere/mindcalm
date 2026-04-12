import rateLimit from 'express-rate-limit'
import { Request } from 'express'
import { config } from '../config'

function getRequestKey(req: Request) {
  return req.adminUser?.id ?? req.ip ?? 'anonymous'
}

export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.public,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste, riprova tra poco' },
})

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.login,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di login, riprova tra poco' },
})

export const playbackSessionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.playback.sessionRateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRequestKey,
  message: { error: 'Troppe richieste di riproduzione, riprova tra poco' },
})
