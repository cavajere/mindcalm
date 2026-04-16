import { body, query } from 'express-validator'

const auditActions = [
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'INVITE_SENT',
  'INVITE_ACCEPTED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_INVITE_RESENT',
  'INVITE_CODE_CREATED',
  'INVITE_CODE_DISABLED',
  'INVITE_CODE_REDEEMED',
  'REGISTRATION_STARTED',
  'REGISTRATION_VERIFICATION_SENT',
  'REGISTRATION_VERIFIED',
  'REGISTRATION_FAILED',
  'AUDIO_CREATED',
  'AUDIO_UPDATED',
  'AUDIO_DELETED',
  'AUDIO_STATUS_CHANGED',
  'ALBUM_IMAGE_CREATED',
  'ALBUM_IMAGE_UPDATED',
  'ALBUM_IMAGE_DELETED',
  'POST_CREATED',
  'POST_UPDATED',
  'POST_DELETED',
  'POST_STATUS_CHANGED',
  'EVENT_CREATED',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'EVENT_DELETED',
  'EVENT_STATUS_CHANGED',
  'EVENT_BOOKING_CREATED',
  'EVENT_BOOKING_CANCELLED',
  'EVENT_BOOKING_RESTORED',
  'EVENT_BOOKING_RECONCILED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DELETED',
  'CATEGORY_ORDER_UPDATED',
  'TAG_CREATED',
  'TAG_UPDATED',
  'TAG_DELETED',
  'TAG_STATUS_CHANGED',
  'SMTP_SETTINGS_UPDATED',
  'SMTP_TEST_SENT',
  'TERMS_POLICY_PUBLISHED',
  'TERMS_ACCEPTED',
  'CONSENT_POLICY_PUBLISHED',
  'CONSENT_POLICY_ARCHIVED',
  'CONSENT_FORMULA_CREATED',
  'CONSENT_FORMULA_UPDATED',
  'CONSENT_FORMULA_DELETED',
  'SUBSCRIPTION_SUBMITTED',
  'SUBSCRIPTION_CONFIRMED',
  'SUBSCRIPTION_UNSUBSCRIBED',
  'CAMPAIGN_CREATED',
  'CAMPAIGN_SENT',
]

const auditEntityTypes = ['AUTH', 'USER', 'INVITE_CODE', 'REGISTRATION', 'TERMS_POLICY', 'AUDIO', 'ALBUM_IMAGE', 'POST', 'EVENT', 'CATEGORY', 'TAG', 'SETTINGS', 'SUBSCRIPTION_POLICY', 'CONSENT_FORMULA', 'CONTACT', 'CONSENT', 'CAMPAIGN']
const phonePattern = /^\+?[0-9\s().-]{7,20}$/
const inviteCodePattern = /^[A-NP-Z1-9]{7}$/
const appUrlValidationOptions = {
  require_protocol: true,
  require_tld: false,
} as const

function isValidPhoneNumber(value: string) {
  const normalized = value.trim()
  const digitsOnly = normalized.replace(/\D/g, '')

  return phonePattern.test(normalized) && digitsOnly.length >= 7 && digitsOnly.length <= 15
}

export const loginValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('password').notEmpty().withMessage('Password obbligatoria'),
]

export const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('resetBaseUrl').optional({ values: 'falsy' }).isURL(appUrlValidationOptions).withMessage('URL reset non valido'),
]

