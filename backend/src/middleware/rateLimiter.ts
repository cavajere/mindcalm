import rateLimit from 'express-rate-limit'
import { Request } from 'express'
import { config } from '../config'

function getRequestKey(req: Request) {
  return req.adminUser?.id ?? req.ip ?? 'anonymous'
}

function getIpKey(req: Request) {
  return req.ip ?? 'anonymous'
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

export const inviteCodeValidationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.inviteCodeValidation,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  message: { error: 'Troppi tentativi di verifica codice, riprova tra poco' },
})

export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.registration,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  message: { error: 'Troppi tentativi di registrazione, riprova tra poco' },
})

export const registrationVerificationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.registrationVerification,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  message: { error: 'Troppi tentativi di conferma registrazione, riprova tra poco' },
})

export const eventBookingAccessRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.eventBookingAccess,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  message: { error: 'Troppi tentativi di accesso prenotazione, riprova tra poco' },
})

export const eventBookingRequestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.eventBookingRequest,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  message: { error: 'Troppi tentativi di richiesta link, riprova tra poco' },
})

export const eventBookingCreateRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.eventBookingCreate,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpKey,
  message: { error: 'Troppi tentativi di prenotazione, riprova tra poco' },
})

export const playbackSessionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.playback.sessionRateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRequestKey,
  message: { error: 'Troppe richieste di riproduzione, riprova tra poco' },
})
