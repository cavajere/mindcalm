import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { Prisma } from '@prisma/client'
import { validationResult } from 'express-validator'
import { getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { optionalAppAuthMiddleware } from '../../middleware/auth'
import { paginationQuery } from '../../utils/validators'
import { resolveCoverImageSource } from '../../services/albumImageService'
import { getVisibleContentVisibilities } from '../../utils/contentVisibility'

const router = createAsyncRouter()

router.use(optionalAppAuthMiddleware)

function mapEventListItem(event: {
  id: string
  title: string
  slug: string
  excerpt: string | null
  organizer: string
  city: string
  venue: string | null
  startsAt: Date
  endsAt: Date | null
  coverImage: string | null
  coverImageOriginalName: string | null
  coverImageDisplayName: string | null
  coverAlbumImage?: {
    id: string
    filePath: string
    originalName: string
    displayName: string
    title: string | null
    description: string | null
    mimeType: string
    size: number
  } | null
  publishedAt: Date | null
}) {
  const cover = resolveCoverImageSource({
    coverImage: event.coverImage,
    coverImageOriginalName: event.coverImageOriginalName,
    coverImageDisplayName: event.coverImageDisplayName,
    coverAlbumImage: event.coverAlbumImage,
  })

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    excerpt: event.excerpt,
    organizer: event.organizer,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    ...cover,
    publishedAt: event.publishedAt,
  }
}

router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit
  const city = getSingleString(req.query.city)?.trim()
  const visibleVisibilities = getVisibleContentVisibilities(req)

  const where: Prisma.EventWhereInput = {
    status: 'PUBLISHED',
    visibility: { in: visibleVisibilities },
  }
  if (city) {
    where.city = { equals: city, mode: 'insensitive' }
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        organizer: true,
        city: true,
        venue: true,
        startsAt: true,
        endsAt: true,
        coverImage: true,
        coverImageOriginalName: true,
        coverImageDisplayName: true,
        coverAlbumImage: {
          select: {
            id: true,
            filePath: true,
            originalName: true,
            displayName: true,
            title: true,
            description: true,
            mimeType: true,
            size: true,
          },
        },
        publishedAt: true,
      },
      orderBy: [{ startsAt: 'asc' }, { publishedAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ])

  res.json({
    data: events.map(mapEventListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/:slug', async (req: Request, res: Response) => {
  const slug = getSingleString(req.params.slug)
  if (!slug) {
    res.status(400).json({ error: 'Slug evento non valido' })
    return
  }

  const event = await prisma.event.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
      visibility: { in: getVisibleContentVisibilities(req) },
    },
    include: {
      coverAlbumImage: {
        select: {
          id: true,
          filePath: true,
          originalName: true,
          displayName: true,
          title: true,
          description: true,
          mimeType: true,
          size: true,
        },
      },
    },
  })

  if (!event) {
    res.status(404).json({ error: 'Evento non trovato' })
    return
  }

  const cover = resolveCoverImageSource({
    coverImage: event.coverImage,
    coverImageOriginalName: event.coverImageOriginalName,
    coverImageDisplayName: event.coverImageDisplayName,
    coverAlbumImage: event.coverAlbumImage,
  })

  res.json({
    id: event.id,
    slug: event.slug,
    title: event.title,
    body: event.body,
    excerpt: event.excerpt,
    organizer: event.organizer,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    ...cover,
    publishedAt: event.publishedAt,
  })
})

export default router
