import { Router, Request, Response } from 'express'
import { AnalyticsEventType } from '@prisma/client'
import { validationResult } from 'express-validator'
import { analyticsEventValidation } from '../../utils/validators'
import { prisma } from '../../lib/prisma'
import { getSingleString } from '../../utils/request'
import { optionalAppAuthMiddleware } from '../../middleware/auth'
import { createAnalyticsEvent } from '../../services/analyticsEventService'

const router = Router()

const errorEventTypes = new Set<AnalyticsEventType>([
  AnalyticsEventType.APP_ERROR,
  AnalyticsEventType.API_ERROR,
  AnalyticsEventType.AUDIO_ERROR,
  AnalyticsEventType.SERVER_ERROR,
])

router.use(optionalAppAuthMiddleware)

router.post('/events', analyticsEventValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const eventType = getSingleString(req.body.eventType) as AnalyticsEventType | undefined
  const audioId = getSingleString(req.body.audioId)
  const articleId = getSingleString(req.body.articleId)
  const metadata = typeof req.body.metadata === 'object' && req.body.metadata !== null && !Array.isArray(req.body.metadata)
    ? req.body.metadata as Record<string, unknown>
    : undefined

  if (!eventType) {
    res.status(400).json({ error: 'Tipo evento non valido' })
    return
  }

  if (audioId && articleId) {
    res.status(400).json({ error: 'Specifica un solo contenuto per evento' })
    return
  }

  if (errorEventTypes.has(eventType)) {
    await createAnalyticsEvent({
      userId: req.adminUser?.id ?? null,
      eventType,
      audioId,
      articleId,
      metadata,
    })

    res.status(201).json({ success: true })
    return
  }

  if (!req.adminUser?.id) {
    res.status(401).json({ error: 'Autenticazione richiesta per questo evento' })
    return
  }

  const isAudioEvent = ['AUDIO_VIEW', 'AUDIO_PLAY', 'AUDIO_COMPLETE'].includes(eventType)
  if (isAudioEvent) {
    if (!audioId || articleId) {
      res.status(400).json({ error: 'Evento audio non valido' })
      return
    }

    const audio = await prisma.audio.findFirst({
      where: { id: audioId, status: 'PUBLISHED' },
      select: { id: true },
    })

    if (!audio) {
      res.status(404).json({ error: 'Audio non trovato' })
      return
    }

    await createAnalyticsEvent({
      userId: req.adminUser.id,
      eventType,
      audioId,
    })

    res.status(201).json({ success: true })
    return
  }

  if (eventType === 'ARTICLE_VIEW') {
    if (!articleId || audioId) {
      res.status(400).json({ error: 'Evento articolo non valido' })
      return
    }

    const article = await prisma.article.findFirst({
      where: { id: articleId, status: 'PUBLISHED' },
      select: { id: true },
    })

    if (!article) {
      res.status(404).json({ error: 'Articolo non trovato' })
      return
    }

    await createAnalyticsEvent({
      userId: req.adminUser.id,
      eventType,
      articleId,
    })

    res.status(201).json({ success: true })
    return
  }

  res.status(400).json({ error: 'Tipo evento non gestito' })
})

export default router
