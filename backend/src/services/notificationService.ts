import {
  NotificationDispatchStatus,
  NotificationFrequency,
  Prisma,
} from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendMail } from './smtpService'
import {
  buildContentNotificationEmail,
  type ContentNotificationItem,
} from './email/templates'

const SCHEDULE_ROW_ID = 1
const NOTIFICATION_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000
const NOTIFICATION_WORKER_INTERVAL_MS = 30 * 1000
const NOTIFICATION_MAX_BATCH_SIZE = 100
const NOTIFICATION_MAX_BACKOFF_MINUTES = 12 * 60

let notificationPipelineStarted = false

export interface UserNotificationPreferencesInput {
  notifyOnAudio: boolean
  notifyOnArticles: boolean
  frequency: NotificationFrequency
}

export interface NotificationScheduleInput {
  immediateHourUtc: number
  weeklyHourUtc: number
  weeklyDayOfWeek: number
  monthlyHourUtc: number
  monthlyDayOfMonth: number
  batchSize: number
  maxAttempts: number
  retryBaseDelayMinutes: number
  lockTimeoutMinutes: number
  retentionDays: number
}

const notificationDispatchJobSelect = {
  id: true,
  userId: true,
  frequency: true,
  status: true,
  recipientEmail: true,
  recipientName: true,
  subject: true,
  title: true,
  intro: true,
  items: true,
  itemCount: true,
  windowStartedAt: true,
  windowEndedAt: true,
  scheduledFor: true,
  availableAt: true,
  lockedAt: true,
  startedAt: true,
  sentAt: true,
  failedAt: true,
  lastError: true,
  attemptCount: true,
  maxAttempts: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} satisfies Prisma.NotificationDispatchJobSelect

type NotificationDispatchJobRecord = Prisma.NotificationDispatchJobGetPayload<{
  select: typeof notificationDispatchJobSelect
}>

type NotificationScheduleSettingsRecord = Awaited<
  ReturnType<typeof getNotificationScheduleSettings>
>

function asUtcDateRange(from: Date, to: Date): Prisma.DateTimeFilter {
  return { gt: from, lte: to }
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function getInitialWindowStart(frequency: NotificationFrequency, now: Date) {
  if (frequency === NotificationFrequency.WEEKLY) {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  }

  if (frequency === NotificationFrequency.MONTHLY) {
    return new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
  }

  return new Date(now.getTime() - 24 * 60 * 60 * 1000)
}

function getImmediateSlotDate(now: Date, hourUtc: number) {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hourUtc,
    0,
    0,
    0,
  ))
}

function getDueSlotForFrequency(
  frequency: NotificationFrequency,
  schedule: NotificationScheduleSettingsRecord,
  now: Date,
) {
  if (frequency === NotificationFrequency.IMMEDIATE) {
    if (now.getUTCHours() !== schedule.immediateHourUtc) return null
    return getImmediateSlotDate(now, schedule.immediateHourUtc)
  }

  if (frequency === NotificationFrequency.WEEKLY) {
    if (now.getUTCHours() !== schedule.weeklyHourUtc || now.getUTCDay() !== schedule.weeklyDayOfWeek) {
      return null
    }

    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      schedule.weeklyHourUtc,
      0,
      0,
      0,
    ))
  }

  if (frequency === NotificationFrequency.MONTHLY) {
    if (now.getUTCHours() !== schedule.monthlyHourUtc || now.getUTCDate() !== schedule.monthlyDayOfMonth) {
      return null
    }

    return new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      schedule.monthlyHourUtc,
      0,
      0,
      0,
    ))
  }

  return null
}

function getNotificationCopy(frequency: NotificationFrequency) {
  if (frequency === NotificationFrequency.WEEKLY) {
    return {
      subject: 'MindCalm: riepilogo settimanale contenuti',
      title: 'Riepilogo settimanale',
      intro: "Ecco i contenuti pubblicati nell'ultima settimana.",
    }
  }

  if (frequency === NotificationFrequency.MONTHLY) {
    return {
      subject: 'MindCalm: riepilogo mensile contenuti',
      title: 'Riepilogo mensile',
      intro: "Ecco i contenuti pubblicati nell'ultimo mese.",
    }
  }

  return {
    subject: 'MindCalm: nuovi contenuti pubblicati',
    title: 'Nuovi contenuti disponibili',
    intro: 'Abbiamo pubblicato nuovi contenuti che corrispondono alle tue preferenze.',
  }
}

