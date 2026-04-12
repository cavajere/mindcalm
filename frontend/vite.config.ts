import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MindCalm',
        short_name: 'MindCalm',
        description: 'Audio di mindfulness guidati',
        theme_color: '#4A90D9',
        background_color: '#F8FAFE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/audio\/[^/]+\/(playback-session|playback\/.*)(\?.*)?$/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\/v1\/audio(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'audio-api', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /\/api\/v1\/articles(\?.*)?$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'articles-api', expiration: { maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /\/api\/v1\/audio\/[^/]+$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'audio-details-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /\/api\/v1\/articles\/[^/]+$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'article-details-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /\/api\/v1\/categories$/,
            handler: 'CacheFirst',
            options: { cacheName: 'categories-api', expiration: { maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /\/api\/v1\/files\/images\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cover-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3300',
    },
  },
})
