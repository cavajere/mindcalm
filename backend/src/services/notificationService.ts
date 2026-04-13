import { NotificationFrequency, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendMail } from './smtpService'

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

function toAudioLine(item: { title: string; publishedAt: Date | null }) {
  const published = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('it-IT') : 'data non disponibile'
  return `🎧 ${item.title} (${published})`
}

function toArticleLine(item: { title: string; publishedAt: Date | null }) {
  const published = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('it-IT') : 'data non disponibile'
  return `📰 ${item.title} (${published})`
}

async function sendContentEmail(user: { email: string; name: string }, subject: string, lines: string[]) {
  const text = [`Ciao ${user.name},`, '', ...lines, '', 'Puoi modificare le preferenze dalla pagina Profilo.'].join('\n')
  const html = `<p>Ciao ${user.name},</p><ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul><p>Puoi modificare le preferenze dalla pagina Profilo.</p>`

  await sendMail({
    to: user.email,
    subject,
    text,
    html,
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
        user,
        'MindCalm: nuovi contenuti pubblicati',
        [...audio.map(toAudioLine), ...articles.map(toArticleLine)],
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
        user,
        'MindCalm: riepilogo settimanale contenuti',
        [...audio.map(toAudioLine), ...articles.map(toArticleLine)],
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
        user,
        'MindCalm: riepilogo mensile contenuti',
        [...audio.map(toAudioLine), ...articles.map(toArticleLine)],
      )

      await prisma.userNotificationPreference.update({
        where: { userId: user.id },
        data: { lastMonthlyDigestSentAt: now },
      })
    }
  }
}
