import { Router, Request, Response } from 'express'
import { AuditAction, AuditEntityType, AuditOutcome } from '@prisma/client'
import { validationResult } from 'express-validator'
import { authMiddleware, requireAdmin } from '../../middleware/auth'
import { paginationQuery, inviteCodeCreateValidation } from '../../utils/validators'
import { getNumber, getSingleString } from '../../utils/request'
import { createInviteCode, disableInviteCode, getInviteCodeById, listInviteCodes } from '../../services/inviteCodeService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = Router()

router.use(authMiddleware, requireAdmin)

router.get('/', paginationQuery, async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10) || 20, 1), 100)
  const search = getSingleString(req.query.search)
  const status = getSingleString(req.query.status)

  const result = await listInviteCodes({ page, limit, search, status })
  res.json(result)
})

router.get('/:id', async (req: Request, res: Response) => {
  const id = getSingleString(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'ID codice non valido' })
    return
  }

  try {
    const inviteCode = await getInviteCodeById(id)
    res.json(inviteCode)
  } catch (error) {
    res.status(404).json({ error: (error as Error).message })
  }
})

router.post('/', inviteCodeCreateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Dati non validi', details: errors.array() })
    return
  }

  const licenseDurationDays = getNumber(req.body.licenseDurationDays)
  const expiresAtInput = getSingleString(req.body.expiresAt)
  const notes = getSingleString(req.body.notes)?.trim() || null
  const expiresAt = expiresAtInput ? new Date(expiresAtInput) : null

  try {
    const inviteCode = await createInviteCode({
      licenseDurationDays: licenseDurationDays!,
      expiresAt,
      notes,
      createdByUserId: req.adminUser?.id ?? null,
    })

    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_CODE_CREATED,
      entityType: AuditEntityType.INVITE_CODE,
      entityId: inviteCode.id,
      entityLabel: inviteCode.code,
      ...getAuditActorFromRequest(req),
      metadata: {
        licenseDurationDays: inviteCode.licenseDurationDays,
        expiresAt: inviteCode.expiresAt,
        notes: inviteCode.notes || null,
      },
    })

    res.status(201).json(inviteCode)
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_CODE_CREATED,
      entityType: AuditEntityType.INVITE_CODE,
      entityLabel: 'Nuovo codice invito',
      outcome: AuditOutcome.FAILURE,
      ...getAuditActorFromRequest(req),
      metadata: {
        error: (error as Error).message,
        licenseDurationDays,
        expiresAt,
      },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

router.post('/:id/disable', async (req: Request, res: Response) => {
  const id = getSingleString(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'ID codice non valido' })
    return
  }

  try {
    const inviteCode = await disableInviteCode(id)
    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_CODE_DISABLED,
      entityType: AuditEntityType.INVITE_CODE,
      entityId: inviteCode.id,
      entityLabel: inviteCode.code,
      ...getAuditActorFromRequest(req),
    })
    res.json(inviteCode)
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.INVITE_CODE_DISABLED,
      entityType: AuditEntityType.INVITE_CODE,
      entityId: id,
      entityLabel: 'Codice invito',
      outcome: AuditOutcome.FAILURE,
      ...getAuditActorFromRequest(req),
      metadata: {
        error: (error as Error).message,
      },
    })
    res.status(400).json({ error: (error as Error).message })
  }
})

export default router