function toAudioItem(item: { title: string; publishedAt: Date | null }): ContentNotificationItem {
  return {
    type: 'audio',
    title: item.title,
    publishedAt: item.publishedAt,
  }
}

function toArticleItem(item: { title: string; publishedAt: Date | null }): ContentNotificationItem {
  return {
    type: 'article',
    title: item.title,
    publishedAt: item.publishedAt,
  }
}

function parseContentItems(items: Prisma.JsonValue): ContentNotificationItem[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return []
    }

    const candidate = item as Record<string, unknown>
    const type = candidate.type === 'audio' || candidate.type === 'article' ? candidate.type : null
    const title = typeof candidate.title === 'string' ? candidate.title : null
    const publishedAt = typeof candidate.publishedAt === 'string'
      ? new Date(candidate.publishedAt)
      : null

    if (!type || !title || (publishedAt && Number.isNaN(publishedAt.getTime()))) {
      return []
    }

    return [{
      type,
      title,
      publishedAt,
    }]
  })
}

function serializeNotificationDispatchJob(job: NotificationDispatchJobRecord) {
  const items = parseContentItems(job.items)

  return {
    id: job.id,
    userId: job.userId,
    user: job.user,
    frequency: job.frequency,
    status: job.status,
    recipientEmail: job.recipientEmail,
    recipientName: job.recipientName,
    subject: job.subject,
    title: job.title,
    intro: job.intro,
    itemCount: job.itemCount,
    items,
    windowStartedAt: job.windowStartedAt,
    windowEndedAt: job.windowEndedAt,
    scheduledFor: job.scheduledFor,
    availableAt: job.availableAt,
    lockedAt: job.lockedAt,
    startedAt: job.startedAt,
    sentAt: job.sentAt,
    failedAt: job.failedAt,
    lastError: job.lastError,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

function getNextRetryDelayMinutes(
  nextAttemptCount: number,
  baseDelayMinutes: number,
) {
  const multiplier = Math.max(0, nextAttemptCount - 1)
  return Math.min(baseDelayMinutes * (2 ** multiplier), NOTIFICATION_MAX_BACKOFF_MINUTES)
}

function getPreferenceTimestampField(frequency: NotificationFrequency) {
  if (frequency === NotificationFrequency.WEEKLY) {
    return 'lastWeeklyDigestSentAt'
  }

  if (frequency === NotificationFrequency.MONTHLY) {
    return 'lastMonthlyDigestSentAt'
  }

  return 'lastImmediateContentAt'
}

async function sendContentEmail(input: {
  user: { email: string; name: string }
  subject: string
  title: string
  intro: string
  items: ContentNotificationItem[]
}) {
  const template = buildContentNotificationEmail({
    name: input.user.name,
    subject: input.subject,
    title: input.title,
    intro: input.intro,
    items: input.items,
  })

  await sendMail({
    to: input.user.email,
    ...template,
  })
}

async function getNotificationCursor(input: {
  userId: string
  frequency: NotificationFrequency
  fallback: Date | null | undefined
  now: Date
}) {
  const latestQueued = await prisma.notificationDispatchJob.findFirst({
    where: {
      userId: input.userId,
      frequency: input.frequency,
    },
    orderBy: {
      windowEndedAt: 'desc',
    },
    select: {
      windowEndedAt: true,
    },
  })

  if (latestQueued?.windowEndedAt) {
    return latestQueued.windowEndedAt
  }

  return input.fallback ?? getInitialWindowStart(input.frequency, input.now)
}

async function enqueueNotificationJob(input: {
  user: { id: string; email: string; name: string }
  frequency: NotificationFrequency
  schedule: NotificationScheduleSettingsRecord
  windowStartedAt: Date
  windowEndedAt: Date
  scheduledFor: Date
  items: ContentNotificationItem[]
}) {
  const copy = getNotificationCopy(input.frequency)
  const dedupeKey = `${input.user.id}:${input.frequency}:${input.scheduledFor.toISOString()}`

  try {
    await prisma.notificationDispatchJob.create({
      data: {
        userId: input.user.id,
        dedupeKey,
        frequency: input.frequency,
        status: NotificationDispatchStatus.PENDING,
        recipientEmail: input.user.email,
        recipientName: input.user.name,
        subject: copy.subject,
        title: copy.title,
        intro: copy.intro,
        items: input.items as unknown as Prisma.InputJsonValue,
        itemCount: input.items.length,
        windowStartedAt: input.windowStartedAt,
        windowEndedAt: input.windowEndedAt,
        scheduledFor: input.scheduledFor,
        availableAt: input.windowEndedAt,
        maxAttempts: input.schedule.maxAttempts,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return
    }

    throw error
  }
}

async function releaseStaleNotificationJobs(
  schedule: NotificationScheduleSettingsRecord,
  now: Date,
) {
  const staleBefore = new Date(now.getTime() - schedule.lockTimeoutMinutes * 60 * 1000)

  await prisma.notificationDispatchJob.updateMany({
    where: {
      status: NotificationDispatchStatus.PROCESSING,
      lockedAt: {
        lt: staleBefore,
      },
    },
    data: {
      status: NotificationDispatchStatus.PENDING,
      availableAt: now,
      lockedAt: null,
      lastError: `Lock scaduto e job rimesso in coda alle ${now.toISOString()}`,
    },
  })
}

async function claimNextNotificationJob(now: Date) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.notificationDispatchJob.findFirst({
      where: {
        status: NotificationDispatchStatus.PENDING,
        availableAt: {
          lte: now,
        },
      },
      orderBy: [
        { availableAt: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        startedAt: true,
      },
    })

    if (!candidate) {
      return null
    }

    const claimed = await tx.notificationDispatchJob.updateMany({
      where: {
        id: candidate.id,
        status: NotificationDispatchStatus.PENDING,
      },
      data: {
        status: NotificationDispatchStatus.PROCESSING,
        lockedAt: now,
        ...(candidate.startedAt ? {} : { startedAt: now }),
      },
    })

    if (claimed.count === 0) {
      return null
    }

    return tx.notificationDispatchJob.findUnique({
      where: {
        id: candidate.id,
      },
      select: notificationDispatchJobSelect,
    })
  })
}

async function claimNotificationJobs(
  schedule: NotificationScheduleSettingsRecord,
  now: Date,
) {
  const jobs: NotificationDispatchJobRecord[] = []
  const limit = Math.min(schedule.batchSize, NOTIFICATION_MAX_BATCH_SIZE)

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextNotificationJob(now)

    if (!job) {
      break
    }

    jobs.push(job)
  }

  return jobs
}

async function finalizeSuccessfulNotificationJob(
  job: NotificationDispatchJobRecord,
  now: Date,
) {
  const timestampField = getPreferenceTimestampField(job.frequency)

  await prisma.$transaction([
    prisma.notificationDispatchJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: NotificationDispatchStatus.SENT,
        lockedAt: null,
        sentAt: now,
        failedAt: null,
        lastError: null,
        attemptCount: {
          increment: 1,
        },
      },
    }),
    prisma.userNotificationPreference.updateMany({
      where: {
        userId: job.userId,
      },
      data: {
        [timestampField]: job.windowEndedAt,
      },
    }),
  ])
}

