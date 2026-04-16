import { EventBookingStatus, Prisma, Status } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { buildAppUrl } from '../utils/appUrls'
import { config } from '../config'
import { generateRandomToken, hashToken } from './cryptoService'

export const MAX_EVENT_BOOKING_PARTICIPANTS = 5

type EventBookingStateRecord = {
  id: string
  slug: string
  title: string
  startsAt: Date
  cancelledAt?: Date | null
  bookingEnabled: boolean
  bookingCapacity: number | null
  bookingReservedSeats: number
  bookingOpensAt: Date | null
  bookingClosesAt: Date | null
  status: Status
}

type EventBookingInvitationRecord = Prisma.EventBookingInvitationGetPayload<{
  include: {
    event: true
    booking: {
      include: {
        participants: true
      }
    }
  }
}>

export type PublicBookingAccessStatus =
  | 'VALID'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'BOOKING_CLOSED'
  | 'SOLD_OUT'
  | 'BOOKED'

export class EventBookingError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'EventBookingError'
    this.code = code
    this.status = status
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeNote(value: string) {
  return value.trim()
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000)
}

function buildRecipientName(input: {
  recipientName?: string | null
  recipientFirstName?: string | null
  recipientLastName?: string | null
}) {
  if (input.recipientName?.trim()) {
    return normalizeName(input.recipientName)
  }

  const composed = [input.recipientFirstName, input.recipientLastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')

  return composed ? normalizeName(composed) : null
}

function buildEventLocationLabel(event: { city: string; venue: string | null }) {
  return event.venue ? `${event.city} · ${event.venue}` : event.city
}

function getEffectiveBookingCloseAt(event: Pick<EventBookingStateRecord, 'bookingClosesAt' | 'startsAt'>) {
  return event.bookingClosesAt ?? event.startsAt
}

export function getEventBookingAvailability(event: EventBookingStateRecord, now = new Date()) {
  const capacity = event.bookingCapacity ?? 0
  const closesAt = getEffectiveBookingCloseAt(event)
  const opensAtPassed = !event.bookingOpensAt || event.bookingOpensAt <= now
  const closesAtFuture = closesAt > now
  const bookingOpen = !event.cancelledAt && event.bookingEnabled && opensAtPassed && closesAtFuture
  const seatsRemaining = Math.max(0, capacity - event.bookingReservedSeats)
  const bookingAvailable = (
    !event.cancelledAt
    && event.status === 'PUBLISHED'
    && event.bookingEnabled
    && capacity > 0
    && bookingOpen
    && seatsRemaining > 0
  )

  return {
    bookingEnabled: event.bookingEnabled,
    bookingOpen,
    bookingAvailable,
    seatsRemaining,
    closesAt,
  }
}

function serializeBookingParticipants(participants: Array<{
  id: string
  firstName: string
  lastName: string
  phone: string | null
  isBooker: boolean
}>) {
  return participants
    .map((participant) => ({
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
      isBooker: participant.isBooker,
    }))
    .sort((left, right) => Number(right.isBooker) - Number(left.isBooker))
}

function serializeBookingSummary(booking: {
  id: string
  status: EventBookingStatus
  bookerFirstName: string
  bookerLastName: string
  bookerPhone: string
  seatsReserved: number
  cancelledAt: Date | null
  cancelReason: string | null
  createdAt: Date
  updatedAt: Date
  participants: Array<{
    id: string
    firstName: string
    lastName: string
    phone: string | null
    isBooker: boolean
  }>
}) {
  return {
    id: booking.id,
    status: booking.status,
    bookerFirstName: booking.bookerFirstName,
    bookerLastName: booking.bookerLastName,
    bookerPhone: booking.bookerPhone,
    seatsReserved: booking.seatsReserved,
    cancelledAt: booking.cancelledAt,
    cancelReason: booking.cancelReason,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    participants: serializeBookingParticipants(booking.participants),
  }
}

function buildBookingParticipantsPayload(input: {
  bookerFirstName: string
  bookerLastName: string
  bookerPhone: string
  guests: Array<{ firstName: string; lastName: string }>
}) {
  return [
    {
      firstName: normalizeName(input.bookerFirstName),
      lastName: normalizeName(input.bookerLastName),
      phone: normalizePhone(input.bookerPhone),
      isBooker: true,
    },
    ...input.guests.map((guest) => ({
      firstName: normalizeName(guest.firstName),
      lastName: normalizeName(guest.lastName),
      phone: null,
      isBooker: false,
    })),
  ]
}

function assertGuestsLimit(guestCount: number) {
  const seatsReserved = 1 + guestCount
  if (seatsReserved < 1 || seatsReserved > MAX_EVENT_BOOKING_PARTICIPANTS) {
    throw new EventBookingError(
      'LIMIT_EXCEEDED',
      `Puoi prenotare al massimo per ${MAX_EVENT_BOOKING_PARTICIPANTS} persone in totale`,
      400,
    )
  }

  return seatsReserved
}

function resolveInvitationExpiry(event: Pick<EventBookingStateRecord, 'bookingClosesAt' | 'startsAt'>, now: Date) {
  const configured = addHours(now, config.eventBooking.invitationExpiresInHours)
  const closesAt = getEffectiveBookingCloseAt(event)
  return closesAt < configured ? closesAt : configured
}

function assertInvitationIsUsable(invitation: EventBookingInvitationRecord, now: Date) {
  if (invitation.revokedAt) {
    throw new EventBookingError('TOKEN_REVOKED', 'Il link di prenotazione non è più valido', 400)
  }

  if (invitation.expiresAt <= now) {
    throw new EventBookingError('TOKEN_EXPIRED', 'Il link di prenotazione è scaduto', 400)
  }
}

function assertBookingIsOpen(event: EventBookingStateRecord, now: Date) {
  const availability = getEventBookingAvailability(event, now)

  if (!event.bookingEnabled) {
    throw new EventBookingError('BOOKING_DISABLED', 'Le prenotazioni online non sono attive per questo evento', 400)
  }

  if (event.status !== 'PUBLISHED' || !availability.bookingOpen) {
    throw new EventBookingError('BOOKING_CLOSED', 'Le prenotazioni online per questo evento sono chiuse', 400)
  }

  return availability
}

export function buildEventBookingUrl(slug: string, token: string, baseUrl = config.appUrls.public) {
  return buildAppUrl(baseUrl, `/events/${slug}?bookingToken=${encodeURIComponent(token)}`)
}

export async function upsertInvitationForEventRecipient(input: {
  eventId: string
  userId?: string | null
  recipientEmail: string
  recipientName?: string | null
  recipientFirstName?: string | null
  recipientLastName?: string | null
  recipientPhone?: string | null
  note?: string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      city: true,
      venue: true,
      startsAt: true,
      bookingClosesAt: true,
      bookingEnabled: true,
      status: true,
    },
  })

  if (!event) {
    throw new EventBookingError('EVENT_NOT_FOUND', 'Evento non trovato', 404)
  }

  if (!event.bookingEnabled || event.status !== 'PUBLISHED') {
    throw new EventBookingError('BOOKING_DISABLED', 'Le prenotazioni online non sono attive per questo evento', 400)
  }

  const token = generateRandomToken()
  const tokenHash = hashToken(token)
  const recipientName = buildRecipientName(input)
  const recipientFirstName = input.recipientFirstName?.trim() ? normalizeName(input.recipientFirstName) : null
  const recipientLastName = input.recipientLastName?.trim() ? normalizeName(input.recipientLastName) : null
  const recipientPhone = input.recipientPhone?.trim() ? normalizePhone(input.recipientPhone) : null
  const note = input.note?.trim() ? normalizeNote(input.note) : null
  const expiresAt = resolveInvitationExpiry({
    bookingClosesAt: event.bookingClosesAt,
    startsAt: event.startsAt,
  } as Pick<EventBookingStateRecord, 'bookingClosesAt' | 'startsAt'>, now)

  const invitation = await prisma.eventBookingInvitation.upsert({
    where: {
      eventId_recipientEmail: {
        eventId: event.id,
        recipientEmail: normalizeEmail(input.recipientEmail),
      },
    },
    update: {
      userId: input.userId ?? null,
      recipientName,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      note,
      tokenHash,
      expiresAt,
      lastSentAt: now,
      revokedAt: null,
    },
    create: {
      eventId: event.id,
      userId: input.userId ?? null,
      recipientEmail: normalizeEmail(input.recipientEmail),
      recipientName,
      recipientFirstName,
      recipientLastName,
      recipientPhone,
      note,
      tokenHash,
      expiresAt,
      lastSentAt: now,
    },
  })

  return {
    invitation,
    token,
    url: buildEventBookingUrl(event.slug, token),
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      location: buildEventLocationLabel(event),
    },
  }
}

