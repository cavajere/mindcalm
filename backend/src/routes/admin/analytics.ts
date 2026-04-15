import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AnalyticsEventType, Prisma, Status } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { analyticsOverviewQuery } from '../../utils/validators'
import { getNumber, getSingleString } from '../../utils/request'
import { prisma } from '../../lib/prisma'

const router = createAsyncRouter()

router.use(adminAuthMiddleware, requireAdmin)

function startOfUtcDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

function endOfUtcDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
}

function getDateRange(req: Request) {
  const queryDays = getNumber(req.query.days)
  const days = queryDays && queryDays > 0 ? queryDays : 30
  const dateFrom = getSingleString(req.query.dateFrom)
  const dateTo = getSingleString(req.query.dateTo)

  if (dateFrom || dateTo) {
    const rangeStart = startOfUtcDay(dateFrom || dateTo || new Date().toISOString().slice(0, 10))
    const rangeEnd = endOfUtcDay(dateTo || dateFrom || new Date().toISOString().slice(0, 10))
    return { rangeStart, rangeEnd }
  }

  const rangeEnd = new Date()
  rangeEnd.setUTCHours(23, 59, 59, 999)

  const rangeStart = new Date(rangeEnd)
  rangeStart.setUTCDate(rangeEnd.getUTCDate() - (days - 1))
  rangeStart.setUTCHours(0, 0, 0, 0)

  return { rangeStart, rangeEnd }
}

function calculatePeriodDays(rangeStart: Date, rangeEnd: Date) {
  return Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1)
}

