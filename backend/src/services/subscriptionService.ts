import {
  CampaignMatchMode,
  CampaignRecipientStatus,
  CampaignStatus,
  ConsentRecordStatus,
  ConsentSource,
  ConsentValue,
  ContactStatus,
  Prisma,
  SubscriptionPolicyStatus,
  SubscriptionPolicyVersionStatus,
} from '@prisma/client'
import sanitizeHtml from 'sanitize-html'
import { prisma } from '../lib/prisma'
import { config } from '../config'
import { buildAppUrl } from '../utils/appUrls'
import { generateRandomToken, hashToken } from './cryptoService'
import { buildCommunicationEmail } from './email/templates'
import { sendMail } from './smtpService'

const CONFIRM_TOKEN_HOURS = 48
const UNSUBSCRIBE_TOKEN_DAYS = 30

type LanguagePayload = {
  lang: string
  title?: string | null
  html: string
  buttonLabel?: string | null
}

type FormulaTranslationPayload = {
  lang: string
  title: string
  text: string
}

type CampaignFilterInput = {
  formulaId: string
  versionIds?: string[]
}

const COMMUNICATION_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img',
    'h1',
    'h2',
    'h3',
    'span',
    'div',
    'br',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt'],
    '*': ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
}

export async function getOrCreateSubscriptionPolicy() {
  const existing = await prisma.subscriptionPolicy.findFirst({
    include: {
      currentVersion: {
        include: {
          translations: true,
        },
      },
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: { translations: true },
      },
      consentFormulas: {
        orderBy: { code: 'asc' },
        include: {
          currentVersion: {
            include: {
              translations: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              translations: true,
            },
          },
        },
      },
    },
  })

  if (existing) return existing

  return prisma.$transaction(async (tx) => {
    const policy = await tx.subscriptionPolicy.create({
      data: {
        status: SubscriptionPolicyStatus.DRAFT,
        subscribeEnabled: true,
      },
    })

    const version = await tx.subscriptionPolicyVersion.create({
      data: {
        subscriptionPolicyId: policy.id,
        versionNumber: 1,
        status: SubscriptionPolicyVersionStatus.DRAFT,
      },
    })

    await tx.subscriptionPolicy.update({
      where: { id: policy.id },
      data: { currentVersionId: version.id },
    })

    return tx.subscriptionPolicy.findUniqueOrThrow({
      where: { id: policy.id },
      include: {
        currentVersion: { include: { translations: true } },
        versions: { orderBy: { versionNumber: 'desc' }, include: { translations: true } },
        consentFormulas: {
          orderBy: { code: 'asc' },
          include: {
            currentVersion: { include: { translations: true } },
            versions: { orderBy: { versionNumber: 'desc' }, include: { translations: true } },
          },
        },
      },
    })
  })
}

export async function createDraftVersion(policyId: string) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.subscriptionPolicy.findUniqueOrThrow({
      where: { id: policyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            translations: true,
          },
        },
        consentFormulas: {
          include: {
            currentVersion: {
              include: { translations: true },
            },
          },
        },
      },
    })

    const existingDraft = policy.versions.find((version) => version.status === SubscriptionPolicyVersionStatus.DRAFT)
    if (existingDraft) {
      throw new Error('Esiste già una versione DRAFT dell informativa')
    }

    const latestVersion = policy.versions[0]
    if (!latestVersion) throw new Error('Versione corrente non trovata')

    const draft = await tx.subscriptionPolicyVersion.create({
      data: {
        subscriptionPolicyId: policy.id,
        versionNumber: latestVersion.versionNumber + 1,
        previousVersionId: latestVersion.id,
        status: SubscriptionPolicyVersionStatus.DRAFT,
      },
    })

    if (latestVersion.translations.length) {
      await tx.subscriptionPolicyVersionTranslation.createMany({
        data: latestVersion.translations.map((translation) => ({
          versionId: draft.id,
          lang: translation.lang,
          title: translation.title,
          html: translation.html,
          buttonLabel: translation.buttonLabel,
        })),
      })
    }

    for (const formula of policy.consentFormulas) {
      const previousVersion = formula.currentVersion
      const versionNumber = previousVersion ? previousVersion.versionNumber + 1 : 1
      const created = await tx.consentFormulaVersion.create({
        data: {
          consentFormulaId: formula.id,
          subscriptionPolicyVersionId: draft.id,
          versionNumber,
          previousVersionId: previousVersion?.id,
        },
      })

      if (previousVersion?.translations.length) {
        await tx.consentFormulaVersionTranslation.createMany({
          data: previousVersion.translations.map((translation) => ({
            consentVersionId: created.id,
            lang: translation.lang,
            title: translation.title,
            text: translation.text,
          })),
        })
      }
    }

    return draft
  })
}

