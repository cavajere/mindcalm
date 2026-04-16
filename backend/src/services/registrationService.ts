import {
  ConsentRecordStatus,
  ConsentSource,
  ConsentValue,
  ContactStatus,
  InviteCodeStatus,
  PendingRegistrationStatus,
  Prisma,
  UserRole,
} from '@prisma/client'
import { prisma } from '../lib/prisma'
import { config } from '../config'
import { hashPassword } from './authService'
import { hashToken, generateRandomToken } from './cryptoService'
import { sendMail } from './smtpService'
import { calculateLicenseExpiresAtFromActivation } from './licenseService'
import { getPublicInviteCodeDetails, normalizeInviteCode } from './inviteCodeService'
import { buildAppUrl } from '../utils/appUrls'
import { buildRegistrationVerificationEmail } from './email/templates'

function normalizeNamePart(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function buildFullName(firstName: string, lastName: string) {
  return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim()
}

function normalizeEmail(email: string) {
  return email.trim()
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/\s+/g, ' ')
}

function getVerificationExpiresAt() {
  return new Date(Date.now() + config.registration.verificationExpiresInHours * 60 * 60 * 1000)
}

type PendingCommunicationConsent = {
  formulaId: string
  formulaVersionId: string
  value: ConsentValue
}

function parsePendingCommunicationConsents(value: Prisma.JsonValue | null | undefined): PendingCommunicationConsent[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []

    const formulaId = typeof entry.formulaId === 'string' ? entry.formulaId : null
    const formulaVersionId = typeof entry.formulaVersionId === 'string' ? entry.formulaVersionId : null
    const consentValue = entry.value === ConsentValue.YES || entry.value === ConsentValue.NO ? entry.value : null

    if (!formulaId || !formulaVersionId || !consentValue) return []

    return [{
      formulaId,
      formulaVersionId,
      value: consentValue,
    }]
  })
}

const verificationDetailsSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  verificationExpiresAt: true,
  status: true,
  inviteCode: {
    select: {
      code: true,
      licenseDurationDays: true,
    },
  },
} satisfies Prisma.PendingRegistrationSelect

export async function startInviteCodeRegistration(input: {
  code: string
  email: string
  firstName: string
  lastName: string
  phone: string
  password: string
  verificationBaseUrl: string
  acceptTerms: boolean
  termsVersionId?: string
  consents?: Array<{
    formulaId: string
    value: ConsentValue
  }>
}) {
  const email = normalizeEmail(input.email)
  const firstName = normalizeNamePart(input.firstName)
  const lastName = normalizeNamePart(input.lastName)
  const phone = normalizePhone(input.phone)
  const inviteCode = await getPublicInviteCodeDetails(input.code)
  const publishedTermsPolicy = await prisma.termsPolicy.findFirst({
    where: { status: 'PUBLISHED' },
    select: {
      currentVersionId: true,
    },
  })
  const publishedCommunicationPolicy = await prisma.subscriptionPolicy.findFirst({
    where: {
      status: 'PUBLISHED',
      subscribeEnabled: true,
    },
    select: {
      currentVersionId: true,
      consentFormulas: {
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          required: true,
          currentVersionId: true,
        },
      },
    },
  })
  const existingUser = await prisma.user.findUnique({ where: { email } })

  if (publishedTermsPolicy?.currentVersionId) {
    if (!input.acceptTerms) {
      throw new Error('TERMS_ACCEPTANCE_REQUIRED')
    }

    if (input.termsVersionId !== publishedTermsPolicy.currentVersionId) {
      throw new Error('TERMS_VERSION_OUTDATED')
    }
  }

  if (existingUser) {
    throw new Error('Esiste già un account con questa email')
  }

  const requestedConsents = new Map((input.consents ?? []).map((entry) => [entry.formulaId, entry.value]))
  const communicationConsents = publishedCommunicationPolicy?.currentVersionId
    ? publishedCommunicationPolicy.consentFormulas.map((formula) => {
        const value = requestedConsents.get(formula.id)
        if (!value || !formula.currentVersionId) {
          throw new Error('CONSENT_PAYLOAD_INCOMPLETE')
        }
        if (formula.required && value !== ConsentValue.YES) {
          throw new Error('REQUIRED_CONSENT_REJECTED')
        }

        return {
          formulaId: formula.id,
          formulaVersionId: formula.currentVersionId,
          value,
        }
      })
    : []

  if ((input.consents?.length ?? 0) !== communicationConsents.length && publishedCommunicationPolicy?.consentFormulas.length) {
    throw new Error('CONSENT_PAYLOAD_INCOMPLETE')
  }

  const token = generateRandomToken()
  const verificationTokenHash = hashToken(token)
  const verificationExpiresAt = getVerificationExpiresAt()
  const passwordHash = await hashPassword(input.password)

  const pendingRegistration = await prisma.$transaction(async (tx) => {
    await tx.pendingRegistration.updateMany({
      where: {
        email,
        status: PendingRegistrationStatus.PENDING,
      },
      data: {
        status: PendingRegistrationStatus.CANCELLED,
      },
    })

    return tx.pendingRegistration.create({
      data: {
        inviteCodeId: inviteCode.id,
        termsPolicyVersionId: publishedTermsPolicy?.currentVersionId ?? null,
        termsAcceptedAt: publishedTermsPolicy?.currentVersionId ? new Date() : null,
        communicationPolicyVersionId: publishedCommunicationPolicy?.currentVersionId ?? null,
        communicationConsents: communicationConsents as Prisma.InputJsonValue,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        verificationTokenHash,
        verificationExpiresAt,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        verificationExpiresAt: true,
      },
    })
  })

  const verificationUrl = `${buildAppUrl(input.verificationBaseUrl, '/verify-registration')}?token=${encodeURIComponent(token)}`
  const template = buildRegistrationVerificationEmail({
    firstName,
    verificationUrl,
    verificationExpiresAt,
    verificationExpiresInHours: config.registration.verificationExpiresInHours,
    licenseDurationDays: inviteCode.licenseDurationDays,
  })

  try {
    await sendMail({
      to: email,
      ...template,
    })
  } catch (error) {
    await prisma.pendingRegistration.update({
      where: { id: pendingRegistration.id },
      data: { status: PendingRegistrationStatus.CANCELLED },
    })
    throw error
  }

  return {
    email: pendingRegistration.email,
    firstName: pendingRegistration.firstName,
    lastName: pendingRegistration.lastName,
    verificationExpiresAt: pendingRegistration.verificationExpiresAt,
    licenseDurationDays: inviteCode.licenseDurationDays,
  }
}

