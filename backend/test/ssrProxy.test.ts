import type { NextFunction, Request, Response } from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSsrProxyMiddleware } from '../src/middleware/ssrProxy'

function createResponseMock() {
  const headers: Record<string, string> = {}

  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = value
      return this
    },
    send: vi.fn(),
    end: vi.fn(),
  } as unknown as Response

  return { res, headers }
}

describe('createSsrProxyMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips api paths and calls next', async () => {
    const middleware = createSsrProxyMiddleware('http://localhost:5573')
    const req = {
      path: '/api/posts',
      method: 'GET',
      originalUrl: '/api/posts',
      url: '/api/posts',
      headers: {},
    } as Request
    const { res } = createResponseMock()
    const next = vi.fn() as unknown as NextFunction

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('proxies GET public route and forwards status, headers and body', async () => {
    const middleware = createSsrProxyMiddleware('http://localhost:5573')
    const req = {
      path: '/posts/test',
      method: 'GET',
      originalUrl: '/posts/test?utm=1',
      url: '/posts/test?utm=1',
      headers: { 'user-agent': 'vitest' },
    } as Request
    const { res, headers } = createResponseMock()
    const next = vi.fn() as unknown as NextFunction

    const body = '<html><body>ok</body></html>'
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=120',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await middleware(req, res, next)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
    expect(headers['content-type']).toContain('text/html')
    expect((res.send as any).mock.calls[0][0].toString()).toContain('ok')
    expect(next).not.toHaveBeenCalled()
  })

  it('handles HEAD by forwarding headers without sending body', async () => {
    const middleware = createSsrProxyMiddleware('http://localhost:5573')
    const req = {
      path: '/robots.txt',
      method: 'HEAD',
      originalUrl: '/robots.txt',
      url: '/robots.txt',
      headers: {},
    } as Request
    const { res, headers } = createResponseMock()
    const next = vi.fn() as unknown as NextFunction

    const fetchMock = vi.fn().mockResolvedValue(new Response('', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await middleware(req, res, next)

    expect(res.statusCode).toBe(200)
    expect(headers['content-type']).toContain('text/plain')
    expect(res.end).toHaveBeenCalledOnce()
    expect(res.send).not.toHaveBeenCalled()
  })
})
