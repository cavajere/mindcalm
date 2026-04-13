function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, '')
}

export function getPublicAppUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  if (configuredUrl) {
    return normalizeUrl(configuredUrl)
  }

  const { origin } = window.location
  if (origin.endsWith(':5474')) {
    return origin.replace(':5474', ':5473')
  }

  return normalizeUrl(origin)
}