export async function upsertPolicyTranslations(versionId: string, translations: LanguagePayload[]) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.subscriptionPolicyVersion.findUniqueOrThrow({ where: { id: versionId } })

    if (version.status !== SubscriptionPolicyVersionStatus.DRAFT) {
      throw new Error('Puoi modificare solo traduzioni di versioni DRAFT')
    }

    for (const translation of translations) {
      await tx.subscriptionPolicyVersionTranslation.upsert({
        where: {
          versionId_lang: {
            versionId,
            lang: translation.lang,
          },
        },
        create: {
          versionId,
          lang: translation.lang,
          title: translation.title ?? null,
          html: translation.html,
          buttonLabel: translation.buttonLabel ?? null,
        },
        update: {
          title: translation.title ?? null,
          html: translation.html,
          buttonLabel: translation.buttonLabel ?? null,
        },
      })
    }

    return tx.subscriptionPolicyVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { translations: true },
    })
  })
}

export async function upsertFormulaTranslations(formulaVersionId: string, translations: FormulaTranslationPayload[]) {
  return prisma.$transaction(async (tx) => {
    const formulaVersion = await tx.consentFormulaVersion.findUniqueOrThrow({ where: { id: formulaVersionId } })

    if (formulaVersion.status !== 'DRAFT') {
      throw new Error('Puoi modificare solo traduzioni di formule DRAFT')
    }

    for (const translation of translations) {
      await tx.consentFormulaVersionTranslation.upsert({
        where: {
          consentVersionId_lang: {
            consentVersionId: formulaVersionId,
            lang: translation.lang,
          },
        },
        create: {
          consentVersionId: formulaVersionId,
          lang: translation.lang,
          title: translation.title,
          text: translation.text,
        },
        update: {
          title: translation.title,
          text: translation.text,
        },
      })
    }

    return tx.consentFormulaVersion.findUniqueOrThrow({
      where: { id: formulaVersionId },
      include: { translations: true },
    })
  })
}

