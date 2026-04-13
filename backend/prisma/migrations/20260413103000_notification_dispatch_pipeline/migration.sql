-- CreateEnum
CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "notification_schedule_settings"
ADD COLUMN "batchSize" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "lockTimeoutMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "retentionDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "retryBaseDelayMinutes" INTEGER NOT NULL DEFAULT 5;

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

-- AddForeignKey
ALTER TABLE "notification_dispatch_jobs"
ADD CONSTRAINT "notification_dispatch_jobs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