export async function getPublicBookingAccess(input: {
  slug: string
  token: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const invitation = await prisma.eventBookingInvitation.findUnique({
    where: {
      tokenHash: hashToken(input.token),
    },
    include: {
      event: true,
      booking: {
        include: {
          participants: true,
        },
      },
    },
  })

  if (!invitation || invitation.event.slug !== input.slug) {
    return {
      accessStatus: 'INVALID' as PublicBookingAccessStatus,
      canBook: false,
      bookingAvailable: false,
      existingBooking: null,
      maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
      requiresBookingDetails: true,
      invitation: null,
    }
  }

  const availability = getEventBookingAvailability(invitation.event, now)
  const existingBooking = invitation.booking ? serializeBookingSummary(invitation.booking) : null
  const requiresBookingDetails = !(
    invitation.recipientFirstName?.trim()
    && invitation.recipientLastName?.trim()
    && invitation.recipientPhone?.trim()
  )
  const invitationSummary = {
    id: invitation.id,
    recipientEmail: invitation.recipientEmail,
    recipientName: invitation.recipientName,
    recipientFirstName: invitation.recipientFirstName,
    recipientLastName: invitation.recipientLastName,
    recipientPhone: invitation.recipientPhone,
    note: invitation.note,
    createdAt: invitation.createdAt,
    lastSentAt: invitation.lastSentAt,
  }

  if (invitation.booking?.status === EventBookingStatus.CONFIRMED) {
    return {
      accessStatus: 'BOOKED' as PublicBookingAccessStatus,
      canBook: false,
      bookingAvailable: availability.bookingAvailable,
      existingBooking,
      maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
      requiresBookingDetails,
      invitation: invitationSummary,
      event: {
        id: invitation.event.id,
        slug: invitation.event.slug,
        title: invitation.event.title,
        startsAt: invitation.event.startsAt,
      },
    }
  }

  if (invitation.revokedAt) {
    return {
      accessStatus: 'REVOKED' as PublicBookingAccessStatus,
      canBook: false,
      bookingAvailable: false,
      existingBooking,
      maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
      requiresBookingDetails,
      invitation: invitationSummary,
      event: {
        id: invitation.event.id,
        slug: invitation.event.slug,
        title: invitation.event.title,
        startsAt: invitation.event.startsAt,
      },
    }
  }

  if (invitation.expiresAt <= now) {
    return {
      accessStatus: 'EXPIRED' as PublicBookingAccessStatus,
      canBook: false,
      bookingAvailable: false,
      existingBooking,
      maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
      requiresBookingDetails,
      invitation: invitationSummary,
      event: {
        id: invitation.event.id,
        slug: invitation.event.slug,
        title: invitation.event.title,
        startsAt: invitation.event.startsAt,
      },
    }
  }

  if (!invitation.event.bookingEnabled || invitation.event.status !== 'PUBLISHED' || !availability.bookingOpen) {
    return {
      accessStatus: 'BOOKING_CLOSED' as PublicBookingAccessStatus,
      canBook: false,
      bookingAvailable: false,
      existingBooking,
      maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
      requiresBookingDetails,
      invitation: invitationSummary,
      event: {
        id: invitation.event.id,
        slug: invitation.event.slug,
        title: invitation.event.title,
        startsAt: invitation.event.startsAt,
      },
    }
  }

  if (!availability.bookingAvailable) {
    return {
      accessStatus: 'SOLD_OUT' as PublicBookingAccessStatus,
      canBook: false,
      bookingAvailable: false,
      existingBooking,
      maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
      requiresBookingDetails,
      invitation: invitationSummary,
      event: {
        id: invitation.event.id,
        slug: invitation.event.slug,
        title: invitation.event.title,
        startsAt: invitation.event.startsAt,
      },
    }
  }

  return {
    accessStatus: 'VALID' as PublicBookingAccessStatus,
    canBook: true,
    bookingAvailable: true,
    existingBooking,
    maxParticipants: MAX_EVENT_BOOKING_PARTICIPANTS,
    requiresBookingDetails,
    invitation: invitationSummary,
    event: {
      id: invitation.event.id,
      slug: invitation.event.slug,
      title: invitation.event.title,
      startsAt: invitation.event.startsAt,
    },
  }
}

export async function createBooking(input: {
  slug: string
  token: string
  bookerFirstName?: string
  bookerLastName?: string
  bookerPhone?: string
  guests: Array<{ firstName: string; lastName: string }>
  now?: Date
}) {
  const now = input.now ?? new Date()
  const tokenHash = hashToken(input.token)
  const seatsReserved = assertGuestsLimit(input.guests.length)

  return prisma.$transaction(async (tx) => {
    const invitation = await tx.eventBookingInvitation.findUnique({
      where: { tokenHash },
      include: {
        event: true,
        booking: {
          include: {
            participants: true,
          },
        },
      },
    })

    if (!invitation || invitation.event.slug !== input.slug) {
      throw new EventBookingError('TOKEN_INVALID', 'Il link di prenotazione non è valido', 400)
    }

    assertInvitationIsUsable(invitation, now)
    const availability = assertBookingIsOpen(invitation.event, now)

    const bookerFirstName = input.bookerFirstName?.trim()
      ? normalizeName(input.bookerFirstName)
      : invitation.recipientFirstName?.trim()
        ? normalizeName(invitation.recipientFirstName)
        : null
    const bookerLastName = input.bookerLastName?.trim()
      ? normalizeName(input.bookerLastName)
      : invitation.recipientLastName?.trim()
        ? normalizeName(invitation.recipientLastName)
        : null
    const bookerPhone = input.bookerPhone?.trim()
      ? normalizePhone(input.bookerPhone)
      : invitation.recipientPhone?.trim()
        ? normalizePhone(invitation.recipientPhone)
        : null

    if (!bookerFirstName || !bookerLastName || !bookerPhone) {
      throw new EventBookingError(
        'BOOKING_DETAILS_REQUIRED',
        'Completa nome, cognome e numero di telefono per confermare la registrazione',
        400,
      )
    }

    const participants = buildBookingParticipantsPayload({
      bookerFirstName,
      bookerLastName,
      bookerPhone,
      guests: input.guests,
    })

    if (invitation.booking?.status === EventBookingStatus.CONFIRMED) {
      throw new EventBookingError('BOOKING_ALREADY_EXISTS', 'Per questo link risulta già una prenotazione confermata', 409)
    }

    const capacity = invitation.event.bookingCapacity ?? 0
    if (availability.seatsRemaining < seatsReserved) {
      throw new EventBookingError('SOLD_OUT', 'I posti disponibili non sono sufficienti per completare la prenotazione', 409)
    }

    const reservedEvent = await tx.event.updateMany({
      where: {
        id: invitation.event.id,
        bookingReservedSeats: {
          lte: capacity - seatsReserved,
        },
      },
      data: {
        bookingReservedSeats: {
          increment: seatsReserved,
        },
      },
    })

    if (reservedEvent.count === 0) {
      throw new EventBookingError('SOLD_OUT', 'I posti disponibili sono terminati durante la prenotazione', 409)
    }

    const bookingData = {
      status: EventBookingStatus.CONFIRMED,
      bookerFirstName,
      bookerLastName,
      bookerPhone,
      seatsReserved,
      cancelledAt: null,
      cancelReason: null,
    }

    const booking = invitation.booking
      ? await tx.eventBooking.update({
          where: {
            id: invitation.booking.id,
          },
          data: {
            ...bookingData,
            participants: {
              deleteMany: {},
              createMany: {
                data: participants,
              },
            },
          },
          include: {
            participants: true,
          },
        })
      : await tx.eventBooking.create({
          data: {
            eventId: invitation.event.id,
            invitationId: invitation.id,
            ...bookingData,
            participants: {
              createMany: {
                data: participants,
              },
            },
          },
          include: {
            participants: true,
          },
        })

    await tx.eventBookingInvitation.update({
      where: { id: invitation.id },
      data: {
        recipientName: buildRecipientName({
          recipientFirstName: bookerFirstName,
          recipientLastName: bookerLastName,
        }),
        recipientFirstName: bookerFirstName,
        recipientLastName: bookerLastName,
        recipientPhone: bookerPhone,
        usedAt: now,
      },
    })

    return {
      booking: serializeBookingSummary(booking),
      event: {
        id: invitation.event.id,
        slug: invitation.event.slug,
        title: invitation.event.title,
      },
    }
  })
}

export async function cancelBooking(input: {
  eventId: string
  bookingId: string
  reason?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.eventBooking.findFirst({
      where: {
        id: input.bookingId,
        eventId: input.eventId,
      },
      include: {
        participants: true,
      },
    })

    if (!booking) {
      throw new EventBookingError('BOOKING_NOT_FOUND', 'Prenotazione non trovata', 404)
    }

    if (booking.status === EventBookingStatus.CANCELLED) {
      return serializeBookingSummary(booking)
    }

    const updated = await tx.eventBooking.update({
      where: { id: booking.id },
      data: {
        status: EventBookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: input.reason?.trim() || 'Annullata da amministrazione',
      },
      include: {
        participants: true,
      },
    })

    await tx.event.update({
      where: { id: booking.eventId },
      data: {
        bookingReservedSeats: {
          decrement: booking.seatsReserved,
        },
      },
    })

    return serializeBookingSummary(updated)
  })
}

