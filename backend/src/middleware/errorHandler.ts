import { Request, Response, NextFunction } from 'express'
import multer from 'multer'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message)

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
