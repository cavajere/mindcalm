type ContentEventType = 'AUDIO_VIEW' | 'AUDIO_PLAY' | 'AUDIO_COMPLETE' | 'THOUGHT_VIEW'
type ErrorEventType = 'APP_ERROR' | 'API_ERROR' | 'AUDIO_ERROR'
type AnalyticsEventType = ContentEventType | ErrorEventType

type AnalyticsPayload = {
  eventType: AnalyticsEventType
  audioId?: string
  thoughtId?: string
  metadata?: Record<string, unknown>
}

type ErrorTrackingContext = {
  audioId?: string
  thoughtId?: string
  metadata?: Record<string, unknown>
}

const recentFingerprints = new Map<string, number>()
const RECENT_FINGERPRINT_TTL_MS = 5000
const deduplicatedEventTypes = new Set<ErrorEventType>(['APP_ERROR', 'API_ERROR', 'AUDIO_ERROR'])
const MAX_DEPTH = 4
const MAX_ARRAY_ITEMS = 10
const MAX_KEYS = 25
const MAX_STRING_LENGTH = 1000

function truncate(value: string, maxLength = MAX_STRING_LENGTH) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return null
  if (depth > MAX_DEPTH) return '[max-depth]'

  if (typeof value === 'string') {
    return truncate(value)
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeValue(entry, depth + 1))
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_KEYS)
        .map(([key, entry]) => [key, sanitizeValue(entry, depth + 1)]),
    )
  }

  return String(value)
}

function getPageContext(metadata?: Record<string, unknown>) {
  return sanitizeValue({
    path: window.location.pathname,
    href: window.location.href,
    userAgent: navigator.userAgent,
    ...metadata,
  }) as Record<string, unknown>
}

function getFingerprint(payload: AnalyticsPayload) {
  const metadata = payload.metadata || {}
  return JSON.stringify([
    payload.eventType,
    payload.audioId || '',
    payload.thoughtId || '',
    metadata.source || '',
    metadata.message || '',
    metadata.path || '',
    metadata.status || '',
  ])
}

function shouldTrack(payload: AnalyticsPayload) {
  const now = Date.now()

  recentFingerprints.forEach((trackedAt, key) => {
    if (now - trackedAt > RECENT_FINGERPRINT_TTL_MS) {
      recentFingerprints.delete(key)
    }
  })

  const fingerprint = getFingerprint(payload)
  const previous = recentFingerprints.get(fingerprint)
  if (previous && now - previous <= RECENT_FINGERPRINT_TTL_MS) {
    return false
  }

  recentFingerprints.set(fingerprint, now)
  return true
}

function normalizeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return sanitizeValue({
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    }) as Record<string, unknown>
  }

  if (typeof error === 'string') {
    return { message: truncate(error) }
  }

  if (error && typeof error === 'object') {
    return sanitizeValue(error) as Record<string, unknown>
  }

  return { message: String(error) }
}

async function postAnalyticsEvent(payload: AnalyticsPayload) {
  if (typeof window === 'undefined') {
    return
  }

  if (deduplicatedEventTypes.has(payload.eventType as ErrorEventType) && !shouldTrack(payload)) {
    return
  }

  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // Analytics must not block the user flow.
  }
}

function trackEvent(payload: AnalyticsPayload) {
  return postAnalyticsEvent(payload)
}

function trackErrorEvent(eventType: ErrorEventType, error: unknown, context: ErrorTrackingContext = {}) {
  return trackEvent({
    eventType,
    audioId: context.audioId,
    thoughtId: context.thoughtId,
    metadata: getPageContext({
      ...context.metadata,
      ...normalizeUnknownError(error),
    }),
  })
}

export function trackAudioView(audioId: string) {
  return trackEvent({ eventType: 'AUDIO_VIEW', audioId })
}

export function trackAudioPlay(audioId: string) {
  return trackEvent({ eventType: 'AUDIO_PLAY', audioId })
}

export function trackAudioComplete(audioId: string) {
  return trackEvent({ eventType: 'AUDIO_COMPLETE', audioId })
}

export function trackThoughtView(thoughtId: string) {
  return trackEvent({ eventType: 'THOUGHT_VIEW', thoughtId })
}

export function trackAppError(error: unknown, context: ErrorTrackingContext = {}) {
  return trackErrorEvent('APP_ERROR', error, context)
}

export function trackApiError(error: unknown, context: ErrorTrackingContext = {}) {
  return trackErrorEvent('API_ERROR', error, context)
}

export function trackAudioError(error: unknown, context: ErrorTrackingContext = {}) {
  return trackErrorEvent('AUDIO_ERROR', error, context)
}
