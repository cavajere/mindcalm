-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_POLICY_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_POLICY_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_FORMULA_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_FORMULA_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CONSENT_FORMULA_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_UNSUBSCRIBED';
ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_SENT';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'SUBSCRIPTION_POLICY';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONSENT_FORMULA';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTACT';
ALTER TYPE "AuditEntityType" ADD VALUE 'CONSENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'CAMPAIGN';

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

-- CreateIndex
CREATE UNIQUE INDEX "subscription_policy_versions_subscriptionPolicyId_versionNumber_key" ON "subscription_policy_versions"("subscriptionPolicyId", "versionNumber");
CREATE UNIQUE INDEX "subscription_policies_currentVersionId_key" ON "subscription_policies"("currentVersionId");
CREATE INDEX "subscription_policy_versions_subscriptionPolicyId_status_idx" ON "subscription_policy_versions"("subscriptionPolicyId", "status");
CREATE UNIQUE INDEX "subscription_policy_version_translations_versionId_lang_key" ON "subscription_policy_version_translations"("versionId", "lang");
CREATE INDEX "subscription_policy_version_translations_lang_idx" ON "subscription_policy_version_translations"("lang");
CREATE UNIQUE INDEX "consent_formulas_subscriptionPolicyId_code_key" ON "consent_formulas"("subscriptionPolicyId", "code");
CREATE UNIQUE INDEX "consent_formulas_currentVersionId_key" ON "consent_formulas"("currentVersionId");
CREATE INDEX "consent_formulas_subscriptionPolicyId_status_idx" ON "consent_formulas"("subscriptionPolicyId", "status");
CREATE UNIQUE INDEX "consent_formula_versions_consentFormulaId_versionNumber_key" ON "consent_formula_versions"("consentFormulaId", "versionNumber");
CREATE INDEX "consent_formula_versions_subscriptionPolicyVersionId_idx" ON "consent_formula_versions"("subscriptionPolicyVersionId");
CREATE INDEX "consent_formula_versions_consentFormulaId_status_idx" ON "consent_formula_versions"("consentFormulaId", "status");
CREATE UNIQUE INDEX "consent_formula_version_translations_consentVersionId_lang_key" ON "consent_formula_version_translations"("consentVersionId", "lang");
CREATE INDEX "consent_formula_version_translations_lang_idx" ON "consent_formula_version_translations"("lang");
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");
CREATE INDEX "contacts_status_createdAt_idx" ON "contacts"("status", "createdAt");
CREATE INDEX "consents_contactId_consentFormulaId_invalidatedAt_idx" ON "consents"("contactId", "consentFormulaId", "invalidatedAt");
CREATE INDEX "consents_consentFormulaVersionId_value_status_invalidatedAt_idx" ON "consents"("consentFormulaVersionId", "value", "status", "invalidatedAt");
CREATE INDEX "consents_policyVersionId_idx" ON "consents"("policyVersionId");
CREATE UNIQUE INDEX "subscription_confirmation_tokens_tokenHash_key" ON "subscription_confirmation_tokens"("tokenHash");
CREATE INDEX "subscription_confirmation_tokens_contactId_expiresAt_idx" ON "subscription_confirmation_tokens"("contactId", "expiresAt");
CREATE UNIQUE INDEX "unsubscribe_tokens_tokenHash_key" ON "unsubscribe_tokens"("tokenHash");
CREATE INDEX "unsubscribe_tokens_contactId_expiresAt_idx" ON "unsubscribe_tokens"("contactId", "expiresAt");
CREATE INDEX "campaigns_status_createdAt_idx" ON "campaigns"("status", "createdAt");
CREATE INDEX "campaign_audience_filters_campaignId_idx" ON "campaign_audience_filters"("campaignId");
CREATE INDEX "campaign_audience_filters_consentFormulaId_idx" ON "campaign_audience_filters"("consentFormulaId");
CREATE UNIQUE INDEX "campaign_recipients_campaignId_contactId_key" ON "campaign_recipients"("campaignId", "contactId");
CREATE INDEX "campaign_recipients_status_createdAt_idx" ON "campaign_recipients"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_policies" ADD CONSTRAINT "subscription_policies_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_policy_versions" ADD CONSTRAINT "subscription_policy_versions_subscriptionPolicyId_fkey" FOREIGN KEY ("subscriptionPolicyId") REFERENCES "subscription_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_policy_versions" ADD CONSTRAINT "subscription_policy_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_policy_version_translations" ADD CONSTRAINT "subscription_policy_version_translations_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "subscription_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_formulas" ADD CONSTRAINT "consent_formulas_subscriptionPolicyId_fkey" FOREIGN KEY ("subscriptionPolicyId") REFERENCES "subscription_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_formulas" ADD CONSTRAINT "consent_formulas_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consent_formula_versions" ADD CONSTRAINT "consent_formula_versions_consentFormulaId_fkey" FOREIGN KEY ("consentFormulaId") REFERENCES "consent_formulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_formula_versions" ADD CONSTRAINT "consent_formula_versions_subscriptionPolicyVersionId_fkey" FOREIGN KEY ("subscriptionPolicyVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_formula_versions" ADD CONSTRAINT "consent_formula_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consent_formula_version_translations" ADD CONSTRAINT "consent_formula_version_translations_consentVersionId_fkey" FOREIGN KEY ("consentVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_consentFormulaId_fkey" FOREIGN KEY ("consentFormulaId") REFERENCES "consent_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_consentFormulaVersionId_fkey" FOREIGN KEY ("consentFormulaVersionId") REFERENCES "consent_formula_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "subscription_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_confirmation_tokens" ADD CONSTRAINT "subscription_confirmation_tokens_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaign_audience_filters" ADD CONSTRAINT "campaign_audience_filters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_audience_filters" ADD CONSTRAINT "campaign_audience_filters_consentFormulaId_fkey" FOREIGN KEY ("consentFormulaId") REFERENCES "consent_formulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
