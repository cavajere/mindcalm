type SeoOverrides = {
  title?: string
  description?: string
  ogType?: 'website' | 'article' | 'profile'
  coverImagePath?: string | null
}

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

function absoluteUrl(base: string, pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const prefix = pathOrUrl.startsWith('/') ? '' : '/'
  return `${trimTrailingSlash(base)}${prefix}${pathOrUrl}`
}

export function useSeoDefaults(overrides: SeoOverrides = {}) {
  const route = useRoute()
  const config = useRuntimeConfig()
  const siteUrl = trimTrailingSlash(String(config.public.siteUrl || ''))
  const canonical = `${siteUrl}${route.path}`
  const ogImage = absoluteUrl(siteUrl, overrides.coverImagePath) || `${siteUrl}/favicon.svg`

  useHead({
    link: [{ rel: 'canonical', href: canonical }],
  })

  useSeoMeta({
    title: overrides.title,
    description: overrides.description,
    ogTitle: overrides.title,
    ogDescription: overrides.description,
    ogType: overrides.ogType || 'website',
    ogUrl: canonical,
    ogSiteName: 'MindCalm',
    ogImage,
    twitterCard: 'summary_large_image',
    twitterTitle: overrides.title,
    twitterDescription: overrides.description,
    twitterImage: ogImage,
  })

  return { canonical, ogImage }
}
