-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC', 'REGISTERED');

-- AlterTable
ALTER TABLE "articles"
ADD COLUMN "visibility" "ContentVisibility" NOT NULL DEFAULT 'REGISTERED';

-- AlterTable
ALTER TABLE "events"
ADD COLUMN "visibility" "ContentVisibility" NOT NULL DEFAULT 'REGISTERED';

-- DropIndex
DROP INDEX "articles_status_idx";

-- DropIndex
DROP INDEX "events_status_idx";

-- CreateIndex
CREATE INDEX "articles_status_visibility_idx" ON "articles"("status", "visibility");

-- CreateIndex
CREATE INDEX "events_status_visibility_idx" ON "events"("status", "visibility");
