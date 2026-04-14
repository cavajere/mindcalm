import {
  ConsentRecordStatus,
  ConsentSource,
  ConsentValue,
  ContactStatus,
} from '@prisma/client'
import { prisma } from '../lib/prisma'
import { getOrCreateSubscriptionPolicy } from './subscriptionService'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeOptionalNamePart(value?: string | null) {
  const normalized = value?.trim() ?? ''
  return normalized.length ? normalized : null
}

function buildContactSearchWhere(search?: string) {
  const normalized = search?.trim()
  if (!normalized) return {}

  return {
    OR: [
      {
        email: {
          contains: normalized,
          mode: 'insensitive' as const,
        },
      },
      {
        firstName: {
          contains: normalized,
          mode: 'insensitive' as const,
        },
      },
      {
        lastName: {
          contains: normalized,
          mode: 'insensitive' as const,
        },
      },
    ],
  }
}

function resolveTranslationTitle(translations: Array<{ lang: string; title: string }> | undefined, fallback: string) {
  return translations?.find((translation) => translation.lang === 'it')?.title
    || translations?.[0]?.title
    || fallback
}

async function getActiveCommunicationPolicy() {
  const policy = await getOrCreateSubscriptionPolicy()

  return {
    ...policy,
    consentFormulas: policy.consentFormulas.filter((formula) => formula.status === 'ACTIVE' && formula.currentVersionId),
  }
}

export async function listCommunicationContacts(input: {
  page?: number
  limit?: number
  search?: string
}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.min(100, Math.max(1, input.limit ?? 25))
  const skip = (page - 1) * limit
  const where = buildContactSearchWhere(input.search)

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        consents: {
          where: { invalidatedAt: null },
          select: {
            consentFormulaId: true,
            value: true,
          },
        },
      },
    }),
    prisma.contact.count({ where }),
  ])

  return {
    data: contacts.map((contact) => {
      const accepted = contact.consents.filter((consent) => consent.value === ConsentValue.YES).length
      const rejected = contact.consents.filter((consent) => consent.value === ConsentValue.NO).length

      return {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        status: contact.status,
        suppressedAt: contact.suppressedAt,
        suppressionReason: contact.suppressionReason,
        createdAt: contact.createdAt,
        consentCounts: {
          accepted,
          rejected,
        },
      }
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function lookupCommunicationContactByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const contact = await prisma.contact.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      suppressedAt: true,
      suppressionReason: true,
      createdAt: true,
      updatedAt: true,
      consents: {
        where: { invalidatedAt: null },
        include: {
          consentFormulaVersion: true,
        },
      },
    },
  })

  if (!contact) {
    return { found: false as const }
  }

  return {
    found: true as const,
    contact,
    consents: contact.consents.map((consent) => ({
      formulaId: consent.consentFormulaId,
      formulaVersionId: consent.consentFormulaVersionId,
      value: consent.value,
      status: consent.status,
    })),
  }
}

export async function upsertCommunicationContact(input: {
  email: string
  firstName?: string | null
  lastName?: string | null
  consents?: Array<{ formulaId: string; value: ConsentValue }>
  adminUserId?: string
}) {
  const email = normalizeEmail(input.email)
  const firstName = normalizeOptionalNamePart(input.firstName)
  const lastName = normalizeOptionalNamePart(input.lastName)
  const consents = Array.isArray(input.consents) ? input.consents : []

  if (!consents.length) {
    return prisma.contact.upsert({
      where: { email },
      update: {
        status: ContactStatus.ACTIVE,
        suppressedAt: null,
        suppressionReason: null,
        ...(firstName !== null ? { firstName } : {}),
        ...(lastName !== null ? { lastName } : {}),
      },
      create: {
        email,
        firstName,
        lastName,
        status: ContactStatus.ACTIVE,
      },
    })
  }

  const policy = await getActiveCommunicationPolicy()
  if (!policy.currentVersionId || !policy.consentFormulas.length) {
    throw new Error('CONSENT_POLICY_NOT_PUBLISHED')
  }

  const requested = new Map(consents.map((consent) => [consent.formulaId, consent.value]))
  if (requested.size !== policy.consentFormulas.length) {
    throw new Error('CONSENT_PAYLOAD_INCOMPLETE')
  }

  for (const formula of policy.consentFormulas) {
    const value = requested.get(formula.id)
    if (!value) throw new Error('CONSENT_PAYLOAD_INCOMPLETE')
    if (formula.required && value !== ConsentValue.YES) {
      throw new Error('REQUIRED_CONSENT_REJECTED')
    }
  }

  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.upsert({
      where: { email },
      update: {
        status: ContactStatus.ACTIVE,
        suppressedAt: null,
        suppressionReason: null,
        ...(firstName !== null ? { firstName } : {}),
        ...(lastName !== null ? { lastName } : {}),
      },
      create: {
        email,
        firstName,
        lastName,
        status: ContactStatus.ACTIVE,
      },
    })

    await tx.consent.updateMany({
      where: {
        contactId: contact.id,
        invalidatedAt: null,
        consentFormulaId: { in: policy.consentFormulas.map((formula) => formula.id) },
      },
      data: {
        invalidatedAt: new Date(),
        invalidationReason: 'replaced_by_manual_entry',
      },
    })

    for (const formula of policy.consentFormulas) {
      await tx.consent.create({
        data: {
          contactId: contact.id,
          consentFormulaId: formula.id,
          consentFormulaVersionId: formula.currentVersionId!,
          policyVersionId: policy.currentVersionId!,
          value: requested.get(formula.id)!,
          status: ConsentRecordStatus.CONFIRMED,
          source: ConsentSource.ADMIN,
        },
      })
    }

    return contact
  })
}

