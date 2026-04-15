-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC', 'REGISTERED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STANDARD');

-- CreateEnum
CREATE TYPE "InviteCodeStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PendingRegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TermsPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TermsPolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StreamingFormat" AS ENUM ('DIRECT', 'HLS');

-- CreateEnum
CREATE TYPE "AudioProcessingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED', 'INVITE_SENT', 'INVITE_ACCEPTED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_INVITE_RESENT', 'INVITE_CODE_CREATED', 'INVITE_CODE_DISABLED', 'INVITE_CODE_REDEEMED', 'REGISTRATION_STARTED', 'REGISTRATION_VERIFICATION_SENT', 'REGISTRATION_VERIFIED', 'REGISTRATION_FAILED', 'AUDIO_CREATED', 'AUDIO_UPDATED', 'AUDIO_DELETED', 'AUDIO_STATUS_CHANGED', 'ALBUM_IMAGE_CREATED', 'ALBUM_IMAGE_UPDATED', 'ALBUM_IMAGE_DELETED', 'POST_CREATED', 'POST_UPDATED', 'POST_DELETED', 'POST_STATUS_CHANGED', 'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED', 'EVENT_STATUS_CHANGED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DELETED', 'CATEGORY_ORDER_UPDATED', 'TAG_CREATED', 'TAG_UPDATED', 'TAG_DELETED', 'TAG_STATUS_CHANGED', 'SMTP_SETTINGS_UPDATED', 'SMTP_TEST_SENT', 'TERMS_POLICY_PUBLISHED', 'TERMS_ACCEPTED', 'CONSENT_POLICY_PUBLISHED', 'CONSENT_POLICY_ARCHIVED', 'CONSENT_FORMULA_CREATED', 'CONSENT_FORMULA_UPDATED', 'CONSENT_FORMULA_DELETED', 'SUBSCRIPTION_SUBMITTED', 'SUBSCRIPTION_CONFIRMED', 'SUBSCRIPTION_UNSUBSCRIBED', 'CAMPAIGN_CREATED', 'CAMPAIGN_SENT');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('AUTH', 'USER', 'INVITE_CODE', 'REGISTRATION', 'TERMS_POLICY', 'AUDIO', 'ALBUM_IMAGE', 'POST', 'EVENT', 'CATEGORY', 'TAG', 'SETTINGS', 'SUBSCRIPTION_POLICY', 'CONSENT_FORMULA', 'CONTACT', 'CONSENT', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "SubscriptionPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubscriptionPolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsentFormulaStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsentFormulaVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ConsentValue" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "ConsentRecordStatus" AS ENUM ('REGISTERED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('SUBSCRIBE', 'UNSUBSCRIBE', 'ADMIN');

-- CreateEnum
CREATE TYPE "CampaignMatchMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "AnalyticsContentType" AS ENUM ('AUDIO', 'POST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('AUDIO_VIEW', 'AUDIO_PLAY', 'AUDIO_COMPLETE', 'POST_VIEW', 'APP_ERROR', 'API_ERROR', 'AUDIO_ERROR', 'SERVER_ERROR');

