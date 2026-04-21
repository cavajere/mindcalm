export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const allowIndexing = config.public.allowIndexing !== false

  const lines = allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        `Sitemap: ${config.public.siteUrl}/sitemap.xml`,
      ]
    : [
        'User-agent: *',
        'Disallow: /',
      ]

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
})
