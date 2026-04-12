import { AnalyticsContentType, AnalyticsEventType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type AnalyticsMetadata = Record<string, unknown>

type AnalyticsEventInput = {
  userId?: string | null
  eventType: AnalyticsEventType
  contentType?: AnalyticsContentType
  audioId?: string | null
  articleId?: string | null
  metadata?: AnalyticsMetadata | null
}

const MAX_STRING_LENGTH = 1000
const MAX_STACK_LENGTH = 4000
const MAX_KEYS_PER_OBJECT = 25
const MAX_ITEMS_PER_ARRAY = 10
const MAX_DEPTH = 4

function truncate(value: string, maxLength = MAX_STRING_LENGTH) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function sanitizeJsonValue(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value === null) {
    return undefined
  }

  if (depth > MAX_DEPTH) {
    return '[max-depth]'
  }

  if (typeof value === 'string') {
    const maxLength = depth === 0 && value.includes('\n') ? MAX_STACK_LENGTH : MAX_STRING_LENGTH
    return truncate(value, maxLength)
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ITEMS_PER_ARRAY)
      .map((entry) => sanitizeJsonValue(entry, depth + 1))
      .filter((entry): entry is Prisma.InputJsonValue => entry !== undefined)
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS_PER_OBJECT)
    const sanitizedEntries = entries
      .map(([key, entryValue]) => {
        const sanitizedValue = sanitizeJsonValue(entryValue, depth + 1)
        if (sanitizedValue === undefined) return null
        return [key, sanitizedValue] as const
      })
      .filter((entry): entry is readonly [string, Prisma.InputJsonValue] => entry !== null)

    return Object.fromEntries(sanitizedEntries)
  }

  return String(value)
}

export function sanitizeAnalyticsMetadata(metadata?: AnalyticsMetadata | null): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined

  const sanitized = sanitizeJsonValue(metadata)
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    return undefined
  }

  return sanitized as Prisma.InputJsonObject
}

export function getAnalyticsContentType(input: Pick<AnalyticsEventInput, 'contentType' | 'audioId' | 'articleId'>) {
  if (input.contentType) return input.contentType
  if (input.audioId) return AnalyticsContentType.AUDIO
  if (input.articleId) return AnalyticsContentType.ARTICLE
  return AnalyticsContentType.SYSTEM
}

export async function createAnalyticsEvent(input: AnalyticsEventInput) {
  await prisma.analyticsEvent.create({
    data: {
      userId: input.userId ?? null,
      contentType: getAnalyticsContentType(input),
      eventType: input.eventType,
      audioId: input.audioId ?? null,
      articleId: input.articleId ?? null,
      metadata: sanitizeAnalyticsMetadata(input.metadata),
    },
  })
}
