import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AudioProcessingStatus, Prisma, StreamingFormat } from '@prisma/client'
import { validationResult } from 'express-validator'
import fs from 'fs'
import { audioFilterQuery } from '../../utils/validators'
import { config } from '../../config'
import { getSingleString, getStringList } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { appAuthMiddleware, optionalAppAuthMiddleware } from '../../middleware/auth'
import { getRankedPublishedAudioIds } from '../../services/searchService'
import { mapAudioTags } from '../../services/tagService'
import { getAudioFilePath } from '../../services/fileService'
import {
  getHlsContentType,
  resolveProtectedHlsAssetPath,
} from '../../services/audioDeliveryService'
import { resolveCoverImageSource } from '../../services/albumImageService'
import {
  buildPlaybackDirectStreamPath,
  buildPlaybackManifestPath,
  buildPlaybackSessionBasePath,
  createPlaybackSession,
  getPlaybackCookieName,
  validatePlaybackSession,
} from '../../services/playbackSessionService'
import { playbackSessionRateLimiter } from '../../middleware/rateLimiter'
import { getVisibleContentVisibilities } from '../../utils/contentVisibility'

const router = createAsyncRouter()

router.use(optionalAppAuthMiddleware)

function setPrivateStreamingHeaders(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
}

function clearPlaybackCookie(res: Response, audioId: string, sessionId: string) {
  res.clearCookie(getPlaybackCookieName(sessionId), {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: buildPlaybackSessionBasePath(audioId, sessionId),
  })
}

async function validatePlaybackRequest(req: Request, res: Response) {
  const audioId = getSingleString(req.params.id)
  const sessionId = getSingleString(req.params.sessionId)

  if (!audioId) {
    res.status(400).json({ error: 'ID audio non valido' })
    return null
  }

  if (!sessionId) {
    res.status(400).json({ error: 'Sessione di playback non valida' })
    return null
  }

  const sessionToken = req.cookies?.[getPlaybackCookieName(sessionId)]
  if (!sessionToken) {
    res.status(401).json({ error: 'Sessione di playback scaduta o non valida' })
    return null
  }

  const playbackSession = await validatePlaybackSession({
    sessionId,
    audioId,
    userId: req.adminUser!.id,
    token: sessionToken,
  })

  if (!playbackSession) {
    clearPlaybackCookie(res, audioId, sessionId)
    res.status(401).json({ error: 'Sessione di playback scaduta o non valida' })
    return null
  }

  const audio = await prisma.audio.findFirst({
    where: {
      id: audioId,
      status: 'PUBLISHED',
      processingStatus: AudioProcessingStatus.READY,
    },
  })

  if (!audio) {
    res.status(404).json({ error: 'Audio non trovato' })
    return null
  }

  return { audioId, sessionId, audio }
}

function mapAudioListItem(audio: {
  id: string
  title: string
  description: string
  category: { id: string; name: string; color: string | null }
  level: string
  durationSec: number
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
  audioTags: Array<{ tag: { id: string; label: string; slug: string } }>
}) {
  const cover = resolveCoverImageSource({
    coverImage: audio.coverImage,
    coverImageOriginalName: audio.coverImageOriginalName,
    coverImageDisplayName: audio.coverImageDisplayName,
    coverAlbumImage: audio.coverAlbumImage,
  })

  return {
    id: audio.id,
    title: audio.title,
    description: audio.description,
    category: audio.category,
    level: audio.level,
    durationSec: audio.durationSec,
    ...cover,
    publishedAt: audio.publishedAt,
    tags: mapAudioTags(audio.audioTags),
  }
}