async function finalizeFailedNotificationJob(
  job: NotificationDispatchJobRecord,
  schedule: NotificationScheduleSettingsRecord,
  now: Date,
  errorMessage: string,
) {
  const nextAttemptCount = job.attemptCount + 1
  const terminalFailure = nextAttemptCount >= job.maxAttempts

  await prisma.notificationDispatchJob.update({
    where: {
      id: job.id,
    },
    data: terminalFailure
      ? {
          status: NotificationDispatchStatus.FAILED,
          attemptCount: nextAttemptCount,
          failedAt: now,
          lockedAt: null,
          lastError: errorMessage,
        }
      : {
          status: NotificationDispatchStatus.PENDING,
          attemptCount: nextAttemptCount,
          failedAt: null,
          lockedAt: null,
          availableAt: addMinutes(
            now,
            getNextRetryDelayMinutes(nextAttemptCount, schedule.retryBaseDelayMinutes),
          ),
          lastError: errorMessage,
        },
  })
}

async function pruneNotificationDispatchJobs(
  schedule: NotificationScheduleSettingsRecord,
  now: Date,
) {
  const cutoff = new Date(now.getTime() - schedule.retentionDays * 24 * 60 * 60 * 1000)

  await prisma.notificationDispatchJob.deleteMany({
    where: {
      status: {
        in: [
          NotificationDispatchStatus.SENT,
          NotificationDispatchStatus.FAILED,
        ],
      },
      updatedAt: {
        lt: cutoff,
      },
    },
  })
}