export async function getRegistrationVerificationDetails(token: string) {
  const verificationTokenHash = hashToken(token)
  const registration = await prisma.pendingRegistration.findFirst({
    where: {
      verificationTokenHash,
      status: PendingRegistrationStatus.PENDING,
      verificationExpiresAt: { gt: new Date() },
    },
    select: verificationDetailsSelect,
  })

  if (!registration) {
    throw new Error('Registrazione non valida o scaduta')
  }

  return {
    email: registration.email,
    firstName: registration.firstName,
    lastName: registration.lastName,
    verificationExpiresAt: registration.verificationExpiresAt,
    code: registration.inviteCode.code,
    licenseDurationDays: registration.inviteCode.licenseDurationDays,
  }
}

export async function completeInviteCodeRegistration(token: string) {
  const verificationTokenHash = hashToken(token)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const registration = await tx.pendingRegistration.findFirst({
      where: {
        verificationTokenHash,
        status: PendingRegistrationStatus.PENDING,
        verificationExpiresAt: { gt: now },
      },
      include: {
        inviteCode: true,
      },
    })

    if (!registration) {
      throw new Error('Registrazione non valida o scaduta')
    }

    const claimedRegistration = await tx.pendingRegistration.updateMany({
      where: {
        id: registration.id,
        status: PendingRegistrationStatus.PENDING,
      },
      data: {
        status: PendingRegistrationStatus.VERIFIED,
        verifiedAt: now,
      },
    })

    if (claimedRegistration.count !== 1) {
      throw new Error('Registrazione non valida o scaduta')
    }

    const claimedCode = await tx.inviteCode.updateMany({
      where: {
        id: registration.inviteCodeId,
        code: normalizeInviteCode(registration.inviteCode.code),
        status: InviteCodeStatus.ACTIVE,
        redemptionsCount: 0,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      data: {
        redemptionsCount: { increment: 1 },
        status: InviteCodeStatus.REDEEMED,
        redeemedAt: now,
      },
    })

    if (claimedCode.count !== 1) {
      throw new Error('Codice invito non valido o scaduto')
    }

    const existingUser = await tx.user.findUnique({
      where: { email: registration.email },
      select: { id: true },
    })

    if (existingUser) {
      throw new Error('Esiste già un account con questa email')
    }

    const licenseExpiresAt = calculateLicenseExpiresAtFromActivation(now, registration.inviteCode.licenseDurationDays)
    const user = await tx.user.create({
      data: {
        email: registration.email,
        name: buildFullName(registration.firstName, registration.lastName),
        firstName: registration.firstName,
        lastName: registration.lastName,
        phone: registration.phone,
        role: UserRole.STANDARD,
        isActive: true,
        licenseExpiresAt,
        password: registration.passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sessionVersion: true,
      },
    })

    if (registration.termsPolicyVersionId) {
      await tx.userTermsAcceptance.create({
        data: {
          userId: user.id,
          termsPolicyVersionId: registration.termsPolicyVersionId,
          acceptedAt: registration.termsAcceptedAt ?? now,
          source: 'SELF_SERVICE',
        },
      })
    }

    const communicationConsents = parsePendingCommunicationConsents(registration.communicationConsents)

    if (registration.communicationPolicyVersionId && communicationConsents.length) {
      const contact = await tx.contact.upsert({
        where: { email: registration.email },
        update: { status: ContactStatus.ACTIVE, suppressedAt: null, suppressionReason: null },
        create: { email: registration.email, status: ContactStatus.ACTIVE },
      })

      await tx.consent.updateMany({
        where: {
          contactId: contact.id,
          consentFormulaId: {
            in: communicationConsents.map((consent) => consent.formulaId),
          },
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: now,
          invalidationReason: 'replaced_by_registration_completion',
        },
      })

      await tx.consent.createMany({
        data: communicationConsents.map((consent) => ({
          contactId: contact.id,
          consentFormulaId: consent.formulaId,
          consentFormulaVersionId: consent.formulaVersionId,
          policyVersionId: registration.communicationPolicyVersionId!,
          value: consent.value,
          status: ConsentRecordStatus.CONFIRMED,
          source: ConsentSource.SUBSCRIBE,
        })),
      })
    }

    await tx.inviteCode.update({
      where: { id: registration.inviteCodeId },
      data: {
        redeemedByUserId: user.id,
      },
    })

    await tx.pendingRegistration.updateMany({
      where: {
        email: registration.email,
        status: PendingRegistrationStatus.PENDING,
      },
      data: {
        status: PendingRegistrationStatus.CANCELLED,
      },
    })

    return {
      user,
      inviteCode: registration.inviteCode,
      licenseExpiresAt,
      termsPolicyVersionId: registration.termsPolicyVersionId,
    }
  })
}
