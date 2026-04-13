-- CreateEnum
CREATE TYPE "ContentPublicationType" AS ENUM ('AUDIO', 'ARTICLE');

-- CreateEnum
CREATE TYPE "PublicationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED');

-- CreateTable
CREATE TABLE "content_publication_outbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "contentType" "ContentPublicationType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "content_publication_outbox_dedupeKey_key" ON "content_publication_outbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "content_publication_outbox_status_availableAt_idx" ON "content_publication_outbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "content_publication_outbox_contentType_contentId_idx" ON "content_publication_outbox"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "content_publication_outbox_publishedAt_idx" ON "content_publication_outbox"("publishedAt");
