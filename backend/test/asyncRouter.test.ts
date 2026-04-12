import express from 'express'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { asyncHandler, createAsyncRouter } from '../src/utils/asyncRouter'

type RunningServer = ReturnType<typeof express.application.listen>

const runningServers: RunningServer[] = []

async function startTestServer() {
  const app = express()
  const router = createAsyncRouter()

  router.get('/boom', async () => {
    throw new Error('boom')
  })

  router.get('/ok', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/wrapped-boom', asyncHandler(async () => {
    throw new Error('wrapped-boom')
  }))

  app.use(router)

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message })
  })

  const server = await new Promise<RunningServer>((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })

  runningServers.push(server)
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })))
})

describe('asyncRouter', () => {
  it('inoltra gli errori async al middleware di errore senza far cadere il server', async () => {
    const baseUrl = await startTestServer()

    const errorResponse = await fetch(`${baseUrl}/boom`)
    const errorBody = await errorResponse.json()

    expect(errorResponse.status).toBe(500)
    expect(errorBody).toEqual({ error: 'boom' })

    const okResponse = await fetch(`${baseUrl}/ok`)
    const okBody = await okResponse.json()

    expect(okResponse.status).toBe(200)
    expect(okBody).toEqual({ ok: true })
  })

  it('permette di usare asyncHandler anche fuori dai router factory', async () => {
    const baseUrl = await startTestServer()

    const response = await fetch(`${baseUrl}/wrapped-boom`)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'wrapped-boom' })
  })
})
