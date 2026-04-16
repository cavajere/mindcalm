-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('FREE', 'PREMIUM');

-- DropIndex
DROP INDEX "audio_status_idx";

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "audio" ADD COLUMN     "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "admin_users_tier_idx" ON "admin_users"("tier");

-- CreateIndex
CREATE INDEX "audio_status_visibility_idx" ON "audio"("status", "visibility");
