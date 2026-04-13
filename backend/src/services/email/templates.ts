import designTokensPkg from '@mindcalm/design-tokens'

export interface EmailTemplate {
  subject: string
  text: string
  html: string
}

export interface ContentNotificationItem {
  type: 'audio' | 'article'
  title: string
  publishedAt: Date | null
  url?: string | null
}

interface EmailLayoutInput {
  subject: string
  preheader: string
  title: string
  bodyHtml: string
  footerNote?: string
}

const { designTokens } = designTokensPkg
const EMAIL_FONT_FAMILY = designTokens.typography.fontFamilySans.join(', ')
const EMAIL_THEME = designTokens.themes.frontend.light
const EMAIL_COLORS = {
  primary: designTokens.brand.primary.DEFAULT,
  primaryDark: designTokens.brand.primary.dark,
  primaryLight: designTokens.brand.primary.light,
  surface: EMAIL_THEME.surface,
  background: EMAIL_THEME.background,
  textPrimary: EMAIL_THEME.textPrimary,
  textSecondary: EMAIL_THEME.textSecondary,
  border: EMAIL_THEME.border,
  muted: EMAIL_THEME.muted,
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

function formatDate(value: Date | null) {
  if (!value) {
    return 'Data non disponibile'
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
  }).format(value)
}

function renderParagraph(text: string) {
  return `<p style="margin:0 0 16px;color:${EMAIL_COLORS.textPrimary};font-size:16px;line-height:1.7;">${escapeHtml(text)}</p>`
}

function renderButton(label: string, url: string) {
  const safeUrl = escapeHtml(url)

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 20px;">` +
    `<tr>` +
    `<td style="border-radius:12px;background:${EMAIL_COLORS.primary};text-align:center;">` +
    `<a href="${safeUrl}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>` +
    `</td>` +
    `</tr>` +
    `</table>`
  )
}

function renderLink(url: string) {
  const safeUrl = escapeHtml(url)

  return (
    `<p style="margin:0 0 16px;color:${EMAIL_COLORS.textSecondary};font-size:13px;line-height:1.7;">` +
    `Se il pulsante non funziona, copia questo link nel browser:<br>` +
    `<a href="${safeUrl}" style="color:${EMAIL_COLORS.primary};text-decoration:underline;word-break:break-all;">${safeUrl}</a>` +
    `</p>`
  )
}

function renderInfoCard(items: Array<{ label: string; value: string }>) {
  if (items.length === 0) {
    return ''
  }

  return (
    `<div style="margin:24px 0;padding:18px 20px;border:1px solid ${EMAIL_COLORS.border};border-radius:16px;background:${EMAIL_COLORS.muted};">` +
    items.map((item) => (
      `<div style="margin:${item === items[0] ? '0' : '12px 0 0'};">` +
      `<div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${EMAIL_COLORS.textSecondary};">${escapeHtml(item.label)}</div>` +
      `<div style="margin-top:4px;font-size:15px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};">${escapeHtml(item.value)}</div>` +
      `</div>`
    )).join('') +
    `</div>`
  )
}

function renderMutedNote(text: string) {
  return `<p style="margin:0;color:${EMAIL_COLORS.textSecondary};font-size:14px;line-height:1.7;">${escapeHtml(text)}</p>`
}

