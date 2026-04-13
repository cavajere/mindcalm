function normalizeBasePath(pathname: string) {
  return pathname === '/' ? '' : pathname.replace(/\/$/, '')
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