export const resetPasswordValidation = [
  body('token').trim().notEmpty().withMessage('Token obbligatorio'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minima 8 caratteri'),
]

export const acceptInviteValidation = [
  body('token').trim().notEmpty().withMessage('Token invito obbligatorio'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minima 8 caratteri'),
]

export const inviteCodeLookupValidation = [
  body('code')
    .trim()
    .matches(inviteCodePattern)
    .withMessage('Codice invito non valido'),
]

export const registerWithInviteCodeValidation = [
  body('code')
    .trim()
    .matches(inviteCodePattern)
    .withMessage('Codice invito non valido'),
  body('email').isEmail().withMessage('Email non valida'),
  body('firstName').trim().notEmpty().withMessage('Nome obbligatorio'),
  body('lastName').trim().notEmpty().withMessage('Cognome obbligatorio'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minima 8 caratteri'),
  body('acceptTerms').optional().isBoolean().withMessage('acceptTerms non valido'),
  body('termsVersionId').optional({ values: 'falsy' }).isUUID().withMessage('termsVersionId non valido'),
  body('consents').optional().isArray().withMessage('consents non validi'),
  body('consents.*.formulaId').optional().isUUID().withMessage('formulaId non valido'),
  body('consents.*.value').optional().isIn(['YES', 'NO']).withMessage('value non valido'),
  body('verificationBaseUrl')
    .optional({ values: 'falsy' })
    .isURL(appUrlValidationOptions)
    .withMessage('URL verifica non valido'),
]

export const registerFreeValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('firstName').trim().notEmpty().withMessage('Nome obbligatorio'),
  body('lastName').trim().notEmpty().withMessage('Cognome obbligatorio'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minima 8 caratteri'),
  body('acceptTerms').optional().isBoolean().withMessage('acceptTerms non valido'),
  body('termsVersionId').optional({ values: 'falsy' }).isUUID().withMessage('termsVersionId non valido'),
  body('consents').optional().isArray().withMessage('consents non validi'),
  body('consents.*.formulaId').optional().isUUID().withMessage('formulaId non valido'),
  body('consents.*.value').optional().isIn(['YES', 'NO']).withMessage('value non valido'),
  body('verificationBaseUrl')
    .optional({ values: 'falsy' })
    .isURL(appUrlValidationOptions)
    .withMessage('URL verifica non valido'),
]

export const verifyRegistrationValidation = [
  body('token').trim().notEmpty().withMessage('Token verifica obbligatorio'),
]

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Password attuale obbligatoria'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Nuova password minima 8 caratteri'),
]

export const notificationPreferencesValidation = [
  body('notifyOnAudio').isBoolean().withMessage('notifyOnAudio non valido'),
  body('notifyOnPosts').isBoolean().withMessage('notifyOnPosts non valido'),
  body('notifyOnEvents').isBoolean().withMessage('notifyOnEvents non valido'),
  body('frequency').isIn(['NONE', 'IMMEDIATE', 'WEEKLY', 'MONTHLY']).withMessage('Frequenza non valida'),
]

export const notificationScheduleValidation = [
  body('immediateHourUtc').isInt({ min: 0, max: 23 }).withMessage('Orario immediate non valido'),
  body('weeklyHourUtc').isInt({ min: 0, max: 23 }).withMessage('Orario weekly non valido'),
  body('weeklyDayOfWeek').isInt({ min: 0, max: 6 }).withMessage('Giorno weekly non valido'),
  body('monthlyHourUtc').isInt({ min: 0, max: 23 }).withMessage('Orario monthly non valido'),
  body('monthlyDayOfMonth').isInt({ min: 1, max: 28 }).withMessage('Giorno monthly non valido'),
  body('batchSize').isInt({ min: 1, max: 100 }).withMessage('Batch size non valido'),
  body('maxAttempts').isInt({ min: 1, max: 10 }).withMessage('Max attempts non valido'),
  body('retryBaseDelayMinutes').isInt({ min: 1, max: 120 }).withMessage('Retry delay non valido'),
  body('lockTimeoutMinutes').isInt({ min: 1, max: 120 }).withMessage('Lock timeout non valido'),
  body('retentionDays').isInt({ min: 1, max: 365 }).withMessage('Retention giorni non valida'),
]

export const audioValidation = [
  body('title').trim().notEmpty().withMessage('Titolo obbligatorio'),
  body('description').optional({ values: 'falsy' }).trim(),
  body('categoryId').isUUID().withMessage('Categoria non valida'),
  body('level').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).withMessage('Livello non valido'),
]

