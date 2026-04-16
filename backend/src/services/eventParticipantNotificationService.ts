import { EventBookingStatus, Status } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendMail } from './smtpService'
import { buildEventParticipantsNotificationEmail } from './email/templates'

export class EventParticipantNotificationError extends Error {
  failedRecipients: string[]

  constructor(message: string, failedRecipients: string[]) {
    super(message)
    this.name = 'EventParticipantNotificationError'
    this.failedRecipients = failedRecipients
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function buildRecipientName(input: {
  invitationRecipientName?: string | null
  invitationFirstName?: string | null
  invitationLastName?: string | null
  bookerFirstName?: string | null
  bookerLastName?: string | null
}) {
  if (input.invitationRecipientName?.trim()) {
    return input.invitationRecipientName.trim()
  }

  const invitationName = [input.invitationFirstName, input.invitationLastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim()
  if (invitationName) {
    return invitationName
  }

  const bookerName = [input.bookerFirstName, input.bookerLastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim()

  return bookerName || null
}

function buildEventLocation(event: { city: string; venue: string | null }) {
  return event.venue ? `${event.city} · ${event.venue}` : event.city
}

export async function notifyConfirmedEventParticipants(input: {
  eventId: string
  type: 'UPDATED' | 'CANCELLED'
  message?: string | null
  eventUrl?: string | null
}) {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      venue: true,
      status: true,
      bookings: {
        where: {
          status: EventBookingStatus.CONFIRMED,
        },
        select: {
          bookerFirstName: true,
          bookerLastName: true,
          invitation: {
            select: {
              recipientEmail: true,
              recipientName: true,
              recipientFirstName: true,
              recipientLastName: true,
            },
          },
        },
      },
    },
  })

  if (!event) {
    throw new Error('Evento non trovato per l’invio notifiche')
  }

  const dedupedRecipients = new Map<string, { email: string; name: string | null }>()
  for (const booking of event.bookings) {
    const email = booking.invitation.recipientEmail?.trim()
    if (!email) continue

    dedupedRecipients.set(normalizeEmail(email), {
      email,
      name: buildRecipientName({
        invitationRecipientName: booking.invitation.recipientName,
        invitationFirstName: booking.invitation.recipientFirstName,
        invitationLastName: booking.invitation.recipientLastName,
        bookerFirstName: booking.bookerFirstName,
        bookerLastName: booking.bookerLastName,
      }),
    })
  }

  if (dedupedRecipients.size === 0) {
    return {
      recipientsCount: 0,
      notifiedCount: 0,
    }
  }

  const eventUrl = event.status === Status.PUBLISHED ? (input.eventUrl?.trim() || null) : null
  const results = await Promise.allSettled(
    Array.from(dedupedRecipients.values()).map(async (recipient) => {
      const template = buildEventParticipantsNotificationEmail({
        recipientName: recipient.name,
        eventTitle: event.title,
        eventStartsAt: event.startsAt,
        eventLocation: buildEventLocation(event),
        eventUrl,
        message: input.message,
        type: input.type,
      })

      await sendMail({
        to: recipient.email,
        ...template,
      })

      return recipient.email
    }),
  )

  const failedRecipients = results
    .flatMap((result, index) => (
      result.status === 'rejected'
        ? [Array.from(dedupedRecipients.values())[index]?.email].filter((value): value is string => Boolean(value))
        : []
    ))

  if (failedRecipients.length > 0) {
    throw new EventParticipantNotificationError(
      `Impossibile notificare ${failedRecipients.length} partecipanti registrati`,
      failedRecipients,
    )
  }

  return {
    recipientsCount: dedupedRecipients.size,
    notifiedCount: dedupedRecipients.size,
  }
}