export async function getCommunicationContactDetail(contactId: string) {
  const [contact, history, policy] = await Promise.all([
    prisma.contact.findUnique({
      where: { id: contactId },
    }),
    prisma.consent.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      include: {
        consentFormula: true,
        consentFormulaVersion: {
          include: {
            translations: true,
          },
        },
      },
    }),
    getActiveCommunicationPolicy(),
  ])

  if (!contact) {
    throw new Error('CONTACT_NOT_FOUND')
  }

  const latestActiveByFormula = new Map<string, typeof history[number]>()
  for (const consent of history) {
    if (consent.invalidatedAt) continue
    if (!latestActiveByFormula.has(consent.consentFormulaId)) {
      latestActiveByFormula.set(consent.consentFormulaId, consent)
    }
  }

  const currentConsents = policy.consentFormulas.map((formula) => {
    const consent = latestActiveByFormula.get(formula.id) ?? null
    return {
      formulaId: formula.id,
      formulaCode: formula.code,
      formulaTitle: resolveTranslationTitle(formula.currentVersion?.translations, formula.code),
      required: formula.required,
      currentVersionId: formula.currentVersionId,
      value: consent?.value ?? null,
      consentDate: consent?.createdAt ?? null,
      versionNumber: consent?.consentFormulaVersion.versionNumber ?? null,
    }
  })

  const currentVersionIds = new Set(policy.consentFormulas.map((formula) => formula.currentVersionId))
  const pastConsents = [...latestActiveByFormula.values()]
    .filter((consent) => !currentVersionIds.has(consent.consentFormulaVersionId))
    .map((consent) => ({
      formulaId: consent.consentFormulaId,
      formulaTitle: resolveTranslationTitle(consent.consentFormulaVersion.translations, consent.consentFormula.code),
      value: consent.value,
      consentDate: consent.createdAt,
      versionNumber: consent.consentFormulaVersion.versionNumber,
    }))

  return {
    contact,
    currentConsents,
    pastConsents,
    history: history.map((consent) => ({
      id: consent.id,
      value: consent.value,
      status: consent.status,
      source: consent.source,
      createdAt: consent.createdAt,
      invalidatedAt: consent.invalidatedAt,
      invalidationReason: consent.invalidationReason,
      consentFormulaId: consent.consentFormulaId,
      consentFormulaVersionId: consent.consentFormulaVersionId,
      consentFormula: {
        id: consent.consentFormula.id,
        code: consent.consentFormula.code,
      },
      consentFormulaVersion: {
        id: consent.consentFormulaVersion.id,
        versionNumber: consent.consentFormulaVersion.versionNumber,
        translations: consent.consentFormulaVersion.translations,
      },
    })),
  }
}

export async function updateCommunicationContactProfile(input: {
  contactId: string
  firstName?: string | null
  lastName?: string | null
}) {
  return prisma.contact.update({
    where: { id: input.contactId },
    data: {
      firstName: normalizeOptionalNamePart(input.firstName),
      lastName: normalizeOptionalNamePart(input.lastName),
    },
  })
}

