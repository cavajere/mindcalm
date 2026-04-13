function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, '')
}

export function getAdminAppUrl() {
  const configuredUrl = import.meta.env.VITE_ADMIN_APP_URL?.trim()
  if (configuredUrl) {
    return normalizeUrl(configuredUrl)
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:5474/admin'
  }

  return `${normalizeUrl(window.location.origin)}/admin`
}

export function buildAdminUrl(fullPath: string) {
  const adminBaseUrl = new URL(getAdminAppUrl())
  const currentPath = fullPath.startsWith('/admin') ? (fullPath.slice('/admin'.length) || '/') : fullPath
  const normalizedPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
  const basePath = adminBaseUrl.pathname.replace(/\/$/, '')

  return `${adminBaseUrl.origin}${basePath}${normalizedPath}`
}
