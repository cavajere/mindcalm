ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALBUM_IMAGE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALBUM_IMAGE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ALBUM_IMAGE_DELETED';

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'ALBUM_IMAGE';

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

ALTER TABLE "audio" ADD COLUMN "coverAlbumImageId" TEXT;
ALTER TABLE "articles" ADD COLUMN "coverAlbumImageId" TEXT;

CREATE UNIQUE INDEX "album_images_filePath_key" ON "album_images"("filePath");
CREATE UNIQUE INDEX "album_images_fileHash_key" ON "album_images"("fileHash");
CREATE INDEX "album_images_createdAt_idx" ON "album_images"("createdAt");
CREATE INDEX "audio_coverAlbumImageId_idx" ON "audio"("coverAlbumImageId");
CREATE INDEX "articles_coverAlbumImageId_idx" ON "articles"("coverAlbumImageId");

ALTER TABLE "audio"
ADD CONSTRAINT "audio_coverAlbumImageId_fkey"
FOREIGN KEY ("coverAlbumImageId") REFERENCES "album_images"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "articles"
ADD CONSTRAINT "articles_coverAlbumImageId_fkey"
FOREIGN KEY ("coverAlbumImageId") REFERENCES "album_images"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