export const postValidation = [
  body('title').trim().notEmpty().withMessage('Titolo obbligatorio'),
  body('body').trim().notEmpty().withMessage('Contenuto obbligatorio'),
  body('author').trim().notEmpty().withMessage('Autore obbligatorio'),
  body('excerpt').optional().trim().isLength({ max: 300 }).withMessage('Excerpt max 300 caratteri'),
  body('visibility').optional().isIn(['PUBLIC', 'REGISTERED']).withMessage('Visibilità non valida'),
]

export const eventValidation = [
  body('title').trim().notEmpty().withMessage('Titolo obbligatorio'),
  body('body').trim().notEmpty().withMessage('Contenuto obbligatorio'),
  body('organizer').optional({ values: 'falsy' }).trim().isLength({ max: 160 }).withMessage('Organizzatore max 160 caratteri'),
  body('city').trim().notEmpty().withMessage('Luogo obbligatorio'),
  body('startsAt').isISO8601().withMessage('Data inizio non valida'),
  body('endsAt').optional({ values: 'falsy' }).isISO8601().withMessage('Data fine non valida'),
  body('excerpt').optional().trim().isLength({ max: 300 }).withMessage('Excerpt max 300 caratteri'),
  body('visibility').optional().isIn(['PUBLIC', 'REGISTERED']).withMessage('Visibilità non valida'),
  body('bookingRequired').optional().isBoolean().withMessage('bookingRequired non valido'),
  body('bookingCapacity').optional({ values: 'falsy' }).isInt({ min: 1, max: 10000 }).withMessage('Capienza prenotazioni non valida'),
  body('bookingOpensAt').optional({ values: 'falsy' }).isISO8601().withMessage('Data apertura prenotazioni non valida'),
  body('bookingClosesAt').optional({ values: 'falsy' }).isISO8601().withMessage('Data chiusura prenotazioni non valida'),
  body('participationMode').optional().isIn(['FREE', 'PAID']).withMessage('Modalità partecipazione non valida'),
  body('participationPrice')
    .optional({ values: 'falsy' })
    .matches(/^\d+([.,]\d{1,2})?$/)
    .withMessage('Costo partecipazione non valido'),
]

export const tagValidation = [
  body('label').trim().notEmpty().isLength({ max: 50 }).withMessage('Nome tag obbligatorio e max 50 caratteri'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 200 }).withMessage('Descrizione max 200 caratteri'),
  body('isActive').optional().isBoolean().withMessage('isActive non valido'),
  body('sortOrder').optional().isInt({ min: 0, max: 9999 }).withMessage('sortOrder non valido'),
  body('aliases').optional().isArray({ max: 10 }).withMessage('aliases non valido'),
]

export const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Nome obbligatorio'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Colore HEX non valido'),
]

export const statusValidation = [
  body('status').isIn(['DRAFT', 'PUBLISHED']).withMessage('Stato non valido'),
]

export const userCreateValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('firstName').trim().notEmpty().withMessage('Nome obbligatorio'),
  body('lastName').trim().notEmpty().withMessage('Cognome obbligatorio'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('notes').optional({ values: 'falsy' }).isLength({ max: 5000 }).withMessage('Note max 5000 caratteri'),
  body('role').isIn(['ADMIN', 'STANDARD']).withMessage('Ruolo non valido'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 8 }).withMessage('Password minima 8 caratteri'),
  body('isActive').optional().isBoolean().withMessage('isActive non valido'),
  body('licenseExpiresAt').optional({ values: 'falsy' }).isISO8601().withMessage('Data scadenza licenza non valida'),
  body('sendInvite').optional().isBoolean().withMessage('sendInvite non valido'),
  body('inviteBaseUrl').optional({ values: 'falsy' }).isURL(appUrlValidationOptions).withMessage('URL invito non valido'),
  body('notifyOnAudio').optional().isBoolean().withMessage('notifyOnAudio non valido'),
  body('notifyOnPosts').optional().isBoolean().withMessage('notifyOnPosts non valido'),
  body('notifyOnEvents').optional().isBoolean().withMessage('notifyOnEvents non valido'),
  body('frequency').optional().isIn(['NONE', 'IMMEDIATE', 'WEEKLY', 'MONTHLY']).withMessage('Frequenza non valida'),
]

