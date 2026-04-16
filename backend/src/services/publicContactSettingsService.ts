import { prisma } from '../lib/prisma'

const PUBLIC_CONTACT_SETTINGS_ROW_ID = 1

export interface PublicContactSettingsInput {
  title?: string | null
  description?: string | null
  email?: string | null
  phone?: string | null
  whatsappNumber?: string | null
  whatsappEnabled?: boolean
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeWhatsappUrl(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits ? `https://wa.me/${digits}` : null
}

function mapPublicContactSettings(record: {
  id: number
  title: string | null
  description: string | null
  email: string | null
  phone: string | null
  whatsappNumber: string | null
  whatsappEnabled: boolean
  updatedAt: Date
} | null) {
  const title = normalizeOptionalText(record?.title)
  const description = normalizeOptionalText(record?.description)
  const email = normalizeOptionalText(record?.email)
  const phone = normalizeOptionalText(record?.phone)
  const whatsappNumber = normalizeOptionalText(record?.whatsappNumber)
  const whatsappEnabled = Boolean(record?.whatsappEnabled)
  const whatsappUrl = whatsappEnabled ? normalizeWhatsappUrl(whatsappNumber) : null
  const hasContacts = Boolean(description || email || phone || whatsappUrl)

  return {
    id: PUBLIC_CONTACT_SETTINGS_ROW_ID,
    title: title ?? '',
    description: description ?? '',
    email: email ?? '',
    phone: phone ?? '',
    whatsappNumber: whatsappNumber ?? '',
    whatsappEnabled,
    whatsappUrl,
    hasContacts,
    updatedAt: record?.updatedAt ?? null,
  }
}

export async function getPublicContactSettingsForAdmin() {
  const settings = await prisma.publicContactSettings.findUnique({
    where: { id: PUBLIC_CONTACT_SETTINGS_ROW_ID },
  })

  return mapPublicContactSettings(settings)
}

export async function getPublicContactSettingsForPublic() {
  const settings = await prisma.publicContactSettings.findUnique({
    where: { id: PUBLIC_CONTACT_SETTINGS_ROW_ID },
  })

  const mapped = mapPublicContactSettings(settings)

  return {
    title: mapped.title,
    description: mapped.description,
    email: mapped.email,
    phone: mapped.phone,
    whatsappNumber: mapped.whatsappNumber,
    whatsappEnabled: mapped.whatsappEnabled,
    whatsappUrl: mapped.whatsappUrl,
    hasContacts: mapped.hasContacts,
    updatedAt: mapped.updatedAt,
  }
}

export async function savePublicContactSettings(input: PublicContactSettingsInput) {
  const settings = await prisma.publicContactSettings.upsert({
    where: { id: PUBLIC_CONTACT_SETTINGS_ROW_ID },
    create: {
      id: PUBLIC_CONTACT_SETTINGS_ROW_ID,
      title: normalizeOptionalText(input.title),
      description: normalizeOptionalText(input.description),
      email: normalizeOptionalText(input.email),
      phone: normalizeOptionalText(input.phone),
      whatsappNumber: normalizeOptionalText(input.whatsappNumber),
      whatsappEnabled: Boolean(input.whatsappEnabled),
    },
    update: {
      title: normalizeOptionalText(input.title),
      description: normalizeOptionalText(input.description),
      email: normalizeOptionalText(input.email),
      phone: normalizeOptionalText(input.phone),
      whatsappNumber: normalizeOptionalText(input.whatsappNumber),
      whatsappEnabled: Boolean(input.whatsappEnabled),
    },
  })

  return mapPublicContactSettings(settings)
}