function toPercent(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

router.get('/filters', async (_req: Request, res: Response) => {
  const [categories, audio, posts, users] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.audio.findMany({
      where: { status: Status.PUBLISHED },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.post.findMany({
      where: { status: Status.PUBLISHED },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        author: true,
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    }),
  ])

  res.json({
    categories,
    audio,
    posts,
    users,
  })
})

router.get('/overview', analyticsOverviewQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const { rangeStart, rangeEnd } = getDateRange(req)
  if (rangeStart > rangeEnd) {
    res.status(400).json({ error: 'Intervallo date non valido' })
    return
  }

  const categoryId = getSingleString(req.query.categoryId)
  const audioId = getSingleString(req.query.audioId)
  const postId = getSingleString(req.query.postId)
  const userId = getSingleString(req.query.userId)

  const whereClauses: Prisma.AnalyticsEventWhereInput[] = [{
    occurredAt: {
      gte: rangeStart,
      lte: rangeEnd,
    },
  }]

  if (userId) whereClauses.push({ userId })
  if (audioId) whereClauses.push({ audioId })
  if (postId) whereClauses.push({ postId })
  if (categoryId && !postId) {
    whereClauses.push({
      audio: {
        categoryId,
      },
    })
  }

  const baseWhere: Prisma.AnalyticsEventWhereInput =
    whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses }

  const periodDays = calculatePeriodDays(rangeStart, rangeEnd)

  const [
    audioViews,
    audioPlays,
    audioCompletions,
    postViews,
    errorEvents,
    activeUsers,
    audioMetricRows,
    postMetricRows,
    userMetricRows,
    rawEvents,
    recentEvents,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...baseWhere, eventType: AnalyticsEventType.AUDIO_VIEW } }),
    prisma.analyticsEvent.count({ where: { ...baseWhere, eventType: AnalyticsEventType.AUDIO_PLAY } }),
    prisma.analyticsEvent.count({ where: { ...baseWhere, eventType: AnalyticsEventType.AUDIO_COMPLETE } }),
    prisma.analyticsEvent.count({ where: { ...baseWhere, eventType: AnalyticsEventType.POST_VIEW } }),
    prisma.analyticsEvent.count({
      where: {
        ...baseWhere,
        eventType: {
          in: [
            AnalyticsEventType.APP_ERROR,
            AnalyticsEventType.API_ERROR,
            AnalyticsEventType.AUDIO_ERROR,
            AnalyticsEventType.SERVER_ERROR,
          ],
        },
      },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        ...baseWhere,
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['audioId', 'eventType'],
      where: {
        ...baseWhere,
        audioId: { not: null },
        eventType: {
          in: [
            AnalyticsEventType.AUDIO_VIEW,
            AnalyticsEventType.AUDIO_PLAY,
            AnalyticsEventType.AUDIO_COMPLETE,
          ],
        },
      },
      _count: { audioId: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['postId'],
      where: {
        ...baseWhere,
        eventType: AnalyticsEventType.POST_VIEW,
        postId: { not: null },
      },
      _count: { postId: true },
      orderBy: { _count: { postId: 'desc' } },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['userId', 'eventType'],
      where: {
        ...baseWhere,
        userId: { not: null },
      },
      _count: { userId: true },
    }),
    prisma.analyticsEvent.findMany({
      where: baseWhere,
      select: { occurredAt: true, eventType: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.analyticsEvent.findMany({
      where: baseWhere,
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventType: true,
        occurredAt: true,
        metadata: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        audio: {
          select: {
            id: true,
            title: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            author: true,
          },
        },
      },
    }),
  ])

  const audioIds = Array.from(new Set(
    audioMetricRows
      .map((row) => row.audioId)
      .filter((id): id is string => Boolean(id)),
  ))
  const postIds = postMetricRows
    .map((row) => row.postId)
    .filter((id): id is string => Boolean(id))
  const userIds = Array.from(new Set(
    userMetricRows
      .map((row) => row.userId)
      .filter((id): id is string => Boolean(id)),
  ))

  const [audioDetails, postDetails, userDetails] = await Promise.all([
    audioIds.length
      ? prisma.audio.findMany({
          where: { id: { in: audioIds } },
          select: {
            id: true,
            title: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    postIds.length
      ? prisma.post.findMany({
          where: { id: { in: postIds } },
          select: {
            id: true,
            title: true,
            author: true,
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        })
      : Promise.resolve([]),
  ])

  const audioMeta = new Map(audioDetails.map((audioItem) => [audioItem.id, audioItem]))
  const postMeta = new Map(postDetails.map((post) => [post.id, post]))
  const userMeta = new Map(userDetails.map((user) => [user.id, user]))

  const audioCountMap = new Map<string, {
    viewCount: number
    playCount: number
    completionCount: number
  }>()

  audioMetricRows.forEach((row) => {
    if (!row.audioId) return

    const current = audioCountMap.get(row.audioId) || {
      viewCount: 0,
      playCount: 0,
      completionCount: 0,
    }

    if (row.eventType === AnalyticsEventType.AUDIO_VIEW) current.viewCount = row._count.audioId
    if (row.eventType === AnalyticsEventType.AUDIO_PLAY) current.playCount = row._count.audioId
    if (row.eventType === AnalyticsEventType.AUDIO_COMPLETE) current.completionCount = row._count.audioId

    audioCountMap.set(row.audioId, current)
  })

  const audioPerformance = Array.from(audioCountMap.entries())
    .map(([id, counts]) => {
      const meta = audioMeta.get(id)
      if (!meta) return null

      const dropOffCount = Math.max(counts.playCount - counts.completionCount, 0)

      return {
        id,
        title: meta.title,
        categoryName: meta.category.name,
        viewCount: counts.viewCount,
        playCount: counts.playCount,
        completionCount: counts.completionCount,
        completionRate: toPercent(counts.completionCount, counts.playCount),
        dropOffCount,
        dropOffRate: toPercent(dropOffCount, counts.playCount),
      }
    })
    .filter((audioItem): audioItem is NonNullable<typeof audioItem> => audioItem !== null)
    .sort((a, b) => b.playCount - a.playCount || b.viewCount - a.viewCount || a.title.localeCompare(b.title))

  const topAudio = audioPerformance.slice(0, 5)

  const topDropoffAudio = [...audioPerformance]
    .filter((audioItem) => audioItem.playCount > 0 && audioItem.dropOffCount > 0)
    .sort((a, b) => b.dropOffCount - a.dropOffCount || b.dropOffRate - a.dropOffRate || b.playCount - a.playCount)
    .slice(0, 5)

  const topPosts = postMetricRows
    .map((row) => {
      if (!row.postId) return null

      const meta = postMeta.get(row.postId)
      if (!meta) return null

      return {
        id: row.postId,
        title: meta.title,
        author: meta.author,
        viewCount: row._count.postId,
      }
    })
    .filter((post): post is NonNullable<typeof post> => post !== null)
    .slice(0, 5)

  const userCountMap = new Map<string, {
    totalEvents: number
    audioViews: number
    audioPlays: number
    audioCompletions: number
    postViews: number
  }>()

  userMetricRows.forEach((row) => {
    if (!row.userId) return

    const current = userCountMap.get(row.userId) || {
      totalEvents: 0,
      audioViews: 0,
      audioPlays: 0,
      audioCompletions: 0,
      postViews: 0,
    }

    current.totalEvents += row._count.userId

    if (row.eventType === AnalyticsEventType.AUDIO_VIEW) current.audioViews = row._count.userId
    if (row.eventType === AnalyticsEventType.AUDIO_PLAY) current.audioPlays = row._count.userId
    if (row.eventType === AnalyticsEventType.AUDIO_COMPLETE) current.audioCompletions = row._count.userId
    if (row.eventType === AnalyticsEventType.POST_VIEW) current.postViews = row._count.userId

    userCountMap.set(row.userId, current)
  })

  const topUsers = Array.from(userCountMap.entries())
    .map(([id, counts]) => {
      const meta = userMeta.get(id)
      if (!meta) return null

      return {
        id,
        name: meta.name,
        email: meta.email,
        role: meta.role,
        totalEvents: counts.totalEvents,
        audioViews: counts.audioViews,
        audioPlays: counts.audioPlays,
        audioCompletions: counts.audioCompletions,
        postViews: counts.postViews,
      }
    })
    .filter((user): user is NonNullable<typeof user> => user !== null)
    .sort((a, b) => b.totalEvents - a.totalEvents || b.audioPlays - a.audioPlays || a.name.localeCompare(b.name))
    .slice(0, 10)

  const dayMap = new Map<string, {
    date: string
    audioViews: number
    audioPlays: number
    audioCompletions: number
    postViews: number
    errorEvents: number
  }>()

  for (let index = 0; index < periodDays; index += 1) {
    const day = new Date(rangeStart)
    day.setUTCDate(rangeStart.getUTCDate() + index)
    const key = day.toISOString().slice(0, 10)
    dayMap.set(key, {
      date: key,
      audioViews: 0,
      audioPlays: 0,
      audioCompletions: 0,
      postViews: 0,
      errorEvents: 0,
    })
  }

  rawEvents.forEach((event) => {
    const key = event.occurredAt.toISOString().slice(0, 10)
    const day = dayMap.get(key)
    if (!day) return

    if (event.eventType === AnalyticsEventType.AUDIO_VIEW) day.audioViews += 1
    if (event.eventType === AnalyticsEventType.AUDIO_PLAY) day.audioPlays += 1
    if (event.eventType === AnalyticsEventType.AUDIO_COMPLETE) day.audioCompletions += 1
    if (event.eventType === AnalyticsEventType.POST_VIEW) day.postViews += 1
    if (
      event.eventType === AnalyticsEventType.APP_ERROR
      || event.eventType === AnalyticsEventType.API_ERROR
      || event.eventType === AnalyticsEventType.AUDIO_ERROR
      || event.eventType === AnalyticsEventType.SERVER_ERROR
    ) {
      day.errorEvents += 1
    }
  })

  res.json({
    periodDays,
    rangeStart,
    rangeEnd,
    appliedFilters: {
      categoryId: categoryId || null,
      audioId: audioId || null,
      postId: postId || null,
      userId: userId || null,
    },
    totals: {
      audioViews,
      audioPlays,
      audioCompletions,
      postViews,
      errorEvents,
      activeUsers: activeUsers.length,
    },
    topAudio,
    audioPerformance,
    topDropoffAudio,
    topPosts,
    topUsers,
    dailyActivity: Array.from(dayMap.values()),
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      user: event.user,
      audio: event.audio
        ? {
            id: event.audio.id,
            title: event.audio.title,
            categoryName: event.audio.category.name,
          }
        : null,
      post: event.post
        ? {
            id: event.post.id,
            title: event.post.title,
            author: event.post.author,
          }
        : null,
    })),
  })
})

export default router