export const bootstrapAdminSetupValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('firstName').trim().notEmpty().withMessage('Nome obbligatorio'),
  body('lastName').trim().notEmpty().withMessage('Cognome obbligatorio'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password minima 8 caratteri'),
]

export const userUpdateValidation = [
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('firstName').optional().trim().notEmpty().withMessage('Nome obbligatorio'),
  body('lastName').optional().trim().notEmpty().withMessage('Cognome obbligatorio'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('notes').optional({ nullable: true }).isLength({ max: 5000 }).withMessage('Note max 5000 caratteri'),
  body('role').optional().isIn(['ADMIN', 'STANDARD']).withMessage('Ruolo non valido'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 8 }).withMessage('Password minima 8 caratteri'),
  body('isActive').optional().isBoolean().withMessage('isActive non valido'),
  body('licenseExpiresAt').optional({ values: 'falsy' }).isISO8601().withMessage('Data scadenza licenza non valida'),
  body('notifyOnAudio').optional().isBoolean().withMessage('notifyOnAudio non valido'),
  body('notifyOnPosts').optional().isBoolean().withMessage('notifyOnPosts non valido'),
  body('notifyOnEvents').optional().isBoolean().withMessage('notifyOnEvents non valido'),
  body('frequency').optional().isIn(['NONE', 'IMMEDIATE', 'WEEKLY', 'MONTHLY']).withMessage('Frequenza non valida'),
]

export const publicEventBookingAccessValidation = [
  query('token').trim().notEmpty().withMessage('Token prenotazione obbligatorio'),
]

export const publicEventBookingCancelAccessValidation = [
  query('token').trim().notEmpty().withMessage('Token prenotazione obbligatorio'),
]

export const publicEventBookingCancelValidation = [
  body('token').trim().notEmpty().withMessage('Token prenotazione obbligatorio'),
]