async function runNotificationSchedulingCycle() {
  try {
    await enqueueDueNotifications()
  } catch (error) {
    console.error('[MindCalm] Notification scheduling error:', error)
  }
}

async function runNotificationWorkerCycle() {
  try {
    await processNotificationQueue()
  } catch (error) {
    console.error('[MindCalm] Notification worker error:', error)
  }
}

export async function getUserNotificationPreferences(userId: string) {
  const preference = await prisma.userNotificationPreference.findUnique({ where: { userId } })

  if (preference) {
    return preference
  }

  return prisma.userNotificationPreference.create({
    data: {
      userId,
      frequency: NotificationFrequency.NONE,
      notifyOnAudio: true,
      notifyOnArticles: true,
    },
  })
}

export async function updateUserNotificationPreferences(userId: string, input: UserNotificationPreferencesInput) {
  return prisma.userNotificationPreference.upsert({
    where: { userId },
    update: {
      notifyOnAudio: input.notifyOnAudio,
      notifyOnArticles: input.notifyOnArticles,
      frequency: input.frequency,
    },
    create: {
      userId,
      notifyOnAudio: input.notifyOnAudio,
      notifyOnArticles: input.notifyOnArticles,
      frequency: input.frequency,
    },
  })
}

export async function getNotificationScheduleSettings() {
  const existing = await prisma.notificationScheduleSettings.findUnique({
    where: { id: SCHEDULE_ROW_ID },
  })

  if (existing) {
    return existing
  }

  return prisma.notificationScheduleSettings.create({
    data: {
      id: SCHEDULE_ROW_ID,
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
    },
  })
}

export async function updateNotificationScheduleSettings(input: NotificationScheduleInput) {
  return prisma.notificationScheduleSettings.upsert({
    where: { id: SCHEDULE_ROW_ID },
    update: input,
    create: {
      id: SCHEDULE_ROW_ID,
      ...input,
    },
  })
}

export async function getNotificationDispatchStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    configuredUsers,
    pendingJobs,
    processingJobs,
    failedJobs,
    sentLast24h,
    lastSentJob,
    nextQueuedJob,
  ] = await Promise.all([
    prisma.userNotificationPreference.count({
      where: {
        frequency: {
          not: NotificationFrequency.NONE,
        },
        OR: [
          { notifyOnAudio: true },
          { notifyOnArticles: true },
        ],
      },
    }),
    prisma.notificationDispatchJob.count({
      where: {
        status: NotificationDispatchStatus.PENDING,
      },
    }),
    prisma.notificationDispatchJob.count({
      where: {
        status: NotificationDispatchStatus.PROCESSING,
      },
    }),
    prisma.notificationDispatchJob.count({
      where: {
        status: NotificationDispatchStatus.FAILED,
      },
    }),
    prisma.notificationDispatchJob.count({
      where: {
        status: NotificationDispatchStatus.SENT,
        sentAt: {
          gte: since,
        },
      },
    }),
    prisma.notificationDispatchJob.findFirst({
      where: {
        status: NotificationDispatchStatus.SENT,
      },
      orderBy: {
        sentAt: 'desc',
      },
      select: {
        sentAt: true,
      },
    }),
    prisma.notificationDispatchJob.findFirst({
      where: {
        status: NotificationDispatchStatus.PENDING,
      },
      orderBy: [
        { availableAt: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        availableAt: true,
      },
    }),
  ])

  return {
    configuredUsers,
    pendingJobs,
    processingJobs,
    failedJobs,
    sentLast24h,
    lastSentAt: lastSentJob?.sentAt ?? null,
    nextQueuedAt: nextQueuedJob?.availableAt ?? null,
    schedulerIntervalMinutes: NOTIFICATION_SCHEDULER_INTERVAL_MS / (60 * 1000),
    workerIntervalSeconds: NOTIFICATION_WORKER_INTERVAL_MS / 1000,
  }
}

