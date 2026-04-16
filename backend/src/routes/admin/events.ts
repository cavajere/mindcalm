import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType, ContentVisibility, EventParticipationMode, Prisma, Status } from '@prisma/client'
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
import {
  cancelBooking,
  EventBookingError,
  getEventBookingAdminSummary,
  getEventBookingAvailability,
  recomputeReservedSeats,
  restoreBooking,
} from '../../services/eventBookingService'
import {
  EventParticipantNotificationError,
  notifyConfirmedEventParticipants,
} from '../../services/eventParticipantNotificationService'

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
  bookingEnabled: boolean
  bookingCapacity: number | null
  bookingReservedSeats: number
  bookingOpensAt: Date | null
  bookingClosesAt: Date | null
  participationMode: 'FREE' | 'PAID'
  participationPriceCents: number | null
  cancelledAt: Date | null
  cancellationMessage: string | null
  coverImage: string | null
  coverImageOriginalName: string | null
  coverImageDisplayName: string | null
  coverAlbumImageId?: string | null
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
  const availability = getEventBookingAvailability({
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    cancelledAt: event.cancelledAt,
    bookingEnabled: event.bookingEnabled,
    bookingCapacity: event.bookingCapacity,
    bookingReservedSeats: event.bookingReservedSeats,
    bookingOpensAt: event.bookingOpensAt,
    bookingClosesAt: event.bookingClosesAt,
    status: event.status,
  })

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
    cancelledAt: event.cancelledAt,
    cancellationMessage: event.cancellationMessage,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    bookingEnabled: event.bookingEnabled,
    bookingCapacity: event.bookingCapacity,
    bookingReservedSeats: event.bookingReservedSeats,
    bookingRemainingSeats: availability.seatsRemaining,
    bookingOpensAt: event.bookingOpensAt,
    bookingClosesAt: event.bookingClosesAt,
    bookingAvailable: availability.bookingAvailable,
    bookingOpen: availability.bookingOpen,
    participationMode: event.participationMode,
    participationPriceCents: event.participationPriceCents,
    ...cover,
  }
}

function buildParticipantNotificationSignature(event: {
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
  bookingEnabled: boolean
  bookingCapacity: number | null
  bookingReservedSeats: number
  bookingOpensAt: Date | null
  bookingClosesAt: Date | null
  participationMode: 'FREE' | 'PAID'
  participationPriceCents: number | null
  cancelledAt: Date | null
  cancellationMessage: string | null
  coverImage: string | null
  coverImageOriginalName: string | null
  coverImageDisplayName: string | null
  coverAlbumImageId?: string | null
}) {
  return JSON.stringify({
    title: event.title,
    slug: event.slug,
    body: event.body,
    excerpt: event.excerpt ?? null,
    organizer: event.organizer,
    city: event.city,
    venue: event.venue ?? null,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    visibility: event.visibility,
    status: event.status,
    bookingEnabled: event.bookingEnabled,
    bookingCapacity: event.bookingCapacity ?? null,
    bookingReservedSeats: event.bookingReservedSeats,
    bookingOpensAt: event.bookingOpensAt?.toISOString() ?? null,
    bookingClosesAt: event.bookingClosesAt?.toISOString() ?? null,
    participationMode: event.participationMode,
    participationPriceCents: event.participationPriceCents ?? null,
    cancelledAt: event.cancelledAt?.toISOString() ?? null,
    cancellationMessage: event.cancellationMessage ?? null,
    coverImage: event.coverImage ?? null,
    coverImageOriginalName: event.coverImageOriginalName ?? null,
    coverImageDisplayName: event.coverImageDisplayName ?? null,
    coverAlbumImageId: event.coverAlbumImageId ?? null,
  })
}

function parseBookingSettings(body: Request['body']) {
  const bookingEnabled = getBoolean(body.bookingEnabled) === true
  const bookingCapacityRaw = getSingleString(body.bookingCapacity)
  const bookingOpensAtRaw = getSingleString(body.bookingOpensAt)
  const bookingClosesAtRaw = getSingleString(body.bookingClosesAt)
  const bookingCapacity = bookingCapacityRaw ? Number.parseInt(bookingCapacityRaw, 10) : null
  const bookingOpensAt = bookingOpensAtRaw ? new Date(bookingOpensAtRaw) : null
  const bookingClosesAt = bookingClosesAtRaw ? new Date(bookingClosesAtRaw) : null

  return {
    bookingEnabled,
    bookingCapacity,
    bookingOpensAt,
    bookingClosesAt,
  }
}

