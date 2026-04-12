import { InviteCodeStatus, Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'

const INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'
const INVITE_CODE_LENGTH = 7
const INVITE_CODE_MAX_GENERATION_ATTEMPTS = 10

const inviteCodeSelect = {
  id: true,
  code: true,
  licenseDurationDays: true,
  maxRedemptions: true,
  redemptionsCount: true,
  status: true,
  expiresAt: true,
  redeemedAt: true,
  createdAt: true,
  updatedAt: true,
  notes: true,
  createdByUser: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  redeemedByUser: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} satisfies Prisma.InviteCodeSelect

type InviteCodeRecord = Prisma.InviteCodeGetPayload<{ select: typeof inviteCodeSelect }>

function getRandomCharacter() {
  return INVITE_CODE_ALPHABET[crypto.randomInt(0, INVITE_CODE_ALPHABET.length)]
}

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase()
}

export function generateInviteCode() {
  let code = ''

  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += getRandomCharacter()
  }

  return code
}

export function getInviteCodeEffectiveStatus(
  inviteCode: Pick<InviteCodeRecord, 'status' | 'expiresAt'>,
  now = new Date(),
): InviteCodeStatus {
  if (inviteCode.status === InviteCodeStatus.ACTIVE && inviteCode.expiresAt && inviteCode.expiresAt.getTime() <= now.getTime()) {
    return InviteCodeStatus.EXPIRED
  }

  return inviteCode.status
}

function serializeInviteCode(inviteCode: InviteCodeRecord, now = new Date()) {
  return {
    id: inviteCode.id,
    code: inviteCode.code,
    licenseDurationDays: inviteCode.licenseDurationDays,
    maxRedemptions: inviteCode.maxRedemptions,
    redemptionsCount: inviteCode.redemptionsCount,
    status: getInviteCodeEffectiveStatus(inviteCode, now),
    expiresAt: inviteCode.expiresAt,
    redeemedAt: inviteCode.redeemedAt,
    createdAt: inviteCode.createdAt,
    updatedAt: inviteCode.updatedAt,
    notes: inviteCode.notes || '',
    createdBy: inviteCode.createdByUser,
    redeemedBy: inviteCode.redeemedByUser,
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function createInviteCode(input: {
  licenseDurationDays: number
  expiresAt?: Date | null
  notes?: string | null
  createdByUserId?: string | null
}) {
  for (let attempt = 0; attempt < INVITE_CODE_MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()

    try {
      const inviteCode = await prisma.inviteCode.create({
        data: {
          code,
          licenseDurationDays: input.licenseDurationDays,
          expiresAt: input.expiresAt ?? null,
          notes: input.notes ?? null,
          createdByUserId: input.createdByUserId ?? null,
        },
        select: inviteCodeSelect,
      })

      return serializeInviteCode(inviteCode)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue
      }

      throw error
    }
  }

  throw new Error('Generazione codice invito non riuscita')
}

export async function listInviteCodes(input: {
  page: number
  limit: number
  search?: string
  status?: string
}) {
  const now = new Date()
  const normalizedSearch = input.search?.trim()
  const normalizedStatus = input.status?.trim().toUpperCase()

  const andFilters: Prisma.InviteCodeWhereInput[] = []

  if (normalizedSearch) {
    andFilters.push({
      OR: [
        { code: { contains: normalizedSearch, mode: 'insensitive' } },
        { notes: { contains: normalizedSearch, mode: 'insensitive' } },
      ],
    })
  }

  if (normalizedStatus === InviteCodeStatus.ACTIVE) {
    andFilters.push({
      status: InviteCodeStatus.ACTIVE,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    })
  } else if (normalizedStatus === InviteCodeStatus.EXPIRED) {
    andFilters.push({
      status: InviteCodeStatus.ACTIVE,
      expiresAt: { lte: now },
    })
  } else if (normalizedStatus === InviteCodeStatus.REDEEMED || normalizedStatus === InviteCodeStatus.DISABLED) {
    andFilters.push({
      status: normalizedStatus as InviteCodeStatus,
    })
  }

  const where: Prisma.InviteCodeWhereInput = andFilters.length ? { AND: andFilters } : {}

  const skip = (input.page - 1) * input.limit
  const [items, total] = await Promise.all([
    prisma.inviteCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: input.limit,
      select: inviteCodeSelect,
    }),
    prisma.inviteCode.count({ where }),
  ])

  return {
    data: items.map((item) => serializeInviteCode(item, now)),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  }
}

export async function getInviteCodeById(id: string) {
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { id },
    select: inviteCodeSelect,
  })

  if (!inviteCode) {
    throw new Error('Codice invito non trovato')
  }

  return serializeInviteCode(inviteCode)
}

export async function disableInviteCode(id: string) {
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { id },
    select: inviteCodeSelect,
  })

  if (!inviteCode) {
    throw new Error('Codice invito non trovato')
  }

  if (inviteCode.status === InviteCodeStatus.DISABLED) {
    return serializeInviteCode(inviteCode)
  }

  if (inviteCode.status === InviteCodeStatus.REDEEMED || inviteCode.redemptionsCount >= inviteCode.maxRedemptions) {
    throw new Error('Non puoi disabilitare un codice già riscattato')
  }

  const updated = await prisma.inviteCode.update({
    where: { id },
    data: { status: InviteCodeStatus.DISABLED },
    select: inviteCodeSelect,
  })

  return serializeInviteCode(updated)
}

export async function getPublicInviteCodeDetails(code: string) {
  const normalizedCode = normalizeInviteCode(code)
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      licenseDurationDays: true,
      expiresAt: true,
      status: true,
      redemptionsCount: true,
      maxRedemptions: true,
    },
  })

  const now = new Date()
  if (
    !inviteCode ||
    inviteCode.status !== InviteCodeStatus.ACTIVE ||
    inviteCode.redemptionsCount >= inviteCode.maxRedemptions ||
    (inviteCode.expiresAt && inviteCode.expiresAt.getTime() <= now.getTime())
  ) {
    throw new Error('Codice invito non valido o scaduto')
  }

  return {
    id: inviteCode.id,
    code: inviteCode.code,
    licenseDurationDays: inviteCode.licenseDurationDays,
  }
}
