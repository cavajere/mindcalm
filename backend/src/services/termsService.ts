import { TermsPolicyStatus, TermsPolicyVersionStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'

type TermsContentPayload = {
  title?: string | null
  html: string
  buttonLabel?: string | null
}

function includeTermsPolicy() {
  return {
    currentVersion: true,
    versions: {
      orderBy: { versionNumber: 'desc' as const },
    },
  }
}

export async function getOrCreateTermsPolicy() {
  const existing = await prisma.termsPolicy.findFirst({
    include: includeTermsPolicy(),
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
      include: includeTermsPolicy(),
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
        },
      },
    })

    const existingDraft = policy.versions.find((version) => version.status === TermsPolicyVersionStatus.DRAFT)
    if (existingDraft) {
      throw new Error('Esiste già una versione DRAFT dei termini')
    }

    const latestVersion = policy.versions[0]
    if (!latestVersion) throw new Error('Versione termini corrente non trovata')

    return tx.termsPolicyVersion.create({
      data: {
        termsPolicyId: policy.id,
        versionNumber: latestVersion.versionNumber + 1,
        previousVersionId: latestVersion.id,
        status: TermsPolicyVersionStatus.DRAFT,
        title: latestVersion.title,
        html: latestVersion.html,
        buttonLabel: latestVersion.buttonLabel,
      },
    })
  })
}

export async function upsertTermsContent(versionId: string, content: TermsContentPayload) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.termsPolicyVersion.findUniqueOrThrow({ where: { id: versionId } })

    if (version.status !== TermsPolicyVersionStatus.DRAFT) {
      throw new Error('Puoi modificare solo versioni DRAFT')
    }

    return tx.termsPolicyVersion.update({
      where: { id: versionId },
      data: {
        title: content.title ?? null,
        html: content.html,
        buttonLabel: content.buttonLabel ?? null,
      },
    })
  })
}

export async function publishTermsVersion(policyId: string, versionId: string) {
  return prisma.$transaction(async (tx) => {
    const targetVersion = await tx.termsPolicyVersion.findFirst({
      where: { id: versionId, termsPolicyId: policyId },
    })

    if (!targetVersion) throw new Error('Versione termini non trovata')
    if (targetVersion.status !== TermsPolicyVersionStatus.DRAFT) {
      throw new Error('Solo una versione DRAFT puo essere pubblicata')
    }
    if (!targetVersion.html?.trim()) {
      throw new Error('Compila i contenuti dei termini prima del publish')
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
      include: includeTermsPolicy(),
    })
  })
}

export async function getPublicTermsPolicy() {
  return prisma.termsPolicy.findFirst({
    where: { status: TermsPolicyStatus.PUBLISHED },
    include: {
      currentVersion: true,
    },
  })
}
