import { Request, Response } from 'express'
import { AuditAction, AuditEntityType, CampaignMatchMode } from '@prisma/client'
import { validationResult } from 'express-validator'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import { campaignSendValidation } from '../../utils/validators'
import { previewCampaignAudience, sendCampaign } from '../../services/subscriptionService'
import { getAuditActorFromRequest, logAuditEventSafe } from '../../services/auditLogService'

const router = createAsyncRouter()
router.use(adminAuthMiddleware, requireAdmin)

router.get('/audience-options', async (_req: Request, res: Response) => {
  res.json({
    matchModes: ['ALL', 'ANY'],
  })
})

router.post('/audience-preview', async (req: Request, res: Response) => {
  const filters = Array.isArray(req.body.filters) ? req.body.filters : []
  const matchMode = req.body.matchMode === 'ANY' ? CampaignMatchMode.ANY : CampaignMatchMode.ALL
  const contacts = await previewCampaignAudience(filters, matchMode)
  res.json({ total: contacts.length, contacts })
})

router.post('/send', campaignSendValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Payload non valido', details: errors.array() })
    return
  }

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
    metadata: {
      recipientsCount: result.recipientsCount,
      matchMode,
    },
  })

  res.status(201).json(result)
})

export default router
