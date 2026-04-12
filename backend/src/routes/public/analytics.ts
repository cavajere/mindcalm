import { Router, Request, Response } from 'express'
import { AnalyticsEventType } from '@prisma/client'
import { validationResult } from 'express-validator'
import { analyticsEventValidation } from '../../utils/validators'
import { prisma } from '../../lib/prisma'
import { getSingleString } from '../../utils/request'
import { authMiddleware } from '../../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.post('/events', analyticsEventValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const eventType = getSingleString(req.body.eventType) as AnalyticsEventType | undefined
  const audioId = getSingleString(req.body.audioId)
  const articleId = getSingleString(req.body.articleId)

  if (!eventType) {
    res.status(400).json({ error: 'Tipo evento non valido' })
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

    await prisma.analyticsEvent.create({
      data: {
        userId: req.adminUser!.id,
        contentType: 'AUDIO',
        eventType,
        audioId,
      },
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

    await prisma.analyticsEvent.create({
      data: {
        userId: req.adminUser!.id,
        contentType: 'ARTICLE',
        eventType,
        articleId,
      },
    })

    res.status(201).json({ success: true })
    return
  }

  res.status(400).json({ error: 'Tipo evento non gestito' })
})

export default router
