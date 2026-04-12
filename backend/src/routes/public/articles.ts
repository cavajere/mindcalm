import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { validationResult } from 'express-validator'
import path from 'path'
import { getSingleString, getStringList } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { appAuthMiddleware } from '../../middleware/auth'
import { articleFilterQuery } from '../../utils/validators'
import { getRankedPublishedArticleIds } from '../../services/searchService'
import { mapArticleTags } from '../../services/tagService'

const router = Router()

router.use(appAuthMiddleware)

function mapArticleListItem(article: {
  id: string
  title: string
  slug: string
  excerpt: string | null
  author: string
  coverImage: string | null
  publishedAt: Date | null
  articleTags: Array<{ tag: { id: string; label: string; slug: string } }>
}) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    author: article.author,
    coverImage: article.coverImage ? `/api/v1/files/images/${path.basename(article.coverImage)}` : null,
    publishedAt: article.publishedAt,
    tags: mapArticleTags(article.articleTags),
  }
}

// GET /api/v1/articles — elenco articoli pubblicati
router.get('/', articleFilterQuery, async (req: Request, res: Response) => {
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

  if (!search && sort === 'relevance') {
    res.status(400).json({ error: 'sort=relevance richiede una query di ricerca' })
    return
  }

  const include = {
    articleTags: {
      include: { tag: { select: { id: true, label: true, slug: true } } },
    },
  } satisfies Prisma.ArticleInclude

  if (search) {
    const { ids, total } = await getRankedPublishedArticleIds({
      page,
      limit,
      search,
      tagSlugs,
      matchMode,
      author,
    })

    if (!ids.length) {
      res.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })
      return
    }

    const articles = await prisma.article.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        author: true,
        coverImage: true,
        publishedAt: true,
        articleTags: include.articleTags,
      },
    })

    const byId = new Map(articles.map(article => [article.id, article]))
    const data = ids
      .map(id => byId.get(id))
      .filter((article): article is NonNullable<typeof article> => Boolean(article))
      .map(mapArticleListItem)

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
    return
  }

  const where: Prisma.ArticleWhereInput = { status: 'PUBLISHED' }
  if (author) {
    where.author = { equals: author, mode: 'insensitive' }
  }
  if (tagSlugs.length) {
    if (matchMode === 'all') {
      where.AND = tagSlugs.map(slug => ({
        articleTags: { some: { tag: { slug, isActive: true } } },
      }))
    } else {
      where.articleTags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
            isActive: true,
          },
        },
      }
    }
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        author: true,
        coverImage: true,
        publishedAt: true,
        articleTags: include.articleTags,
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.article.count({ where }),
  ])

  res.json({
    data: articles.map(mapArticleListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// GET /api/v1/articles/:slug — dettaglio articolo
router.get('/:slug', async (req: Request, res: Response) => {
  const slug = getSingleString(req.params.slug)
  if (!slug) {
    res.status(400).json({ error: 'Slug articolo non valido' })
    return
  }

  const article = await prisma.article.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      articleTags: {
        include: { tag: { select: { id: true, label: true, slug: true } } },
      },
    },
  })

  if (!article) {
    res.status(404).json({ error: 'Articolo non trovato' })
    return
  }

  res.json({
    id: article.id,
    slug: article.slug,
    title: article.title,
    body: article.body,
    excerpt: article.excerpt,
    author: article.author,
    coverImage: article.coverImage ? `/api/v1/files/images/${path.basename(article.coverImage)}` : null,
    publishedAt: article.publishedAt,
    tags: mapArticleTags(article.articleTags),
  })
})

export default router
