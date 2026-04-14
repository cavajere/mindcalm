import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ContentPublicationType,
  NotificationDispatchStatus,
  NotificationFrequency,
  PublicationOutboxStatus,
} from '@prisma/client'
import {
  enqueueDueNotifications,
  enqueueImmediateContentNotifications,
  processPublicationOutbox,
  retryFailedNotificationDispatchJob,
} from '../src/services/notificationService'

const {
  prismaNotificationScheduleSettingsFindUnique,
  prismaNotificationScheduleSettingsCreate,
  prismaUserFindMany,
  prismaNotificationDispatchJobCreate,
  prismaNotificationDispatchJobCreateMany,
  prismaNotificationDispatchJobFindFirst,
  prismaNotificationDispatchJobFindUnique,
  prismaNotificationDispatchJobUpdate,
  prismaAudioFindMany,
  prismaArticleFindMany,
  prismaContentPublicationOutboxUpdateMany,
  prismaContentPublicationOutboxFindFirst,
  prismaContentPublicationOutboxFindUnique,
  prismaContentPublicationOutboxUpdate,
  prismaContentPublicationOutboxDeleteMany,
} = vi.hoisted(() => ({
  prismaNotificationScheduleSettingsFindUnique: vi.fn(),
  prismaNotificationScheduleSettingsCreate: vi.fn(),
  prismaUserFindMany: vi.fn(),
  prismaNotificationDispatchJobCreate: vi.fn(),
  prismaNotificationDispatchJobCreateMany: vi.fn(),
  prismaNotificationDispatchJobFindFirst: vi.fn(),
  prismaNotificationDispatchJobFindUnique: vi.fn(),
  prismaNotificationDispatchJobUpdate: vi.fn(),
  prismaAudioFindMany: vi.fn(),
  prismaArticleFindMany: vi.fn(),
  prismaContentPublicationOutboxUpdateMany: vi.fn(),
  prismaContentPublicationOutboxFindFirst: vi.fn(),
  prismaContentPublicationOutboxFindUnique: vi.fn(),
  prismaContentPublicationOutboxUpdate: vi.fn(),
  prismaContentPublicationOutboxDeleteMany: vi.fn(),
}))

const txMock = {
  contentPublicationOutbox: {
    findFirst: prismaContentPublicationOutboxFindFirst,
    updateMany: prismaContentPublicationOutboxUpdateMany,
    findUnique: prismaContentPublicationOutboxFindUnique,
  },
}

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(txMock)
      }

      return Promise.all(input as Promise<unknown>[])
    }),
    notificationScheduleSettings: {
      findUnique: prismaNotificationScheduleSettingsFindUnique,
      create: prismaNotificationScheduleSettingsCreate,
    },
    user: {
      findMany: prismaUserFindMany,
    },
    notificationDispatchJob: {
      create: prismaNotificationDispatchJobCreate,
      createMany: prismaNotificationDispatchJobCreateMany,
      findFirst: prismaNotificationDispatchJobFindFirst,
      findUnique: prismaNotificationDispatchJobFindUnique,
      update: prismaNotificationDispatchJobUpdate,
    },
    audio: {
      findMany: prismaAudioFindMany,
    },
    thought: {
      findMany: prismaArticleFindMany,
    },
    contentPublicationOutbox: {
      updateMany: prismaContentPublicationOutboxUpdateMany,
      findFirst: prismaContentPublicationOutboxFindFirst,
      findUnique: prismaContentPublicationOutboxFindUnique,
      update: prismaContentPublicationOutboxUpdate,
      deleteMany: prismaContentPublicationOutboxDeleteMany,
    },
  },
}))

vi.mock('../src/services/smtpService', () => ({
  sendMail: vi.fn(),
}))

function buildSchedule() {
  return {
    id: 1,
    immediateHourUtc: 9,
    weeklyHourUtc: 9,
    weeklyDayOfWeek: 1,
    monthlyHourUtc: 9,
    monthlyDayOfMonth: 1,
    batchSize: 20,
    maxAttempts: 5,
    retryBaseDelayMinutes: 5,
    lockTimeoutMinutes: 15,
    retentionDays: 30,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  }
}

