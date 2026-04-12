import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType, Prisma, Status } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { uploadImage } from '../../middleware/upload'
import { articleValidation, statusValidation, paginationQuery } from '../../utils/validators'
import { extractPlainText, sanitizeBody } from '../../utils/sanitize'
import { getBoolean, getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { MAX_TAGS_PER_CONTENT, createTagSlug, ensureTagsExist, mapArticleTags, parseTagIds } from '../../services/tagService'
import { buildUploadMetadata, renameStoredUpload } from '../../services/uploadMetadataService'
import { deleteDirectCoverImage, resolveCoverImageSource } from '../../services/albumImageService'

const router = createAsyncRouter()

router.use(adminAuthMiddleware, requireAdmin)

const albumImageSelect = {
  id: true,
  filePath: true,
  originalName: true,
  displayName: true,
  title: true,
  description: true,
  mimeType: true,
  size: true,
} as const

async function getAlbumImageOrNull(albumImageId: string) {
  return prisma.albumImage.findUnique({
    where: { id: albumImageId },
    select: albumImageSelect,
  })
}

function serializeAdminArticle(article: {
  id: string
  title: string
  slug: string
  body: string
  excerpt: string | null
  author: string
  status: Status
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
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
  articleTags: Array<{ tag: { id: string; label: string; slug: string } }>
}) {
  const cover = resolveCoverImageSource({
    coverImage: article.coverImage,
    coverImageOriginalName: article.coverImageOriginalName,
    coverImageDisplayName: article.coverImageDisplayName,
    coverAlbumImage: article.coverAlbumImage,
  })

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    body: article.body,
    excerpt: article.excerpt,
    author: article.author,
    status: article.status,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    ...cover,
    tags: mapArticleTags(article.articleTags),
  }
}

// GET /api/admin/articles
router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit

  const where: Prisma.ArticleWhereInput = {}
  if (req.query.status) where.status = req.query.status as any

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        coverAlbumImage: { select: albumImageSelect },
        articleTags: {
          include: { tag: { select: { id: true, label: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.article.count({ where }),
  ])

  res.json({
    data: articles.map(serializeAdminArticle),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/:id', async (req: Request, res: Response) => {
  const articleId = getSingleString(req.params.id)
  if (!articleId) {
    res.status(400).json({ error: 'ID articolo non valido' })
    return
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      coverAlbumImage: { select: albumImageSelect },
      articleTags: {
        include: { tag: { select: { id: true, label: true, slug: true } } },
      },
    },
  })

  if (!article) {
    res.status(404).json({ error: 'Articolo non trovato' })
    return
  }

  res.json(serializeAdminArticle(article))
})

