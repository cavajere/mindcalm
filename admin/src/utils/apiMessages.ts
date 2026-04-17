import axios from 'axios'
import {
  API_ERROR_MESSAGES,
  API_GENERIC_ERROR_MESSAGE,
  API_NETWORK_ERROR_MESSAGE,
  API_STATUS_FALLBACKS,
} from './apiErrorCatalog'

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

function getCodeFromPayload(data: unknown): string | null {
  if (!isRecord(data)) return null
  return toNonEmptyString(data.code)
}

function getCatalogMessageByCode(code: string | null): string | null {
  if (!code) return null
  return API_ERROR_MESSAGES[code] ?? null
}

function getStatusFallback(status: number | undefined): string | null {
  if (status === undefined) return null
  return API_STATUS_FALLBACKS[status] ?? null
}

function looksLikeRawHttpStatus(value: string): boolean {
  const lowered = value.toLowerCase()
  return (
    lowered === 'unauthorized' ||
    lowered === 'forbidden' ||
    lowered === 'not found' ||
    lowered === 'internal server error' ||
    lowered === 'bad request' ||
    lowered === 'too many requests' ||
    lowered.startsWith('request failed with status')
  )
}

export function getApiErrorMessage(error: unknown, fallback: string = API_GENERIC_ERROR_MESSAGE) {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return API_NETWORK_ERROR_MESSAGE
    }

    const { data, status } = error.response

    const catalogByCode = getCatalogMessageByCode(getCodeFromPayload(data))
    if (catalogByCode) return catalogByCode

    const payloadMessage = getMessageFromPayload(data, ['error', 'message'])
    if (payloadMessage && !looksLikeRawHttpStatus(payloadMessage)) {
      return payloadMessage
    }

    const statusFallback = getStatusFallback(status)
    if (statusFallback) return statusFallback

    return fallback
  }

  if (error instanceof Error) {
    const message = toNonEmptyString(error.message)
    if (message && !looksLikeRawHttpStatus(message)) {
      return message
    }
  }

  return fallback
}