export async function publishPolicyVersion(policyId: string, versionId: string) {
  return prisma.$transaction(async (tx) => {
    const targetVersion = await tx.subscriptionPolicyVersion.findFirst({
      where: { id: versionId, subscriptionPolicyId: policyId },
      include: {
        translations: true,
        consentFormulaVersions: true,
      },
    })

    if (!targetVersion) throw new Error('Versione informativa non trovata')
    if (targetVersion.status !== SubscriptionPolicyVersionStatus.DRAFT) {
      throw new Error('Solo una versione DRAFT puo essere pubblicata')
    }

    if (!targetVersion.translations.length) {
      throw new Error('Aggiungi almeno una traduzione informativa prima del publish')
    }

    const now = new Date()
    const policy = await tx.subscriptionPolicy.findUniqueOrThrow({ where: { id: policyId } })

    if (policy.currentVersionId && policy.currentVersionId !== versionId) {
      await tx.subscriptionPolicyVersion.update({
        where: { id: policy.currentVersionId },
        data: { status: SubscriptionPolicyVersionStatus.ARCHIVED },
      })
    }

    await tx.subscriptionPolicyVersion.update({
      where: { id: versionId },
      data: {
        status: SubscriptionPolicyVersionStatus.PUBLISHED,
        publishedAt: now,
      },
    })

    const formulas = await tx.consentFormula.findMany({
      where: { subscriptionPolicyId: policyId },
      include: {
        currentVersion: true,
      },
    })

    for (const formula of formulas) {
      const draftFormulaVersion = await tx.consentFormulaVersion.findFirst({
        where: {
          consentFormulaId: formula.id,
          subscriptionPolicyVersionId: versionId,
          status: 'DRAFT',
        },
      })

      if (!draftFormulaVersion) continue

      if (formula.currentVersionId && formula.currentVersionId !== draftFormulaVersion.id) {
        await tx.consentFormulaVersion.update({
          where: { id: formula.currentVersionId },
          data: { status: 'ARCHIVED' },
        })

        await tx.consent.updateMany({
          where: {
            consentFormulaId: formula.id,
            consentFormulaVersionId: formula.currentVersionId,
            invalidatedAt: null,
            value: ConsentValue.YES,
          },
          data: {
            invalidatedAt: now,
            invalidationReason: 'superseded_by_new_version',
          },
        })
      }

      await tx.consentFormulaVersion.update({
        where: { id: draftFormulaVersion.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
        },
      })

      await tx.consentFormula.update({
        where: { id: formula.id },
        data: { currentVersionId: draftFormulaVersion.id, status: 'ACTIVE' },
      })
    }

    await tx.subscriptionPolicy.update({
      where: { id: policyId },
      data: {
        status: SubscriptionPolicyStatus.PUBLISHED,
        currentVersionId: versionId,
      },
    })

    return tx.subscriptionPolicy.findUniqueOrThrow({
      where: { id: policyId },
      include: {
        currentVersion: { include: { translations: true } },
        consentFormulas: {
          include: {
            currentVersion: { include: { translations: true } },
            versions: { orderBy: { versionNumber: 'desc' }, include: { translations: true } },
          },
        },
        versions: { orderBy: { versionNumber: 'desc' }, include: { translations: true } },
      },
    })
  })
}

export async function createConsentFormula(policyId: string, code: string, required: boolean) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.subscriptionPolicy.findUniqueOrThrow({
      where: { id: policyId },
      select: {
        currentVersionId: true,
        status: true,
      },
    })

    const formula = await tx.consentFormula.create({
      data: {
        subscriptionPolicyId: policyId,
        code,
        required,
      },
    })

    const draftVersion = await tx.subscriptionPolicyVersion.findFirst({
      where: {
        subscriptionPolicyId: policyId,
        status: SubscriptionPolicyVersionStatus.DRAFT,
      },
      orderBy: { versionNumber: 'desc' },
    })

    if (draftVersion) {
      const currentVersion = await tx.consentFormulaVersion.findFirst({
        where: { consentFormulaId: formula.id },
        orderBy: { versionNumber: 'desc' },
      })

      const createdVersion = await tx.consentFormulaVersion.create({
        data: {
          consentFormulaId: formula.id,
          subscriptionPolicyVersionId: draftVersion.id,
          versionNumber: currentVersion ? currentVersion.versionNumber + 1 : 1,
          previousVersionId: currentVersion?.id,
        },
      })

      await tx.consentFormula.update({
        where: { id: formula.id },
        data: {
          currentVersionId: policy.status === SubscriptionPolicyStatus.PUBLISHED
            ? null
            : (formula.currentVersionId ?? createdVersion.id),
        },
      })
    }

    return formula
  })
}

export async function updateConsentFormula(formulaId: string, required: boolean) {
  return prisma.consentFormula.update({
    where: { id: formulaId },
    data: { required },
  })
}

export async function deleteConsentFormula(formulaId: string) {
  return prisma.consentFormula.update({
    where: { id: formulaId },
    data: { status: 'ARCHIVED' },
  })
}

