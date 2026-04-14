import { Request, Response } from 'express'
import { AuditAction, AuditEntityType, AuditOutcome } from '@prisma/client'
import { validationResult } from 'express-validator'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { subscriptionTranslationValidation } from '../../utils/validators'
import { getSingleString } from '../../utils/request'
import {
  createTermsDraftVersion,
  getOrCreateTermsPolicy,
  publishTermsVersion,
  upsertTermsTranslations,
} from '../../services/termsService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = createAsyncRouter()
router.use(adminAuthMiddleware, requireAdmin)

router.get('/mine', async (_req: Request, res: Response) => {
  const policy = await getOrCreateTermsPolicy()
  res.json(policy)
})

router.post('/:id/versions', async (req: Request, res: Response) => {
  const id = getSingleString(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID termini non valido' })

  const version = await createTermsDraftVersion(id)
  res.status(201).json(version)
})

router.put('/:id/versions/:versionId/translations', subscriptionTranslationValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Payload non valido', details: errors.array() })

  const versionId = getSingleString(req.params.versionId)
  if (!versionId) return res.status(400).json({ error: 'versionId non valido' })

  const translations = Array.isArray(req.body.translations) ? req.body.translations : []
  const result = await upsertTermsTranslations(versionId, translations)
  res.json(result)
})

router.post('/:id/versions/:versionId/publish', async (req: Request, res: Response) => {
  const id = getSingleString(req.params.id)
  const versionId = getSingleString(req.params.versionId)
  if (!id || !versionId) return res.status(400).json({ error: 'Parametri non validi' })

  try {
    const result = await publishTermsVersion(id, versionId)

    await logAuditEventSafe({
      req,
      action: AuditAction.TERMS_POLICY_PUBLISHED,
      entityType: AuditEntityType.TERMS_POLICY,
      entityId: id,
      entityLabel: `Terms ${id}`,
      ...getAuditActorFromRequest(req),
      metadata: { versionId },
    })

    res.json(result)
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.TERMS_POLICY_PUBLISHED,
      entityType: AuditEntityType.TERMS_POLICY,
      entityId: id,
      entityLabel: `Terms ${id}`,
      outcome: AuditOutcome.FAILURE,
      ...getAuditActorFromRequest(req),
      metadata: { versionId, error: (error as Error).message },
    })

    res.status(400).json({ error: (error as Error).message })
  }
})

export default router
