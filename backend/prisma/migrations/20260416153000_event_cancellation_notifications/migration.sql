-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_CANCELLED';

-- AlterTable
ALTER TABLE "events"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationMessage" TEXT;
