import path from 'path'

export const config = {
  port: parseInt(process.env.PORT || '3300', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    appCookieName: process.env.APP_AUTH_COOKIE_NAME || 'mindcalm_app_session',
    adminCookieName: process.env.ADMIN_AUTH_COOKIE_NAME || 'mindcalm_admin_session',
  },

  bootstrapAdmin: {
    email: process.env.ADMIN_EMAIL?.trim() || '',
    password: process.env.ADMIN_PASSWORD?.trim() || '',
    name: process.env.ADMIN_NAME?.trim() || 'Bootstrap Admin',
  },

  security: {
    encryptionSecret: process.env.APP_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me',
  },

  playback: {
    minExpiresInSeconds: parseInt(process.env.PLAYBACK_MIN_EXPIRES_IN_SECONDS || '1800', 10),
    maxExpiresInSeconds: parseInt(process.env.PLAYBACK_MAX_EXPIRES_IN_SECONDS || '14400', 10),
    gracePeriodSeconds: parseInt(process.env.PLAYBACK_GRACE_PERIOD_SECONDS || '900', 10),
    sessionRateLimitPerMinute: parseInt(process.env.PLAYBACK_SESSION_RATE_LIMIT_PER_MINUTE || '12', 10),
    maxConcurrentSessionsPerUser: parseInt(process.env.PLAYBACK_MAX_CONCURRENT_SESSIONS_PER_USER || '1', 10),
  },

  storage: {
    audioPath: path.resolve(process.env.AUDIO_STORAGE_PATH || './storage/audio'),
    hlsPath: path.resolve(process.env.HLS_STORAGE_PATH || './storage/hls'),
    imagesPath: path.resolve(process.env.IMAGES_STORAGE_PATH || './storage/images'),
    backupsPath: path.resolve(process.env.BACKUP_STORAGE_PATH || './storage/backups'),
    maxAudioSize: parseInt(process.env.MAX_AUDIO_SIZE_MB || '100', 10) * 1024 * 1024,
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10) * 1024 * 1024,
  },

  backups: {
    schedulerPollMs: parseInt(process.env.BACKUP_SCHEDULER_POLL_MS || '60000', 10),
  },

  audioDelivery: {
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    hlsSegmentDurationSec: parseInt(process.env.HLS_SEGMENT_DURATION_SEC || '6', 10),
    hlsAudioBitrateKbps: parseInt(process.env.HLS_AUDIO_BITRATE_KBPS || '96', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5473,http://localhost:5474',
  },

  appUrls: {
    public: process.env.PUBLIC_APP_URL?.trim() || 'http://localhost:5473',
    admin: process.env.ADMIN_APP_URL?.trim() || 'http://localhost:5474/admin',
  },

  rateLimit: {
    public: parseInt(process.env.RATE_LIMIT_PUBLIC || '100', 10),
    login: parseInt(process.env.RATE_LIMIT_LOGIN || '30', 10),
    inviteCodeValidation: parseInt(process.env.RATE_LIMIT_INVITE_CODE_VALIDATION || '20', 10),
    registration: parseInt(process.env.RATE_LIMIT_REGISTRATION || '10', 10),
    registrationVerification: parseInt(process.env.RATE_LIMIT_REGISTRATION_VERIFICATION || '20', 10),
  },

  resetPassword: {
    expiresInMinutes: parseInt(process.env.RESET_PASSWORD_EXPIRES_IN_MINUTES || '60', 10),
  },

  invitation: {
    expiresInHours: parseInt(process.env.INVITATION_EXPIRES_IN_HOURS || '720', 10),
  },

  registration: {
    verificationExpiresInHours: parseInt(process.env.REGISTRATION_VERIFICATION_EXPIRES_IN_HOURS || '24', 10),
  },
}
