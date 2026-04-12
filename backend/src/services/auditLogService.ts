import { AuditAction, AuditEntityType, AuditOutcome, Prisma, UserRole } from '@prisma/client'
import { Request } from 'express'
import { prisma } from '../lib/prisma'

type AuditMetadata = Prisma.InputJsonValue | undefined

interface AuditActorSnapshot {
  actorUserId?: string | null
  actorEmail?: string | null
  actorName?: string | null
  actorRole?: UserRole | null
}

interface AuditLogInput extends AuditActorSnapshot {
  req?: Request
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  entityLabel?: string | null
  outcome?: AuditOutcome
  metadata?: AuditMetadata
}

const SENSITIVE_KEY_PATTERN = /(pass(word)?|token|secret|authorization|cookie)/i

function normalizeIp(ipAddress?: string | string[] | null): string | null {
  if (!ipAddress) return null
  const raw = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress
  if (!raw) return null

  const forwardedIp = raw.split(',')[0]?.trim()
  if (!forwardedIp) return null

  return forwardedIp.replace(/^::ffff:/, '')
}

function sanitizeAuditMetadata(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) {
    return undefined
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (depth >= 4) {
    return '[truncated]'
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeAuditMetadata(entry, depth + 1))
      .filter((entry): entry is Prisma.InputJsonValue => entry !== undefined)
  }

  if (typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, Prisma.InputJsonValue> = {}

    Object.entries(input).forEach(([key, entry]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return
      }

      const sanitized = sanitizeAuditMetadata(entry, depth + 1)
      if (sanitized !== undefined) {
        output[key] = sanitized
      }
    })

    return output
  }

  return String(value)
}

export function getAuditActorFromRequest(req: Request): AuditActorSnapshot {
  return {
    actorUserId: req.adminUser?.id ?? null,
    actorEmail: req.adminUser?.email ?? null,
    actorName: req.adminUser?.name ?? null,
    actorRole: req.adminUser?.role ?? null,
  }
}

export async function logAuditEvent({
  req,
  action,
  entityType,
  entityId,
  entityLabel,
  outcome = AuditOutcome.SUCCESS,
  metadata,
  actorUserId,
  actorEmail,
  actorName,
  actorRole,
}: AuditLogInput) {
  const requestIdHeader = req?.headers['x-request-id']
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader

  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId: entityId ?? null,
      entityLabel: entityLabel ?? null,
      outcome,
      actorUserId: actorUserId ?? req?.adminUser?.id ?? null,
      actorEmail: actorEmail ?? req?.adminUser?.email ?? null,
      actorName: actorName ?? req?.adminUser?.name ?? null,
      actorRole: actorRole ?? req?.adminUser?.role ?? null,
      ipAddress: normalizeIp(req?.headers['x-forwarded-for'] ?? req?.ip ?? req?.socket.remoteAddress ?? null),
      userAgent: req?.headers['user-agent'] ?? null,
      requestPath: req?.originalUrl ?? null,
      requestMethod: req?.method ?? null,
      requestId: requestId ?? null,
      metadata: sanitizeAuditMetadata(metadata),
    },
  })
}

export async function logAuditEventSafe(input: AuditLogInput) {
  try {
    await logAuditEvent(input)
  } catch (error) {
    console.error('[MindCalm] Audit log non registrato', error)
  }
}
