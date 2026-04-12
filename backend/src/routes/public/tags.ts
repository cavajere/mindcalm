import { Router, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { prisma } from '../../lib/prisma'
import { appAuthMiddleware } from '../../middleware/auth'
import { getBoolean, getSingleString } from '../../utils/request'
import { tagFilterQuery } from '../../utils/validators'

const router = Router()

router.use(appAuthMiddleware)

router.get('/', tagFilterQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const contentType = getSingleString(req.query.contentType) || 'all'
  const activeOnly = getBoolean(req.query.activeOnly) ?? true
  const search = getSingleString(req.query.search)?.trim()

  const tags = await prisma.tag.findMany({
    where: {
      isActive: activeOnly ? true : undefined,
      OR: search
        ? [
            { label: { contains: search, mode: 'insensitive' } },
            { aliases: { some: { alias: { contains: search, mode: 'insensitive' } } } },
          ]
        : undefined,
      ...(contentType === 'audio'
        ? { audioTags: { some: {} } }
        : contentType === 'article'
          ? { articleTags: { some: {} } }
          : {}),
    },
    include: {
      _count: { select: { audioTags: true, articleTags: true } },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { label: 'asc' },
    ],
  })

  res.json(tags.map(tag => ({
    id: tag.id,
    label: tag.label,
    slug: tag.slug,
    description: tag.description,
    audioCount: tag._count.audioTags,
    articleCount: tag._count.articleTags,
  })))
})

export default router
