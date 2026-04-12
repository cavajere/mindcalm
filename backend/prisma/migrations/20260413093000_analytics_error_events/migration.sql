ALTER TYPE "AnalyticsContentType" ADD VALUE IF NOT EXISTS 'SYSTEM';

ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'APP_ERROR';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'API_ERROR';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'AUDIO_ERROR';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'SERVER_ERROR';

ALTER TABLE "analytics_events" ADD COLUMN "metadata" JSONB;
ALTER TABLE "analytics_events" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_userId_fkey";

ALTER TABLE "analytics_events"
ADD CONSTRAINT "analytics_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
