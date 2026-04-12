import { Router, Request, Response } from 'express'
import { AuditAction, AuditEntityType, Prisma, Status } from '@prisma/client'
import { validationResult } from 'express-validator'
import path from 'path'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { uploadImage } from '../../middleware/upload'
import { articleValidation, statusValidation, paginationQuery } from '../../utils/validators'
import { extractPlainText, sanitizeBody } from '../../utils/sanitize'
import { deleteFile } from '../../services/fileService'
import { getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { MAX_TAGS_PER_CONTENT, createTagSlug, ensureTagsExist, mapArticleTags, parseTagIds } from '../../services/tagService'

const router = Router()

router.use(adminAuthMiddleware, requireAdmin)

// GET /api/v1/admin/articles
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
    data: articles.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      body: a.body,
      excerpt: a.excerpt,
      author: a.author,
      status: a.status,
      publishedAt: a.publishedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      coverImage: a.coverImage ? `/api/v1/files/images/${path.basename(a.coverImage)}` : null,
      tags: mapArticleTags(a.articleTags),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// POST /api/v1/admin/articles
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
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        articleTags: {
          create: tagIds.map(tagId => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
      include: {
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
        hasCoverImage: Boolean(article.coverImage),
        tagIds,
      },
    })

    res.status(201).json(article)
  }
)

// PUT /api/v1/admin/articles/:id
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
    const tagIds = parseTagIds(req.body.tagIds)
    const data: Prisma.ArticleUpdateInput = {}
    const changedFields: string[] = []

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
      if (existing.coverImage) deleteFile(existing.coverImage)
      data.coverImage = `images/${req.file.filename}`
      changedFields.push('coverImage')
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

    res.json(article)
  }
)

// DELETE /api/v1/admin/articles/:id
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

  if (article.coverImage) deleteFile(article.coverImage)

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

// PATCH /api/v1/admin/articles/:id/status
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
