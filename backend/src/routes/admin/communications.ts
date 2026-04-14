import { ConsentRecordStatus, ConsentValue } from '@prisma/client'
import { Request, Response } from 'express'
import { adminAuthMiddleware, requireAdmin } from '../../middleware/auth'
import {
  createCommunicationSuppression,
  deleteCommunicationContact,
  getCommunicationConsentStats,
  getCommunicationContactDetail,
  listCommunicationConsents,
  listCommunicationContacts,
  listCommunicationSuppressions,
  lookupCommunicationContactByEmail,
  removeCommunicationSuppression,
  updateCommunicationContactConsent,
  upsertCommunicationContact,
} from '../../services/communicationAdminService'
import { createAsyncRouter } from '../../utils/asyncRouter'
import { getSingleString } from '../../utils/request'

const router = createAsyncRouter()

router.use(adminAuthMiddleware, requireAdmin)

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeConsentValue(value: string | undefined) {
  return value === 'YES' || value === 'NO' ? value : null
}

function normalizeConsentStatus(value: string | undefined) {
  return value === 'REGISTERED' || value === 'CONFIRMED' ? value : null
}

type CommunicationConsentInput = {
  formulaId: string
  value: ConsentValue
}

router.get('/contacts', async (req: Request, res: Response) => {
  const data = await listCommunicationContacts({
    page: parsePositiveInteger(getSingleString(req.query.page), 1),
    limit: parsePositiveInteger(getSingleString(req.query.limit), 25),
    search: getSingleString(req.query.search) ?? undefined,
  })

  res.json(data)
})

router.get('/contacts/lookup', async (req: Request, res: Response) => {
  const email = getSingleString(req.query.email)
  if (!email) {
    res.status(400).json({ error: 'Email obbligatoria' })
    return
  }

  const result = await lookupCommunicationContactByEmail(email)
  res.json(result)
})

router.post('/contacts', async (req: Request, res: Response) => {
  const email = String(req.body.email ?? '').trim()
  const consents = Array.isArray(req.body.consents) ? req.body.consents : []

  if (!email) {
    res.status(400).json({ error: 'Email obbligatoria' })
    return
  }

  if (!consents.length) {
    res.status(400).json({ error: 'Consensi obbligatori' })
    return
  }

  const result = await upsertCommunicationContact({
    email,
    consents: consents.map((consent: any): CommunicationConsentInput => ({
      formulaId: String(consent.formulaId),
      value: String(consent.value) as ConsentValue,
    })),
    adminUserId: req.adminUser?.id,
  })

  res.status(201).json(result)
})

router.get('/contacts/:contactId', async (req: Request, res: Response) => {
  const contactId = getSingleString(req.params.contactId)
  if (!contactId) {
    res.status(400).json({ error: 'contactId non valido' })
    return
  }

  try {
    const detail = await getCommunicationContactDetail(contactId)
    res.json(detail)
  } catch (error) {
    if ((error as Error).message === 'CONTACT_NOT_FOUND') {
      res.status(404).json({ error: 'Contatto non trovato' })
      return
    }

    throw error
  }
})

router.put('/contacts/:contactId/consents', async (req: Request, res: Response) => {
  const contactId = getSingleString(req.params.contactId)
  const formulaId = String(req.body.formulaId ?? '').trim()
  const value = normalizeConsentValue(String(req.body.value ?? '').trim())

  if (!contactId) {
    res.status(400).json({ error: 'contactId non valido' })
    return
  }

  if (!formulaId || !value) {
    res.status(400).json({ error: 'Formula e valore sono obbligatori' })
    return
  }

  try {
    const result = await updateCommunicationContactConsent({
      contactId,
      formulaId,
      value,
    })

    res.json(result)
  } catch (error) {
    if ((error as Error).message === 'CONTACT_NOT_FOUND') {
      res.status(404).json({ error: 'Contatto non trovato' })
      return
    }

    if ((error as Error).message === 'CONSENT_FORMULA_NOT_FOUND') {
      res.status(404).json({ error: 'Formula consenso non trovata' })
      return
    }

    throw error
  }
})

router.delete('/contacts/:contactId', async (req: Request, res: Response) => {
  const contactId = getSingleString(req.params.contactId)
  if (!contactId) {
    res.status(400).json({ error: 'contactId non valido' })
    return
  }

  await deleteCommunicationContact(contactId)
  res.status(204).end()
})

router.get('/consents/stats', async (_req: Request, res: Response) => {
  const data = await getCommunicationConsentStats()
  res.json(data)
})

router.get('/consents', async (req: Request, res: Response) => {
  const value = normalizeConsentValue(getSingleString(req.query.value) ?? undefined)
  const status = normalizeConsentStatus(getSingleString(req.query.status) ?? undefined)

  const data = await listCommunicationConsents({
    page: parsePositiveInteger(getSingleString(req.query.page), 1),
    limit: parsePositiveInteger(getSingleString(req.query.limit), 20),
    search: getSingleString(req.query.search) ?? undefined,
    formulaId: getSingleString(req.query.formulaId) ?? undefined,
    value: value as ConsentValue | undefined,
    status: status as ConsentRecordStatus | undefined,
  })

  res.json(data)
})

router.post('/consents/register', async (req: Request, res: Response) => {
  const email = String(req.body.email ?? '').trim()
  const consents = Array.isArray(req.body.consents) ? req.body.consents : []

  if (!email) {
    res.status(400).json({ error: 'Email obbligatoria' })
    return
  }

  if (!consents.length) {
    res.status(400).json({ error: 'Consensi obbligatori' })
    return
  }

  const result = await upsertCommunicationContact({
    email,
    consents: consents.map((consent: any): CommunicationConsentInput => ({
      formulaId: String(consent.formulaId),
      value: String(consent.value) as ConsentValue,
    })),
    adminUserId: req.adminUser?.id,
  })

  res.status(201).json(result)
})

router.get('/suppressions', async (req: Request, res: Response) => {
  const data = await listCommunicationSuppressions({
    page: parsePositiveInteger(getSingleString(req.query.page), 1),
    limit: parsePositiveInteger(getSingleString(req.query.limit), 25),
    search: getSingleString(req.query.search) ?? undefined,
  })

  res.json(data)
})

router.post('/suppressions', async (req: Request, res: Response) => {
  const email = String(req.body.email ?? '').trim()
  if (!email) {
    res.status(400).json({ error: 'Email obbligatoria' })
    return
  }

  const result = await createCommunicationSuppression({
    email,
    reason: getSingleString(req.body.reason) ?? undefined,
  })

  res.status(201).json(result)
})

router.delete('/suppressions/:contactId', async (req: Request, res: Response) => {
  const contactId = getSingleString(req.params.contactId)
  if (!contactId) {
    res.status(400).json({ error: 'contactId non valido' })
    return
  }

  const result = await removeCommunicationSuppression(contactId)
  res.json(result)
})

export default router
