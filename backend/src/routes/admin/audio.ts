import { Router, Request, Response } from 'express'
import { AuditAction, AuditEntityType, AudioProcessingStatus, Level, Prisma, Status, StreamingFormat } from '@prisma/client'
import { validationResult } from 'express-validator'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { uploadAudioFiles } from '../../middleware/upload'
import { audioValidation, statusValidation, paginationQuery } from '../../utils/validators'
import { getAudioDuration, getAudioFormat } from '../../services/audioService'
import { deleteDirectory, deleteFile, getHlsDirectoryPath } from '../../services/fileService'
import { getSingleString } from '../../utils/request'
import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'
import { MAX_TAGS_PER_CONTENT, ensureTagsExist, mapAudioTags, parseTagIds } from '../../services/tagService'
import { transcodeAudioFileToHls } from '../../services/audioDeliveryService'

const router = Router()

function removeUploadedFile(file?: Express.Multer.File) {
  if (file && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path)
  }
}

function validateAudioUploadSizes(files?: { [fieldname: string]: Express.Multer.File[] }): string | null {
  const coverImage = files?.coverImage?.[0]

  if (coverImage && coverImage.size > config.storage.maxImageSize) {
    removeUploadedFile(coverImage)
    return 'Immagine di copertina troppo grande'
  }

  return null
}

router.use(adminAuthMiddleware, requireAdmin)

