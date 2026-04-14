import { Request, Response } from 'express'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { AuditAction, AuditEntityType } from '@prisma/client'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { tagValidation } from '../../utils/validators'
import { prisma } from '../../lib/prisma'
import { getBoolean, getNumber, getSingleString } from '../../utils/request'
import {
  createTagSlug,
  ensureUniqueTag,
  normalizeTagAliases,
  normalizeTagLabel,
} from '../../services/tagService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = createAsyncRouter()

router.use(adminAuthMiddleware, requireAdmin)

router.get('/', async (req: Request, res: Response) => {
  const search = getSingleString(req.query.search)?.trim()

  const tags = await prisma.tag.findMany({
    where: search
      ? {
          OR: [
            { label: { contains: search, mode: 'insensitive' } },
            { aliases: { some: { alias: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : undefined,
    include: {
      aliases: { orderBy: { alias: 'asc' } },
      _count: { select: { audioTags: true, thoughtTags: true } },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { label: 'asc' },
    ],
  })

  res.json(tags.map(tag => ({
    id: tag.id,
    label: tag.label,
    slug: tag.slug,
    description: tag.description,
    isActive: tag.isActive,
    sortOrder: tag.sortOrder,
    aliases: tag.aliases.map(alias => alias.alias),
    audioCount: tag._count.audioTags,
    thoughtCount: tag._count.thoughtTags,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  })))
})

router.post('/', tagValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const rawLabel = getSingleString(req.body.label)
  if (!rawLabel) {
    res.status(400).json({ error: 'Nome tag obbligatorio' })
    return
  }

  const label = normalizeTagLabel(rawLabel)
  const aliases = normalizeTagAliases(req.body.aliases)
  const description = getSingleString(req.body.description)?.trim() || null
  const isActive = getBoolean(req.body.isActive) ?? true
  const sortOrder = getNumber(req.body.sortOrder) ?? 0

  try {
    await ensureUniqueTag(label)
  } catch (error) {
    res.status(409).json({ error: (error as Error).message })
    return
  }

  const tag = await prisma.tag.create({
    data: {
      label,
      slug: createTagSlug(label),
      description,
      isActive,
      sortOrder,
      aliases: {
        create: aliases.map(alias => ({ alias })),
      },
    },
    include: {
      aliases: { orderBy: { alias: 'asc' } },
      _count: { select: { audioTags: true, thoughtTags: true } },
    },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.TAG_CREATED,
    entityType: AuditEntityType.TAG,
    entityId: tag.id,
    entityLabel: tag.label,
    ...getAuditActorFromRequest(req),
    metadata: {
      slug: tag.slug,
      isActive: tag.isActive,
      aliasCount: tag.aliases.length,
    },
  })

  res.status(201).json({
    id: tag.id,
    label: tag.label,
    slug: tag.slug,
    description: tag.description,
    isActive: tag.isActive,
    sortOrder: tag.sortOrder,
    aliases: tag.aliases.map(alias => alias.alias),
    audioCount: tag._count.audioTags,
    thoughtCount: tag._count.thoughtTags,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  })
})

router.put('/:id', tagValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const tagId = getSingleString(req.params.id)
  if (!tagId) {
    res.status(400).json({ error: 'ID tag non valido' })
    return
  }

  const existing = await prisma.tag.findUnique({
    where: { id: tagId },
    include: { aliases: true },
  })

  if (!existing) {
    res.status(404).json({ error: 'Tag non trovato' })
    return
  }

  const rawLabel = getSingleString(req.body.label)
  if (!rawLabel) {
    res.status(400).json({ error: 'Nome tag obbligatorio' })
    return
  }

  const label = normalizeTagLabel(rawLabel)
  const aliases = normalizeTagAliases(req.body.aliases)
  const description = getSingleString(req.body.description)?.trim() || null
  const isActive = getBoolean(req.body.isActive) ?? existing.isActive
  const sortOrder = getNumber(req.body.sortOrder) ?? existing.sortOrder

  try {
    await ensureUniqueTag(label, tagId)
  } catch (error) {
    res.status(409).json({ error: (error as Error).message })
    return
  }

  const tag = await prisma.tag.update({
    where: { id: tagId },
    data: {
      label,
      slug: createTagSlug(label),
      description,
      isActive,
      sortOrder,
      aliases: {
        deleteMany: {},
        create: aliases.map(alias => ({ alias })),
      },
    },
    include: {
      aliases: { orderBy: { alias: 'asc' } },
      _count: { select: { audioTags: true, thoughtTags: true } },
    },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.TAG_UPDATED,
    entityType: AuditEntityType.TAG,
    entityId: tag.id,
    entityLabel: tag.label,
    ...getAuditActorFromRequest(req),
    metadata: {
      previousLabel: existing.label,
      previousSlug: existing.slug,
      aliasCount: tag.aliases.length,
      isActive: tag.isActive,
    },
  })

  res.json({
    id: tag.id,
    label: tag.label,
    slug: tag.slug,
    description: tag.description,
    isActive: tag.isActive,
    sortOrder: tag.sortOrder,
    aliases: tag.aliases.map(alias => alias.alias),
    audioCount: tag._count.audioTags,
    thoughtCount: tag._count.thoughtTags,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  })
})

router.patch('/:id/status', async (req: Request, res: Response) => {
  const tagId = getSingleString(req.params.id)
  const isActive = getBoolean(req.body.isActive)

  if (!tagId || typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const existing = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!existing) {
    res.status(404).json({ error: 'Tag non trovato' })
    return
  }

  const tag = await prisma.tag.update({
    where: { id: tagId },
    data: { isActive },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.TAG_STATUS_CHANGED,
    entityType: AuditEntityType.TAG,
    entityId: tag.id,
    entityLabel: tag.label,
    ...getAuditActorFromRequest(req),
    metadata: {
      isActive: tag.isActive,
    },
  })

  res.json(tag)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const tagId = getSingleString(req.params.id)
  if (!tagId) {
    res.status(400).json({ error: 'ID tag non valido' })
    return
  }

  const tag = await prisma.tag.findUnique({ where: { id: tagId } })
  if (!tag) {
    res.status(404).json({ error: 'Tag non trovato' })
    return
  }

  await prisma.tag.delete({ where: { id: tagId } })

  await logAuditEventSafe({
    req,
    action: AuditAction.TAG_DELETED,
    entityType: AuditEntityType.TAG,
    entityId: tag.id,
    entityLabel: tag.label,
    ...getAuditActorFromRequest(req),
    metadata: {
      slug: tag.slug,
      isActive: tag.isActive,
    },
  })

  res.json({ message: 'Tag eliminato' })
})

export default router
