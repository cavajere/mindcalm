import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType } from '@prisma/client'
import fs from 'fs'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { uploadImage } from '../../middleware/upload'
import { prisma } from '../../lib/prisma'
import { getSingleString } from '../../utils/request'
import { buildUploadMetadata } from '../../services/uploadMetadataService'
import {
  computeFileHash,
  deleteAlbumImageAsset,
  serializeAlbumImage,
} from '../../services/albumImageService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = createAsyncRouter()

router.use(adminAuthMiddleware, requireAdmin)

const albumImageInclude = {
  audioCoverFor: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  articleCoverFor: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
} as const

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (value === undefined) return undefined

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return null

  return normalized.slice(0, maxLength)
}

function removeUploadedFile(file?: Express.Multer.File) {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path)
  }
}

async function findAlbumImageOrNull(imageId: string) {
  return prisma.albumImage.findUnique({
    where: { id: imageId },
    include: albumImageInclude,
  })
}

router.get('/', async (_req: Request, res: Response) => {
  const images = await prisma.albumImage.findMany({
    include: albumImageInclude,
    orderBy: { createdAt: 'desc' },
  })

  res.json(images.map(serializeAlbumImage))
})

router.post(
  '/',
  uploadImage.single('image'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Immagine obbligatoria' })
      return
    }

    const fileHash = computeFileHash(req.file.path)
    const duplicate = await prisma.albumImage.findUnique({
      where: { fileHash },
      include: albumImageInclude,
    })

    if (duplicate) {
      removeUploadedFile(req.file)
      res.status(409).json({
        error: 'Immagine gia presente nell\'album',
        image: serializeAlbumImage(duplicate),
      })
      return
    }

    try {
      const uploadNames = buildUploadMetadata(req.file, getSingleString(req.body.displayName))
      const created = await prisma.albumImage.create({
        data: {
          filePath: `images/${req.file.filename}`,
          originalName: uploadNames.originalName,
          displayName: uploadNames.displayName,
          title: normalizeOptionalText(getSingleString(req.body.title), 180) ?? null,
          description: normalizeOptionalText(getSingleString(req.body.description), 1000) ?? null,
          mimeType: req.file.mimetype,
          size: req.file.size,
          fileHash,
        },
        include: albumImageInclude,
      })

      await logAuditEventSafe({
        req,
        action: AuditAction.ALBUM_IMAGE_CREATED,
        entityType: AuditEntityType.ALBUM_IMAGE,
        entityId: created.id,
        entityLabel: created.title ?? created.displayName,
        ...getAuditActorFromRequest(req),
        metadata: {
          displayName: created.displayName,
          size: created.size,
        },
      })

      res.status(201).json(serializeAlbumImage(created))
    } catch (error) {
      removeUploadedFile(req.file)
      throw error
    }
  },
)

router.post(
  '/bulk',
  uploadImage.array('images', 30),
  async (req: Request, res: Response) => {
    const files = Array.isArray(req.files) ? req.files : []
    if (!files.length) {
      res.status(400).json({ error: 'Nessuna immagine selezionata' })
      return
    }

    const fileHashes = files.map((file) => computeFileHash(file.path))
    const existingImages = await prisma.albumImage.findMany({
      where: {
        fileHash: { in: fileHashes },
      },
      select: {
        fileHash: true,
        displayName: true,
      },
    })

    const existingByHash = new Map(existingImages.map((image) => [image.fileHash, image]))
    const seenInBatch = new Set<string>()
    const results: Array<Record<string, unknown>> = []

    for (const [index, file] of files.entries()) {
      const fileHash = fileHashes[index]
      const duplicate = existingByHash.get(fileHash)

      if (duplicate || seenInBatch.has(fileHash)) {
        removeUploadedFile(file)
        results.push({
          filename: file.originalname,
          status: 'duplicate',
          existingFilename: duplicate?.displayName ?? null,
        })
        continue
      }

      seenInBatch.add(fileHash)

      try {
        const uploadNames = buildUploadMetadata(file)
        const created = await prisma.albumImage.create({
          data: {
            filePath: `images/${file.filename}`,
            originalName: uploadNames.originalName,
            displayName: uploadNames.displayName,
            mimeType: file.mimetype,
            size: file.size,
            fileHash,
          },
          include: albumImageInclude,
        })

        await logAuditEventSafe({
          req,
          action: AuditAction.ALBUM_IMAGE_CREATED,
          entityType: AuditEntityType.ALBUM_IMAGE,
          entityId: created.id,
          entityLabel: created.displayName,
          ...getAuditActorFromRequest(req),
          metadata: {
            displayName: created.displayName,
            size: created.size,
          },
        })

        results.push({
          filename: file.originalname,
          status: 'created',
          image: serializeAlbumImage(created),
        })
      } catch (error) {
        removeUploadedFile(file)
        throw error
      }
    }

    const hasDuplicates = results.some((result) => result.status === 'duplicate')
    res.status(hasDuplicates ? 207 : 201).json(results)
  },
)

router.put('/:id', async (req: Request, res: Response) => {
  const imageId = getSingleString(req.params.id)
  if (!imageId) {
    res.status(400).json({ error: 'ID immagine non valido' })
    return
  }

  const existing = await findAlbumImageOrNull(imageId)
  if (!existing) {
    res.status(404).json({ error: 'Immagine album non trovata' })
    return
  }

  const updated = await prisma.albumImage.update({
    where: { id: imageId },
    data: {
      title: normalizeOptionalText(getSingleString(req.body.title), 180) ?? null,
      description: normalizeOptionalText(getSingleString(req.body.description), 1000) ?? null,
    },
    include: albumImageInclude,
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.ALBUM_IMAGE_UPDATED,
    entityType: AuditEntityType.ALBUM_IMAGE,
    entityId: updated.id,
    entityLabel: updated.title ?? updated.displayName,
    ...getAuditActorFromRequest(req),
    metadata: {
      previousTitle: existing.title,
      nextTitle: updated.title,
    },
  })

  res.json(serializeAlbumImage(updated))
})

router.delete('/:id', async (req: Request, res: Response) => {
  const imageId = getSingleString(req.params.id)
  if (!imageId) {
    res.status(400).json({ error: 'ID immagine non valido' })
    return
  }

  const existing = await findAlbumImageOrNull(imageId)
  if (!existing) {
    res.status(404).json({ error: 'Immagine album non trovata' })
    return
  }

  const serialized = serializeAlbumImage(existing)
  if (serialized.inUse) {
    res.status(409).json({
      error: 'Immagine in uso',
      dependencies: serialized.dependencies,
    })
    return
  }

  await prisma.albumImage.delete({
    where: { id: imageId },
  })
  deleteAlbumImageAsset(existing)

  await logAuditEventSafe({
    req,
    action: AuditAction.ALBUM_IMAGE_DELETED,
    entityType: AuditEntityType.ALBUM_IMAGE,
    entityId: existing.id,
    entityLabel: existing.title ?? existing.displayName,
    ...getAuditActorFromRequest(req),
    metadata: {
      displayName: existing.displayName,
    },
  })

  res.json({ message: 'Immagine eliminata' })
})

export default router
