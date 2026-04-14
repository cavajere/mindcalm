import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType, ContentVisibility, Prisma, Status } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { uploadImage } from '../../middleware/upload'
import { eventValidation, statusValidation, paginationQuery } from '../../utils/validators'
import { extractPlainText, sanitizeBody } from '../../utils/sanitize'
import { getBoolean, getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { buildUploadMetadata, renameStoredUpload } from '../../services/uploadMetadataService'
import { deleteDirectCoverImage, resolveCoverImageSource } from '../../services/albumImageService'
import { queuePublishedContentOutboxEntry } from '../../services/notificationService'
import { buildAppUrl, derivePublicAppBaseUrl } from '../../utils/appUrls'
import { config } from '../../config'
import { createTagSlug } from '../../services/tagService'

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
  return prisma.albumImage.findUnique({ where: { id: albumImageId }, select: albumImageSelect })
}

async function queueEventPublicationOutbox(
  tx: Prisma.TransactionClient,
  publicBaseUrl: string,
  event: { id: string; slug: string; title: string; status: Status; publishedAt: Date | null },
) {
  if (event.status !== 'PUBLISHED' || !event.publishedAt) return

  await queuePublishedContentOutboxEntry(tx, {
    contentId: event.id,
    type: 'event',
    title: event.title,
    publishedAt: event.publishedAt,
    contentUrl: buildAppUrl(publicBaseUrl, `/events/${event.slug}`),
  })
}

function serializeEvent(event: {
  id: string
  title: string
  slug: string
  body: string
  excerpt: string | null
  organizer: string
  city: string
  venue: string | null
  startsAt: Date
  endsAt: Date | null
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
    body: event.body,
    excerpt: event.excerpt,
    organizer: event.organizer,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    visibility: event.visibility,
    status: event.status,
    publishedAt: event.publishedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    ...cover,
  }
}

router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit

  const where: Prisma.EventWhereInput = {}
  if (req.query.status) where.status = req.query.status as any

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { coverAlbumImage: { select: albumImageSelect } },
      orderBy: { startsAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ])

  res.json({ data: events.map(serializeEvent), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
})

router.get('/:id', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { coverAlbumImage: { select: albumImageSelect } } })
  if (!event) {
    res.status(404).json({ error: 'Evento non trovato' })
    return
  }

  res.json(serializeEvent(event))
})

router.post('/', uploadImage.single('coverImage'), eventValidation, async (req: Request, res: Response) => {
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
  const organizer = getSingleString(req.body.organizer)
  const city = getSingleString(req.body.city)
  const venue = getSingleString(req.body.venue)
  const startsAt = getSingleString(req.body.startsAt)
  const endsAt = getSingleString(req.body.endsAt)
  const status = getSingleString(req.body.status)
  const visibility = getSingleString(req.body.visibility)
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

  const selectedAlbumImage = requestedCoverAlbumImageId ? await getAlbumImageOrNull(requestedCoverAlbumImageId) : null
  if (requestedCoverAlbumImageId && !selectedAlbumImage) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(404).json({ error: 'Immagine album non trovata' })
    return
  }

  const existingSlug = await prisma.event.findUnique({ where: { slug } })
  if (existingSlug) {
    res.status(409).json({ error: 'Un evento con un titolo simile esiste già' })
    return
  }

  if (endsAt && new Date(endsAt) < new Date(startsAt!)) {
    res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' })
    return
  }

  const sanitizedBody = sanitizeBody(body!)

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: title!,
        slug,
        body: sanitizedBody,
        bodyText: extractPlainText(sanitizedBody),
        excerpt: excerpt || null,
        organizer: organizer!,
        city: city!,
        venue: venue || null,
        startsAt: new Date(startsAt!),
        endsAt: endsAt ? new Date(endsAt) : null,
        visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'REGISTERED',
        coverImage: req.file ? `images/${req.file.filename}` : null,
        coverImageOriginalName: coverImageNames?.originalName ?? null,
        coverImageDisplayName: coverImageNames?.displayName ?? null,
        coverAlbumImageId: selectedAlbumImage?.id ?? null,
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      include: { coverAlbumImage: { select: albumImageSelect } },
    })

    await queueEventPublicationOutbox(tx, publicBaseUrl, created)
    return created
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.EVENT_CREATED,
    entityType: AuditEntityType.EVENT,
    entityId: event.id,
    entityLabel: event.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      slug: event.slug,
      status: event.status,
      visibility: event.visibility,
      startsAt: event.startsAt.toISOString(),
      city: event.city,
    },
  })

  res.status(201).json(serializeEvent(event))
})

