export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    `Sitemap: ${config.public.siteUrl}/sitemap.xml`,
  ].join('\n')

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
})
