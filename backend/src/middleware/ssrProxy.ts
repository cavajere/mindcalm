import type { Request, Response, NextFunction } from 'express'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function isBypassedPath(path: string) {
  return (
    path.startsWith('/api/')
    || path.startsWith('/public-api/')
    || path === '/api'
    || path === '/public-api'
    || path.startsWith('/admin')
  )
}

function cloneRequestHeaders(req: Request) {
  const headers = new Headers()

  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value) return
    if (key === 'host' || key === 'content-length') return

    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v))
      return
    }

    headers.set(key, value)
  })

  return headers
}

function copyResponseHeaders(upstream: globalThis.Response, res: Response) {
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return
    res.setHeader(key, value)
  })
}

export function createSsrProxyMiddleware(ssrOrigin: string) {
  return async function ssrProxy(req: Request, res: Response, next: NextFunction) {
    if (isBypassedPath(req.path)) {
      next()
      return
    }

    if (!['GET', 'HEAD'].includes(req.method)) {
      next()
      return
    }

    try {
      const target = new URL(req.originalUrl || req.url, ssrOrigin)
      const upstream = await fetch(target, {
        method: req.method,
        headers: cloneRequestHeaders(req),
        redirect: 'manual',
      })

      res.status(upstream.status)
      copyResponseHeaders(upstream, res)

      if (req.method === 'HEAD' || !upstream.body) {
        res.end()
        return
      }

      const buffer = Buffer.from(await upstream.arrayBuffer())
      res.send(buffer)
    } catch (error) {
      next(error)
    }
  }
}
