import { prisma } from '../lib/prisma'
import { config } from '../config'
import { generateRandomToken, hashToken } from './cryptoService'

interface CreatePlaybackSessionInput {
  audioId: string
  userId: string
  durationSec: number
  ipAddress?: string | null
  userAgent?: string | null
}

export function getPlaybackExpiresInSeconds(durationSec: number): number {
  const desiredTtl = Math.max(durationSec, 0) + config.playback.gracePeriodSeconds
  return Math.min(
    config.playback.maxExpiresInSeconds,
    Math.max(config.playback.minExpiresInSeconds, desiredTtl),
  )
}

export function getPlaybackCookieName(sessionId: string): string {
  return `mindcalm_playback_${sessionId}`
}

export function buildPlaybackSessionBasePath(audioId: string, sessionId: string): string {
  return `/api/audio/${audioId}/playback/${sessionId}`
}

export function buildPlaybackManifestPath(audioId: string, sessionId: string): string {
  return `${buildPlaybackSessionBasePath(audioId, sessionId)}/master.m3u8`
}

export function buildPlaybackDirectStreamPath(audioId: string, sessionId: string): string {
  return `${buildPlaybackSessionBasePath(audioId, sessionId)}/direct`
}

export async function revokeExpiredPlaybackSessions() {
  await prisma.playbackSession.updateMany({
    where: {
      revokedAt: null,
      expiresAt: { lte: new Date() },
    },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllPlaybackSessionsForUser(userId: string) {
  await prisma.playbackSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })
}

export async function enforcePlaybackConcurrency(userId: string, keepSessionId?: string) {
  const activeSessions = await prisma.playbackSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  const allowedAdditionalSessions = Math.max(config.playback.maxConcurrentSessionsPerUser - 1, 0)
  const sessionsToRevoke = activeSessions.slice(allowedAdditionalSessions)

  if (!sessionsToRevoke.length) return

  await prisma.playbackSession.updateMany({
    where: { id: { in: sessionsToRevoke.map((session) => session.id) } },
    data: { revokedAt: new Date() },
  })
}

export async function createPlaybackSession({
  audioId,
  userId,
  durationSec,
  ipAddress,
  userAgent,
}: CreatePlaybackSessionInput) {
  await revokeExpiredPlaybackSessions()

  const rawToken = generateRandomToken(32)
  const expiresInSec = getPlaybackExpiresInSeconds(durationSec)
  const expiresAt = new Date(Date.now() + expiresInSec * 1000)

  const session = await prisma.playbackSession.create({
    data: {
      userId,
      audioId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  })

  await enforcePlaybackConcurrency(userId, session.id)

  return {
    sessionId: session.id,
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
    expiresInSec,
  }
}

export async function validatePlaybackSession(input: {
  sessionId: string
  audioId: string
  userId: string
  token: string
}) {
  const session = await prisma.playbackSession.findFirst({
    where: {
      id: input.sessionId,
      audioId: input.audioId,
      userId: input.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (!session) return null
  if (session.tokenHash !== hashToken(input.token)) return null

  if (!session.startedAt) {
    await prisma.playbackSession.update({
      where: { id: session.id },
      data: { startedAt: new Date() },
    })
  }

  return session
}
