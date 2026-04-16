import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { Prisma } from '@prisma/client'
import { validationResult } from 'express-validator'
import { getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { optionalAppAuthMiddleware } from '../../middleware/auth'
import {
  paginationQuery,
  publicEventBookingAccessValidation,
  publicEventBookingCreateValidation,
} from '../../utils/validators'
import { resolveCoverImageSource } from '../../services/albumImageService'
import { getVisibleContentVisibilities } from '../../utils/contentVisibility'
import {
  createBooking,
  EventBookingError,
  getEventBookingAvailability,
  getPublicBookingAccess,
} from '../../services/eventBookingService'
import {
  eventBookingAccessRateLimiter,
  eventBookingCreateRateLimiter,
} from '../../middleware/rateLimiter'

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
  bookingEnabled: boolean
  bookingCapacity: number | null
  bookingReservedSeats: number
  bookingOpensAt: Date | null
  bookingClosesAt: Date | null
  participationMode: 'FREE' | 'PAID'
  participationPriceCents: number | null
  status: 'DRAFT' | 'PUBLISHED'
}) {
  const cover = resolveCoverImageSource({
    coverImage: event.coverImage,
    coverImageOriginalName: event.coverImageOriginalName,
    coverImageDisplayName: event.coverImageDisplayName,
    coverAlbumImage: event.coverAlbumImage,
  })

  const availability = getEventBookingAvailability({
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    bookingEnabled: event.bookingEnabled,
    bookingCapacity: event.bookingCapacity,
    bookingReservedSeats: event.bookingReservedSeats,
    bookingOpensAt: event.bookingOpensAt,
    bookingClosesAt: event.bookingClosesAt,
    status: event.status,
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
    bookingEnabled: event.bookingEnabled,
    bookingAvailable: availability.bookingAvailable,
    participationMode: event.participationMode,
    participationPriceCents: event.participationPriceCents,
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
  const search = getSingleString(req.query.search)?.trim()
  const visibleVisibilities = getVisibleContentVisibilities(req)

  const where: Prisma.EventWhereInput = {
    status: 'PUBLISHED',
    visibility: { in: visibleVisibilities },
  }
  const andFilters: Prisma.EventWhereInput[] = []

  if (city) {
    andFilters.push({
      city: { equals: city, mode: 'insensitive' },
    })
  }
  if (search) {
    andFilters.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { bodyText: { contains: search, mode: 'insensitive' } },
        { organizer: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  if (andFilters.length) {
    where.AND = andFilters
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
        bookingEnabled: true,
        bookingCapacity: true,
        bookingReservedSeats: true,
        bookingOpensAt: true,
        bookingClosesAt: true,
        participationMode: true,
        participationPriceCents: true,
        status: true,
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

router.get('/:slug/booking-access', eventBookingAccessRateLimiter, publicEventBookingAccessValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const slug = getSingleString(req.params.slug)
  const token = getSingleString(req.query.token)
  if (!slug || !token) {
    res.status(400).json({ error: 'Slug evento o token non validi' })
    return
  }

  const result = await getPublicBookingAccess({ slug, token })
  res.json(result)
})

router.post('/:slug/bookings', eventBookingCreateRateLimiter, publicEventBookingCreateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Payload non valido', details: errors.array() })
    return
  }

  const slug = getSingleString(req.params.slug)
  if (!slug) {
    res.status(400).json({ error: 'Slug evento non valido' })
    return
  }

  const guests = Array.isArray(req.body.participants)
    ? req.body.participants.map((participant: any) => ({
        firstName: String(participant.firstName || ''),
        lastName: String(participant.lastName || ''),
      }))
    : []

  try {
    const booking = await createBooking({
      slug,
      token: String(req.body.token),
      bookerFirstName: String(req.body.bookerFirstName),
      bookerLastName: String(req.body.bookerLastName),
      bookerPhone: String(req.body.bookerPhone),
      guests,
    })

    res.status(201).json(booking)
  } catch (error) {
    if (error instanceof EventBookingError) {
      res.status(error.status).json({ error: error.message, code: error.code })
      return
    }

    throw error
  }
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
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      excerpt: true,
      organizer: true,
      city: true,
      venue: true,
      startsAt: true,
      endsAt: true,
      coverImage: true,
      coverImageOriginalName: true,
      coverImageDisplayName: true,
      publishedAt: true,
      bookingEnabled: true,
      bookingCapacity: true,
      bookingReservedSeats: true,
      bookingOpensAt: true,
      bookingClosesAt: true,
      participationMode: true,
      participationPriceCents: true,
      status: true,
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

  const availability = getEventBookingAvailability({
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    bookingEnabled: event.bookingEnabled,
    bookingCapacity: event.bookingCapacity,
    bookingReservedSeats: event.bookingReservedSeats,
    bookingOpensAt: event.bookingOpensAt,
    bookingClosesAt: event.bookingClosesAt,
    status: event.status,
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
    bookingEnabled: event.bookingEnabled,
    bookingAvailable: availability.bookingAvailable,
    participationMode: event.participationMode,
    participationPriceCents: event.participationPriceCents,
  })
})

export default router