export async function listNotificationDispatchJobs(input: {
  page: number
  limit: number
  status?: NotificationDispatchStatus
}) {
  const page = Math.max(1, input.page)
  const limit = Math.min(Math.max(1, input.limit), 100)
  const where: Prisma.NotificationDispatchJobWhereInput = input.status
    ? { status: input.status }
    : {}

  const [total, jobs, grouped] = await Promise.all([
    prisma.notificationDispatchJob.count({ where }),
    prisma.notificationDispatchJob.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { availableAt: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: notificationDispatchJobSelect,
    }),
    prisma.notificationDispatchJob.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    }),
  ])

  const summary = grouped.reduce<Record<NotificationDispatchStatus, number>>((acc, item) => {
    acc[item.status] = item._count._all
    return acc
  }, {
    [NotificationDispatchStatus.PENDING]: 0,
    [NotificationDispatchStatus.PROCESSING]: 0,
    [NotificationDispatchStatus.SENT]: 0,
    [NotificationDispatchStatus.FAILED]: 0,
  })

  return {
    data: jobs.map(serializeNotificationDispatchJob),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    summary,
  }
}

export async function enqueueDueNotifications(now = new Date()) {
  const schedule = await getNotificationScheduleSettings()
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      notificationPreference: {
        isNot: null,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      notificationPreference: true,
    },
  })

  for (const user of users) {
    const preference = user.notificationPreference

    if (!preference || preference.frequency === NotificationFrequency.NONE) {
      continue
    }

    if (!preference.notifyOnAudio && !preference.notifyOnArticles) {
      continue
    }

    const scheduledFor = getDueSlotForFrequency(preference.frequency, schedule, now)

    if (!scheduledFor) {
      continue
    }

    const fallbackField = getPreferenceTimestampField(preference.frequency)
    const windowStartedAt = await getNotificationCursor({
      userId: user.id,
      frequency: preference.frequency,
      fallback: preference[fallbackField],
      now,
    })

    if (windowStartedAt.getTime() >= now.getTime()) {
      continue
    }

    const [audio, articles] = await Promise.all([
      preference.notifyOnAudio
        ? prisma.audio.findMany({
            where: {
              status: 'PUBLISHED',
              publishedAt: asUtcDateRange(windowStartedAt, now),
            },
            select: {
              title: true,
              publishedAt: true,
            },
            orderBy: {
              publishedAt: 'desc',
            },
          })
        : Promise.resolve([]),
      preference.notifyOnArticles
        ? prisma.article.findMany({
            where: {
              status: 'PUBLISHED',
              publishedAt: asUtcDateRange(windowStartedAt, now),
            },
            select: {
              title: true,
              publishedAt: true,
            },
            orderBy: {
              publishedAt: 'desc',
            },
          })
        : Promise.resolve([]),
    ])

    const items = [...audio.map(toAudioItem), ...articles.map(toArticleItem)].sort((left, right) => {
      const leftTime = left.publishedAt?.getTime() ?? 0
      const rightTime = right.publishedAt?.getTime() ?? 0
      return rightTime - leftTime
    })

    if (items.length === 0) {
      continue
    }

    await enqueueNotificationJob({
      user,
      frequency: preference.frequency,
      schedule,
      windowStartedAt,
      windowEndedAt: now,
      scheduledFor,
      items,
    })
  }
}

export async function processNotificationQueue(now = new Date()) {
  const schedule = await getNotificationScheduleSettings()

  await releaseStaleNotificationJobs(schedule, now)

  const jobs = await claimNotificationJobs(schedule, now)

  for (const job of jobs) {
    try {
      await sendContentEmail({
        user: {
          email: job.recipientEmail,
          name: job.recipientName,
        },
        subject: job.subject,
        title: job.title,
        intro: job.intro,
        items: parseContentItems(job.items),
      })

      await finalizeSuccessfulNotificationJob(job, new Date())
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Invio notifica fallito'

      await finalizeFailedNotificationJob(job, schedule, new Date(), errorMessage)
    }
  }

  await pruneNotificationDispatchJobs(schedule, now)
}

export function startNotificationPipeline() {
  if (notificationPipelineStarted) {
    return
  }

  notificationPipelineStarted = true

  void runNotificationSchedulingCycle()
  void runNotificationWorkerCycle()

  setInterval(() => {
    void runNotificationSchedulingCycle()
  }, NOTIFICATION_SCHEDULER_INTERVAL_MS)

  setInterval(() => {
    void runNotificationWorkerCycle()
  }, NOTIFICATION_WORKER_INTERVAL_MS)
}