type SubscribeInput = {
  email: string
  consents: Array<{ formulaId: string, value: ConsentValue }>
  ipAddress?: string
  userAgent?: string
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function hashIpAddress(value?: string) {
  if (!value) return null
  return hashToken(value)
}

export async function getPublicConsentFormulas(lang = 'it') {
  const policy = await prisma.subscriptionPolicy.findFirst({
    where: { status: SubscriptionPolicyStatus.PUBLISHED },
    include: {
      currentVersion: {
        include: {
          translations: {
            where: { lang },
            take: 1,
          },
        },
      },
      consentFormulas: {
        where: { status: 'ACTIVE', currentVersionId: { not: null } },
        orderBy: { code: 'asc' },
        include: {
          currentVersion: {
            include: {
              translations: {
                where: { lang },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  return policy
}

export async function subscribePublic(input: SubscribeInput) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.subscriptionPolicy.findFirst({
      where: {
        status: SubscriptionPolicyStatus.PUBLISHED,
        subscribeEnabled: true,
      },
      include: {
        currentVersion: true,
        consentFormulas: {
          where: { status: 'ACTIVE' },
          include: {
            currentVersion: true,
          },
        },
      },
    })

    if (!policy?.currentVersion) {
      throw new Error('CONSENT_POLICY_NOT_PUBLISHED')
    }

    const requested = new Map(input.consents.map((entry) => [entry.formulaId, entry.value]))
    if (requested.size !== policy.consentFormulas.length) {
      throw new Error('CONSENT_PAYLOAD_INCOMPLETE')
    }

    for (const formula of policy.consentFormulas) {
      const value = requested.get(formula.id)
      if (!value) throw new Error('CONSENT_PAYLOAD_INCOMPLETE')
      if (formula.required && value !== ConsentValue.YES) {
        throw new Error('REQUIRED_CONSENT_REJECTED')
      }
      if (!formula.currentVersionId) {
        throw new Error('CONSENT_POLICY_NOT_PUBLISHED')
      }
    }

    const email = normalizeEmail(input.email)
    const contact = await tx.contact.upsert({
      where: { email },
      update: { status: ContactStatus.ACTIVE, suppressedAt: null, suppressionReason: null },
      create: { email, status: ContactStatus.ACTIVE },
    })

    const now = new Date()
    const status = policy.subscribeConfirmEmail ? ConsentRecordStatus.REGISTERED : ConsentRecordStatus.CONFIRMED

    await tx.consent.updateMany({
      where: {
        contactId: contact.id,
        consentFormulaId: {
          in: policy.consentFormulas.map((formula) => formula.id),
        },
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: now,
        invalidationReason: 'replaced_by_new_choice',
      },
    })

    await tx.consent.createMany({
      data: policy.consentFormulas.map((formula) => ({
        contactId: contact.id,
        consentFormulaId: formula.id,
        consentFormulaVersionId: formula.currentVersionId!,
        policyVersionId: policy.currentVersionId!,
        value: requested.get(formula.id)!,
        status,
        ipHash: hashIpAddress(input.ipAddress),
        userAgent: input.userAgent,
        source: ConsentSource.SUBSCRIBE,
      })),
    })

    let confirmToken: string | null = null
    if (policy.subscribeConfirmEmail) {
      const rawToken = generateRandomToken(24)
      confirmToken = rawToken
      await tx.subscriptionConfirmationToken.create({
        data: {
          contactId: contact.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + CONFIRM_TOKEN_HOURS * 60 * 60 * 1000),
        },
      })
    }

    return {
      contactId: contact.id,
      email: contact.email,
      status,
      requiresConfirmation: policy.subscribeConfirmEmail,
      confirmToken,
    }
  })
}

export async function confirmSubscription(rawToken: string) {
  const tokenHash = hashToken(rawToken)

  return prisma.$transaction(async (tx) => {
    const record = await tx.subscriptionConfirmationToken.findUnique({
      where: { tokenHash },
    })

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new Error('CONFIRM_TOKEN_INVALID')
    }

    await tx.consent.updateMany({
      where: {
        contactId: record.contactId,
        status: ConsentRecordStatus.REGISTERED,
        invalidatedAt: null,
      },
      data: {
        status: ConsentRecordStatus.CONFIRMED,
      },
    })

    await tx.subscriptionConfirmationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    })

    return { confirmed: true }
  })
}

export async function createUnsubscribeTokenForContact(contactId: string) {
  const rawToken = generateRandomToken(24)
  await prisma.unsubscribeToken.create({
    data: {
      contactId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + UNSUBSCRIBE_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    },
  })

  return rawToken
}

export async function getUnsubscribePreferences(rawToken: string) {
  const tokenHash = hashToken(rawToken)
  const token = await prisma.unsubscribeToken.findUnique({
    where: { tokenHash },
    include: {
      contact: {
        select: {
          email: true,
        },
      },
    },
  })

  if (!token || token.expiresAt < new Date()) {
    throw new Error('UNSUBSCRIBE_TOKEN_INVALID')
  }

  const consents = await prisma.consent.findMany({
    where: {
      contactId: token.contactId,
      invalidatedAt: null,
    },
    include: {
      consentFormula: true,
      consentFormulaVersion: {
        include: {
          translations: true,
        },
      },
    },
  })

  return {
    contactId: token.contactId,
    email: token.contact.email,
    consents,
  }
}

export async function unsubscribeWithToken(rawToken: string, options: {
  revokeAll?: boolean
  updates?: Array<{ formulaId: string, keep: boolean }>
  reason?: string
}) {
  const tokenHash = hashToken(rawToken)

  return prisma.$transaction(async (tx) => {
    const token = await tx.unsubscribeToken.findUnique({ where: { tokenHash } })
    if (!token || token.expiresAt < new Date()) {
      throw new Error('UNSUBSCRIBE_TOKEN_INVALID')
    }

    const active = await tx.consent.findMany({
      where: {
        contactId: token.contactId,
        invalidatedAt: null,
      },
    })

    const now = new Date()
    const revokeAll = Boolean(options.revokeAll)
    const updateSet = new Map((options.updates ?? []).map((item) => [item.formulaId, item.keep]))

    for (const consent of active) {
      const shouldRevoke = revokeAll || updateSet.get(consent.consentFormulaId) === false
      if (!shouldRevoke || consent.value === ConsentValue.NO) continue

      await tx.consent.update({
        where: { id: consent.id },
        data: {
          invalidatedAt: now,
          invalidationReason: options.reason || 'user_unsubscribed',
        },
      })

      await tx.consent.create({
        data: {
          contactId: consent.contactId,
          consentFormulaId: consent.consentFormulaId,
          consentFormulaVersionId: consent.consentFormulaVersionId,
          policyVersionId: consent.policyVersionId,
          value: ConsentValue.NO,
          status: ConsentRecordStatus.CONFIRMED,
          source: ConsentSource.UNSUBSCRIBE,
          invalidatedAt: null,
          invalidationReason: null,
        },
      })
    }

    if (revokeAll) {
      await tx.contact.update({
        where: { id: token.contactId },
        data: {
          status: ContactStatus.SUPPRESSED,
          suppressedAt: now,
          suppressionReason: options.reason ?? 'unsubscribe_all',
        },
      })
    }

    return { success: true }
  })
}

function buildAudienceWhere(filters: Array<{ formulaId: string, versionIds?: string[] }>, matchMode: CampaignMatchMode): Prisma.ConsentWhereInput {
  const condition = filters.map((filter) => ({
    consentFormulaId: filter.formulaId,
    consentFormulaVersionId: filter.versionIds?.length ? { in: filter.versionIds } : undefined,
    value: ConsentValue.YES,
    status: ConsentRecordStatus.CONFIRMED,
    invalidatedAt: null,
  }))

  return matchMode === CampaignMatchMode.ALL
    ? { AND: condition }
    : { OR: condition }
}

function buildCommunicationHtmlBody(htmlBody: string, unsubscribeUrl: string) {
  const bodyWithToken = htmlBody
    .replaceAll('{{unsubscribe_url}}', unsubscribeUrl)
    .replaceAll('{{unsubscribeUrl}}', unsubscribeUrl)
    .replaceAll('[[unsubscribe_url]]', unsubscribeUrl)

  return sanitizeHtml(bodyWithToken, COMMUNICATION_HTML_SANITIZE_OPTIONS)
}

function buildCommunicationTextBody(htmlBody: string) {
  const withLineBreaks = htmlBody
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|blockquote)>/gi, '\n')

  return sanitizeHtml(withLineBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export async function getCampaignAudienceOptions() {
  const policy = await getOrCreateSubscriptionPolicy()

  return {
    matchModes: ['ALL', 'ANY'] as const,
    placeholders: ['{{unsubscribe_url}}', '{{unsubscribeUrl}}'],
    formulas: policy.consentFormulas.map((formula) => ({
      id: formula.id,
      code: formula.code,
      required: formula.required,
      currentVersionId: formula.currentVersionId,
      versions: formula.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        subscriptionPolicyVersionId: version.subscriptionPolicyVersionId,
        translations: version.translations,
      })),
    })),
  }
}

