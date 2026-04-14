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
  'ARTICLE_CREATED',
  'ARTICLE_UPDATED',
  'ARTICLE_DELETED',
  'ARTICLE_STATUS_CHANGED',
  'EVENT_CREATED',
  'EVENT_UPDATED',
  'EVENT_DELETED',
  'EVENT_STATUS_CHANGED',
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
]

const auditEntityTypes = ['AUTH', 'USER', 'INVITE_CODE', 'REGISTRATION', 'AUDIO', 'ALBUM_IMAGE', 'ARTICLE', 'EVENT', 'CATEGORY', 'TAG', 'SETTINGS']
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
  body('notifyOnArticles').isBoolean().withMessage('notifyOnArticles non valido'),
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

export const articleValidation = [
  body('title').trim().notEmpty().withMessage('Titolo obbligatorio'),
  body('body').trim().notEmpty().withMessage('Contenuto obbligatorio'),
  body('author').trim().notEmpty().withMessage('Autore obbligatorio'),
  body('excerpt').optional().trim().isLength({ max: 300 }).withMessage('Excerpt max 300 caratteri'),
]

export const eventValidation = [
  body('title').trim().notEmpty().withMessage('Titolo obbligatorio'),
  body('body').trim().notEmpty().withMessage('Contenuto obbligatorio'),
  body('organizer').trim().notEmpty().withMessage('Organizzatore obbligatorio'),
  body('city').trim().notEmpty().withMessage('Città obbligatoria'),
  body('venue').optional({ values: 'falsy' }).trim().isLength({ max: 160 }).withMessage('Venue max 160 caratteri'),
  body('startsAt').isISO8601().withMessage('Data inizio non valida'),
  body('endsAt').optional({ values: 'falsy' }).isISO8601().withMessage('Data fine non valida'),
  body('excerpt').optional().trim().isLength({ max: 300 }).withMessage('Excerpt max 300 caratteri'),
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
  body('notifyOnArticles').optional().isBoolean().withMessage('notifyOnArticles non valido'),
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
  body('notifyOnArticles').optional().isBoolean().withMessage('notifyOnArticles non valido'),
  body('frequency').optional().isIn(['NONE', 'IMMEDIATE', 'WEEKLY', 'MONTHLY']).withMessage('Frequenza non valida'),
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

export const analyticsEventValidation = [
  body('eventType')
    .isIn([
      'AUDIO_VIEW',
      'AUDIO_PLAY',
      'AUDIO_COMPLETE',
      'ARTICLE_VIEW',
      'APP_ERROR',
      'API_ERROR',
      'AUDIO_ERROR',
      'SERVER_ERROR',
    ])
    .withMessage('Tipo evento non valido'),
  body('audioId').optional({ values: 'falsy' }).isUUID().withMessage('audioId non valido'),
  body('articleId').optional({ values: 'falsy' }).isUUID().withMessage('articleId non valido'),
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
  query('articleId').optional().isUUID().withMessage('articleId non valido'),
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

export const articleFilterQuery = [
  ...paginationQuery,
  query('search').optional().trim().isLength({ max: 200 }).withMessage('search troppo lunga'),
  query('tags').optional().trim().isLength({ max: 500 }).withMessage('tags troppo lunghi'),
  query('author').optional().trim().isLength({ max: 120 }).withMessage('author troppo lungo'),
  query('matchMode').optional().isIn(['any', 'all']).withMessage('matchMode non valido'),
  query('sort').optional().isIn(['recent', 'relevance']).withMessage('sort non valido'),
]

export const tagFilterQuery = [
  query('contentType').optional().isIn(['audio', 'article', 'all']).withMessage('contentType non valido'),
  query('activeOnly').optional().isBoolean().withMessage('activeOnly non valido'),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('search troppo lunga'),
]
