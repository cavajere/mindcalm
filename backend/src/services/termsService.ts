import { TermsPolicyStatus, TermsPolicyVersionStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'

type TermsTranslationPayload = {
  lang: string
  title?: string | null
  html: string
  buttonLabel?: string | null
}

export async function getOrCreateTermsPolicy() {
  const existing = await prisma.termsPolicy.findFirst({
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
    },
  })

  if (existing) return existing

  return prisma.$transaction(async (tx) => {
    const policy = await tx.termsPolicy.create({
      data: {
        status: TermsPolicyStatus.DRAFT,
      },
    })

    const version = await tx.termsPolicyVersion.create({
      data: {
        termsPolicyId: policy.id,
        versionNumber: 1,
        status: TermsPolicyVersionStatus.DRAFT,
      },
    })

    await tx.termsPolicy.update({
      where: { id: policy.id },
      data: { currentVersionId: version.id },
    })

    return tx.termsPolicy.findUniqueOrThrow({
      where: { id: policy.id },
      include: {
        currentVersion: { include: { translations: true } },
        versions: { orderBy: { versionNumber: 'desc' }, include: { translations: true } },
      },
    })
  })
}

export async function createTermsDraftVersion(policyId: string) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.termsPolicy.findUniqueOrThrow({
      where: { id: policyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            translations: true,
          },
        },
      },
    })

    const existingDraft = policy.versions.find((version) => version.status === TermsPolicyVersionStatus.DRAFT)
    if (existingDraft) {
      throw new Error('Esiste già una versione DRAFT dei termini')
    }

    const latestVersion = policy.versions[0]
    if (!latestVersion) throw new Error('Versione termini corrente non trovata')

    const draft = await tx.termsPolicyVersion.create({
      data: {
        termsPolicyId: policy.id,
        versionNumber: latestVersion.versionNumber + 1,
        previousVersionId: latestVersion.id,
        status: TermsPolicyVersionStatus.DRAFT,
      },
    })

    if (latestVersion.translations.length) {
      await tx.termsPolicyVersionTranslation.createMany({
        data: latestVersion.translations.map((translation) => ({
          versionId: draft.id,
          lang: translation.lang,
          title: translation.title,
          html: translation.html,
          buttonLabel: translation.buttonLabel,
        })),
      })
    }

    return draft
  })
}

export async function upsertTermsTranslations(versionId: string, translations: TermsTranslationPayload[]) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.termsPolicyVersion.findUniqueOrThrow({ where: { id: versionId } })

    if (version.status !== TermsPolicyVersionStatus.DRAFT) {
      throw new Error('Puoi modificare solo traduzioni di versioni DRAFT')
    }

    for (const translation of translations) {
      await tx.termsPolicyVersionTranslation.upsert({
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

    return tx.termsPolicyVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { translations: true },
    })
  })
}

export async function publishTermsVersion(policyId: string, versionId: string) {
  return prisma.$transaction(async (tx) => {
    const targetVersion = await tx.termsPolicyVersion.findFirst({
      where: { id: versionId, termsPolicyId: policyId },
      include: {
        translations: true,
      },
    })

    if (!targetVersion) throw new Error('Versione termini non trovata')
    if (targetVersion.status !== TermsPolicyVersionStatus.DRAFT) {
      throw new Error('Solo una versione DRAFT puo essere pubblicata')
    }
    if (!targetVersion.translations.length) {
      throw new Error('Aggiungi almeno una traduzione termini prima del publish')
    }

    const now = new Date()
    const policy = await tx.termsPolicy.findUniqueOrThrow({ where: { id: policyId } })

    if (policy.currentVersionId && policy.currentVersionId !== versionId) {
      await tx.termsPolicyVersion.update({
        where: { id: policy.currentVersionId },
        data: { status: TermsPolicyVersionStatus.ARCHIVED },
      })
    }

    await tx.termsPolicyVersion.update({
      where: { id: versionId },
      data: {
        status: TermsPolicyVersionStatus.PUBLISHED,
        publishedAt: now,
      },
    })

    await tx.termsPolicy.update({
      where: { id: policyId },
      data: {
        status: TermsPolicyStatus.PUBLISHED,
        currentVersionId: versionId,
      },
    })

    return tx.termsPolicy.findUniqueOrThrow({
      where: { id: policyId },
      include: {
        currentVersion: { include: { translations: true } },
        versions: { orderBy: { versionNumber: 'desc' }, include: { translations: true } },
      },
    })
  })
}

export async function getPublicTermsPolicy(lang = 'it') {
  return prisma.termsPolicy.findFirst({
    where: { status: TermsPolicyStatus.PUBLISHED },
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
  })
}
