export default defineEventHandler(() => {
  return {
    status: 'ok',
    service: 'frontend-ssr',
    timestamp: new Date().toISOString(),
  }
})
