import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { Prisma } from '@prisma/client'
import { validationResult } from 'express-validator'
import { prisma } from '../../lib/prisma'
import { optionalAppAuthMiddleware } from '../../middleware/auth'
import { getBoolean, getSingleString } from '../../utils/request'
import { tagFilterQuery } from '../../utils/validators'
import { getVisibleContentVisibilities } from '../../utils/contentVisibility'

const router = createAsyncRouter()

router.use(optionalAppAuthMiddleware)

router.get('/', tagFilterQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const contentType = getSingleString(req.query.contentType) || 'all'
  const activeOnly = getBoolean(req.query.activeOnly) ?? true
  const search = getSingleString(req.query.search)?.trim()
  const articleVisibilityFilter = {
    status: 'PUBLISHED' as const,
    visibility: { in: getVisibleContentVisibilities(req) },
  }

  if (!req.adminUser && contentType !== 'article') {
    res.json([])
    return
  }

  const where: Prisma.TagWhereInput = {
    AND: [
      {
        isActive: activeOnly ? true : undefined,
      },
      search
        ? {
            OR: [
              { label: { contains: search, mode: 'insensitive' } },
              { aliases: { some: { alias: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {},
      contentType === 'audio'
        ? { audioTags: { some: { audio: { status: 'PUBLISHED' } } } }
        : contentType === 'article'
          ? { articleTags: { some: { article: articleVisibilityFilter } } }
          : {
              OR: [
                { audioTags: { some: { audio: { status: 'PUBLISHED' } } } },
                { articleTags: { some: { article: articleVisibilityFilter } } },
              ],
            },
    ],
  }

  const tags = await prisma.tag.findMany({
    where,
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
    audioCount: req.adminUser ? tag._count.audioTags : 0,
    articleCount: tag._count.articleTags,
  })))
})

export default router
