import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { config } from './config'
import { publicRateLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import { authMiddleware, clearAuthCookie, resolveAdminRequest } from './middleware/auth'
import audioPublicRouter from './routes/public/audio'
import articlesPublicRouter from './routes/public/articles'
import categoriesPublicRouter from './routes/public/categories'
import tagsPublicRouter from './routes/public/tags'
import authRouter from './routes/admin/auth'
import audioAdminRouter from './routes/admin/audio'
import albumAdminRouter from './routes/admin/album'
import articlesAdminRouter from './routes/admin/articles'
import categoriesAdminRouter from './routes/admin/categories'
import tagsAdminRouter from './routes/admin/tags'
import usersAdminRouter from './routes/admin/users'
import settingsAdminRouter from './routes/admin/settings'
import analyticsPublicRouter from './routes/public/analytics'
import analyticsAdminRouter from './routes/admin/analytics'
import auditLogsAdminRouter from './routes/admin/auditLogs'
import inviteCodesAdminRouter from './routes/admin/inviteCodes'
import { startBackupScheduler } from './services/backupService'
import { ensureDatabaseReady } from './services/startupService'
import { asyncHandler } from './utils/asyncRouter'

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
app.use('/api', publicRateLimiter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Public API routes
app.use('/api/audio', audioPublicRouter)
app.use('/api/articles', articlesPublicRouter)
app.use('/api/categories', categoriesPublicRouter)
app.use('/api/tags', tagsPublicRouter)
app.use('/api/analytics', analyticsPublicRouter)

// Admin API routes
app.use('/api/auth', authRouter)
app.use('/api/admin/audio', audioAdminRouter)
app.use('/api/admin/album', albumAdminRouter)
app.use('/api/admin/articles', articlesAdminRouter)
app.use('/api/admin/categories', categoriesAdminRouter)
app.use('/api/admin/tags', tagsAdminRouter)
app.use('/api/admin/users', usersAdminRouter)
app.use('/api/admin/settings', settingsAdminRouter)
app.use('/api/admin/analytics', analyticsAdminRouter)
app.use('/api/admin/audit-logs', auditLogsAdminRouter)
app.use('/api/admin/invite-codes', inviteCodesAdminRouter)

// Serve uploaded files
app.use('/api/files/images', authMiddleware, express.static(config.storage.imagesPath))

// In production, serve frontend and admin static files
if (config.isProduction) {
  const publicDir = path.resolve(__dirname, 'public')
  const adminDir = path.resolve(__dirname, 'public/admin')
  const adminPublicRoutes = new Set([
    '/admin/login',
    '/admin/forgot-password',
    '/admin/reset-password',
  ])

  function getAdminAppPath(requestPath: string) {
    const normalized = requestPath === '/admin' ? '/admin/' : requestPath
    const appPath = normalized.slice('/admin'.length) || '/'
    return appPath.startsWith('/') ? appPath : `/${appPath}`
  }

  app.use('/admin', express.static(adminDir, { index: false }))

  app.get(['/admin', '/admin/*'], asyncHandler(async (req, res) => {
    if (path.extname(req.path)) {
      res.status(404).end()
      return
    }

    const appPath = getAdminAppPath(req.path)
    const isPublicRoute = adminPublicRoutes.has(req.path)
    const authResult = await resolveAdminRequest(req)

    if (authResult.kind !== 'authenticated' && authResult.clearCookieName) {
      clearAuthCookie(res, authResult.clearCookieName)
    }

    if (authResult.kind === 'authenticated') {
      if (authResult.principal.isBootstrap) {
        if (appPath !== '/setup') {
          res.redirect(302, '/admin/setup')
          return
        }
      } else if (isPublicRoute || appPath === '/setup') {
        res.redirect(302, '/admin/')
        return
      }
    } else if (!isPublicRoute) {
      if (authResult.clearCookieName) {
        clearAuthCookie(res, authResult.clearCookieName)
      }

      const redirectParam = appPath !== '/' ? `?redirect=${encodeURIComponent(appPath)}` : ''
      res.redirect(302, `/admin/login${redirectParam}`)
      return
    }

    res.sendFile(path.join(adminDir, 'index.html'))
  }))

  // Frontend PWA
  app.use(express.static(publicDir, { index: 'index.html' }))
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

// Error handler
app.use(errorHandler)

async function startApplication() {
  await ensureDatabaseReady()

  app.listen(config.port, () => {
    console.log(`[MindCalm] Server avviato su porta ${config.port} (${config.nodeEnv})`)
  })

  void startBackupScheduler().catch((error) => {
    console.error('[Backup] Impossibile avviare lo scheduler backup:', error)
  })
}

void startApplication().catch((error) => {
  console.error('[MindCalm] Avvio backend fallito:', error)
  process.exit(1)
})

export default app
