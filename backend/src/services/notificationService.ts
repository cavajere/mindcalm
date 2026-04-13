import { NotificationFrequency, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendMail } from './smtpService'
import { buildContentNotificationEmail, type ContentNotificationItem } from './email/templates'

const SCHEDULE_ROW_ID = 1

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
}

function asUtcDateRange(from: Date, to: Date): Prisma.DateTimeFilter {
  return { gt: from, lte: to }
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
  const existing = await prisma.notificationScheduleSettings.findUnique({ where: { id: SCHEDULE_ROW_ID } })

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

export async function processNotificationDispatch(now = new Date()) {
  const schedule = await getNotificationScheduleSettings()
  const hour = now.getUTCHours()
  const day = now.getUTCDay()
  const dayOfMonth = now.getUTCDate()

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
    if (!preference || preference.frequency === NotificationFrequency.NONE) continue
    if (!preference.notifyOnAudio && !preference.notifyOnArticles) continue

    if (preference.frequency === NotificationFrequency.IMMEDIATE) {
      if (hour !== schedule.immediateHourUtc) continue

      const since = preference.lastImmediateContentAt || new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const [audio, articles] = await Promise.all([
        preference.notifyOnAudio
          ? prisma.audio.findMany({
              where: { status: 'PUBLISHED', publishedAt: asUtcDateRange(since, now) },
              select: { title: true, publishedAt: true },
              orderBy: { publishedAt: 'desc' },
            })
          : Promise.resolve([]),
        preference.notifyOnArticles
          ? prisma.article.findMany({
              where: { status: 'PUBLISHED', publishedAt: asUtcDateRange(since, now) },
              select: { title: true, publishedAt: true },
              orderBy: { publishedAt: 'desc' },
            })
          : Promise.resolve([]),
      ])

      if (audio.length === 0 && articles.length === 0) continue

      await sendContentEmail(
        {
          user,
          subject: 'MindCalm: nuovi contenuti pubblicati',
          title: 'Nuovi contenuti disponibili',
          intro: 'Abbiamo pubblicato nuovi contenuti che corrispondono alle tue preferenze.',
          items: [...audio.map(toAudioItem), ...articles.map(toArticleItem)],
        },
      )

      await prisma.userNotificationPreference.update({
        where: { userId: user.id },
        data: { lastImmediateContentAt: now },
      })

      continue
    }

    if (preference.frequency === NotificationFrequency.WEEKLY) {
      if (hour !== schedule.weeklyHourUtc || day !== schedule.weeklyDayOfWeek) continue

      const since = preference.lastWeeklyDigestSentAt || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const [audio, articles] = await Promise.all([
        preference.notifyOnAudio
          ? prisma.audio.findMany({
              where: { status: 'PUBLISHED', publishedAt: asUtcDateRange(since, now) },
              select: { title: true, publishedAt: true },
              orderBy: { publishedAt: 'desc' },
            })
          : Promise.resolve([]),
        preference.notifyOnArticles
          ? prisma.article.findMany({
              where: { status: 'PUBLISHED', publishedAt: asUtcDateRange(since, now) },
              select: { title: true, publishedAt: true },
              orderBy: { publishedAt: 'desc' },
            })
          : Promise.resolve([]),
      ])

      if (audio.length === 0 && articles.length === 0) continue

      await sendContentEmail(
        {
          user,
          subject: 'MindCalm: riepilogo settimanale contenuti',
          title: 'Riepilogo settimanale',
          intro: "Ecco i contenuti pubblicati nell'ultima settimana.",
          items: [...audio.map(toAudioItem), ...articles.map(toArticleItem)],
        },
      )

      await prisma.userNotificationPreference.update({
        where: { userId: user.id },
        data: { lastWeeklyDigestSentAt: now },
      })

      continue
    }

    if (preference.frequency === NotificationFrequency.MONTHLY) {
      if (hour !== schedule.monthlyHourUtc || dayOfMonth !== schedule.monthlyDayOfMonth) continue

      const since = preference.lastMonthlyDigestSentAt || new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
      const [audio, articles] = await Promise.all([
        preference.notifyOnAudio
          ? prisma.audio.findMany({
              where: { status: 'PUBLISHED', publishedAt: asUtcDateRange(since, now) },
              select: { title: true, publishedAt: true },
              orderBy: { publishedAt: 'desc' },
            })
          : Promise.resolve([]),
        preference.notifyOnArticles
          ? prisma.article.findMany({
              where: { status: 'PUBLISHED', publishedAt: asUtcDateRange(since, now) },
              select: { title: true, publishedAt: true },
              orderBy: { publishedAt: 'desc' },
            })
          : Promise.resolve([]),
      ])

      if (audio.length === 0 && articles.length === 0) continue

      await sendContentEmail(
        {
          user,
          subject: 'MindCalm: riepilogo mensile contenuti',
          title: 'Riepilogo mensile',
          intro: "Ecco i contenuti pubblicati nell'ultimo mese.",
          items: [...audio.map(toAudioItem), ...articles.map(toArticleItem)],
        },
      )

      await prisma.userNotificationPreference.update({
        where: { userId: user.id },
        data: { lastMonthlyDigestSentAt: now },
      })
    }
  }
}