export async function restoreBooking(input: {
  eventId: string
  bookingId: string
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.eventBooking.findFirst({
      where: {
        id: input.bookingId,
        eventId: input.eventId,
      },
      include: {
        participants: true,
        event: true,
      },
    })

    if (!booking) {
      throw new EventBookingError('BOOKING_NOT_FOUND', 'Prenotazione non trovata', 404)
    }

    if (booking.status === EventBookingStatus.CONFIRMED) {
      return serializeBookingSummary(booking)
    }

    assertBookingIsOpen(booking.event, new Date())
    const capacity = booking.event.bookingCapacity ?? 0

    const reservedEvent = await tx.event.updateMany({
      where: {
        id: booking.eventId,
        bookingReservedSeats: {
          lte: capacity - booking.seatsReserved,
        },
      },
      data: {
        bookingReservedSeats: {
          increment: booking.seatsReserved,
        },
      },
    })

    if (reservedEvent.count === 0) {
      throw new EventBookingError('SOLD_OUT', 'La capienza residua non consente il ripristino della prenotazione', 409)
    }

    const restored = await tx.eventBooking.update({
      where: { id: booking.id },
      data: {
        status: EventBookingStatus.CONFIRMED,
        cancelledAt: null,
        cancelReason: null,
      },
      include: {
        participants: true,
      },
    })

    return serializeBookingSummary(restored)
  })
}