router.put('/:id', uploadImage.single('coverImage'), eventValidation, async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

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

  const existing = await prisma.event.findUnique({ where: { id: eventId }, include: { coverAlbumImage: { select: albumImageSelect } } })
  if (!existing) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(404).json({ error: 'Evento non trovato' })
    return
  }

  const title = getSingleString(req.body.title)
  const body = getSingleString(req.body.body)
  const excerpt = getSingleString(req.body.excerpt)
  const organizer = getSingleString(req.body.organizer)
  const city = getSingleString(req.body.city)
  const venue = getSingleString(req.body.venue)
  const startsAt = getSingleString(req.body.startsAt)
  const endsAt = getSingleString(req.body.endsAt)
  const status = getSingleString(req.body.status)
  const visibility = getSingleString(req.body.visibility)
  const requestedCoverImageDisplayName = getSingleString(req.body.coverImageDisplayName)
  const removeCoverImage = getBoolean(req.body.removeCoverImage) === true
  const hasCoverAlbumImageId = Object.prototype.hasOwnProperty.call(req.body, 'coverAlbumImageId')
  const requestedCoverAlbumImageId = hasCoverAlbumImageId
    ? (getSingleString(req.body.coverAlbumImageId)?.trim() || null)
    : undefined
  const slug = createTagSlug(title!)

  if (endsAt && new Date(endsAt) < new Date(startsAt!)) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' })
    return
  }

  if (slug !== existing.slug) {
    const slugExists = await prisma.event.findUnique({ where: { slug } })
    if (slugExists && slugExists.id !== existing.id) {
      deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
      res.status(409).json({ error: 'Un evento con un titolo simile esiste già' })
      return
    }
  }

  const selectedAlbumImage = requestedCoverAlbumImageId ? await getAlbumImageOrNull(requestedCoverAlbumImageId) : null
  if (requestedCoverAlbumImageId && !selectedAlbumImage) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(404).json({ error: 'Immagine album non trovata' })
    return
  }

  const coverImageNames = req.file
    ? buildUploadMetadata(req.file, requestedCoverImageDisplayName)
    : null

  const sanitizedBody = sanitizeBody(body!)

  const updated = await prisma.$transaction(async (tx) => {
    const event = await tx.event.update({
      where: { id: existing.id },
      data: {
        title: title!,
        slug,
        body: sanitizedBody,
        bodyText: extractPlainText(sanitizedBody),
        excerpt: excerpt || null,
        organizer: organizer!,
        city: city!,
        venue: venue || null,
        startsAt: new Date(startsAt!),
        endsAt: endsAt ? new Date(endsAt) : null,
        visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'REGISTERED',
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        publishedAt: status === 'PUBLISHED' ? (existing.publishedAt ?? new Date()) : null,
        coverImage: req.file
          ? `images/${req.file.filename}`
          : selectedAlbumImage
            ? null
            : removeCoverImage
              ? null
              : existing.coverImage,
        coverImageOriginalName: req.file
          ? coverImageNames?.originalName ?? null
          : selectedAlbumImage || removeCoverImage
            ? null
            : requestedCoverImageDisplayName !== undefined && existing.coverImage && !existing.coverAlbumImageId
              ? renameStoredUpload(
                  existing.coverImageOriginalName ?? '',
                  existing.coverImageDisplayName,
                  requestedCoverImageDisplayName,
                ).originalName
              : existing.coverImageOriginalName,
        coverImageDisplayName: req.file
          ? coverImageNames?.displayName ?? null
          : selectedAlbumImage || removeCoverImage
            ? null
            : requestedCoverImageDisplayName !== undefined && existing.coverImage && !existing.coverAlbumImageId
              ? renameStoredUpload(
                  existing.coverImageOriginalName ?? '',
                  existing.coverImageDisplayName,
                  requestedCoverImageDisplayName,
                ).displayName
              : existing.coverImageDisplayName,
        coverAlbumImageId: selectedAlbumImage
          ? selectedAlbumImage.id
          : req.file
            ? null
          : removeCoverImage
            ? null
            : existing.coverAlbumImageId,
      },
      include: { coverAlbumImage: { select: albumImageSelect } },
    })

    await queueEventPublicationOutbox(tx, publicBaseUrl, event)
    return event
  })

  if ((req.file || selectedAlbumImage || removeCoverImage) && existing.coverImage) {
    deleteDirectCoverImage(existing.coverImage)
  }

  await logAuditEventSafe({
    req,
    action: AuditAction.EVENT_UPDATED,
    entityType: AuditEntityType.EVENT,
    entityId: updated.id,
    entityLabel: updated.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      slug: updated.slug,
      status: updated.status,
      visibility: updated.visibility,
      startsAt: updated.startsAt.toISOString(),
      city: updated.city,
    },
  })

  res.json(serializeEvent(updated))
})

router.patch('/:id/status', statusValidation, async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

  const status = getSingleString(req.body.status)
  if (!status || !['DRAFT', 'PUBLISHED'].includes(status)) {
    res.status(400).json({ error: 'Stato non valido' })
    return
  }

  const event = await prisma.event.update({
    where: { id: eventId },
    data: { status: status as Status, publishedAt: status === 'PUBLISHED' ? new Date() : null },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.EVENT_STATUS_CHANGED,
    entityType: AuditEntityType.EVENT,
    entityId: event.id,
    entityLabel: event.title,
    ...getAuditActorFromRequest(req),
    metadata: { status: event.status },
  })

  res.json(event)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) {
    res.status(404).json({ error: 'Evento non trovato' })
    return
  }

  await prisma.event.delete({ where: { id: eventId } })

  if (event.coverImage) {
    deleteDirectCoverImage(event.coverImage)
  }

  await logAuditEventSafe({
    req,
    action: AuditAction.EVENT_DELETED,
    entityType: AuditEntityType.EVENT,
    entityId: event.id,
    entityLabel: event.title,
    ...getAuditActorFromRequest(req),
  })

  res.status(204).send()
})

export default router