export async function listCampaigns(limit = 20) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 20
  const campaigns = await prisma.campaign.findMany({
    take: safeLimit,
    orderBy: [{ createdAt: 'desc' }],
    include: {
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      filters: {
        include: {
          consentFormula: {
            select: {
              id: true,
              code: true,
            },
          },
        },
      },
      _count: {
        select: {
          recipients: true,
        },
      },
    },
  })

  if (!campaigns.length) {
    return []
  }

  const recipientSummaryRows = await prisma.campaignRecipient.groupBy({
    by: ['campaignId', 'status'],
    where: {
      campaignId: {
        in: campaigns.map((campaign) => campaign.id),
      },
    },
    _count: {
      status: true,
    },
  })

  const recipientStats = new Map<string, {
    pendingCount: number
    sentCount: number
    failedCount: number
  }>()

  for (const row of recipientSummaryRows) {
    const existing = recipientStats.get(row.campaignId) ?? {
      pendingCount: 0,
      sentCount: 0,
      failedCount: 0,
    }

    if (row.status === CampaignRecipientStatus.PENDING) {
      existing.pendingCount = row._count.status
    } else if (row.status === CampaignRecipientStatus.SENT) {
      existing.sentCount = row._count.status
    } else if (row.status === CampaignRecipientStatus.FAILED) {
      existing.failedCount = row._count.status
    }

    recipientStats.set(row.campaignId, existing)
  }

  return campaigns.map((campaign) => {
    const stats = recipientStats.get(campaign.id) ?? {
      pendingCount: 0,
      sentCount: 0,
      failedCount: 0,
    }

    return {
      ...campaign,
      recipientsCount: campaign._count.recipients,
      pendingCount: stats.pendingCount,
      sentCount: stats.sentCount,
      failedCount: stats.failedCount,
    }
  })
}

