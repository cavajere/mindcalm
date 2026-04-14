import { Request, Response } from 'express'
import { ConsentValue } from '@prisma/client'
import { validationResult } from 'express-validator'
import { createAsyncRouter } from '../../utils/asyncRouter'
import {
  publicSubscribeValidation,
  publicUnsubscribeValidation,
} from '../../utils/validators'
import {
  confirmSubscription,
  getPublicConsentFormulas,
  getUnsubscribePreferences,
  subscribePublic,
  unsubscribeWithToken,
} from '../../services/subscriptionService'
import { getPublicTermsPolicy } from '../../services/termsService'
import sanitizeHtml from 'sanitize-html'

const router = createAsyncRouter()

function getLegalDocumentHtml(html: string) {
  return sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt'],
    },
  })
}

function getRequestOrigin(req: Request) {
  return `${req.protocol}://${req.get('host')}`
}

router.get('/consent-formulas', async (req: Request, res: Response) => {
  const lang = typeof req.query.lang === 'string' ? req.query.lang : 'it'
  const result = await getPublicConsentFormulas(lang)
  if (!result) {
    res.status(404).json({ error: 'CONSENT_POLICY_NOT_PUBLISHED' })
    return
  }

  res.json(result)
})

router.get('/legal-documents', async (req: Request, res: Response) => {
  const lang = typeof req.query.lang === 'string' ? req.query.lang : 'it'
  const [privacyPolicy, termsPolicy] = await Promise.all([
    getPublicConsentFormulas(lang),
    getPublicTermsPolicy(lang),
  ])
  const origin = getRequestOrigin(req)

  res.json({
    privacy: privacyPolicy?.currentVersion
      ? {
          versionId: privacyPolicy.currentVersion.id,
          title: privacyPolicy.currentVersion.translations[0]?.title || 'Informativa privacy',
          publishedAt: privacyPolicy.currentVersion.publishedAt,
          url: `${origin}/public-api/privacy?lang=${encodeURIComponent(lang)}`,
        }
      : null,
    terms: termsPolicy?.currentVersion
      ? {
          versionId: termsPolicy.currentVersion.id,
          title: termsPolicy.currentVersion.translations[0]?.title || 'Termini e condizioni',
          publishedAt: termsPolicy.currentVersion.publishedAt,
          url: `${origin}/public-api/terms?lang=${encodeURIComponent(lang)}`,
          requiredForRegistration: true,
        }
      : null,
  })
})

router.get('/privacy', async (req: Request, res: Response) => {
  const lang = typeof req.query.lang === 'string' ? req.query.lang : 'it'
  const policy = await getPublicConsentFormulas(lang)

  if (!policy?.currentVersion) {
    res.status(404).send('Informativa non disponibile')
    return
  }

  const translation = policy.currentVersion.translations[0]
  const html = getLegalDocumentHtml(translation?.html || '')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Privacy MindCalm</title></head><body><main><h1>${translation?.title || 'Informativa privacy'}</h1>${html}</main></body></html>`)
})

router.get('/terms', async (req: Request, res: Response) => {
  const lang = typeof req.query.lang === 'string' ? req.query.lang : 'it'
  const policy = await getPublicTermsPolicy(lang)

  if (!policy?.currentVersion) {
    res.status(404).send('Termini non disponibili')
    return
  }

  const translation = policy.currentVersion.translations[0]
  const html = getLegalDocumentHtml(translation?.html || '')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Termini MindCalm</title></head><body><main><h1>${translation?.title || 'Termini e condizioni'}</h1>${html}</main></body></html>`)
})

router.post('/subscribe', publicSubscribeValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Payload non valido', details: errors.array() })
    return
  }

  const consents = Array.isArray(req.body.consents) ? req.body.consents.map((entry: any) => ({
    formulaId: String(entry.formulaId),
    value: entry.value === 'YES' ? ConsentValue.YES : ConsentValue.NO,
  })) : []

  try {
    const result = await subscribePublic({
      email: String(req.body.email),
      consents,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    })

    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

router.get('/confirm-subscription', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) return res.status(400).json({ error: 'Token mancante' })

  try {
    await confirmSubscription(token)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

router.get('/unsubscribe', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) return res.status(400).json({ error: 'Token mancante' })

  try {
    const preferences = await getUnsubscribePreferences(token)
    res.json(preferences)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

router.post('/unsubscribe', publicUnsubscribeValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Payload non valido', details: errors.array() })
    return
  }

  try {
    const result = await unsubscribeWithToken(String(req.body.token), {
      revokeAll: Boolean(req.body.revokeAll),
      updates: Array.isArray(req.body.updates) ? req.body.updates.map((update: any) => ({ formulaId: String(update.formulaId), keep: Boolean(update.keep) })) : [],
      reason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
    })

    res.json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
})

export default router