function parseParticipationSettings(body: Request['body']) {
  const participationMode = getSingleString(body.participationMode) === 'PAID'
    ? EventParticipationMode.PAID
    : EventParticipationMode.FREE
  const rawPrice = getSingleString(body.participationPrice)?.trim() || ''

  if (participationMode === 'FREE') {
    return {
      participationMode,
      participationPriceCents: null,
    }
  }

  const normalized = rawPrice.replace(',', '.')
  const parsed = Number.parseFloat(normalized)

  return {
    participationMode,
    participationPriceCents: Number.isFinite(parsed) ? Math.round(parsed * 100) : null,
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
  const startsAt = getSingleString(req.body.startsAt)
  const endsAt = getSingleString(req.body.endsAt)
  const status = getSingleString(req.body.status)
  const visibility = getSingleString(req.body.visibility)
  const bookingSettings = parseBookingSettings(req.body)
  const participationSettings = parseParticipationSettings(req.body)
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

  if (bookingSettings.bookingEnabled && (!bookingSettings.bookingCapacity || bookingSettings.bookingCapacity < 1)) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'Imposta una capienza valida per attivare le prenotazioni online' })
    return
  }

  if (bookingSettings.bookingOpensAt && bookingSettings.bookingClosesAt && bookingSettings.bookingClosesAt <= bookingSettings.bookingOpensAt) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'La chiusura prenotazioni deve essere successiva all’apertura' })
    return
  }

  if (participationSettings.participationMode === 'PAID' && participationSettings.participationPriceCents === null) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'Imposta un costo valido per gli eventi a pagamento' })
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
        organizer: organizer?.trim() || 'MindCalm',
        city: city!,
        venue: null,
        startsAt: new Date(startsAt!),
        endsAt: endsAt ? new Date(endsAt) : null,
        bookingEnabled: bookingSettings.bookingEnabled,
        bookingCapacity: bookingSettings.bookingEnabled ? bookingSettings.bookingCapacity : null,
        bookingReservedSeats: 0,
        bookingOpensAt: bookingSettings.bookingEnabled ? bookingSettings.bookingOpensAt : null,
        bookingClosesAt: bookingSettings.bookingEnabled ? bookingSettings.bookingClosesAt : null,
        participationMode: participationSettings.participationMode,
        participationPriceCents: participationSettings.participationPriceCents,
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
      bookingEnabled: event.bookingEnabled,
      bookingCapacity: event.bookingCapacity,
      participationMode: event.participationMode,
      participationPriceCents: event.participationPriceCents,
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
  const startsAt = getSingleString(req.body.startsAt)
  const endsAt = getSingleString(req.body.endsAt)
  const status = getSingleString(req.body.status)
  const visibility = getSingleString(req.body.visibility)
  const bookingSettings = parseBookingSettings(req.body)
  const participationSettings = parseParticipationSettings(req.body)
  const requestedCoverImageDisplayName = getSingleString(req.body.coverImageDisplayName)
  const removeCoverImage = getBoolean(req.body.removeCoverImage) === true
  const hasCoverAlbumImageId = Object.prototype.hasOwnProperty.call(req.body, 'coverAlbumImageId')
  const requestedCoverAlbumImageId = hasCoverAlbumImageId
    ? (getSingleString(req.body.coverAlbumImageId)?.trim() || null)
    : undefined
  const participantNotificationMessage = getSingleString(req.body.participantNotificationMessage)?.trim() || null
  const slug = createTagSlug(title!)

  if (endsAt && new Date(endsAt) < new Date(startsAt!)) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'La data di fine deve essere successiva alla data di inizio' })
    return
  }

  if (bookingSettings.bookingEnabled && (!bookingSettings.bookingCapacity || bookingSettings.bookingCapacity < existing.bookingReservedSeats)) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'La capienza non può essere inferiore ai posti già prenotati' })
    return
  }

  if (bookingSettings.bookingOpensAt && bookingSettings.bookingClosesAt && bookingSettings.bookingClosesAt <= bookingSettings.bookingOpensAt) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'La chiusura prenotazioni deve essere successiva all’apertura' })
    return
  }

  if (participationSettings.participationMode === 'PAID' && participationSettings.participationPriceCents === null) {
    deleteDirectCoverImage(req.file ? `images/${req.file.filename}` : null)
    res.status(400).json({ error: 'Imposta un costo valido per gli eventi a pagamento' })
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
  const existingParticipantSignature = buildParticipantNotificationSignature(existing)

  const updated = await prisma.$transaction(async (tx) => {
    const event = await tx.event.update({
      where: { id: existing.id },
      data: {
        title: title!,
        slug,
        body: sanitizedBody,
        bodyText: extractPlainText(sanitizedBody),
        excerpt: excerpt || null,
        organizer: organizer?.trim() || 'MindCalm',
        city: city!,
        venue: null,
        startsAt: new Date(startsAt!),
        endsAt: endsAt ? new Date(endsAt) : null,
        bookingEnabled: bookingSettings.bookingEnabled,
        bookingCapacity: bookingSettings.bookingEnabled ? bookingSettings.bookingCapacity : null,
        bookingOpensAt: bookingSettings.bookingEnabled ? bookingSettings.bookingOpensAt : null,
        bookingClosesAt: bookingSettings.bookingEnabled ? bookingSettings.bookingClosesAt : null,
        participationMode: participationSettings.participationMode,
        participationPriceCents: participationSettings.participationPriceCents,
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
  const updatedParticipantSignature = buildParticipantNotificationSignature(updated)

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
      bookingEnabled: updated.bookingEnabled,
      bookingCapacity: updated.bookingCapacity,
      participationMode: updated.participationMode,
      participationPriceCents: updated.participationPriceCents,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    },
  })

  if (existingParticipantSignature !== updatedParticipantSignature) {
    try {
      await notifyConfirmedEventParticipants({
        eventId: updated.id,
        type: 'UPDATED',
        message: participantNotificationMessage,
        eventUrl: buildAppUrl(publicBaseUrl, `/events/${updated.slug}`),
      })
    } catch (error) {
      if (error instanceof EventParticipantNotificationError) {
        res.status(502).json({
          error: `${error.message}. L'evento è stato comunque aggiornato.`,
          failedRecipients: error.failedRecipients,
        })
        return
      }

      throw error
    }
  }

  res.json(serializeEvent(updated))
})

router.patch('/:id/status', statusValidation, async (req: Request, res: Response) => {
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

  const status = getSingleString(req.body.status)
  if (!status || !['DRAFT', 'PUBLISHED'].includes(status)) {
    res.status(400).json({ error: 'Stato non valido' })
    return
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } })
  if (!existing) {
    res.status(404).json({ error: 'Evento non trovato' })
    return
  }

  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: eventId },
      data: { status: status as Status, publishedAt: status === 'PUBLISHED' ? new Date() : null },
    })

    await queueEventPublicationOutbox(tx, publicBaseUrl, updated)
    return updated
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

  if (existing.status !== event.status) {
    try {
      await notifyConfirmedEventParticipants({
        eventId: event.id,
        type: 'UPDATED',
        message: event.status === 'PUBLISHED'
          ? 'L’evento è stato ripubblicato nel calendario.'
          : 'L’evento non è più disponibile nel calendario pubblico.',
        eventUrl: buildAppUrl(publicBaseUrl, `/events/${event.slug}`),
      })
    } catch (error) {
      if (error instanceof EventParticipantNotificationError) {
        res.status(502).json({
          error: `${error.message}. Lo stato dell'evento è stato comunque aggiornato.`,
          failedRecipients: error.failedRecipients,
        })
        return
      }

      throw error
    }
  }

  res.json(event)
})

