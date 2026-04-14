function normalizeBasePath(pathname: string) {
  return pathname === '/' ? '' : pathname.replace(/\/$/, '')
}

function normalizePublicPath(pathname: string) {
  const normalized = normalizeBasePath(pathname)
  return normalized.toLowerCase() === '/admin' ? '' : normalized
}

export function resolveAppBaseUrl(override: string | undefined, fallback: string | undefined, label: string) {
  const candidate = override?.trim() || fallback?.trim()

  if (!candidate) {
    throw new Error(`URL ${label} non configurato`)
  }

  let parsed: URL

  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error(`URL ${label} non valido`)
  }

  return `${parsed.origin}${normalizeBasePath(parsed.pathname)}`
}

export function buildAppUrl(baseUrl: string, path: string) {
  const normalizedBase = resolveAppBaseUrl(baseUrl, undefined, 'app')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export function derivePublicAppBaseUrl(input: {
  override?: string
  requestOrigin?: string
  requestProtocol?: string
  requestHost?: string
  fallback: string
}) {
  if (input.override?.trim()) {
    return resolveAppBaseUrl(input.override, input.fallback, 'app pubblica')
  }

  const directOrigin = input.requestOrigin?.trim()
  const computedOrigin = !directOrigin && input.requestProtocol && input.requestHost
    ? `${input.requestProtocol}://${input.requestHost}`
    : undefined
  const candidate = directOrigin || computedOrigin

  if (candidate) {
    try {
      const parsed = new URL(candidate)
      const normalizedPath = normalizePublicPath(parsed.pathname)
      const host = parsed.hostname === 'localhost' && parsed.port === '5474'
        ? 'localhost:5473'
        : parsed.host

      return `${parsed.protocol}//${host}${normalizedPath}`
    } catch {
      // fallback handled below
    }
  }

  return resolveAppBaseUrl(undefined, input.fallback, 'app pubblica')
}
