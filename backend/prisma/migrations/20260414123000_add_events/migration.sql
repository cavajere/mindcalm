-- AlterEnum
ALTER TYPE "ContentPublicationType" ADD VALUE 'EVENT';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'EVENT_STATUS_CHANGED';
ALTER TYPE "AuditEntityType" ADD VALUE 'EVENT';

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

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_coverAlbumImageId_idx" ON "events"("coverAlbumImageId");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_startsAt_idx" ON "events"("startsAt");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_coverAlbumImageId_fkey" FOREIGN KEY ("coverAlbumImageId") REFERENCES "album_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
