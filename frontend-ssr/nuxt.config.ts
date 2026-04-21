export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'it' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#4A90D9' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  runtimeConfig: {
    ssrInternalToken: process.env.SSR_INTERNAL_TOKEN || '',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3300',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:5573',
      allowIndexing: process.env.NUXT_PUBLIC_ALLOW_INDEXING !== 'false',
    },
  },
  routeRules: {
    '/': { swr: 120 },
    '/posts/**': { swr: 120 },
    '/audio/**': { swr: 120 },
    '/events/**': { swr: 120 },
    '/privacy-policy': { swr: 3600 },
    '/termini-e-condizioni': { swr: 3600 },
  },
  nitro: {
    compressPublicAssets: true,
  },
  compatibilityDate: '2026-04-21',
})
