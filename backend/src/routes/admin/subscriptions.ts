import { Request, Response } from 'express'
import { AuditAction, AuditEntityType, AuditOutcome, CampaignMatchMode } from '@prisma/client'
import { validationResult } from 'express-validator'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import {
  campaignSendValidation,
  consentFormulaCreateValidation,
  subscriptionTranslationValidation,
  formulaTranslationValidation,
} from '../../utils/validators'
import { getSingleString } from '../../utils/request'
import {
  createConsentFormula,
  createDraftVersion,
  createUnsubscribeTokenForContact,
  deleteConsentFormula,
  getOrCreateSubscriptionPolicy,
  previewCampaignAudience,
  publishPolicyVersion,
  sendCampaign,
  updateConsentFormula,
  upsertFormulaTranslations,
  upsertPolicyTranslations,
} from '../../services/subscriptionService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = createAsyncRouter()
router.use(adminAuthMiddleware, requireAdmin)

router.get('/mine', async (_req: Request, res: Response) => {
  const policy = await getOrCreateSubscriptionPolicy()
  res.json(policy)
})

router.post('/:id/versions', async (req: Request, res: Response) => {
  const id = getSingleString(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID informativa non valido' })

  const version = await createDraftVersion(id)
  res.status(201).json(version)
})

router.put('/:id/versions/:versionId/translations', subscriptionTranslationValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Payload non valido', details: errors.array() })

  const versionId = getSingleString(req.params.versionId)
  if (!versionId) return res.status(400).json({ error: 'versionId non valido' })

  const translations = Array.isArray(req.body.translations) ? req.body.translations : []
  const result = await upsertPolicyTranslations(versionId, translations)
  res.json(result)
})

router.put('/formulas/:formulaVersionId/translations', formulaTranslationValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Payload non valido', details: errors.array() })

  const formulaVersionId = getSingleString(req.params.formulaVersionId)
  if (!formulaVersionId) return res.status(400).json({ error: 'formulaVersionId non valido' })

  const translations = Array.isArray(req.body.translations) ? req.body.translations : []
  const result = await upsertFormulaTranslations(formulaVersionId, translations)
  res.json(result)
})

router.post('/:id/versions/:versionId/publish', async (req: Request, res: Response) => {
  const id = getSingleString(req.params.id)
  const versionId = getSingleString(req.params.versionId)
  if (!id || !versionId) return res.status(400).json({ error: 'Parametri non validi' })

  try {
    const result = await publishPolicyVersion(id, versionId)

    await logAuditEventSafe({
      req,
      action: AuditAction.CONSENT_POLICY_PUBLISHED,
      entityType: AuditEntityType.SUBSCRIPTION_POLICY,
      entityId: id,
      entityLabel: `Policy ${id}`,
      ...getAuditActorFromRequest(req),
      metadata: { versionId },
    })

    res.json(result)
  } catch (error) {
    await logAuditEventSafe({
      req,
      action: AuditAction.CONSENT_POLICY_PUBLISHED,
      entityType: AuditEntityType.SUBSCRIPTION_POLICY,
      entityId: id,
      entityLabel: `Policy ${id}`,
      outcome: AuditOutcome.FAILURE,
      ...getAuditActorFromRequest(req),
      metadata: { versionId, error: (error as Error).message },
    })

    res.status(400).json({ error: (error as Error).message })
  }
})

router.post('/:id/formulas', consentFormulaCreateValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Payload non valido', details: errors.array() })

  const id = getSingleString(req.params.id)
  if (!id) return res.status(400).json({ error: 'ID informativa non valido' })

  const code = String(req.body.code || '').trim()
  const required = Boolean(req.body.required)
  const formula = await createConsentFormula(id, code, required)

  await logAuditEventSafe({
    req,
    action: AuditAction.CONSENT_FORMULA_CREATED,
    entityType: AuditEntityType.CONSENT_FORMULA,
    entityId: formula.id,
    entityLabel: formula.code,
    ...getAuditActorFromRequest(req),
  })

  res.status(201).json(formula)
})

router.put('/:id/formulas/:formulaId', async (req: Request, res: Response) => {
  const formulaId = getSingleString(req.params.formulaId)
  if (!formulaId) return res.status(400).json({ error: 'formulaId non valido' })

  const required = Boolean(req.body.required)
  const formula = await updateConsentFormula(formulaId, required)

  await logAuditEventSafe({
    req,
    action: AuditAction.CONSENT_FORMULA_UPDATED,
    entityType: AuditEntityType.CONSENT_FORMULA,
    entityId: formula.id,
    entityLabel: formula.code,
    ...getAuditActorFromRequest(req),
  })

  res.json(formula)
})

router.delete('/:id/formulas/:formulaId', async (req: Request, res: Response) => {
  const formulaId = getSingleString(req.params.formulaId)
  if (!formulaId) return res.status(400).json({ error: 'formulaId non valido' })

  const formula = await deleteConsentFormula(formulaId)
  await logAuditEventSafe({
    req,
    action: AuditAction.CONSENT_FORMULA_DELETED,
    entityType: AuditEntityType.CONSENT_FORMULA,
    entityId: formula.id,
    entityLabel: formula.code,
    ...getAuditActorFromRequest(req),
  })

  res.status(204).end()
})

router.get('/contacts/:contactId/unsubscribe-token', async (req: Request, res: Response) => {
  const contactId = getSingleString(req.params.contactId)
  if (!contactId) return res.status(400).json({ error: 'contactId non valido' })

  const token = await createUnsubscribeTokenForContact(contactId)
  res.json({ token })
})

router.post('/campaigns/audience-preview', async (req: Request, res: Response) => {
  const filters = Array.isArray(req.body.filters) ? req.body.filters : []
  const matchMode = req.body.matchMode === 'ANY' ? CampaignMatchMode.ANY : CampaignMatchMode.ALL
  const contacts = await previewCampaignAudience(filters, matchMode)
  res.json({ total: contacts.length, contacts })
})

router.post('/campaigns/send', campaignSendValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Payload non valido', details: errors.array() })

  const filters = Array.isArray(req.body.filters) ? req.body.filters : []
  const matchMode = req.body.matchMode === 'ANY' ? CampaignMatchMode.ANY : CampaignMatchMode.ALL

  const result = await sendCampaign({
    name: String(req.body.name),
    subject: String(req.body.subject),
    htmlBody: String(req.body.htmlBody),
    filters,
    matchMode,
    createdByUserId: req.adminUser?.id,
  })

  await logAuditEventSafe({
    req,
    action: AuditAction.CAMPAIGN_SENT,
    entityType: AuditEntityType.CAMPAIGN,
    entityId: result.campaign.id,
    entityLabel: result.campaign.name,
    ...getAuditActorFromRequest(req),
    metadata: { recipientsCount: result.recipientsCount },
  })

  res.status(201).json(result)
})

export default router
