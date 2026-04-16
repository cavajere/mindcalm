import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { Prisma } from '@prisma/client'
import { validationResult } from 'express-validator'
import { getSingleString, getStringList } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { optionalAppAuthMiddleware } from '../../middleware/auth'
import { postFilterQuery } from '../../utils/validators'
import { getRankedPublishedPostIds } from '../../services/searchService'
import { mapPostTags } from '../../services/tagService'
import { resolveCoverImageSource } from '../../services/albumImageService'
import { getVisibleContentVisibilities } from '../../utils/contentVisibility'

const router = createAsyncRouter()

router.use(optionalAppAuthMiddleware)

function mapPostListItem(post: {
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
  postTags: Array<{ tag: { id: string; label: string; slug: string } }>
}) {
  const cover = resolveCoverImageSource({
    coverImage: post.coverImage,
    coverImageOriginalName: post.coverImageOriginalName,
    coverImageDisplayName: post.coverImageDisplayName,
    coverAlbumImage: post.coverAlbumImage,
  })

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    author: post.author,
    ...cover,
    publishedAt: post.publishedAt,
    tags: mapPostTags(post.postTags),
  }
}

// GET /api/posts — elenco post pubblicati
router.get('/', postFilterQuery, async (req: Request, res: Response) => {
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
  const requestLog = {
    search,
    page,
    limit,
    tagSlugs,
    matchMode,
    author: author || null,
    sort,
  }

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
    postTags: {
      include: { tag: { select: { id: true, label: true, slug: true } } },
    },
  } satisfies Prisma.PostInclude

  if (search) {
    console.info('[Search][API][Posts] request', requestLog)

    const { ids, total } = await getRankedPublishedPostIds({
      page,
      limit,
      search,
      tagSlugs,
      matchMode,
      author,
      visibilities: visibleVisibilities,
    })

    if (!ids.length) {
      console.info('[Search][API][Posts] response', { ...requestLog, resultCount: 0, total: 0 })
      res.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })
      return
    }

    const posts = await prisma.post.findMany({
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
        postTags: include.postTags,
      },
    })

    const byId = new Map(posts.map(post => [post.id, post]))
    const data = ids
      .map(id => byId.get(id))
      .filter((post): post is NonNullable<typeof post> => Boolean(post))
      .map(mapPostListItem)

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
    console.info('[Search][API][Posts] response', { ...requestLog, resultCount: data.length, total })
    return
  }

  const where: Prisma.PostWhereInput = {
    status: 'PUBLISHED',
    visibility: { in: visibleVisibilities },
  }
  if (author) {
    where.author = { equals: author, mode: 'insensitive' }
  }
  if (tagSlugs.length) {
    if (matchMode === 'all') {
      where.AND = tagSlugs.map(slug => ({
        postTags: { some: { tag: { slug, isActive: true } } },
      }))
    } else {
      where.postTags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
            isActive: true,
          },
        },
      }
    }
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
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
        postTags: include.postTags,
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  res.json({
    data: posts.map(mapPostListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// GET /api/posts/:slug — dettaglio post
router.get('/:slug', async (req: Request, res: Response) => {
  const slug = getSingleString(req.params.slug)
  if (!slug) {
    res.status(400).json({ error: 'Slug post non valido' })
    return
  }

  const post = await prisma.post.findFirst({
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
      postTags: {
        include: { tag: { select: { id: true, label: true, slug: true } } },
      },
    },
  })

  if (!post) {
    res.status(404).json({ error: 'Post non trovato' })
    return
  }

  const cover = resolveCoverImageSource({
    coverImage: post.coverImage,
    coverImageOriginalName: post.coverImageOriginalName,
    coverImageDisplayName: post.coverImageDisplayName,
    coverAlbumImage: post.coverAlbumImage,
  })

  res.json({
    id: post.id,
    slug: post.slug,
    title: post.title,
    body: post.body,
    excerpt: post.excerpt,
    author: post.author,
    ...cover,
    publishedAt: post.publishedAt,
    tags: mapPostTags(post.postTags),
  })
})

export default router