router.post('/:id/cancel', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

  const cancellationMessage = getSingleString(req.body.cancellationMessage)?.trim()
  if (!cancellationMessage) {
    res.status(400).json({ error: 'Inserisci un messaggio di annullamento da inviare ai partecipanti' })
    return
  }

  const publicBaseUrl = derivePublicAppBaseUrl({
    override: getSingleString(req.body.publicBaseUrl),
    requestOrigin: req.get('origin'),
    requestProtocol: req.protocol,
    requestHost: req.get('host'),
    fallback: config.appUrls.public,
  })

  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    include: { coverAlbumImage: { select: albumImageSelect } },
  })
  if (!existing) {
    res.status(404).json({ error: 'Evento non trovato' })
    return
  }

  if (existing.cancelledAt) {
    res.status(409).json({ error: 'L’evento risulta già annullato' })
    return
  }

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      cancelledAt: new Date(),
      cancellationMessage,
    },
    include: { coverAlbumImage: { select: albumImageSelect } },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.EVENT_CANCELLED,
    entityType: AuditEntityType.EVENT,
    entityId: event.id,
    entityLabel: event.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      cancelledAt: event.cancelledAt?.toISOString() ?? null,
      cancellationMessage,
    },
  })

  try {
    await notifyConfirmedEventParticipants({
      eventId: event.id,
      type: 'CANCELLED',
      message: cancellationMessage,
      eventUrl: buildAppUrl(publicBaseUrl, `/events/${event.slug}`),
    })
  } catch (error) {
    if (error instanceof EventParticipantNotificationError) {
      res.status(502).json({
        error: `${error.message}. L'evento è stato comunque annullato.`,
        failedRecipients: error.failedRecipients,
      })
      return
    }

    throw error
  }

  res.json(serializeEvent(event))
})

