import { Router, Request, Response } from 'express'
import { AuditAction, AuditEntityType } from '@prisma/client'
import { validationResult } from 'express-validator'
import { authMiddleware, requireAdmin } from '../../middleware/auth'
import { categoryValidation } from '../../utils/validators'
import { getSingleString, getStringArray } from '../../utils/request'
import { prisma } from '../../lib/prisma'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = Router()

router.use(authMiddleware, requireAdmin)

// GET /api/v1/admin/categories
router.get('/', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { audios: true } },
    },
  })

  res.json(categories.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    color: c.color,
    icon: c.icon,
    sortOrder: c.sortOrder,
    audioCount: c._count.audios,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })))
})

// POST /api/v1/admin/categories
router.post('/', categoryValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const name = getSingleString(req.body.name)
  const description = getSingleString(req.body.description)
  const color = getSingleString(req.body.color)
  const icon = getSingleString(req.body.icon)

  const category = await prisma.category.create({
    data: {
      name: name!,
      description: description || null,
      color: color || null,
      icon: icon || null,
      sortOrder: req.body.sortOrder || 0,
    },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.CATEGORY_CREATED,
    entityType: AuditEntityType.CATEGORY,
    entityId: category.id,
    entityLabel: category.name,
    ...getAuditActorFromRequest(req),
    metadata: {
      color: category.color,
      sortOrder: category.sortOrder,
    },
  })

  res.status(201).json(category)
})

// PUT /api/v1/admin/categories/:id
router.put('/:id', categoryValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const categoryId = getSingleString(req.params.id)
  if (!categoryId) {
    res.status(400).json({ error: 'ID categoria non valido' })
    return
  }

  const existing = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!existing) {
    res.status(404).json({ error: 'Categoria non trovata' })
    return
  }

  const name = getSingleString(req.body.name)
  const description = getSingleString(req.body.description)
  const color = getSingleString(req.body.color)
  const icon = getSingleString(req.body.icon)
  const changedFields = [
    name !== undefined && name !== existing.name ? 'name' : null,
    description !== undefined && description !== existing.description ? 'description' : null,
    color !== undefined && color !== existing.color ? 'color' : null,
    icon !== undefined && icon !== existing.icon ? 'icon' : null,
  ].filter((field): field is string => Boolean(field))
  const category = await prisma.category.update({
    where: { id: categoryId },
    data: {
      name: name!,
      description: description ?? existing.description,
      color: color ?? existing.color,
      icon: icon ?? existing.icon,
    },
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.CATEGORY_UPDATED,
    entityType: AuditEntityType.CATEGORY,
    entityId: category.id,
    entityLabel: category.name,
    ...getAuditActorFromRequest(req),
    metadata: {
      changedFields,
    },
  })

  res.json(category)
})

// DELETE /api/v1/admin/categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const categoryId = getSingleString(req.params.id)
  if (!categoryId) {
    res.status(400).json({ error: 'ID categoria non valido' })
    return
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { audios: true } } },
  })

  if (!category) {
    res.status(404).json({ error: 'Categoria non trovata' })
    return
  }

  if (category._count.audios > 0) {
    res.status(409).json({ error: 'Impossibile eliminare: la categoria ha audio associati' })
    return
  }

  await prisma.category.delete({ where: { id: categoryId } })

  await logAuditEventSafe({
    req,
    action: AuditAction.CATEGORY_DELETED,
    entityType: AuditEntityType.CATEGORY,
    entityId: category.id,
    entityLabel: category.name,
    ...getAuditActorFromRequest(req),
    metadata: {
      audioCount: category._count.audios,
    },
  })

  res.json({ message: 'Categoria eliminata' })
})

// PATCH /api/v1/admin/categories/order — riordina categorie
router.patch('/order', async (req: Request, res: Response) => {
  const ids = getStringArray(req.body.ids)

  if (!ids.length) {
    res.status(400).json({ error: 'ids deve essere un array di UUID' })
    return
  }

  const updates = ids.map((id: string, index: number) =>
    prisma.category.update({
      where: { id },
      data: { sortOrder: index + 1 },
    })
  )

  await prisma.$transaction(updates)

  await logAuditEventSafe({
    req,
    action: AuditAction.CATEGORY_ORDER_UPDATED,
    entityType: AuditEntityType.CATEGORY,
    entityLabel: 'Riordino categorie',
    ...getAuditActorFromRequest(req),
    metadata: {
      categoryIds: ids,
    },
  })

  res.json({ message: 'Ordine aggiornato' })
})

export default router