function renderEmailLayout(input: EmailLayoutInput) {
  const footer = input.footerNote
    ? `<p style="margin:0;color:${EMAIL_COLORS.textSecondary};font-size:13px;line-height:1.7;">${escapeHtml(input.footerNote)}</p>`
    : `<p style="margin:0;color:${EMAIL_COLORS.textSecondary};font-size:13px;line-height:1.7;">Email automatica inviata da MindCalm.</p>`

  return (
    `<!DOCTYPE html>` +
    `<html lang="it">` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<meta name="x-apple-disable-message-reformatting">` +
    `<title>${escapeHtml(input.subject)}</title>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${EMAIL_COLORS.background};font-family:${EMAIL_FONT_FAMILY};">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${EMAIL_COLORS.background};">` +
    `<tr>` +
    `<td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:separate;background:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.border};border-radius:24px;overflow:hidden;">` +
    `<tr>` +
    `<td style="padding:28px 28px 0;background:${EMAIL_COLORS.surface};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">` +
    `<tr>` +
    `<td style="width:44px;height:44px;border-radius:14px;background:${EMAIL_COLORS.primary};text-align:center;font-size:18px;font-weight:700;line-height:44px;color:#ffffff;">M</td>` +
    `<td style="padding-left:12px;">` +
    `<div style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_COLORS.primaryDark};">MindCalm</div>` +
    `<div style="margin-top:2px;font-size:13px;line-height:1.4;color:${EMAIL_COLORS.textSecondary};">Benessere digitale, con la stessa UI dell'app.</div>` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</td>` +
    `</tr>` +
    `<tr>` +
    `<td style="padding:24px 28px 28px;">` +
    `<div style="height:8px;width:72px;border-radius:999px;background:${EMAIL_COLORS.primaryLight};margin:0 0 20px;"></div>` +
    `<h1 style="margin:0 0 20px;color:${EMAIL_COLORS.textPrimary};font-size:30px;line-height:1.2;font-weight:700;">${escapeHtml(input.title)}</h1>` +
    input.bodyHtml +
    `</td>` +
    `</tr>` +
    `<tr>` +
    `<td style="padding:0 28px 28px;">` +
    `<div style="padding-top:18px;border-top:1px solid ${EMAIL_COLORS.border};">${footer}</div>` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</td>` +
    `</tr>` +
    `</table>` +
    `</body>` +
    `</html>`
  )
}

function joinTextBlocks(blocks: string[]) {
  return blocks.filter(Boolean).join('\n\n')
}

function toContentTypeLabel(type: ContentNotificationItem['type']) {
  return type === 'audio' ? 'Audio' : 'Articolo'
}

function renderContentItems(items: ContentNotificationItem[]) {
  return (
    `<div style="margin:24px 0 20px;">` +
    items.map((item) => (
      `<div style="margin:0 0 12px;padding:16px 18px;border:1px solid ${EMAIL_COLORS.border};border-radius:16px;background:${EMAIL_COLORS.muted};">` +
      `<div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${EMAIL_COLORS.primaryDark};">${escapeHtml(toContentTypeLabel(item.type))}</div>` +
      `<div style="margin-top:6px;color:${EMAIL_COLORS.textPrimary};font-size:17px;line-height:1.5;font-weight:600;">${escapeHtml(item.title)}</div>` +
      `<div style="margin-top:4px;color:${EMAIL_COLORS.textSecondary};font-size:13px;line-height:1.6;">Pubblicato il ${escapeHtml(formatDate(item.publishedAt))}</div>` +
      (item.url
        ? `<div style="margin-top:10px;"><a href="${escapeHtml(item.url)}" style="color:${EMAIL_COLORS.primary};font-size:14px;font-weight:700;text-decoration:underline;">Apri contenuto</a></div>`
        : '') +
      `</div>`
    )).join('') +
    `</div>`
  )
}

export function buildUserInviteEmail(input: {
  name: string
  inviteUrl: string
  expiresAt: Date
  expiresIn: string
}): EmailTemplate {
  const subject = 'Sei stato invitato su MindCalm'
  const text = joinTextBlocks([
    `Ciao ${input.name},`,
    `Il tuo account MindCalm e' pronto. Imposta la password entro ${input.expiresIn} usando questo link:\n${input.inviteUrl}`,
    `Scadenza: ${formatDateTime(input.expiresAt)}`,
    'Se non ti aspettavi questa email, puoi ignorarla.',
  ])
  const html = renderEmailLayout({
    subject,
    preheader: 'Imposta la password del tuo account MindCalm.',
    title: "Il tuo account e' pronto",
    bodyHtml:
      renderParagraph(`Ciao ${input.name},`) +
      renderParagraph(`Il tuo account MindCalm e' pronto. Imposta la password entro ${input.expiresIn} per completare il primo accesso.`) +
      renderButton('Imposta password', input.inviteUrl) +
      renderLink(input.inviteUrl) +
      renderInfoCard([{ label: 'Scadenza link', value: formatDateTime(input.expiresAt) }]) +
      renderMutedNote('Se non ti aspettavi questa email, puoi ignorarla.'),
    footerNote: 'Invito account MindCalm.',
  })

  return { subject, text, html }
}

