-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TERMS_POLICY_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'TERMS_ACCEPTED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'TERMS_POLICY';

-- CreateEnum
CREATE TYPE "TermsPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TermsPolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "pending_registrations"
ADD COLUMN "termsPolicyVersionId" TEXT,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

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

-- CreateIndex
CREATE UNIQUE INDEX "terms_policies_currentVersionId_key" ON "terms_policies"("currentVersionId");
CREATE UNIQUE INDEX "terms_policy_versions_termsPolicyId_versionNumber_key" ON "terms_policy_versions"("termsPolicyId", "versionNumber");
CREATE INDEX "terms_policy_versions_termsPolicyId_status_idx" ON "terms_policy_versions"("termsPolicyId", "status");
CREATE UNIQUE INDEX "terms_policy_version_translations_versionId_lang_key" ON "terms_policy_version_translations"("versionId", "lang");
CREATE INDEX "terms_policy_version_translations_lang_idx" ON "terms_policy_version_translations"("lang");
CREATE UNIQUE INDEX "user_terms_acceptances_userId_termsPolicyVersionId_key" ON "user_terms_acceptances"("userId", "termsPolicyVersionId");
CREATE INDEX "user_terms_acceptances_userId_acceptedAt_idx" ON "user_terms_acceptances"("userId", "acceptedAt");
CREATE INDEX "user_terms_acceptances_termsPolicyVersionId_idx" ON "user_terms_acceptances"("termsPolicyVersionId");
CREATE INDEX "pending_registrations_termsPolicyVersionId_idx" ON "pending_registrations"("termsPolicyVersionId");

-- AddForeignKey
ALTER TABLE "terms_policies" ADD CONSTRAINT "terms_policies_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terms_policy_versions" ADD CONSTRAINT "terms_policy_versions_termsPolicyId_fkey" FOREIGN KEY ("termsPolicyId") REFERENCES "terms_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terms_policy_versions" ADD CONSTRAINT "terms_policy_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terms_policy_version_translations" ADD CONSTRAINT "terms_policy_version_translations_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "terms_policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_terms_acceptances" ADD CONSTRAINT "user_terms_acceptances_termsPolicyVersionId_fkey" FOREIGN KEY ("termsPolicyVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pending_registrations" ADD CONSTRAINT "pending_registrations_termsPolicyVersionId_fkey" FOREIGN KEY ("termsPolicyVersionId") REFERENCES "terms_policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
