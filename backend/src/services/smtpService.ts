import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma'
import { decryptText, encryptText } from './cryptoService'

export interface SmtpSettingsInput {
  host: string
  port: number
  secure: boolean
  username?: string | null
  password?: string | null
  fromEmail: string
  fromName?: string | null
}

export async function getSmtpSettings() {
  return prisma.smtpSettings.findUnique({ where: { id: 1 } })
}

export async function saveSmtpSettings(input: SmtpSettingsInput) {
  const existing = await getSmtpSettings()

  const passwordEncrypted = input.password
    ? encryptText(input.password)
    : existing?.passwordEncrypted || null

  return prisma.smtpSettings.upsert({
    where: { id: 1 },
    update: {
      host: input.host,
      port: input.port,
      secure: input.secure,
      username: input.username || null,
      passwordEncrypted,
      fromEmail: input.fromEmail,
      fromName: input.fromName || null,
    },
    create: {
      id: 1,
      host: input.host,
      port: input.port,
      secure: input.secure,
      username: input.username || null,
      passwordEncrypted,
      fromEmail: input.fromEmail,
      fromName: input.fromName || null,
    },
  })
}

export async function getSmtpSettingsForAdmin() {
  const settings = await getSmtpSettings()

  if (!settings) {
    return null
  }

  return {
    id: settings.id,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    hasPassword: Boolean(settings.passwordEncrypted),
    updatedAt: settings.updatedAt,
  }
}

async function buildTransport() {
  const settings = await getSmtpSettings()
  if (!settings) {
    throw new Error('SMTP non configurato')
  }

  const password = settings.passwordEncrypted ? decryptText(settings.passwordEncrypted) : undefined

  return {
    transporter: nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.username
        ? {
            user: settings.username,
            pass: password,
          }
        : undefined,
    }),
    settings,
  }
}

export async function sendMail(input: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const { transporter, settings } = await buildTransport()

  await transporter.sendMail({
    from: settings.fromName
      ? `"${settings.fromName}" <${settings.fromEmail}>`
      : settings.fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })
}

export async function sendTestMail(to: string) {
  await sendMail({
    to,
    subject: 'Test configurazione SMTP MindCalm',
    text: 'La configurazione SMTP di MindCalm è valida.',
    html: '<p>La configurazione SMTP di <strong>MindCalm</strong> è valida.</p>',
  })
}