-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('NONE', 'IMMEDIATE', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentPublicationType" AS ENUM ('AUDIO', 'POST', 'EVENT');

-- CreateEnum
CREATE TYPE "PublicationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseExpiresAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "resetPasswordTokenHash" TEXT,
    "resetPasswordExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_policies" (
    "id" TEXT NOT NULL,
    "status" "TermsPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_policy_versions" (
    "id" TEXT NOT NULL,
    "termsPolicyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "TermsPolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_policy_version_translations" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "title" TEXT,
    "html" TEXT NOT NULL,
    "buttonLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terms_policy_version_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_terms_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsPolicyVersionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SELF_SERVICE',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_policies" (
    "id" TEXT NOT NULL,
    "status" "SubscriptionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "subscribeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "subscribeConfirmEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_policy_versions" (
    "id" TEXT NOT NULL,
    "subscriptionPolicyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "SubscriptionPolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_policy_version_translations" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "title" TEXT,
    "html" TEXT NOT NULL,
    "buttonLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_policy_version_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_formulas" (
    "id" TEXT NOT NULL,
    "subscriptionPolicyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConsentFormulaStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_formula_versions" (
    "id" TEXT NOT NULL,
    "consentFormulaId" TEXT NOT NULL,
    "subscriptionPolicyVersionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ConsentFormulaVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_formula_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_formula_version_translations" (
    "id" TEXT NOT NULL,
    "consentVersionId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_formula_version_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "suppressedAt" TIMESTAMP(3),
    "suppressionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "consentFormulaId" TEXT NOT NULL,
    "consentFormulaVersionId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "value" "ConsentValue" NOT NULL,
    "status" "ConsentRecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "source" "ConsentSource" NOT NULL DEFAULT 'SUBSCRIBE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_confirmation_tokens" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_confirmation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unsubscribe_tokens" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unsubscribe_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "matchMode" "CampaignMatchMode" NOT NULL DEFAULT 'ALL',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_audience_filters" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "consentFormulaId" TEXT NOT NULL,
    "formulaVersionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_audience_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "userId" TEXT NOT NULL,
    "notifyOnAudio" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPosts" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "NotificationFrequency" NOT NULL DEFAULT 'NONE',
    "lastImmediateContentAt" TIMESTAMP(3),
    "lastWeeklyDigestSentAt" TIMESTAMP(3),
    "lastMonthlyDigestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "notification_schedule_settings" (
    "id" INTEGER NOT NULL,
    "immediateHourUtc" INTEGER NOT NULL DEFAULT 9,
    "weeklyHourUtc" INTEGER NOT NULL DEFAULT 9,
    "weeklyDayOfWeek" INTEGER NOT NULL DEFAULT 1,
    "monthlyHourUtc" INTEGER NOT NULL DEFAULT 9,
    "monthlyDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "batchSize" INTEGER NOT NULL DEFAULT 20,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "retryBaseDelayMinutes" INTEGER NOT NULL DEFAULT 5,
    "lockTimeoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_schedule_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_dispatch_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "frequency" "NotificationFrequency" NOT NULL,
    "status" "NotificationDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "windowEndedAt" TIMESTAMP(3) NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_dispatch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_publication_outbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "contentType" "ContentPublicationType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "status" "PublicationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_publication_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT,
    "organizer" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'REGISTERED',
    "coverImage" TEXT,
    "coverImageOriginalName" TEXT,
    "coverImageDisplayName" TEXT,
    "coverAlbumImageId" TEXT,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "licenseDurationDays" INTEGER NOT NULL,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "redemptionsCount" INTEGER NOT NULL DEFAULT 0,
    "status" "InviteCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "createdByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_registrations" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "termsPolicyVersionId" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "verificationTokenHash" TEXT NOT NULL,
    "verificationExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "status" "PendingRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smtp_settings" (
    "id" INTEGER NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "passwordEncrypted" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smtp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "level" "Level" NOT NULL DEFAULT 'BEGINNER',
    "durationSec" INTEGER NOT NULL,
    "audioFile" TEXT NOT NULL,
    "audioOriginalName" TEXT NOT NULL,
    "audioDisplayName" TEXT NOT NULL,
    "audioFormat" TEXT NOT NULL,
    "audioSize" INTEGER NOT NULL,
    "streamingFormat" "StreamingFormat" NOT NULL DEFAULT 'DIRECT',
    "processingStatus" "AudioProcessingStatus" NOT NULL DEFAULT 'READY',
    "hlsManifestPath" TEXT,
    "processingError" TEXT,
    "coverImage" TEXT,
    "coverImageOriginalName" TEXT,
    "coverImageDisplayName" TEXT,
    "coverAlbumImageId" TEXT,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT,
    "author" TEXT NOT NULL,
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'REGISTERED',
    "coverImage" TEXT,
    "coverImageOriginalName" TEXT,
    "coverImageDisplayName" TEXT,
    "coverAlbumImageId" TEXT,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_images" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_aliases" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_tags" (
    "audioId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "audio_tags_pkey" PRIMARY KEY ("audioId","tagId")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "contentType" "AnalyticsContentType" NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "audioId" TEXT,
    "postId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "actorRole" "UserRole",
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestPath" TEXT,
    "requestMethod" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "terms_policies_currentVersionId_key" ON "terms_policies"("currentVersionId");

-- CreateIndex
CREATE INDEX "terms_policy_versions_termsPolicyId_status_idx" ON "terms_policy_versions"("termsPolicyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "terms_policy_versions_termsPolicyId_versionNumber_key" ON "terms_policy_versions"("termsPolicyId", "versionNumber");

-- CreateIndex
CREATE INDEX "terms_policy_version_translations_lang_idx" ON "terms_policy_version_translations"("lang");

-- CreateIndex
CREATE UNIQUE INDEX "terms_policy_version_translations_versionId_lang_key" ON "terms_policy_version_translations"("versionId", "lang");

-- CreateIndex
CREATE INDEX "user_terms_acceptances_userId_acceptedAt_idx" ON "user_terms_acceptances"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "user_terms_acceptances_termsPolicyVersionId_idx" ON "user_terms_acceptances"("termsPolicyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_terms_acceptances_userId_termsPolicyVersionId_key" ON "user_terms_acceptances"("userId", "termsPolicyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_policies_currentVersionId_key" ON "subscription_policies"("currentVersionId");

-- CreateIndex
CREATE INDEX "subscription_policy_versions_subscriptionPolicyId_status_idx" ON "subscription_policy_versions"("subscriptionPolicyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_policy_versions_subscriptionPolicyId_versionNu_key" ON "subscription_policy_versions"("subscriptionPolicyId", "versionNumber");

-- CreateIndex
CREATE INDEX "subscription_policy_version_translations_lang_idx" ON "subscription_policy_version_translations"("lang");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_policy_version_translations_versionId_lang_key" ON "subscription_policy_version_translations"("versionId", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "consent_formulas_currentVersionId_key" ON "consent_formulas"("currentVersionId");

-- CreateIndex
CREATE INDEX "consent_formulas_subscriptionPolicyId_status_idx" ON "consent_formulas"("subscriptionPolicyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consent_formulas_subscriptionPolicyId_code_key" ON "consent_formulas"("subscriptionPolicyId", "code");

-- CreateIndex
CREATE INDEX "consent_formula_versions_subscriptionPolicyVersionId_idx" ON "consent_formula_versions"("subscriptionPolicyVersionId");

-- CreateIndex
CREATE INDEX "consent_formula_versions_consentFormulaId_status_idx" ON "consent_formula_versions"("consentFormulaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consent_formula_versions_consentFormulaId_versionNumber_key" ON "consent_formula_versions"("consentFormulaId", "versionNumber");

-- CreateIndex
CREATE INDEX "consent_formula_version_translations_lang_idx" ON "consent_formula_version_translations"("lang");

-- CreateIndex
CREATE UNIQUE INDEX "consent_formula_version_translations_consentVersionId_lang_key" ON "consent_formula_version_translations"("consentVersionId", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_status_createdAt_idx" ON "contacts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "consents_contactId_consentFormulaId_invalidatedAt_idx" ON "consents"("contactId", "consentFormulaId", "invalidatedAt");

-- CreateIndex
CREATE INDEX "consents_consentFormulaVersionId_value_status_invalidatedAt_idx" ON "consents"("consentFormulaVersionId", "value", "status", "invalidatedAt");

-- CreateIndex
CREATE INDEX "consents_policyVersionId_idx" ON "consents"("policyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_confirmation_tokens_tokenHash_key" ON "subscription_confirmation_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "subscription_confirmation_tokens_contactId_expiresAt_idx" ON "subscription_confirmation_tokens"("contactId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "unsubscribe_tokens_tokenHash_key" ON "unsubscribe_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "unsubscribe_tokens_contactId_expiresAt_idx" ON "unsubscribe_tokens"("contactId", "expiresAt");

-- CreateIndex
CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "campaign_audience_filters_campaignId_idx" ON "campaign_audience_filters"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_audience_filters_consentFormulaId_idx" ON "campaign_audience_filters"("consentFormulaId");

-- CreateIndex
CREATE INDEX "campaign_recipients_status_createdAt_idx" ON "campaign_recipients"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaignId_contactId_key" ON "campaign_recipients"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_dispatch_jobs_dedupeKey_key" ON "notification_dispatch_jobs"("dedupeKey");

-- CreateIndex
CREATE INDEX "notification_dispatch_jobs_status_availableAt_idx" ON "notification_dispatch_jobs"("status", "availableAt");

-- CreateIndex
CREATE INDEX "notification_dispatch_jobs_userId_frequency_createdAt_idx" ON "notification_dispatch_jobs"("userId", "frequency", "createdAt");

-- CreateIndex
CREATE INDEX "notification_dispatch_jobs_scheduledFor_idx" ON "notification_dispatch_jobs"("scheduledFor");

-- CreateIndex
CREATE INDEX "notification_dispatch_jobs_sentAt_idx" ON "notification_dispatch_jobs"("sentAt");

-- CreateIndex
CREATE INDEX "notification_dispatch_jobs_failedAt_idx" ON "notification_dispatch_jobs"("failedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_publication_outbox_dedupeKey_key" ON "content_publication_outbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "content_publication_outbox_status_availableAt_idx" ON "content_publication_outbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "content_publication_outbox_contentType_contentId_idx" ON "content_publication_outbox"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "content_publication_outbox_publishedAt_idx" ON "content_publication_outbox"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_coverAlbumImageId_idx" ON "events"("coverAlbumImageId");

-- CreateIndex
CREATE INDEX "events_status_visibility_idx" ON "events"("status", "visibility");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_startsAt_idx" ON "events"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_codes_status_createdAt_idx" ON "invite_codes"("status", "createdAt");

-- CreateIndex
CREATE INDEX "invite_codes_expiresAt_idx" ON "invite_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_registrations_verificationTokenHash_key" ON "pending_registrations"("verificationTokenHash");

-- CreateIndex
CREATE INDEX "pending_registrations_email_status_idx" ON "pending_registrations"("email", "status");

-- CreateIndex
CREATE INDEX "pending_registrations_verificationExpiresAt_idx" ON "pending_registrations"("verificationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "audio_categoryId_idx" ON "audio"("categoryId");

-- CreateIndex
CREATE INDEX "audio_coverAlbumImageId_idx" ON "audio"("coverAlbumImageId");

-- CreateIndex
CREATE INDEX "audio_status_idx" ON "audio"("status");

-- CreateIndex
CREATE INDEX "audio_level_idx" ON "audio"("level");

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_coverAlbumImageId_idx" ON "posts"("coverAlbumImageId");

-- CreateIndex
CREATE INDEX "posts_status_visibility_idx" ON "posts"("status", "visibility");

-- CreateIndex
CREATE INDEX "posts_slug_idx" ON "posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "album_images_filePath_key" ON "album_images"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "album_images_fileHash_key" ON "album_images"("fileHash");

-- CreateIndex
CREATE INDEX "album_images_createdAt_idx" ON "album_images"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_isActive_sortOrder_idx" ON "tags"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "tags_label_idx" ON "tags"("label");

-- CreateIndex
CREATE INDEX "tag_aliases_alias_idx" ON "tag_aliases"("alias");

-- CreateIndex
CREATE INDEX "tag_aliases_tagId_idx" ON "tag_aliases"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_aliases_tagId_alias_key" ON "tag_aliases"("tagId", "alias");

-- CreateIndex
CREATE INDEX "audio_tags_tagId_audioId_idx" ON "audio_tags"("tagId", "audioId");

-- CreateIndex
CREATE INDEX "post_tags_tagId_postId_idx" ON "post_tags"("tagId", "postId");

-- CreateIndex
CREATE INDEX "analytics_events_occurredAt_idx" ON "analytics_events"("occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_occurredAt_idx" ON "analytics_events"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_audioId_occurredAt_idx" ON "analytics_events"("audioId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_postId_occurredAt_idx" ON "analytics_events"("postId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_occurredAt_idx" ON "analytics_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_occurredAt_idx" ON "audit_logs"("occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_occurredAt_idx" ON "audit_logs"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_occurredAt_idx" ON "audit_logs"("entityType", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_occurredAt_idx" ON "audit_logs"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_outcome_occurredAt_idx" ON "audit_logs"("outcome", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "playback_sessions_tokenHash_key" ON "playback_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "playback_sessions_userId_expiresAt_idx" ON "playback_sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "playback_sessions_audioId_expiresAt_idx" ON "playback_sessions"("audioId", "expiresAt");

-- CreateIndex
CREATE INDEX "playback_sessions_userId_revokedAt_expiresAt_idx" ON "playback_sessions"("userId", "revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "terms_policies" ADD CONSTRAINT "terms_policies_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_policy_versions" ADD CONSTRAINT "terms_policy_versions_termsPolicyId_fkey" FOREIGN KEY ("termsPolicyId") REFERENCES "terms_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_policy_versions" ADD CONSTRAINT "terms_policy_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_policy_version_translations" ADD CONSTRAINT "terms_policy_version_translations_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "terms_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_termsPolicyVersionId_fkey" FOREIGN KEY ("termsPolicyVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_policies" ADD CONSTRAINT "subscription_policies_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_policy_versions" ADD CONSTRAINT "subscription_policy_versions_subscriptionPolicyId_fkey" FOREIGN KEY ("subscriptionPolicyId") REFERENCES "subscription_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_policy_versions" ADD CONSTRAINT "subscription_policy_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_policy_version_translations" ADD CONSTRAINT "subscription_policy_version_translations_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "subscription_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_formulas" ADD CONSTRAINT "consent_formulas_subscriptionPolicyId_fkey" FOREIGN KEY ("subscriptionPolicyId") REFERENCES "subscription_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_formulas" ADD CONSTRAINT "consent_formulas_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_formula_versions" ADD CONSTRAINT "consent_formula_versions_consentFormulaId_fkey" FOREIGN KEY ("consentFormulaId") REFERENCES "consent_formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_formula_versions" ADD CONSTRAINT "consent_formula_versions_subscriptionPolicyVersionId_fkey" FOREIGN KEY ("subscriptionPolicyVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_formula_versions" ADD CONSTRAINT "consent_formula_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_formula_version_translations" ADD CONSTRAINT "consent_formula_version_translations_consentVersionId_fkey" FOREIGN KEY ("consentVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_consentFormulaId_fkey" FOREIGN KEY ("consentFormulaId") REFERENCES "consent_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_consentFormulaVersionId_fkey" FOREIGN KEY ("consentFormulaVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_confirmation_tokens" ADD CONSTRAINT "subscription_confirmation_tokens_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audience_filters" ADD CONSTRAINT "campaign_audience_filters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audience_filters" ADD CONSTRAINT "campaign_audience_filters_consentFormulaId_fkey" FOREIGN KEY ("consentFormulaId") REFERENCES "consent_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_dispatch_jobs" ADD CONSTRAINT "notification_dispatch_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_coverAlbumImageId_fkey" FOREIGN KEY ("coverAlbumImageId") REFERENCES "album_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_termsPolicyVersionId_fkey" FOREIGN KEY ("termsPolicyVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio" ADD CONSTRAINT "audio_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio" ADD CONSTRAINT "audio_coverAlbumImageId_fkey" FOREIGN KEY ("coverAlbumImageId") REFERENCES "album_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_coverAlbumImageId_fkey" FOREIGN KEY ("coverAlbumImageId") REFERENCES "album_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_aliases" ADD CONSTRAINT "tag_aliases_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_tags" ADD CONSTRAINT "audio_tags_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "audio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_tags" ADD CONSTRAINT "audio_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "audio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "audio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