export async function previewCampaignAudience(filters: Array<{ formulaId: string, versionIds?: string[] }>, matchMode: CampaignMatchMode) {
  if (!filters.length) return []

  if (matchMode === CampaignMatchMode.ANY) {
    const consents = await prisma.consent.findMany({
      where: {
        OR: filters.map((filter) => ({
          consentFormulaId: filter.formulaId,
          consentFormulaVersionId: filter.versionIds?.length ? { in: filter.versionIds } : undefined,
          value: ConsentValue.YES,
          status: ConsentRecordStatus.CONFIRMED,
          invalidatedAt: null,
        })),
        contact: { status: ContactStatus.ACTIVE },
      },
      include: { contact: true },
    })

    const unique = new Map(consents.map((consent) => [consent.contactId, consent.contact]))
    return Array.from(unique.values())
  }

  const grouped = await prisma.consent.groupBy({
    by: ['contactId'],
    where: {
      OR: filters.map((filter) => ({
        consentFormulaId: filter.formulaId,
        consentFormulaVersionId: filter.versionIds?.length ? { in: filter.versionIds } : undefined,
        value: ConsentValue.YES,
        status: ConsentRecordStatus.CONFIRMED,
        invalidatedAt: null,
      })),
      contact: { status: ContactStatus.ACTIVE },
    },
    _count: { consentFormulaId: true },
  })

  const eligibleIds = grouped
    .filter((row) => row._count.consentFormulaId >= filters.length)
    .map((row) => row.contactId)

  if (!eligibleIds.length) return []

  return prisma.contact.findMany({ where: { id: { in: eligibleIds } } })
}