router.get('/', audioFilterQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit
  const search = getSingleString(req.query.search)?.trim() || ''
  const tagSlugs = [...new Set(getStringList(req.query.tags))]
  const matchMode = getSingleString(req.query.matchMode) === 'all' ? 'all' : 'any'
  const sort = getSingleString(req.query.sort) || 'recent'
  const visibleVisibilities = getVisibleContentVisibilities(req)
  const requestLog = {
    search,
    page,
    limit,
    categoryId: getSingleString(req.query.category) || null,
    level: getSingleString(req.query.level) || null,
    duration: getSingleString(req.query.duration) || null,
    tagSlugs,
    matchMode,
    sort,
  }

  if (!search && sort === 'relevance') {
    res.status(400).json({ error: 'sort=relevance richiede una query di ricerca' })
    return
  }

  const include = {
    category: { select: { id: true, name: true, color: true } },
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
    audioTags: {
      include: { tag: { select: { id: true, label: true, slug: true } } },
    },
  } satisfies Prisma.AudioInclude

  if (search) {
    console.info('[Search][API][Audio] request', requestLog)

    const { ids, total } = await getRankedPublishedAudioIds({
      page,
      limit,
      search,
      tagSlugs,
      matchMode,
      categoryId: getSingleString(req.query.category),
      level: getSingleString(req.query.level) as any,
      duration: getSingleString(req.query.duration) as any,
      visibilities: visibleVisibilities,
    })

    if (!ids.length) {
      console.info('[Search][API][Audio] response', { ...requestLog, resultCount: 0, total: 0 })
      res.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      })
      return
    }

    const audioItems = await prisma.audio.findMany({
      where: { 
        id: { in: ids },
        status: 'PUBLISHED',
        visibility: { in: visibleVisibilities },
      },
      include,
    })

    const byId = new Map(audioItems.map(audio => [audio.id, audio]))
    const data = ids
      .map(id => byId.get(id))
      .filter((audio): audio is NonNullable<typeof audio> => Boolean(audio))
      .map(mapAudioListItem)

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
    console.info('[Search][API][Audio] response', { ...requestLog, resultCount: data.length, total })
    return
  }

  const where: Prisma.AudioWhereInput = { 
    status: 'PUBLISHED',
    visibility: { in: visibleVisibilities },
  }

  if (req.query.category) {
    where.categoryId = req.query.category as string
  }
  if (req.query.level) {
    where.level = req.query.level as any
  }
  if (req.query.duration) {
    const d = req.query.duration as string
    if (d === 'short') where.durationSec = { lt: 600 }
    else if (d === 'medium') where.durationSec = { gte: 600, lte: 1200 }
    else if (d === 'long') where.durationSec = { gt: 1200 }
  }
  if (tagSlugs.length) {
    if (matchMode === 'all') {
      where.AND = tagSlugs.map(slug => ({
        audioTags: { some: { tag: { slug, isActive: true } } },
      }))
    } else {
      where.audioTags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
            isActive: true,
          },
        },
      }
    }
  }

  const [audioItems, total] = await Promise.all([
    prisma.audio.findMany({
      where,
      include,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.audio.count({ where }),
  ])

  res.json({
    data: audioItems.map(mapAudioListItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/:id', async (req: Request, res: Response) => {
  const audioId = getSingleString(req.params.id)
  if (!audioId) {
    res.status(400).json({ error: 'ID audio non valido' })
    return
  }

  const audio = await prisma.audio.findFirst({
    where: { 
      id: audioId, 
      status: 'PUBLISHED',
      visibility: { in: getVisibleContentVisibilities(req) },
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
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
      audioTags: {
        include: { tag: { select: { id: true, label: true, slug: true } } },
      },
    },
  })

  if (!audio) {
    res.status(404).json({ error: 'Audio non trovato' })
    return
  }

  const cover = resolveCoverImageSource({
    coverImage: audio.coverImage,
    coverImageOriginalName: audio.coverImageOriginalName,
    coverImageDisplayName: audio.coverImageDisplayName,
    coverAlbumImage: audio.coverAlbumImage,
  })

  res.json({
    id: audio.id,
    title: audio.title,
    description: audio.description,
    category: audio.category,
    level: audio.level,
    durationSec: audio.durationSec,
    audioFormat: audio.audioFormat,
    audioSize: audio.audioSize,
    audioFileOriginalName: audio.audioOriginalName,
    audioFileDisplayName: audio.audioDisplayName,
    ...cover,
    publishedAt: audio.publishedAt,
    tags: mapAudioTags(audio.audioTags),
    streaming: {
      mode: 'session-playback',
      requiresOnline: true,
      delivery: audio.streamingFormat === StreamingFormat.HLS ? 'hls' : 'direct',
      processingStatus: audio.processingStatus,
      playbackSessionUrl: `/api/audio/${audioId}/playback-session`,
      minTokenTtlSec: config.playback.minExpiresInSeconds,
    },
  })
})

router.post('/:id/playback-session', playbackSessionRateLimiter, appAuthMiddleware, async (req: Request, res: Response) => {
  const audioId = getSingleString(req.params.id)
  if (!audioId) {
    res.status(400).json({ error: 'ID audio non valido' })
    return
  }

  const audio = await prisma.audio.findFirst({
    where: {
      id: audioId,
      status: 'PUBLISHED',
      processingStatus: AudioProcessingStatus.READY,
      visibility: { in: getVisibleContentVisibilities(req) },
    },
  })

  if (!audio) {
    res.status(404).json({ error: 'Audio non disponibile per la riproduzione' })
    return
  }

  const { sessionId, token, expiresAt, expiresInSec } = await createPlaybackSession({
    audioId,
    userId: req.adminUser!.id,
    durationSec: audio.durationSec,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  })

  const basePath = buildPlaybackSessionBasePath(audioId, sessionId)
  res.cookie(getPlaybackCookieName(sessionId), token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: basePath,
    maxAge: expiresInSec * 1000,
  })

  const playbackType = audio.streamingFormat === StreamingFormat.HLS && audio.hlsManifestPath ? 'hls' : 'direct'
  const playbackUrl = playbackType === 'hls'
    ? buildPlaybackManifestPath(audioId, sessionId)
    : buildPlaybackDirectStreamPath(audioId, sessionId)

  res.json({
    playbackType,
    playbackUrl,
    expiresAt,
    expiresInSec,
  })
})

router.get('/:id/playback/:sessionId/direct', appAuthMiddleware, async (req: Request, res: Response) => {
  const validated = await validatePlaybackRequest(req, res)
  if (!validated) return

  const { audio } = validated
  const filePath = getAudioFilePath(audio.audioFile)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File audio non trovato' })
    return
  }

  setPrivateStreamingHeaders(res)

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  }
  const contentType = mimeTypes[audio.audioFormat] || 'audio/mpeg'

  const range = req.headers.range
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start > end || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end()
      return
    }

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
    })
    fs.createReadStream(filePath, { start, end }).pipe(res)
    return
  }

  res.writeHead(200, {
    'Content-Length': fileSize,
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
  })
  fs.createReadStream(filePath).pipe(res)
})

router.get('/:id/playback/:sessionId/:asset(*)', appAuthMiddleware, async (req: Request, res: Response) => {
  const validated = await validatePlaybackRequest(req, res)
  if (!validated) return

  const { audio } = validated
  if (audio.streamingFormat !== StreamingFormat.HLS || !audio.hlsManifestPath) {
    res.status(404).json({ error: 'Manifest HLS non disponibile' })
    return
  }

  const requestedAsset = getSingleString(req.params.asset)
  if (!requestedAsset) {
    res.status(400).json({ error: 'Asset HLS non valido' })
    return
  }

  let assetPath: string
  try {
    assetPath = resolveProtectedHlsAssetPath(audio.hlsManifestPath, requestedAsset)
  } catch {
    res.status(400).json({ error: 'Asset HLS non valido' })
    return
  }

  if (!fs.existsSync(assetPath)) {
    res.status(404).json({ error: 'Asset HLS non trovato' })
    return
  }

  setPrivateStreamingHeaders(res)
  res.setHeader('Content-Type', getHlsContentType(assetPath))
  res.setHeader('Content-Length', fs.statSync(assetPath).size)
  fs.createReadStream(assetPath).pipe(res)
})

export default router