export const publicEventBookingRequestValidation = [
  body('email').isEmail().withMessage('Email obbligatoria o non valida'),
  body('firstName').trim().notEmpty().withMessage('Nome obbligatorio'),
  body('lastName').trim().notEmpty().withMessage('Cognome obbligatorio'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Numero di telefono obbligatorio')
    .bail()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Note max 1000 caratteri'),
]

export const publicEventBookingCreateValidation = [
  body('token').trim().notEmpty().withMessage('Token prenotazione obbligatorio'),
  body('bookerFirstName').optional({ values: 'falsy' }).trim(),
  body('bookerLastName').optional({ values: 'falsy' }).trim(),
  body('bookerPhone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero di telefono non valido'),
  body('participants').optional().isArray({ max: 4 }).withMessage('Partecipanti aggiuntivi non validi'),
  body('participants.*.firstName').optional().trim().notEmpty().withMessage('Nome partecipante obbligatorio'),
  body('participants.*.lastName').optional().trim().notEmpty().withMessage('Cognome partecipante obbligatorio'),
]

export const inviteCodeCreateValidation = [
  body('licenseDurationDays')
    .isInt({ min: 1, max: 3650 })
    .withMessage('Durata licenza non valida'),
  body('expiresAt')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Data scadenza codice non valida'),
  body('notes')
    .optional({ values: 'falsy' })
    .isLength({ max: 500 })
    .withMessage('Note max 500 caratteri'),
]

export const smtpSettingsValidation = [
  body('host').trim().notEmpty().withMessage('Host SMTP obbligatorio'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Porta SMTP non valida'),
  body('secure').isBoolean().withMessage('Secure non valido'),
  body('username').optional({ values: 'falsy' }).trim(),
  body('password').optional({ values: 'falsy' }).isString(),
  body('fromEmail').isEmail().withMessage('Email mittente non valida'),
  body('fromName').optional({ values: 'falsy' }).isString(),
]

export const publicContactSettingsValidation = [
  body('title').optional({ values: 'falsy' }).trim().isLength({ max: 120 }).withMessage('Titolo max 120 caratteri'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Descrizione max 1000 caratteri'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email contatti non valida'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Telefono contatti non valido'),
  body('whatsappNumber')
    .optional({ values: 'falsy' })
    .trim()
    .custom(isValidPhoneNumber)
    .withMessage('Numero WhatsApp non valido'),
  body('whatsappEnabled').isBoolean().withMessage('whatsappEnabled non valido'),
]

export const analyticsEventValidation = [
  body('eventType')
    .isIn([
      'AUDIO_VIEW',
      'AUDIO_PLAY',
      'AUDIO_COMPLETE',
      'POST_VIEW',
      'APP_ERROR',
      'API_ERROR',
      'AUDIO_ERROR',
      'SERVER_ERROR',
    ])
    .withMessage('Tipo evento non valido'),
  body('audioId').optional({ values: 'falsy' }).isUUID().withMessage('audioId non valido'),
  body('postId').optional({ values: 'falsy' }).isUUID().withMessage('postId non valido'),
  body('metadata')
    .optional({ values: 'falsy' })
    .custom((value) => typeof value === 'object' && value !== null && !Array.isArray(value))
    .withMessage('metadata non valida'),
]

export const analyticsOverviewQuery = [
  query('days').optional().isInt({ min: 1, max: 365 }).toInt(),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom non valida'),
  query('dateTo').optional().isISO8601().withMessage('dateTo non valida'),
  query('categoryId').optional().isUUID().withMessage('categoryId non valido'),
  query('audioId').optional().isUUID().withMessage('audioId non valido'),
  query('postId').optional().isUUID().withMessage('postId non valido'),
  query('userId').optional().isUUID().withMessage('userId non valido'),
]

export const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]

export const auditLogFilterQuery = [
  ...paginationQuery,
  query('action').optional().isIn(auditActions).withMessage('action non valida'),
  query('entityType').optional().isIn(auditEntityTypes).withMessage('entityType non valido'),
  query('actorRole').optional().isIn(['ADMIN', 'STANDARD']).withMessage('actorRole non valido'),
  query('actorUserId').optional().isUUID().withMessage('actorUserId non valido'),
  query('outcome').optional().isIn(['SUCCESS', 'FAILURE']).withMessage('outcome non valido'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom non valida'),
  query('dateTo').optional().isISO8601().withMessage('dateTo non valida'),
  query('search').optional().trim().isLength({ max: 200 }).withMessage('search troppo lunga'),
]

export const auditLogBulkDeleteValidation = [
  body('ids').isArray({ min: 1, max: 1000 }).withMessage('Seleziona almeno un log valido'),
  body('ids.*').isUUID().withMessage('ID log non valido'),
]

export const audioFilterQuery = [
  ...paginationQuery,
  query('category').optional().isUUID(),
  query('level').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  query('duration').optional().isIn(['short', 'medium', 'long']),
  query('search').optional().trim().isLength({ max: 200 }).withMessage('search troppo lunga'),
  query('tags').optional().trim().isLength({ max: 500 }).withMessage('tags troppo lunghi'),
  query('matchMode').optional().isIn(['any', 'all']).withMessage('matchMode non valido'),
  query('sort').optional().isIn(['recent', 'relevance']).withMessage('sort non valido'),
]

export const postFilterQuery = [
  ...paginationQuery,
  query('search').optional().trim().isLength({ max: 200 }).withMessage('search troppo lunga'),
  query('tags').optional().trim().isLength({ max: 500 }).withMessage('tags troppo lunghi'),
  query('author').optional().trim().isLength({ max: 120 }).withMessage('author troppo lungo'),
  query('matchMode').optional().isIn(['any', 'all']).withMessage('matchMode non valido'),
  query('sort').optional().isIn(['recent', 'relevance']).withMessage('sort non valido'),
]

export const tagFilterQuery = [
  query('contentType').optional().isIn(['audio', 'post', 'all']).withMessage('contentType non valido'),
  query('activeOnly').optional().isBoolean().withMessage('activeOnly non valido'),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('search troppo lunga'),
]

export const subscriptionContentValidation = [
  body('html').trim().notEmpty().withMessage('html obbligatorio'),
  body('title').optional({ values: 'falsy' }).isString(),
  body('buttonLabel').optional({ values: 'falsy' }).isString(),
]

export const formulaContentValidation = [
  body('title').trim().notEmpty().withMessage('title obbligatorio'),
  body('text').trim().notEmpty().withMessage('text obbligatorio'),
]

export const consentFormulaCreateValidation = [
  body('code').trim().matches(/^[a-z0-9_.-]{2,80}$/i).withMessage('code non valido'),
  body('required').isBoolean().withMessage('required non valido'),
]

export const publicSubscribeValidation = [
  body('email').isEmail().withMessage('Email non valida'),
  body('consents').isArray({ min: 1 }).withMessage('consents obbligatori'),
  body('consents.*.formulaId').isUUID().withMessage('formulaId non valido'),
  body('consents.*.value').isIn(['YES', 'NO']).withMessage('value non valido'),
]

export const publicUnsubscribeValidation = [
  body('token').trim().notEmpty().withMessage('Token obbligatorio'),
  body('revokeAll').optional().isBoolean().withMessage('revokeAll non valido'),
  body('updates').optional().isArray().withMessage('updates non valido'),
  body('updates.*.formulaId').optional().isUUID().withMessage('formulaId non valido'),
  body('updates.*.keep').optional().isBoolean().withMessage('keep non valido'),
  body('reason').optional({ values: 'falsy' }).isLength({ max: 200 }).withMessage('reason troppo lungo'),
]

export const campaignSendValidation = [
  body('name').trim().notEmpty().withMessage('name obbligatorio'),
  body('subject').trim().notEmpty().withMessage('subject obbligatorio'),
  body('htmlBody').trim().notEmpty().withMessage('htmlBody obbligatorio'),
  body('matchMode').optional().isIn(['ALL', 'ANY']).withMessage('matchMode non valido'),
  body('filters').optional().isArray().withMessage('filters non valido'),
  body('filters.*.formulaId').optional().isUUID().withMessage('formulaId non valido'),
  body('filters.*.versionIds').optional().isArray().withMessage('versionIds non valido'),
  body('selectedRecipientIds').optional().isArray().withMessage('selectedRecipientIds non valido'),
  body('selectedRecipientIds.*').optional().isUUID().withMessage('selectedRecipientIds non valido'),
  body('manualRecipientIds').optional().isArray().withMessage('manualRecipientIds non valido'),
  body('manualRecipientIds.*').optional().isUUID().withMessage('manualRecipientIds non valido'),
  body('unsubscribeLabel').optional({ values: 'falsy' }).isLength({ max: 80 }).withMessage('unsubscribeLabel troppo lungo'),
  body().custom((value) => {
    const filters = Array.isArray(value?.filters) ? value.filters : []
    const selectedRecipientIds = Array.isArray(value?.selectedRecipientIds) ? value.selectedRecipientIds : []
    const manualRecipientIds = Array.isArray(value?.manualRecipientIds) ? value.manualRecipientIds : []

    if (filters.length === 0 && selectedRecipientIds.length === 0 && manualRecipientIds.length === 0) {
      throw new Error('Serve almeno un filtro o un destinatario selezionato')
    }

    return true
  }),
]
