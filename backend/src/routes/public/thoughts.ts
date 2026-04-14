import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { Prisma } from '@prisma/client'
import { validationResult } from 'express-validator'
import { getSingleString, getStringList } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { optionalAppAuthMiddleware } from '../../middleware/auth'
import { thoughtFilterQuery } from '../../utils/validators'
import { getRankedPublishedThoughtIds } from '../../services/searchService'
import { mapThoughtTags } from '../../services/tagService'
import { resolveCoverImageSource } from '../../services/albumImageService'
import { getVisibleContentVisibilities } from '../../utils/contentVisibility'

const router = createAsyncRouter()

router.use(optionalAppAuthMiddleware)

function mapThoughtListItem(thought: {
  id: string
  title: string
  slug: string
  excerpt: string | null
  author: string
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
  thoughtTags: Array<{ tag: { id: string; label: string; slug: string } }>
}) {
  const cover = resolveCoverImageSource({
    coverImage: thought.coverImage,
    coverImageOriginalName: thought.coverImageOriginalName,
    coverImageDisplayName: thought.coverImageDisplayName,
    coverAlbumImage: thought.coverAlbumImage,
  })

  return {
    id: thought.id,
    title: thought.title,
    slug: thought.slug,
    excerpt: thought.excerpt,
    author: thought.author,
    ...cover,
    publishedAt: thought.publishedAt,
    tags: mapThoughtTags(thought.thoughtTags),
  }
}

// GET /api/thoughts — elenco pensieri pubblicati
router.get('/', thoughtFilterQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit
  const search = getSingleString(req.query.search)?.trim() || ''
  const tagSlugs = [...new Set(getStringList(req.query.tags))]
  const matchMode = getSingleString(req.query.matchMode) === 'all' ? 'all' : 'any'
  const author = getSingleString(req.query.author)?.trim()
  const sort = getSingleString(req.query.sort) || 'recent'
  const visibleVisibilities = getVisibleContentVisibilities(req)

  if (!search && sort === 'relevance') {
    res.status(400).json({ error: 'sort=relevance richiede una query di ricerca' })
    return
  }

  const include = {
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
    thoughtTags: {
      include: { tag: { select: { id: true, label: true, slug: true } } },
    },
  } satisfies Prisma.ThoughtInclude

  if (search) {
    const { ids, total } = await getRankedPublishedThoughtIds({
      page,
      limit,
      search,
      tagSlugs,
      matchMode,
      author,
      visibilities: visibleVisibilities,
    })

    if (!ids.length) {
      res.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })
      return
    }

    const thoughts = await prisma.thought.findMany({
      where: {
        id: { in: ids },
        status: 'PUBLISHED',
        visibility: { in: visibleVisibilities },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        author: true,
        coverImage: true,
        coverImageOriginalName: true,
        coverImageDisplayName: true,
        coverAlbumImage: include.coverAlbumImage,
        publishedAt: true,
        thoughtTags: include.thoughtTags,
      },
    })

    const byId = new Map(thoughts.map(thought => [thought.id, thought]))
    const data = ids
      .map(id => byId.get(id))
      .filter((thought): thought is NonNullable<typeof thought> => Boolean(thought))
      .map(mapThoughtListItem)

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
    return
  }

  const where: Prisma.ThoughtWhereInput = {
    status: 'PUBLISHED',
    visibility: { in: visibleVisibilities },
  }
  if (author) {
    where.author = { equals: author, mode: 'insensitive' }
  }
  if (tagSlugs.length) {
    if (matchMode === 'all') {
      where.AND = tagSlugs.map(slug => ({
        thoughtTags: { some: { tag: { slug, isActive: true } } },
      }))
    } else {
      where.thoughtTags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
            isActive: true,
          },
        },
      }
    }
  }

  const [thoughts, total] = await Promise.all([
    prisma.thought.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        author: true,
        coverImage: true,
        coverImageOriginalName: true,
        coverImageDisplayName: true,
        coverAlbumImage: include.coverAlbumImage,
        publishedAt: true,
        thoughtTags: include.thoughtTags,
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.thought.count({ where }),
  ])

  res.json({
    data: thoughts.map(mapThoughtListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// GET /api/thoughts/:slug — dettaglio pensiero
router.get('/:slug', async (req: Request, res: Response) => {
  const slug = getSingleString(req.params.slug)
  if (!slug) {
    res.status(400).json({ error: 'Slug pensiero non valido' })
    return
  }

  const thought = await prisma.thought.findFirst({
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
      thoughtTags: {
        include: { tag: { select: { id: true, label: true, slug: true } } },
      },
    },
  })

  if (!thought) {
    res.status(404).json({ error: 'Pensiero non trovato' })
    return
  }

  const cover = resolveCoverImageSource({
    coverImage: thought.coverImage,
    coverImageOriginalName: thought.coverImageOriginalName,
    coverImageDisplayName: thought.coverImageDisplayName,
    coverAlbumImage: thought.coverAlbumImage,
  })

  res.json({
    id: thought.id,
    slug: thought.slug,
    title: thought.title,
    body: thought.body,
    excerpt: thought.excerpt,
    author: thought.author,
    ...cover,
    publishedAt: thought.publishedAt,
    tags: mapThoughtTags(thought.thoughtTags),
  })
})

export default router
