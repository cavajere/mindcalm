import type { PaginatedResponse, PublicAudio, PublicEvent, PublicPost } from '~/types/content'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const base = config.public.siteUrl
  const api = config.public.apiBase

  const [postResponse, audioResponse, eventResponse] = await Promise.all([
    $fetch<PaginatedResponse<PublicPost>>('/api/posts', { baseURL: api }).catch(() => ({ data: [] } as PaginatedResponse<PublicPost>)),
    $fetch<PaginatedResponse<PublicAudio>>('/api/audio', { baseURL: api }).catch(() => ({ data: [] } as PaginatedResponse<PublicAudio>)),
    $fetch<PaginatedResponse<PublicEvent>>('/api/events', { baseURL: api }).catch(() => ({ data: [] } as PaginatedResponse<PublicEvent>)),
  ])

  const posts = postResponse.data ?? []
  const audio = audioResponse.data ?? []
  const events = eventResponse.data ?? []

  const staticUrls = ['/', '/posts', '/audio', '/events', '/privacy-policy', '/termini-e-condizioni']
  const postUrls = posts.map(post => `/posts/${post.slug}`)
  const audioUrls = audio.map(item => `/audio/${item.id}`)
  const eventUrls = events.map(event => `/events/${event.slug}`)

  const allUrls = [...staticUrls, ...postUrls, ...audioUrls, ...eventUrls]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls
    .map(url => `  <url><loc>${escapeXml(base + url)}</loc></url>`)
    .join('\n')}\n</urlset>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
    },
  })
})