// GET /api/admin/audio — elenco tutti gli audio (incluse bozze)
router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const skip = (page - 1) * limit

  const where: Prisma.AudioWhereInput = {}
  if (req.query.status) where.status = req.query.status as any
  if (req.query.category) where.categoryId = req.query.category as string

  const [audioItems, total] = await Promise.all([
    prisma.audio.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
        audioTags: {
          include: { tag: { select: { id: true, label: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.audio.count({ where }),
  ])

  res.json({
    data: audioItems.map((audio) => ({
      id: audio.id,
      title: audio.title,
      description: audio.description,
      categoryId: audio.categoryId,
      category: audio.category,
      level: audio.level,
      durationSec: audio.durationSec,
      audioFile: audio.audioFile,
      audioFormat: audio.audioFormat,
      audioSize: audio.audioSize,
      streamingFormat: audio.streamingFormat,
      processingStatus: audio.processingStatus,
      processingError: audio.processingError,
      status: audio.status,
      publishedAt: audio.publishedAt,
      createdAt: audio.createdAt,
      updatedAt: audio.updatedAt,
      coverImage: audio.coverImage ? `/api/files/images/${path.basename(audio.coverImage)}` : null,
      tags: mapAudioTags(audio.audioTags),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// POST /api/admin/audio — crea audio
router.post('/',
  uploadAudioFiles.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  audioValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Dati non validi', details: errors.array() })
      return
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    const audioFile = files?.audioFile?.[0]
    const sizeError = validateAudioUploadSizes(files)
    if (sizeError) {
      removeUploadedFile(audioFile)
      res.status(413).json({ error: sizeError })
      return
    }

    if (!audioFile) {
      res.status(400).json({ error: 'File audio obbligatorio' })
      return
    }

    const durationSec = await getAudioDuration(audioFile.path)
    const audioFormat = getAudioFormat(audioFile.mimetype)
    const coverImageFile = files?.coverImage?.[0]
    const title = getSingleString(req.body.title)
    const description = getSingleString(req.body.description)
    const categoryId = getSingleString(req.body.categoryId)
    const level = getSingleString(req.body.level)
    const status = getSingleString(req.body.status)
    const tagIds = parseTagIds(req.body.tagIds)

    if (tagIds.length > MAX_TAGS_PER_CONTENT) {
      res.status(400).json({ error: `Massimo ${MAX_TAGS_PER_CONTENT} tag per contenuto` })
      return
    }

    try {
      await ensureTagsExist(tagIds)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }

    const audioId = uuidv4()

    try {
      const hlsAsset = await transcodeAudioFileToHls(audioId, audioFile.path)

      const audio = await prisma.audio.create({
        data: {
          id: audioId,
          title: title!,
          description: description ?? '',
          categoryId: categoryId!,
          level: (level as Level | undefined) || 'BEGINNER',
          durationSec,
          audioFile: `audio/${audioFile.filename}`,
          audioFormat,
          audioSize: audioFile.size,
          streamingFormat: StreamingFormat.HLS,
          processingStatus: AudioProcessingStatus.READY,
          hlsManifestPath: hlsAsset.manifestPath,
          processingError: null,
          coverImage: coverImageFile ? `images/${coverImageFile.filename}` : null,
          status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          audioTags: {
            create: tagIds.map(tagId => ({
              tag: { connect: { id: tagId } },
            })),
          },
        },
        include: {
          category: true,
          audioTags: {
            include: { tag: { select: { id: true, label: true, slug: true } } },
          },
        },
      })

      await logAuditEventSafe({
        req,
        action: AuditAction.AUDIO_CREATED,
        entityType: AuditEntityType.AUDIO,
        entityId: audio.id,
        entityLabel: audio.title,
        ...getAuditActorFromRequest(req),
        metadata: {
          status: audio.status,
          categoryId: audio.categoryId,
          level: audio.level,
          durationSec: audio.durationSec,
          hasCoverImage: Boolean(audio.coverImage),
          streamingFormat: audio.streamingFormat,
          tagIds,
        },
      })

      res.status(201).json(audio)
    } catch (error) {
      removeUploadedFile(audioFile)
      removeUploadedFile(coverImageFile)
      deleteDirectory(getHlsDirectoryPath(audioId))
      res.status(422).json({ error: (error as Error).message || 'Impossibile preparare lo streaming HLS' })
    }
  }
)

// PUT /api/admin/audio/:id — aggiorna audio
router.put('/:id',
  uploadAudioFiles.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    const audioId = getSingleString(req.params.id)
    if (!audioId) {
      res.status(400).json({ error: 'ID audio non valido' })
      return
    }

    const existing = await prisma.audio.findUnique({ where: { id: audioId } })
    if (!existing) {
      res.status(404).json({ error: 'Audio non trovato' })
      return
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    const audioFile = files?.audioFile?.[0]
    const coverImageFile = files?.coverImage?.[0]
    const sizeError = validateAudioUploadSizes(files)
    if (sizeError) {
      removeUploadedFile(audioFile)
      res.status(413).json({ error: sizeError })
      return
    }
    const title = getSingleString(req.body.title)
    const description = getSingleString(req.body.description)
    const categoryId = getSingleString(req.body.categoryId)
    const level = getSingleString(req.body.level)
    const status = getSingleString(req.body.status)
    const tagIds = parseTagIds(req.body.tagIds)

    if (tagIds.length > MAX_TAGS_PER_CONTENT) {
      res.status(400).json({ error: `Massimo ${MAX_TAGS_PER_CONTENT} tag per contenuto` })
      return
    }

    try {
      await ensureTagsExist(tagIds)
    } catch (error) {
      res.status(400).json({ error: (error as Error).message })
      return
    }

    const data: Prisma.AudioUpdateInput = {}
    const changedFields: string[] = []
    if (title) {
      data.title = title
      if (title !== existing.title) changedFields.push('title')
    }
    if (description !== undefined) {
      data.description = description
      if (description !== existing.description) changedFields.push('description')
    }
    if (categoryId) {
      data.category = { connect: { id: categoryId } }
      if (categoryId !== existing.categoryId) changedFields.push('categoryId')
    }
    if (level) {
      data.level = level as Level
      if (level !== existing.level) changedFields.push('level')
    }
    if (status && ['DRAFT', 'PUBLISHED'].includes(status)) {
      data.status = status as Status
      if (status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        data.publishedAt = new Date()
      } else if (status === 'DRAFT') {
        data.publishedAt = null
      }
      if (status !== existing.status) changedFields.push('status')
    }

    if (audioFile) {
      try {
        const hlsAsset = await transcodeAudioFileToHls(audioId, audioFile.path)
        data.audioFile = `audio/${audioFile.filename}`
        data.audioFormat = getAudioFormat(audioFile.mimetype)
        data.audioSize = audioFile.size
        data.durationSec = await getAudioDuration(audioFile.path)
        data.streamingFormat = StreamingFormat.HLS
        data.processingStatus = AudioProcessingStatus.READY
        data.hlsManifestPath = hlsAsset.manifestPath
        data.processingError = null
        changedFields.push('audioFile')
        changedFields.push('delivery')
      } catch (error) {
        removeUploadedFile(audioFile)
        res.status(422).json({ error: (error as Error).message || 'Impossibile aggiornare lo streaming HLS' })
        return
      }
    }

    if (coverImageFile) {
      if (existing.coverImage) deleteFile(existing.coverImage)
      data.coverImage = `images/${coverImageFile.filename}`
      changedFields.push('coverImage')
    }

    data.audioTags = {
      deleteMany: {},
      create: tagIds.map(tagId => ({
        tag: { connect: { id: tagId } },
      })),
    }
    changedFields.push('tags')

    const audio = await prisma.audio.update({
      where: { id: audioId },
      data,
      include: {
        category: true,
        audioTags: {
          include: { tag: { select: { id: true, label: true, slug: true } } },
        },
      },
    })

    if (audioFile) {
      deleteFile(existing.audioFile)
    }

    await logAuditEventSafe({
      req,
      action: AuditAction.AUDIO_UPDATED,
      entityType: AuditEntityType.AUDIO,
      entityId: audio.id,
      entityLabel: audio.title,
      ...getAuditActorFromRequest(req),
      metadata: {
        changedFields,
        previousStatus: existing.status,
        nextStatus: audio.status,
        tagIds,
      },
    })

    res.json(audio)
  }
)

// DELETE /api/admin/audio/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const audioId = getSingleString(req.params.id)
  if (!audioId) {
    res.status(400).json({ error: 'ID audio non valido' })
    return
  }

  const audio = await prisma.audio.findUnique({ where: { id: audioId } })
  if (!audio) {
    res.status(404).json({ error: 'Audio non trovato' })
    return
  }

  deleteFile(audio.audioFile)
  if (audio.hlsManifestPath) {
    deleteDirectory(getHlsDirectoryPath(audio.id))
  }
  if (audio.coverImage) deleteFile(audio.coverImage)

  await prisma.audio.delete({ where: { id: audioId } })

  await logAuditEventSafe({
    req,
    action: AuditAction.AUDIO_DELETED,
    entityType: AuditEntityType.AUDIO,
    entityId: audio.id,
    entityLabel: audio.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      status: audio.status,
      categoryId: audio.categoryId,
    },
  })

  res.json({ message: 'Audio eliminato' })
})

// PATCH /api/admin/audio/:id/status
router.patch('/:id/status', statusValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const audioId = getSingleString(req.params.id)
  const status = getSingleString(req.body.status)
  if (!audioId || !status) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const audio = await prisma.audio.update({
    where: { id: audioId },
    data: {
      status: status as Status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
    include: { category: true },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.AUDIO_STATUS_CHANGED,
    entityType: AuditEntityType.AUDIO,
    entityId: audio.id,
    entityLabel: audio.title,
    ...getAuditActorFromRequest(req),
    metadata: {
      nextStatus: audio.status,
    },
  })

  res.json(audio)
})

export default router
