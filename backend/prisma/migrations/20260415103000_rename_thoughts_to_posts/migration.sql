ALTER TYPE "AuditAction" RENAME VALUE 'THOUGHT_CREATED' TO 'POST_CREATED';
ALTER TYPE "AuditAction" RENAME VALUE 'THOUGHT_UPDATED' TO 'POST_UPDATED';
ALTER TYPE "AuditAction" RENAME VALUE 'THOUGHT_DELETED' TO 'POST_DELETED';
ALTER TYPE "AuditAction" RENAME VALUE 'THOUGHT_STATUS_CHANGED' TO 'POST_STATUS_CHANGED';

ALTER TYPE "AuditEntityType" RENAME VALUE 'THOUGHT' TO 'POST';
ALTER TYPE "AnalyticsContentType" RENAME VALUE 'THOUGHT' TO 'POST';
ALTER TYPE "AnalyticsEventType" RENAME VALUE 'THOUGHT_VIEW' TO 'POST_VIEW';
ALTER TYPE "ContentPublicationType" RENAME VALUE 'THOUGHT' TO 'POST';

ALTER TABLE "thoughts" RENAME TO "posts";
ALTER TABLE "thought_tags" RENAME TO "post_tags";

ALTER TABLE "posts" RENAME CONSTRAINT "thoughts_pkey" TO "posts_pkey";
ALTER TABLE "posts" RENAME CONSTRAINT "thoughts_coverAlbumImageId_fkey" TO "posts_coverAlbumImageId_fkey";

ALTER TABLE "post_tags" RENAME CONSTRAINT "thought_tags_pkey" TO "post_tags_pkey";
ALTER TABLE "post_tags" RENAME CONSTRAINT "thought_tags_thoughtId_fkey" TO "post_tags_postId_fkey";
ALTER TABLE "post_tags" RENAME CONSTRAINT "thought_tags_tagId_fkey" TO "post_tags_tagId_fkey";

ALTER TABLE "post_tags" RENAME COLUMN "thoughtId" TO "postId";
ALTER TABLE "analytics_events" RENAME COLUMN "thoughtId" TO "postId";
ALTER TABLE "user_notification_preferences" RENAME COLUMN "notifyOnThoughts" TO "notifyOnPosts";

ALTER TABLE "analytics_events" RENAME CONSTRAINT "analytics_events_thoughtId_fkey" TO "analytics_events_postId_fkey";

ALTER INDEX "thoughts_slug_key" RENAME TO "posts_slug_key";
ALTER INDEX "thoughts_slug_idx" RENAME TO "posts_slug_idx";
ALTER INDEX "thoughts_title_trgm_idx" RENAME TO "posts_title_trgm_idx";
ALTER INDEX "thoughts_coverAlbumImageId_idx" RENAME TO "posts_coverAlbumImageId_idx";
ALTER INDEX "thoughts_status_visibility_idx" RENAME TO "posts_status_visibility_idx";
ALTER INDEX "thought_tags_tagId_thoughtId_idx" RENAME TO "post_tags_tagId_postId_idx";
ALTER INDEX "analytics_events_thoughtId_occurredAt_idx" RENAME TO "analytics_events_postId_occurredAt_idx";