async function resolveCampaignRecipients(input: {
  filters: CampaignFilterInput[]
  matchMode: CampaignMatchMode
  selectedRecipientIds?: string[]
  manualRecipientIds?: string[]
}) {
  const previewRecipients = input.filters.length
    ? await previewCampaignAudience(input.filters, input.matchMode)
    : []

  const previewRecipientById = new Map(previewRecipients.map((recipient) => [recipient.id, recipient]))
  const resolved = new Map<string, typeof previewRecipients[number]>()

  if (input.filters.length) {
    const selectedIds = Array.isArray(input.selectedRecipientIds) && input.selectedRecipientIds.length
      ? [...new Set(input.selectedRecipientIds)]
      : previewRecipients.map((recipient) => recipient.id)

    for (const recipientId of selectedIds) {
      const recipient = previewRecipientById.get(recipientId)
      if (!recipient) {
        throw new Error('CAMPAIGN_RECIPIENTS_NOT_ELIGIBLE')
      }
      resolved.set(recipient.id, recipient)
    }
  }

  const extraManualIds = [...new Set(input.manualRecipientIds ?? [])]
    .filter((recipientId) => !resolved.has(recipientId))

  if (extraManualIds.length) {
    const manualRecipients = await prisma.contact.findMany({
      where: {
        id: { in: extraManualIds },
        status: ContactStatus.ACTIVE,
        consents: {
          some: {
            value: ConsentValue.YES,
            status: ConsentRecordStatus.CONFIRMED,
            invalidatedAt: null,
          },
        },
      },
    })

    const manualRecipientById = new Map(manualRecipients.map((recipient) => [recipient.id, recipient]))
    for (const recipientId of extraManualIds) {
      const recipient = manualRecipientById.get(recipientId)
      if (!recipient) {
        throw new Error('CAMPAIGN_RECIPIENTS_NOT_ELIGIBLE')
      }
      resolved.set(recipient.id, recipient)
    }
  }

  return [...resolved.values()]
}

