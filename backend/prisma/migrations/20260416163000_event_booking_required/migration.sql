-- AlterTable: rename bookingEnabled to bookingRequired
ALTER TABLE "events" RENAME COLUMN "bookingEnabled" TO "bookingRequired";

-- DropIndex + CreateIndex for renamed column
DROP INDEX IF EXISTS "events_bookingEnabled_idx";
CREATE INDEX "events_bookingRequired_idx" ON "events"("bookingRequired");
