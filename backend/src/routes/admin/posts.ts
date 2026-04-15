import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType, ContentVisibility, Prisma, Status } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { uploadImage } from '../../middleware/upload'
import { postValidation, statusValidation, paginationQuery } from '../../utils/validators'
import { extractPlainText, sanitizeBody } from '../../utils/sanitize'
import { getBoolean, getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { MAX_TAGS_PER_CONTENT, createTagSlug, ensureTagsExist, mapPostTags, parseTagIds } from '../../services/tagService'
import { buildUploadMetadata, renameStoredUpload } from '../../services/uploadMetadataService'
import { deleteDirectCoverImage, resolveCoverImageSource } from '../../services/albumImageService'
import { queuePublishedContentOutboxEntry } from '../../services/notificationService'
import { buildAppUrl, derivePublicAppBaseUrl } from '../../utils/appUrls'
import { config } from '../../config'

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

async function queuePostPublicationOutbox(
  tx: Prisma.TransactionClient,
  publicBaseUrl: string,
  post: {
  id: string
  slug: string
  title: string
  status: Status
  publishedAt: Date | null
},
) {
  if (post.status !== 'PUBLISHED' || !post.publishedAt) {
    return
  }

  await queuePublishedContentOutboxEntry(tx, {
    contentId: post.id,
    type: 'post',
    title: post.title,
    publishedAt: post.publishedAt,
    contentUrl: buildAppUrl(publicBaseUrl, `/posts/${post.slug}`),
  })
}

function serializeAdminPost(post: {
  id: string
  title: string
  slug: string
  body: string
  excerpt: string | null
  author: string
  visibility: ContentVisibility
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
    body: post.body,
    excerpt: post.excerpt,
    author: post.author,
    visibility: post.visibility,
    status: post.status,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    ...cover,
    tags: mapPostTags(post.postTags),
  }
}

// GET /api/admin/posts
router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit

  const where: Prisma.PostWhereInput = {}
  if (req.query.status) where.status = req.query.status as any

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        coverAlbumImage: { select: albumImageSelect },
        postTags: {
          include: { tag: { select: { id: true, label: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  res.json({
    data: posts.map(serializeAdminPost),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/:id', async (req: Request, res: Response) => {
  const postId = getSingleString(req.params.id)
  if (!postId) {
    res.status(400).json({ error: 'ID post non valido' })
    return
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      coverAlbumImage: { select: albumImageSelect },
      postTags: {
        include: { tag: { select: { id: true, label: true, slug: true } } },
      },
    },
  })

  if (!post) {
    res.status(404).json({ error: 'Post non trovato' })
    return
  }

  res.json(serializeAdminPost(post))
})

// POST /api/admin/posts
router.post('/',
  uploadImage.single('coverImage'),
  postValidation,
  async (req: Request, res: Response) => {
    const publicBaseUrl = derivePublicAppBaseUrl({
      override: getSingleString(req.body.publicBaseUrl),
      requestOrigin: req.get('origin'),
      requestProtocol: req.protocol,
      requestHost: req.get('host'),
      fallback: config.appUrls.public,
    })

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
    const visibility = getSingleString(req.body.visibility)
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
    const existingSlug = await prisma.post.findUnique({ where: { slug } })
    if (existingSlug) {
      res.status(409).json({ error: 'Un post con un titolo simile esiste già' })
      return
    }

    const sanitizedBody = sanitizeBody(body!)

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          title: title!,
          slug,
          body: sanitizedBody,
          bodyText: extractPlainText(sanitizedBody),
          excerpt: excerpt || null,
          author: author!,
          visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'REGISTERED',
          coverImage: req.file ? `images/${req.file.filename}` : null,
          coverImageOriginalName: coverImageNames?.originalName ?? null,
          coverImageDisplayName: coverImageNames?.displayName ?? null,
          coverAlbumImageId: selectedAlbumImage?.id ?? null,
          status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          postTags: {
            create: tagIds.map(tagId => ({
              tag: { connect: { id: tagId } },
            })),
          },
        },
        include: {
          coverAlbumImage: { select: albumImageSelect },
          postTags: {
            include: { tag: { select: { id: true, label: true, slug: true } } },
          },
        },
      })

      await queuePostPublicationOutbox(tx, publicBaseUrl, created)

      return created
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.POST_CREATED,
      entityType: AuditEntityType.POST,
      entityId: post.id,
      entityLabel: post.title,
      ...getAuditActorFromRequest(req),
      metadata: {
        slug: post.slug,
        author: post.author,
        status: post.status,
        visibility: post.visibility,
        hasCoverImage: Boolean(post.coverImage || post.coverAlbumImageId),
        tagIds,
      },
    })

    res.status(201).json(serializeAdminPost(post))
  }
)