describe('notificationService', () => {
  beforeEach(() => {
    prismaNotificationScheduleSettingsFindUnique.mockReset()
    prismaNotificationScheduleSettingsCreate.mockReset()
    prismaUserFindMany.mockReset()
    prismaNotificationDispatchJobCreate.mockReset()
    prismaNotificationDispatchJobCreateMany.mockReset()
    prismaNotificationDispatchJobFindFirst.mockReset()
    prismaNotificationDispatchJobFindUnique.mockReset()
    prismaNotificationDispatchJobUpdate.mockReset()
    prismaAudioFindMany.mockReset()
    prismaArticleFindMany.mockReset()
    prismaContentPublicationOutboxUpdateMany.mockReset()
    prismaContentPublicationOutboxFindFirst.mockReset()
    prismaContentPublicationOutboxFindUnique.mockReset()
    prismaContentPublicationOutboxUpdate.mockReset()
    prismaContentPublicationOutboxDeleteMany.mockReset()

    prismaNotificationScheduleSettingsFindUnique.mockResolvedValue(buildSchedule())
  })

  it('accoda un job immediate per ogni utente compatibile alla pubblicazione del contenuto', async () => {
    prismaUserFindMany.mockResolvedValue([
      { id: 'user-1', email: 'mario@example.com', name: 'Mario' },
      { id: 'user-2', email: 'anna@example.com', name: 'Anna' },
    ])
    prismaNotificationDispatchJobCreateMany.mockResolvedValue({ count: 2 })

    const publishedAt = new Date('2026-04-13T10:00:00.000Z')
    const count = await enqueueImmediateContentNotifications({
      contentId: 'audio-123',
      type: 'audio',
      title: 'Respira meglio',
      publishedAt,
    })

    expect(count).toBe(2)
    expect(prismaUserFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        notificationPreference: {
          is: {
            frequency: NotificationFrequency.IMMEDIATE,
            notifyOnAudio: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    expect(prismaNotificationDispatchJobCreateMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user-1',
          dedupeKey: 'user-1:IMMEDIATE:audio:audio-123:2026-04-13T10:00:00.000Z',
          frequency: NotificationFrequency.IMMEDIATE,
          status: NotificationDispatchStatus.PENDING,
          recipientEmail: 'mario@example.com',
          recipientName: 'Mario',
          subject: 'MindCalm: nuovi contenuti pubblicati',
          title: 'Nuovi contenuti disponibili',
          intro: 'Abbiamo pubblicato nuovi contenuti che corrispondono alle tue preferenze.',
          items: [{ type: 'audio', title: 'Respira meglio', publishedAt: '2026-04-13T10:00:00.000Z', url: 'http://localhost:5473/audio/audio-123' }],
          itemCount: 1,
          windowStartedAt: publishedAt,
          windowEndedAt: publishedAt,
          scheduledFor: publishedAt,
          availableAt: publishedAt,
          maxAttempts: 5,
        },
        {
          userId: 'user-2',
          dedupeKey: 'user-2:IMMEDIATE:audio:audio-123:2026-04-13T10:00:00.000Z',
          frequency: NotificationFrequency.IMMEDIATE,
          status: NotificationDispatchStatus.PENDING,
          recipientEmail: 'anna@example.com',
          recipientName: 'Anna',
          subject: 'MindCalm: nuovi contenuti pubblicati',
          title: 'Nuovi contenuti disponibili',
          intro: 'Abbiamo pubblicato nuovi contenuti che corrispondono alle tue preferenze.',
          items: [{ type: 'audio', title: 'Respira meglio', publishedAt: '2026-04-13T10:00:00.000Z', url: 'http://localhost:5473/audio/audio-123' }],
          itemCount: 1,
          windowStartedAt: publishedAt,
          windowEndedAt: publishedAt,
          scheduledFor: publishedAt,
          availableAt: publishedAt,
          maxAttempts: 5,
        },
      ],
      skipDuplicates: true,
    })
  })

  it('processa l outbox di pubblicazione e lo marca come processato', async () => {
    prismaContentPublicationOutboxUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    prismaContentPublicationOutboxFindFirst
      .mockResolvedValueOnce({ id: 'outbox-1' })
      .mockResolvedValueOnce(null)
    prismaContentPublicationOutboxFindUnique.mockResolvedValue({
      id: 'outbox-1',
      dedupeKey: 'AUDIO:audio-123:2026-04-13T10:00:00.000Z',
      contentType: ContentPublicationType.AUDIO,
      contentId: 'audio-123',
      title: 'Respira meglio',
      publishedAt: new Date('2026-04-13T10:00:00.000Z'),
      status: PublicationOutboxStatus.PROCESSING,
      availableAt: new Date('2026-04-13T10:00:00.000Z'),
      lockedAt: new Date('2026-04-13T10:01:00.000Z'),
      processedAt: null,
      lastError: null,
      attemptCount: 0,
      createdAt: new Date('2026-04-13T10:00:00.000Z'),
      updatedAt: new Date('2026-04-13T10:00:00.000Z'),
    })
    prismaUserFindMany.mockResolvedValue([
      { id: 'user-1', email: 'mario@example.com', name: 'Mario' },
    ])
    prismaNotificationDispatchJobCreateMany.mockResolvedValue({ count: 1 })
    prismaContentPublicationOutboxUpdate.mockResolvedValue({})
    prismaContentPublicationOutboxDeleteMany.mockResolvedValue({ count: 0 })

    await processPublicationOutbox(new Date('2026-04-13T10:05:00.000Z'))

    expect(prismaNotificationDispatchJobCreateMany).toHaveBeenCalledTimes(1)
    expect(prismaContentPublicationOutboxUpdate).toHaveBeenCalledWith({
      where: {
        id: 'outbox-1',
      },
      data: {
        status: PublicationOutboxStatus.PROCESSED,
        lockedAt: null,
        processedAt: expect.any(Date),
        lastError: null,
        attemptCount: {
          increment: 1,
        },
      },
    })
  })

  it('non crea nuovi digest finche esiste un job non risolto oltre l ultimo inviato', async () => {
    prismaUserFindMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'mario@example.com',
        name: 'Mario',
        notificationPreference: {
          userId: 'user-1',
          notifyOnAudio: true,
          notifyOnThoughts: true,
          frequency: NotificationFrequency.WEEKLY,
          lastImmediateContentAt: null,
          lastWeeklyDigestSentAt: null,
          lastMonthlyDigestSentAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      },
    ])
    prismaNotificationDispatchJobFindFirst
      .mockResolvedValueOnce({
        windowEndedAt: new Date('2026-04-06T09:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'failed-digest',
      })

    await enqueueDueNotifications(new Date('2026-04-13T09:00:00.000Z'))

    expect(prismaAudioFindMany).not.toHaveBeenCalled()
    expect(prismaArticleFindMany).not.toHaveBeenCalled()
    expect(prismaNotificationDispatchJobCreate).not.toHaveBeenCalled()
  })

  it('rimette in coda un job failed resettando il budget di retry', async () => {
    prismaNotificationDispatchJobFindUnique.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'mario@example.com', name: 'Mario' },
      frequency: NotificationFrequency.IMMEDIATE,
      status: NotificationDispatchStatus.FAILED,
      recipientEmail: 'mario@example.com',
      recipientName: 'Mario',
      subject: 'MindCalm: nuovi contenuti pubblicati',
      title: 'Nuovi contenuti disponibili',
      intro: 'Abbiamo pubblicato nuovi contenuti che corrispondono alle tue preferenze.',
      items: [],
      itemCount: 0,
      windowStartedAt: new Date('2026-04-13T10:00:00.000Z'),
      windowEndedAt: new Date('2026-04-13T10:00:00.000Z'),
      scheduledFor: new Date('2026-04-13T10:00:00.000Z'),
      availableAt: new Date('2026-04-13T10:05:00.000Z'),
      lockedAt: null,
      startedAt: new Date('2026-04-13T10:05:00.000Z'),
      sentAt: null,
      failedAt: new Date('2026-04-13T10:06:00.000Z'),
      lastError: 'SMTP timeout',
      attemptCount: 5,
      maxAttempts: 5,
      createdAt: new Date('2026-04-13T10:00:00.000Z'),
      updatedAt: new Date('2026-04-13T10:06:00.000Z'),
    })
    prismaNotificationDispatchJobUpdate.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'mario@example.com', name: 'Mario' },
      frequency: NotificationFrequency.IMMEDIATE,
      status: NotificationDispatchStatus.PENDING,
      recipientEmail: 'mario@example.com',
      recipientName: 'Mario',
      subject: 'MindCalm: nuovi contenuti pubblicati',
      title: 'Nuovi contenuti disponibili',
      intro: 'Abbiamo pubblicato nuovi contenuti che corrispondono alle tue preferenze.',
      items: [],
      itemCount: 0,
      windowStartedAt: new Date('2026-04-13T10:00:00.000Z'),
      windowEndedAt: new Date('2026-04-13T10:00:00.000Z'),
      scheduledFor: new Date('2026-04-13T10:00:00.000Z'),
      availableAt: new Date('2026-04-13T10:07:00.000Z'),
      lockedAt: null,
      startedAt: null,
      sentAt: null,
      failedAt: null,
      lastError: null,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: new Date('2026-04-13T10:00:00.000Z'),
      updatedAt: new Date('2026-04-13T10:07:00.000Z'),
    })

    const job = await retryFailedNotificationDispatchJob('job-1')

    expect(prismaNotificationDispatchJobUpdate).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
      },
      data: {
        status: NotificationDispatchStatus.PENDING,
        availableAt: expect.any(Date),
        lockedAt: null,
        startedAt: null,
        failedAt: null,
        lastError: null,
        attemptCount: 0,
      },
      select: expect.any(Object),
    })
    expect(job?.status).toBe(NotificationDispatchStatus.PENDING)
    expect(job?.attemptCount).toBe(0)
  })
})
