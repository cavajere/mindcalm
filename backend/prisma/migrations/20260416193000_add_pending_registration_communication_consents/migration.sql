ALTER TABLE "pending_registrations"
ADD COLUMN "communicationPolicyVersionId" TEXT,
ADD COLUMN "communicationConsents" JSONB;
