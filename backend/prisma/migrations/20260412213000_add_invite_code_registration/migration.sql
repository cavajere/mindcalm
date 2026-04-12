CREATE TYPE "InviteCodeStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'DISABLED');

CREATE TYPE "PendingRegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'CANCELLED', 'EXPIRED');

ALTER TYPE "AuditAction" ADD VALUE 'INVITE_CODE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_CODE_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_CODE_REDEEMED';
ALTER TYPE "AuditAction" ADD VALUE 'REGISTRATION_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'REGISTRATION_VERIFICATION_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'REGISTRATION_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'REGISTRATION_FAILED';

ALTER TYPE "AuditEntityType" ADD VALUE 'INVITE_CODE';
ALTER TYPE "AuditEntityType" ADD VALUE 'REGISTRATION';

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

CREATE TABLE "pending_registrations" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");
CREATE INDEX "invite_codes_status_createdAt_idx" ON "invite_codes"("status", "createdAt");
CREATE INDEX "invite_codes_expiresAt_idx" ON "invite_codes"("expiresAt");

CREATE UNIQUE INDEX "pending_registrations_verificationTokenHash_key" ON "pending_registrations"("verificationTokenHash");
CREATE INDEX "pending_registrations_email_status_idx" ON "pending_registrations"("email", "status");
CREATE INDEX "pending_registrations_verificationExpiresAt_idx" ON "pending_registrations"("verificationExpiresAt");

ALTER TABLE "invite_codes"
ADD CONSTRAINT "invite_codes_redeemedByUserId_fkey"
FOREIGN KEY ("redeemedByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invite_codes"
ADD CONSTRAINT "invite_codes_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pending_registrations"
ADD CONSTRAINT "pending_registrations_inviteCodeId_fkey"
FOREIGN KEY ("inviteCodeId") REFERENCES "invite_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