export function buildRegistrationVerificationEmail(input: {
  firstName: string
  verificationUrl: string
  verificationExpiresAt: Date
  verificationExpiresInHours: number
  licenseDurationDays: number
}): EmailTemplate {
  const subject = 'Conferma la registrazione a MindCalm'
  const text = joinTextBlocks([
    `Ciao ${input.firstName},`,
    `Conferma la tua registrazione a MindCalm entro ${input.verificationExpiresInHours} ore usando questo link:\n${input.verificationUrl}`,
    `Dopo la conferma, la tua licenza di ${input.licenseDurationDays} giorni verra' attivata automaticamente.`,
    `Scadenza link: ${formatDateTime(input.verificationExpiresAt)}`,
  ])
  const html = renderEmailLayout({
    subject,
    preheader: 'Conferma la tua email per attivare la registrazione.',
    title: 'Conferma la registrazione',
    bodyHtml:
      renderParagraph(`Ciao ${input.firstName},`) +
      renderParagraph(`Conferma la tua registrazione a MindCalm entro ${input.verificationExpiresInHours} ore per attivare il tuo accesso.`) +
      renderButton('Conferma email', input.verificationUrl) +
      renderLink(input.verificationUrl) +
      renderInfoCard([
        { label: 'Licenza', value: `${input.licenseDurationDays} giorni` },
        { label: 'Scadenza link', value: formatDateTime(input.verificationExpiresAt) },
      ]),
    footerNote: 'Completamento registrazione MindCalm.',
  })

  return { subject, text, html }
}

export function buildPasswordResetEmail(input: {
  resetUrl: string
  expiresAt: Date
  expiresMinutes: number
}): EmailTemplate {
  const subject = 'Reimposta la password di MindCalm'
  const text = joinTextBlocks([
    'Hai richiesto il reset della password.',
    `Usa questo link entro ${input.expiresMinutes} minuti:\n${input.resetUrl}`,
    `Scadenza: ${formatDateTime(input.expiresAt)}`,
    'Se non hai richiesto il reset, ignora questa email.',
  ])
  const html = renderEmailLayout({
    subject,
    preheader: 'Link per reimpostare la password MindCalm.',
    title: 'Reimposta la password',
    bodyHtml:
      renderParagraph('Hai richiesto il reset della password del tuo account MindCalm.') +
      renderParagraph(`Apri il link entro ${input.expiresMinutes} minuti per scegliere una nuova password.`) +
      renderButton('Reimposta password', input.resetUrl) +
      renderLink(input.resetUrl) +
      renderInfoCard([{ label: 'Scadenza link', value: formatDateTime(input.expiresAt) }]) +
      renderMutedNote('Se non hai richiesto il reset, ignora questa email.'),
    footerNote: 'Recupero password MindCalm.',
  })

  return { subject, text, html }
}

export function buildContentNotificationEmail(input: {
  name: string
  subject: string
  title: string
  intro: string
  items: ContentNotificationItem[]
}): EmailTemplate {
  const text = joinTextBlocks([
    `Ciao ${input.name},`,
    input.intro,
    ...input.items.map((item) => [
      `${toContentTypeLabel(item.type)}: ${item.title} (${formatDate(item.publishedAt)})`,
      item.url ? `Apri: ${item.url}` : null,
    ].filter(Boolean).join('\n')),
    'Puoi modificare le preferenze dalla pagina Profilo.',
  ])
  const html = renderEmailLayout({
    subject: input.subject,
    preheader: input.intro,
    title: input.title,
    bodyHtml:
      renderParagraph(`Ciao ${input.name},`) +
      renderParagraph(input.intro) +
      renderContentItems(input.items) +
      renderMutedNote('Puoi modificare le preferenze delle notifiche dalla pagina Profilo.'),
    footerNote: 'Notifica contenuti MindCalm.',
  })

  return {
    subject: input.subject,
    text,
    html,
  }
}

export function buildSmtpTestEmail(): EmailTemplate {
  const subject = 'Test configurazione SMTP MindCalm'
  const text = "La configurazione SMTP di MindCalm e' valida."
  const html = renderEmailLayout({
    subject,
    preheader: 'Verifica riuscita della configurazione SMTP.',
    title: 'Configurazione SMTP valida',
    bodyHtml:
      renderParagraph("La configurazione SMTP di MindCalm e' valida.") +
      renderMutedNote('Puoi usare questo server per notifiche operative, inviti e recupero password.'),
    footerNote: 'Messaggio di test SMTP MindCalm.',
  })

  return { subject, text, html }
}