// POST /api/admin/articles
router.post('/',
  uploadImage.single('coverImage'),
  articleValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Dati non validi', details: errors.array() })
      return
    }

    const title = getSingleString(req.body.title)
    const body = getSingleString(req.body.body)
    const excerpt = getSingleString(req.body.excerpt)
    const author = getSingleString(req.body.author)
    const status = getSingleString(req.body.status)
    const tagIds = parseTagIds(req.body.tagIds)
    const slug = createTagSlug(title!)
    const requestedCoverAlbumImageId = getSingleString(req.body.coverAlbumImageId)?.trim() || undefined
    const coverImageNames = req.file
      ? buildUploadMetadata(req.file, getSingleString(req.body.coverImageDisplayName))
      : null

    if (req.file && requestedCoverAlbumImageId) {
      deleteDirectCoverImage(`images/${req.file.filename}`)
      res.status(400).json({ error: 'Seleziona una copertina da album oppure carica un file, non entrambe' })
      return
    }

    if (tagIds.length > MAX_TAGS_PER_CONTENT) {
      res.status(400).json({ error: `Massimo ${MAX_TAGS_PER_CONTENT} tag per contenuto` })
      return
    }

    const selectedAlbumImage = requestedCoverAlbumImageId
      ? await getAlbumImageOrNull(requestedCoverAlbumImageId)
      : null

    if (requestedCoverAlbumImageId && !selectedAlbumImage) {
      deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
      res.status(404).json({ error: 'Immagine album non trovata' })
      return
    }

    try {
      await ensureTagsExist(tagIds)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }

    // Verifica unicità slug
    const existingSlug = await prisma.article.findUnique({ where: { slug } })
    if (existingSlug) {
      res.status(409).json({ error: 'Un articolo con un titolo simile esiste già' })
      return
    }

    const sanitizedBody = sanitizeBody(body!)

    const article = await prisma.article.create({
      data: {
        title: title!,
        slug,
        body: sanitizedBody,
        bodyText: extractPlainText(sanitizedBody),
        excerpt: excerpt || null,
        author: author!,
        coverImage: req.file ? `images/${req.file.filename}` : null,
        coverImageOriginalName: coverImageNames?.originalName ?? null,
        coverImageDisplayName: coverImageNames?.displayName ?? null,
        coverAlbumImageId: selectedAlbumImage?.id ?? null,
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        articleTags: {
          create: tagIds.map(tagId => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
      include: {
        coverAlbumImage: { select: albumImageSelect },
        articleTags: {
          include: { tag: { select: { id: true, label: true, slug: true } } },
        },
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.ARTICLE_CREATED,
      entityType: AuditEntityType.ARTICLE,
      entityId: article.id,
      entityLabel: article.title,
      ...getAuditActorFromRequest(req),
      metadata: {
        slug: article.slug,
        author: article.author,
        status: article.status,
        hasCoverImage: Boolean(article.coverImage || article.coverAlbumImageId),
        tagIds,
      },
    })

    res.status(201).json(serializeAdminArticle(article))
  }
)

// PUT /api/admin/articles/:id
router.put('/:id',
  uploadImage.single('coverImage'),
  async (req: Request, res: Response) => {
    const articleId = getSingleString(req.params.id)
    if (!articleId) {
      res.status(400).json({ error: 'ID articolo non valido' })
      return
    }

    const existing = await prisma.article.findUnique({ where: { id: articleId } })
    if (!existing) {
      res.status(404).json({ error: 'Articolo non trovato' })
      return
    }

    const title = getSingleString(req.body.title)
    const body = getSingleString(req.body.body)
    const author = getSingleString(req.body.author)
    const excerpt = getSingleString(req.body.excerpt)
    const status = getSingleString(req.body.status)
    const requestedCoverImageDisplayName = getSingleString(req.body.coverImageDisplayName)
    const removeCoverImage = getBoolean(req.body.removeCoverImage) === true
    const hasCoverAlbumImageId = Object.prototype.hasOwnProperty.call(req.body, 'coverAlbumImageId')
    const requestedCoverAlbumImageId = hasCoverAlbumImageId
      ? (getSingleString(req.body.coverAlbumImageId)?.trim() || null)
      : undefined
    const tagIds = parseTagIds(req.body.tagIds)
    const data: Prisma.ArticleUpdateInput = {}
    const changedFields: string[] = []

    if (req.file && requestedCoverAlbumImageId) {
      deleteDirectCoverImage(`images/${req.file.filename}`)
      res.status(400).json({ error: 'Seleziona una copertina da album oppure carica un file, non entrambe' })
      return
    }

    if (tagIds.length > MAX_TAGS_PER_CONTENT) {
      res.status(400).json({ error: `Massimo ${MAX_TAGS_PER_CONTENT} tag per contenuto` })
      return
    }

    try {
      await ensureTagsExist(tagIds)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }

    const selectedAlbumImage = requestedCoverAlbumImageId
      ? await getAlbumImageOrNull(requestedCoverAlbumImageId)
      : null

    if (requestedCoverAlbumImageId && !selectedAlbumImage) {
      deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
      res.status(404).json({ error: 'Immagine album non trovata' })
      return
    }

    if (title) {
      const nextSlug = createTagSlug(title)
      const conflictingSlug = await prisma.article.findFirst({
        where: {
          id: { not: articleId },
          slug: nextSlug,
        },
        select: { id: true },
      })
      if (conflictingSlug) {
        res.status(409).json({ error: 'Un articolo con un titolo simile esiste gia' })
        return
      }
      data.title = title
      data.slug = nextSlug
      if (title !== existing.title) changedFields.push('title')
    }
    if (body) {
      const sanitizedBody = sanitizeBody(body)
      data.body = sanitizedBody
      data.bodyText = extractPlainText(sanitizedBody)
      if (body !== existing.body) changedFields.push('body')
    }
    if (author) {
      data.author = author
      if (author !== existing.author) changedFields.push('author')
    }
    if (req.body.excerpt !== undefined) {
      data.excerpt = excerpt || null
      if ((excerpt || null) !== existing.excerpt) changedFields.push('excerpt')
    }

    if (status && ['DRAFT', 'PUBLISHED'].includes(status)) {
      data.status = status as Status
      if (status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        data.publishedAt = new Date()
      } else if (status === 'DRAFT') {
        data.publishedAt = null
      }
      if (status !== existing.status) changedFields.push('status')
    }

    if (req.file) {
      const coverImageNames = buildUploadMetadata(req.file, requestedCoverImageDisplayName)
      deleteDirectCoverImage(existing.coverImage)
      data.coverImage = `images/${req.file.filename}`
      data.coverImageOriginalName = coverImageNames.originalName
      data.coverImageDisplayName = coverImageNames.displayName
      data.coverAlbumImage = { disconnect: true }
      changedFields.push('coverImage')
    } else if (hasCoverAlbumImageId && requestedCoverAlbumImageId) {
      deleteDirectCoverImage(existing.coverImage)
      data.coverImage = null
      data.coverImageOriginalName = null
      data.coverImageDisplayName = null
      data.coverAlbumImage = { connect: { id: selectedAlbumImage!.id } }
      if (requestedCoverAlbumImageId !== existing.coverAlbumImageId || existing.coverImage) {
        changedFields.push('coverImage')
      }
    } else if (removeCoverImage && (existing.coverImage || existing.coverAlbumImageId)) {
      deleteDirectCoverImage(existing.coverImage)
      data.coverImage = null
      data.coverImageOriginalName = null
      data.coverImageDisplayName = null
      data.coverAlbumImage = { disconnect: true }
      changedFields.push('coverImage')
    } else if (hasCoverAlbumImageId && requestedCoverAlbumImageId === null && existing.coverAlbumImageId) {
      data.coverAlbumImage = { disconnect: true }
      changedFields.push('coverImage')
    } else if (requestedCoverImageDisplayName !== undefined && existing.coverImage && !existing.coverAlbumImageId) {
      const coverImageNames = renameStoredUpload(
        existing.coverImageOriginalName ?? '',
        existing.coverImageDisplayName,
        requestedCoverImageDisplayName,
      )
      if (
        coverImageNames.displayName !== existing.coverImageDisplayName ||
        coverImageNames.originalName !== existing.coverImageOriginalName
      ) {
        data.coverImageOriginalName = coverImageNames.originalName
        data.coverImageDisplayName = coverImageNames.displayName
        changedFields.push('coverImageDisplayName')
      }
    }

    data.articleTags = {
      deleteMany: {},
      create: tagIds.map(tagId => ({
        tag: { connect: { id: tagId } },
      })),
    }
    changedFields.push('tags')

    const article = await prisma.article.update({
      where: { id: articleId },
      data,
      include: {
        coverAlbumImage: { select: albumImageSelect },
        articleTags: {
          include: { tag: { select: { id: true, label: true, slug: true } } },
        },
      },
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.ARTICLE_UPDATED,
      entityType: AuditEntityType.ARTICLE,
      entityId: article.id,
      entityLabel: article.title,
      ...getAuditActorFromRequest(req),
      metadata: {
        changedFields,
        previousStatus: existing.status,
        nextStatus: article.status,
        tagIds,
      },
    })

    res.json(serializeAdminArticle(article))
  }
)

// DELETE /api/admin/articles/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const articleId = getSingleString(req.params.id)
  if (!articleId) {
    res.status(400).json({ error: 'ID articolo non valido' })
    return
  }

  const article = await prisma.article.findUnique({ where: { id: articleId } })
  if (!article) {
    res.status(404).json({ error: 'Articolo non trovato' })
    return
  }

  deleteDirectCoverImage(article.coverImage)

  await prisma.article.delete({ where: { id: articleId } })

  await logAuditEventSafe({
    req,
    action: AuditAction.ARTICLE_DELETED,
    entityType: AuditEntityType.ARTICLE,
    entityId: article.id,
    entityLabel: article.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      slug: article.slug,
      status: article.status,
    },
  })

  res.json({ message: 'Articolo eliminato' })
})

// PATCH /api/admin/articles/:id/status
router.patch('/:id/status', statusValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const articleId = getSingleString(req.params.id)
  const status = getSingleString(req.body.status)
  if (!articleId || !status) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const article = await prisma.article.update({
    where: { id: articleId },
    data: {
      status: status as Status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.ARTICLE_STATUS_CHANGED,
    entityType: AuditEntityType.ARTICLE,
    entityId: article.id,
    entityLabel: article.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      nextStatus: article.status,
    },
  })

  res.json(article)
})

export default router