// PUT /api/admin/posts/:id
router.put('/:id',
  uploadImage.single('coverImage'),
  async (req: Request, res: Response) => {
    const publicBaseUrl = derivePublicAppBaseUrl({
      override: getSingleString(req.body.publicBaseUrl),
      requestOrigin: req.get('origin'),
      requestProtocol: req.protocol,
      requestHost: req.get('host'),
      fallback: config.appUrls.public,
    })

    const postId = getSingleString(req.params.id)
    if (!postId) {
      res.status(400).json({ error: 'ID post non valido' })
      return
    }

    const existing = await prisma.post.findUnique({ where: { id: postId } })
    if (!existing) {
      res.status(404).json({ error: 'Post non trovato' })
      return
    }

    const title = getSingleString(req.body.title)
    const body = getSingleString(req.body.body)
    const author = getSingleString(req.body.author)
    const excerpt = getSingleString(req.body.excerpt)
    const status = getSingleString(req.body.status)
    const visibility = getSingleString(req.body.visibility)
    const requestedCoverImageDisplayName = getSingleString(req.body.coverImageDisplayName)
    const removeCoverImage = getBoolean(req.body.removeCoverImage) === true
    const hasCoverAlbumImageId = Object.prototype.hasOwnProperty.call(req.body, 'coverAlbumImageId')
    const requestedCoverAlbumImageId = hasCoverAlbumImageId
      ? (getSingleString(req.body.coverAlbumImageId)?.trim() || null)
      : undefined
    const tagIds = parseTagIds(req.body.tagIds)
    const data: Prisma.PostUpdateInput = {}
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
      const conflictingSlug = await prisma.post.findFirst({
        where: {
          id: { not: postId },
          slug: nextSlug,
        },
        select: { id: true },
      })
      if (conflictingSlug) {
        res.status(409).json({ error: 'Un post con un titolo simile esiste gia' })
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

    if (visibility && ['PUBLIC', 'REGISTERED'].includes(visibility)) {
      data.visibility = visibility as ContentVisibility
      if (visibility !== existing.visibility) changedFields.push('visibility')
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

    data.postTags = {
      deleteMany: {},
      create: tagIds.map(tagId => ({
        tag: { connect: { id: tagId } },
      })),
    }
    changedFields.push('tags')

    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id: postId },
        data,
        include: {
          coverAlbumImage: { select: albumImageSelect },
          postTags: {
            include: { tag: { select: { id: true, label: true, slug: true } } },
          },
        },
      })

      if (existing.status !== 'PUBLISHED' && updated.status === 'PUBLISHED') {
        await queuePostPublicationOutbox(tx, publicBaseUrl, updated)
      }

      return updated
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.POST_UPDATED,
      entityType: AuditEntityType.POST,
      entityId: post.id,
      entityLabel: post.title,
      ...getAuditActorFromRequest(req),
      metadata: {
        changedFields,
        previousStatus: existing.status,
        nextStatus: post.status,
        previousVisibility: existing.visibility,
        nextVisibility: post.visibility,
        tagIds,
      },
    })

    res.json(serializeAdminPost(post))
  }
)

// DELETE /api/admin/posts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const postId = getSingleString(req.params.id)
  if (!postId) {
    res.status(400).json({ error: 'ID post non valido' })
    return
  }

  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post) {
    res.status(404).json({ error: 'Post non trovato' })
    return
  }

  deleteDirectCoverImage(post.coverImage)

  await prisma.post.delete({ where: { id: postId } })

  await logAuditEventSafe({
    req,
    action: AuditAction.POST_DELETED,
    entityType: AuditEntityType.POST,
    entityId: post.id,
    entityLabel: post.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      slug: post.slug,
      status: post.status,
    },
  })

  res.json({ message: 'Post eliminato' })
})

// PATCH /api/admin/posts/:id/status
router.patch('/:id/status', statusValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const postId = getSingleString(req.params.id)
  const status = getSingleString(req.body.status)
  if (!postId || !status) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const existing = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
    },
  })

  if (!existing) {
    res.status(404).json({ error: 'Post non trovato' })
    return
  }

  const post = await prisma.$transaction(async (tx) => {
    const publicBaseUrl = derivePublicAppBaseUrl({
      override: getSingleString(req.body.publicBaseUrl),
      requestOrigin: req.get('origin'),
      requestProtocol: req.protocol,
      requestHost: req.get('host'),
      fallback: config.appUrls.public,
    })

    const updated = await tx.post.update({
      where: { id: postId },
      data: {
        status: status as Status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    })

    if (existing.status !== 'PUBLISHED' && updated.status === 'PUBLISHED') {
      await queuePostPublicationOutbox(tx, publicBaseUrl, updated)
    }

    return updated
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.POST_STATUS_CHANGED,
    entityType: AuditEntityType.POST,
    entityId: post.id,
    entityLabel: post.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      nextStatus: post.status,
    },
  })

  res.json(post)
})

export default router
