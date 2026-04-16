-- CreateEnum
CREATE TYPE "EventParticipationMode" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "events"
ADD COLUMN "participationMode" "EventParticipationMode" NOT NULL DEFAULT 'FREE',
ADD COLUMN "participationPriceCents" INTEGER;

-- AddCheckConstraint
ALTER TABLE "events" ADD CONSTRAINT "events_participation_price_check"
CHECK (
  ("participationMode" = 'FREE' AND "participationPriceCents" IS NULL)
  OR ("participationMode" = 'PAID' AND "participationPriceCents" IS NOT NULL AND "participationPriceCents" >= 0)
);