router.get('/:id/bookings', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

  try {
    const summary = await getEventBookingAdminSummary(eventId)
    res.json(summary)
  } catch (error) {
    if (error instanceof EventBookingError) {
      res.status(error.status).json({ error: error.message, code: error.code })
      return
    }

    throw error
  }
})

router.post('/:id/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  const bookingId = getSingleString(req.params.bookingId)
  if (!eventId || !bookingId) {
    res.status(400).json({ error: 'ID evento o prenotazione non valido' })
    return
  }

  try {
    const booking = await cancelBooking({
      eventId,
      bookingId,
      reason: getSingleString(req.body.reason),
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.EVENT_BOOKING_CANCELLED,
      entityType: AuditEntityType.EVENT,
      entityId: eventId,
      entityLabel: bookingId,
      ...getAuditActorFromRequest(req),
      metadata: {
        bookingId,
        reason: booking.cancelReason,
      },
    })

    res.json(booking)
  } catch (error) {
    if (error instanceof EventBookingError) {
      res.status(error.status).json({ error: error.message, code: error.code })
      return
    }

    throw error
  }
})

router.post('/:id/bookings/:bookingId/restore', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  const bookingId = getSingleString(req.params.bookingId)
  if (!eventId || !bookingId) {
    res.status(400).json({ error: 'ID evento o prenotazione non valido' })
    return
  }

  try {
    const booking = await restoreBooking({ eventId, bookingId })

    await logAuditEventSafe({
      req,
      action: AuditAction.EVENT_BOOKING_RESTORED,
      entityType: AuditEntityType.EVENT,
      entityId: eventId,
      entityLabel: bookingId,
      ...getAuditActorFromRequest(req),
      metadata: {
        bookingId,
      },
    })

    res.json(booking)
  } catch (error) {
    if (error instanceof EventBookingError) {
      res.status(error.status).json({ error: error.message, code: error.code })
      return
    }

    throw error
  }
})

router.post('/:id/bookings/reconcile', async (req: Request, res: Response) => {
  const eventId = getSingleString(req.params.id)
  if (!eventId) {
    res.status(400).json({ error: 'ID evento non valido' })
    return
  }

  const reservedSeats = await recomputeReservedSeats(eventId)

  await logAuditEventSafe({
    req,
    action: AuditAction.EVENT_BOOKING_RECONCILED,
    entityType: AuditEntityType.EVENT,
    entityId: eventId,
    ...getAuditActorFromRequest(req),
    metadata: {
      reservedSeats,
    },
  })

  res.json({ reservedSeats })
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