export async function recomputeReservedSeats(eventId: string) {
  const aggregation = await prisma.eventBooking.aggregate({
    where: {
      eventId,
      status: EventBookingStatus.CONFIRMED,
    },
    _sum: {
      seatsReserved: true,
    },
  })

  const reservedSeats = aggregation._sum.seatsReserved ?? 0
  await prisma.event.update({
    where: { id: eventId },
    data: {
      bookingReservedSeats: reservedSeats,
    },
  })

  return reservedSeats
}

export async function getEventBookingAdminSummary(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      cancelledAt: true,
      bookingEnabled: true,
      bookingCapacity: true,
      bookingReservedSeats: true,
      bookingOpensAt: true,
      bookingClosesAt: true,
      status: true,
      bookingInvitations: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          booking: {
            include: {
              participants: true,
            },
          },
        },
      },
    },
  })

  if (!event) {
    throw new EventBookingError('EVENT_NOT_FOUND', 'Evento non trovato', 404)
  }

  const availability = getEventBookingAvailability(event)

  return {
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      status: event.status,
      bookingEnabled: event.bookingEnabled,
      bookingCapacity: event.bookingCapacity,
      bookingReservedSeats: event.bookingReservedSeats,
      bookingRemainingSeats: availability.seatsRemaining,
      bookingOpensAt: event.bookingOpensAt,
      bookingClosesAt: event.bookingClosesAt,
      bookingAvailable: availability.bookingAvailable,
      bookingOpen: availability.bookingOpen,
    },
    registrations: event.bookingInvitations.map((invitation) => ({
      id: invitation.id,
      registrationStatus: invitation.booking
        ? invitation.booking.status === EventBookingStatus.CONFIRMED
          ? 'CONFIRMED'
          : 'CANCELLED'
        : 'PENDING',
      recipientEmail: invitation.recipientEmail,
      recipientName: invitation.recipientName,
      recipientFirstName: invitation.recipientFirstName,
      recipientLastName: invitation.recipientLastName,
      recipientPhone: invitation.recipientPhone,
      note: invitation.note,
      expiresAt: invitation.expiresAt,
      usedAt: invitation.usedAt,
      revokedAt: invitation.revokedAt,
      lastSentAt: invitation.lastSentAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      booking: invitation.booking ? serializeBookingSummary(invitation.booking) : null,
    })),
  }
}
