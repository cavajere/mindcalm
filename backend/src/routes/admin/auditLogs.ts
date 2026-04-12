import { AuditAction, AuditEntityType, AuditOutcome, Prisma, UserRole } from '@prisma/client'
import { Router, Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { getSingleString } from '../../utils/request'
import { auditLogFilterQuery } from '../../utils/validators'

const router = Router()

router.use(adminAuthMiddleware, requireAdmin)

function buildDateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined

  const range: Prisma.DateTimeFilter = {}
  if (dateFrom) {
    range.gte = new Date(dateFrom)
  }

  if (dateTo) {
    const endDate = new Date(dateTo)
    endDate.setHours(23, 59, 59, 999)
    range.lte = endDate
  }

  return range
}

router.get('/', auditLogFilterQuery, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Parametri non validi', details: errors.array() })
    return
  }

  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 20
  const skip = (page - 1) * limit

  const action = getSingleString(req.query.action) as AuditAction | undefined
  const entityType = getSingleString(req.query.entityType) as AuditEntityType | undefined
  const actorRole = getSingleString(req.query.actorRole) as UserRole | undefined
  const actorUserId = getSingleString(req.query.actorUserId)
  const outcome = getSingleString(req.query.outcome) as AuditOutcome | undefined
  const search = getSingleString(req.query.search)?.trim()
  const occurredAt = buildDateRange(
    getSingleString(req.query.dateFrom),
    getSingleString(req.query.dateTo),
  )

  const where: Prisma.AuditLogWhereInput = {
    action,
    entityType,
    actorRole,
    actorUserId,
    outcome,
    occurredAt,
  }

  if (search) {
    where.OR = [
      { actorEmail: { contains: search, mode: 'insensitive' } },
      { actorName: { contains: search, mode: 'insensitive' } },
      { entityLabel: { contains: search, mode: 'insensitive' } },
      { requestPath: { contains: search, mode: 'insensitive' } },
      { ipAddress: { contains: search, mode: 'insensitive' } },
      { userAgent: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [logs, total, failureCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({
      where: {
        ...where,
        outcome: AuditOutcome.FAILURE,
      },
    }),
  ])

  res.json({
    data: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      entityLabel: log.entityLabel,
      outcome: log.outcome,
      occurredAt: log.occurredAt,
      actor: {
        userId: log.actorUserId,
        email: log.actorEmail,
        name: log.actorName,
        role: log.actorRole,
      },
      request: {
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        path: log.requestPath,
        method: log.requestMethod,
        requestId: log.requestId,
      },
      metadata: log.metadata,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      total,
      failures: failureCount,
      successes: total - failureCount,
    },
    filters: {
      actions: Object.values(AuditAction),
      entityTypes: Object.values(AuditEntityType),
      outcomes: Object.values(AuditOutcome),
      actorRoles: Object.values(UserRole),
    },
  })
})

export default router
