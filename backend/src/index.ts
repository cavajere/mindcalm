import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { config } from './config'
import { publicRateLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import { authMiddleware } from './middleware/auth'
import audioPublicRouter from './routes/public/audio'
import articlesPublicRouter from './routes/public/articles'
import categoriesPublicRouter from './routes/public/categories'
import tagsPublicRouter from './routes/public/tags'
import authRouter from './routes/admin/auth'
import audioAdminRouter from './routes/admin/audio'
import articlesAdminRouter from './routes/admin/articles'
import categoriesAdminRouter from './routes/admin/categories'
import tagsAdminRouter from './routes/admin/tags'
import usersAdminRouter from './routes/admin/users'
import settingsAdminRouter from './routes/admin/settings'
import analyticsPublicRouter from './routes/public/analytics'
import analyticsAdminRouter from './routes/admin/analytics'
import auditLogsAdminRouter from './routes/admin/auditLogs'

const app = express()

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))
app.use(cors({
  origin: config.isProduction
    ? config.cors.origin.split(',').map(s => s.trim())
    : true,
  credentials: true,
}))

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Rate limiting
app.use('/api/v1', publicRateLimiter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Public API routes
app.use('/api/v1/audio', audioPublicRouter)
app.use('/api/v1/articles', articlesPublicRouter)
app.use('/api/v1/categories', categoriesPublicRouter)
app.use('/api/v1/tags', tagsPublicRouter)
app.use('/api/v1/analytics', analyticsPublicRouter)

// Admin API routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/admin/audio', audioAdminRouter)
app.use('/api/v1/admin/articles', articlesAdminRouter)
app.use('/api/v1/admin/categories', categoriesAdminRouter)
app.use('/api/v1/admin/tags', tagsAdminRouter)
app.use('/api/v1/admin/users', usersAdminRouter)
app.use('/api/v1/admin/settings', settingsAdminRouter)
app.use('/api/v1/admin/analytics', analyticsAdminRouter)
app.use('/api/v1/admin/audit-logs', auditLogsAdminRouter)

// Serve uploaded files
app.use('/api/v1/files/images', authMiddleware, express.static(config.storage.imagesPath))

// In production, serve frontend and admin static files
if (config.isProduction) {
  const publicDir = path.resolve(__dirname, '../public')
  const adminDir = path.resolve(__dirname, '../public/admin')

  // Admin SPA (must be before frontend catch-all)
  app.use('/admin', express.static(adminDir))
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'))
  })

  // Frontend PWA
  app.use(express.static(publicDir, { index: 'index.html' }))
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

// Error handler
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`[MindCalm] Server avviato su porta ${config.port} (${config.nodeEnv})`)
})

export default app
