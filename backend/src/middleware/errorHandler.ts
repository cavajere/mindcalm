import { Request, Response, NextFunction } from 'express'
import { AnalyticsEventType } from '@prisma/client'
import multer from 'multer'
import { createAnalyticsEvent } from '../services/analyticsEventService'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const requestLabel = `${_req.method} ${_req.originalUrl}`
  console.error(`[Error] ${requestLabel}: ${err.message}`)

  if (_req.originalUrl !== '/api/analytics/events') {
    void createAnalyticsEvent({
      userId: _req.adminUser?.id ?? null,
      eventType: AnalyticsEventType.SERVER_ERROR,
      metadata: {
        source: 'backend-error-handler',
        requestPath: _req.originalUrl,
        requestMethod: _req.method,
        requestQuery: _req.query,
        routeParams: _req.params,
        message: err.message,
        name: err.name,
        stack: err.stack,
        surface: _req.originalUrl.startsWith('/api/admin/') ? 'admin' : 'app',
      },
    }).catch((loggingError) => {
      console.error('[MindCalm] Analytics errore server non registrato', loggingError)
    })
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File troppo grande' })
      return
    }
    res.status(400).json({ error: err.message })
    return
  }

  if (err.message?.includes('Formato')) {
    res.status(400).json({ error: err.message })
    return
  }

  res.status(500).json({ error: 'Errore interno del server' })
}