export async function updateCommunicationContactConsent(input: {
  contactId: string
  formulaId: string
  value: ConsentValue
}) {
  const detail = await getCommunicationContactDetail(input.contactId)
  const formula = detail.currentConsents.find((item) => item.formulaId === input.formulaId)
  if (!formula?.currentVersionId) {
    throw new Error('CONSENT_FORMULA_NOT_FOUND')
  }

  const policy = await getActiveCommunicationPolicy()
  if (!policy.currentVersionId) {
    throw new Error('CONSENT_POLICY_NOT_PUBLISHED')
  }

  return prisma.$transaction(async (tx) => {
    await tx.consent.updateMany({
      where: {
        contactId: input.contactId,
        consentFormulaId: input.formulaId,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
        invalidationReason: 'replaced_by_manual_edit',
      },
    })

    const consent = await tx.consent.create({
      data: {
        contactId: input.contactId,
        consentFormulaId: input.formulaId,
        consentFormulaVersionId: formula.currentVersionId!,
        policyVersionId: policy.currentVersionId!,
        value: input.value,
        status: ConsentRecordStatus.CONFIRMED,
        source: ConsentSource.ADMIN,
      },
    })

    if (input.value === ConsentValue.YES) {
      await tx.contact.update({
        where: { id: input.contactId },
        data: {
          status: ContactStatus.ACTIVE,
          suppressedAt: null,
          suppressionReason: null,
        },
      })
    }

    return consent
  })
}

export async function deleteCommunicationContact(contactId: string) {
  return prisma.contact.delete({
    where: { id: contactId },
  })
}

export async function getCommunicationConsentStats() {
  const policy = await getActiveCommunicationPolicy()

  const byFormula = await Promise.all(policy.consentFormulas.map(async (formula) => {
    const [accepted, rejected] = await Promise.all([
      prisma.consent.count({
        where: {
          consentFormulaId: formula.id,
          value: ConsentValue.YES,
          invalidatedAt: null,
        },
      }),
      prisma.consent.count({
        where: {
          consentFormulaId: formula.id,
          value: ConsentValue.NO,
          invalidatedAt: null,
        },
      }),
    ])

    return {
      formulaId: formula.id,
      code: formula.code,
      translations: formula.currentVersion?.translations ?? [],
      total: accepted + rejected,
      accepted,
      rejected,
    }
  }))

  const [accepted, rejected, pendingConfirmations] = await Promise.all([
    prisma.consent.count({
      where: {
        value: ConsentValue.YES,
        invalidatedAt: null,
      },
    }),
    prisma.consent.count({
      where: {
        value: ConsentValue.NO,
        invalidatedAt: null,
      },
    }),
    prisma.consent.count({
      where: {
        status: ConsentRecordStatus.REGISTERED,
        invalidatedAt: null,
      },
    }),
  ])

  return {
    total: accepted + rejected,
    accepted,
    rejected,
    pendingConfirmations,
    byFormula,
  }
}

export async function listCommunicationConsents(input: {
  page?: number
  limit?: number
  search?: string
  formulaId?: string
  value?: ConsentValue
  status?: ConsentRecordStatus
}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.min(100, Math.max(1, input.limit ?? 20))
  const skip = (page - 1) * limit

  const where = {
    invalidatedAt: null,
    ...(input.formulaId ? { consentFormulaId: input.formulaId } : {}),
    ...(input.value ? { value: input.value } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.search?.trim() ? {
      contact: {
        email: {
          contains: input.search.trim(),
          mode: 'insensitive' as const,
        },
      },
    } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.consent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        contact: {
          select: {
            id: true,
            email: true,
          },
        },
        consentFormula: {
          select: {
            id: true,
            code: true,
          },
        },
        consentFormulaVersion: {
          include: {
            translations: true,
          },
        },
      },
    }),
    prisma.consent.count({ where }),
  ])

  return {
    items,
    total,
    page,
    limit,
  }
}

export async function listCommunicationSuppressions(input: {
  page?: number
  limit?: number
  search?: string
}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.min(100, Math.max(1, input.limit ?? 25))
  const skip = (page - 1) * limit
  const search = input.search?.trim()

  const where = {
    status: ContactStatus.SUPPRESSED,
    ...buildContactSearchWhere(search),
  }

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { suppressedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ])

  return {
    items,
    total,
    page,
    limit,
  }
}

export async function createCommunicationSuppression(input: {
  email: string
  reason?: string
  firstName?: string | null
  lastName?: string | null
}) {
  const email = normalizeEmail(input.email)
  const firstName = normalizeOptionalNamePart(input.firstName)
  const lastName = normalizeOptionalNamePart(input.lastName)

  return prisma.contact.upsert({
    where: { email },
    update: {
      status: ContactStatus.SUPPRESSED,
      suppressedAt: new Date(),
      suppressionReason: input.reason ?? 'manual',
      ...(firstName !== null ? { firstName } : {}),
      ...(lastName !== null ? { lastName } : {}),
    },
    create: {
      email,
      firstName,
      lastName,
      status: ContactStatus.SUPPRESSED,
      suppressedAt: new Date(),
      suppressionReason: input.reason ?? 'manual',
    },
  })
}

export async function removeCommunicationSuppression(contactId: string) {
  return prisma.contact.update({
    where: { id: contactId },
    data: {
      status: ContactStatus.ACTIVE,
      suppressedAt: null,
      suppressionReason: null,
    },
  })
}
