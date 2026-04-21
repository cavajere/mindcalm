import type { PaginatedResponse, PublicAudio, PublicEvent, PublicPost } from '~/types/content'

const PAGE_SIZE = 200
const MAX_PAGES = 50

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIsoDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function fetchAll<T>(
  base: string,
  path: string,
  label: string,
  headers: Record<string, string>,
): Promise<T[]> {
  const items: T[] = []
  let page = 1

  while (page <= MAX_PAGES) {
    try {
      const response = await $fetch<PaginatedResponse<T>>(path, {
        baseURL: base,
        query: { page, limit: PAGE_SIZE },
        headers,
      })
      const batch = response?.data ?? []
      items.push(...batch)

      const totalPages = response?.pagination?.totalPages ?? 1
      if (page >= totalPages || batch.length === 0) break
      page += 1
    } catch (error) {
      console.error(`[sitemap] fetch ${label} page ${page} failed`, error)
      break
    }
  }

  return items
}

type SitemapEntry = {
  loc: string
  lastmod?: string | null
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const base = String(config.public.siteUrl || '').replace(/\/+$/, '')
  const api = String(config.public.apiBase || '')
  const headers: Record<string, string> = {}
  if (config.ssrInternalToken) {
    headers['x-internal-ssr-token'] = String(config.ssrInternalToken)
  }

  const [posts, audio, events] = await Promise.all([
    fetchAll<PublicPost>(api, '/api/posts', 'posts', headers),
    fetchAll<PublicAudio>(api, '/api/audio', 'audio', headers),
    fetchAll<PublicEvent>(api, '/api/events', 'events', headers),
  ])

  const staticEntries: SitemapEntry[] = [
    { loc: '/' },
    { loc: '/posts' },
    { loc: '/audio' },
    { loc: '/events' },
    { loc: '/privacy-policy' },
    { loc: '/termini-e-condizioni' },
  ]

  const postEntries: SitemapEntry[] = posts.map(post => ({
    loc: `/posts/${post.slug}`,
    lastmod: toIsoDate(post.publishedAt),
  }))

  const audioEntries: SitemapEntry[] = audio.map(item => ({
    loc: `/audio/${item.id}`,
    lastmod: toIsoDate(item.publishedAt),
  }))

  const eventEntries: SitemapEntry[] = events.map(event => ({
    loc: `/events/${event.slug}`,
    lastmod: toIsoDate(event.startsAt) || toIsoDate(event.publishedAt),
  }))

  const entries = [...staticEntries, ...postEntries, ...audioEntries, ...eventEntries]

  const body = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(base + entry.loc)}</loc>`]
      if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  })
})