export async function searchCampaignContacts(input: {
  query: string
  filters?: CampaignFilterInput[]
  matchMode?: CampaignMatchMode
}) {
  const normalizedQuery = input.query.trim().toLowerCase()
  if (normalizedQuery.length < 2) {
    return []
  }

  const filteredAudience = input.filters?.length
    ? await previewCampaignAudience(input.filters, input.matchMode ?? CampaignMatchMode.ALL)
    : null
  const audienceIds = filteredAudience?.map((recipient) => recipient.id) ?? null

  if (filteredAudience && audienceIds?.length === 0) {
    return []
  }

  const contacts = await prisma.contact.findMany({
    where: {
      status: ContactStatus.ACTIVE,
      ...(audienceIds ? { id: { in: audienceIds } } : {}),
      email: { contains: normalizedQuery, mode: 'insensitive' },
      consents: {
        some: {
          value: ConsentValue.YES,
          status: ConsentRecordStatus.CONFIRMED,
          invalidatedAt: null,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      consents: {
        where: {
          value: ConsentValue.YES,
          status: ConsentRecordStatus.CONFIRMED,
          invalidatedAt: null,
        },
        include: {
          consentFormula: {
            include: {
              currentVersion: {
                include: {
                  translations: true,
                },
              },
            },
          },
        },
      },
    },
  })

  return contacts.map((contact) => {
    const activeConsents = Array.from(new Map(
      contact.consents.map((consent) => [
        consent.consentFormulaId,
        {
          id: consent.consentFormula.id,
          code: consent.consentFormula.code,
          title: consent.consentFormula.currentVersion?.translations.find((translation) => translation.lang === 'it')?.title
            || consent.consentFormula.currentVersion?.translations[0]?.title
            || consent.consentFormula.code,
        },
      ]),
    ).values())

    return {
      id: contact.id,
      email: contact.email,
      activeConsents,
    }
  })
}

export async function sendCampaign(input: {
  name: string
  subject: string
  htmlBody: string
  filters: CampaignFilterInput[]
  matchMode: CampaignMatchMode
  createdByUserId?: string
  selectedRecipientIds?: string[]
  manualRecipientIds?: string[]
  unsubscribeLabel?: string
}) {
  const recipients = await resolveCampaignRecipients({
    filters: input.filters,
    matchMode: input.matchMode,
    selectedRecipientIds: input.selectedRecipientIds,
    manualRecipientIds: input.manualRecipientIds,
  })
  if (!recipients.length) {
    throw new Error('CAMPAIGN_AUDIENCE_EMPTY')
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name: input.name,
        subject: input.subject,
        htmlBody: input.htmlBody,
        matchMode: input.matchMode,
        status: CampaignStatus.DRAFT,
        createdByUserId: input.createdByUserId ?? null,
      },
    })

    await tx.campaignAudienceFilter.createMany({
      data: input.filters.map((filter) => ({
        campaignId: campaign.id,
        consentFormulaId: filter.formulaId,
        formulaVersionIds: filter.versionIds ?? [],
      })),
    })

    await tx.campaignRecipient.createMany({
      data: recipients.map((contact) => ({
        campaignId: campaign.id,
        contactId: contact.id,
        status: CampaignRecipientStatus.PENDING,
      })),
    })

    return campaign
  })

  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    try {
      const unsubscribeToken = await createUnsubscribeTokenForContact(recipient.id)
      const unsubscribeUrl = buildAppUrl(
        config.appUrls.public,
        `/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
      )
      const sanitizedHtmlBody = buildCommunicationHtmlBody(input.htmlBody, unsubscribeUrl)
      const communicationEmail = buildCommunicationEmail({
        subject: input.subject,
        title: input.name,
        bodyHtml: sanitizedHtmlBody,
        bodyText: buildCommunicationTextBody(sanitizedHtmlBody),
        unsubscribeUrl,
        unsubscribeLabel: input.unsubscribeLabel,
      })

      await sendMail({
        to: recipient.email,
        subject: communicationEmail.subject,
        html: communicationEmail.html,
        text: communicationEmail.text,
      })

      sentCount += 1
      await prisma.campaignRecipient.update({
        where: {
          campaignId_contactId: {
            campaignId: campaign.id,
            contactId: recipient.id,
          },
        },
        data: {
          status: CampaignRecipientStatus.SENT,
          sentAt: new Date(),
          error: null,
        },
      })
    } catch (error) {
      failedCount += 1
      await prisma.campaignRecipient.update({
        where: {
          campaignId_contactId: {
            campaignId: campaign.id,
            contactId: recipient.id,
          },
        },
        data: {
          status: CampaignRecipientStatus.FAILED,
          error: error instanceof Error ? error.message : 'Invio non riuscito',
        },
      })
    }
  }

  const finalCampaign = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: sentCount > 0 ? CampaignStatus.SENT : CampaignStatus.CANCELLED,
      sentAt: sentCount > 0 ? new Date() : null,
    },
  })

  return {
    campaign: finalCampaign,
    recipientsCount: recipients.length,
    sentCount,
    failedCount,
  }
}
