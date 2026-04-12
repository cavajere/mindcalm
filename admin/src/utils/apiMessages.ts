import axios from 'axios'

type ApiRecord = Record<string, unknown>

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized ? normalized : null
}

function getValidationDetailsMessage(data: unknown): string | null {
  if (!isRecord(data) || !Array.isArray(data.details)) {
    return null
  }

  const messages = data.details
    .map((detail) => (isRecord(detail) ? toNonEmptyString(detail.msg) : null))
    .filter((message): message is string => Boolean(message))

  if (!messages.length) {
    return null
  }

  return [...new Set(messages)].join('. ')
}

function getMessageFromPayload(data: unknown, keys: string[]): string | null {
  const directMessage = toNonEmptyString(data)
  if (directMessage) {
    return directMessage
  }

  if (!isRecord(data)) {
    return null
  }

  for (const key of keys) {
    const message = toNonEmptyString(data[key])
    if (message) {
      return message
    }
  }

  return getValidationDetailsMessage(data)
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return getMessageFromPayload(error.response?.data, ['error', 'message']) ?? fallback
  }

  if (error instanceof Error) {
    return toNonEmptyString(error.message) ?? fallback
  }

  return fallback
}
