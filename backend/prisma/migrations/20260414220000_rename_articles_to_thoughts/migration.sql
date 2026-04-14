ALTER TYPE "AuditAction" RENAME VALUE 'ARTICLE_CREATED' TO 'THOUGHT_CREATED';
ALTER TYPE "AuditAction" RENAME VALUE 'ARTICLE_UPDATED' TO 'THOUGHT_UPDATED';
ALTER TYPE "AuditAction" RENAME VALUE 'ARTICLE_DELETED' TO 'THOUGHT_DELETED';
ALTER TYPE "AuditAction" RENAME VALUE 'ARTICLE_STATUS_CHANGED' TO 'THOUGHT_STATUS_CHANGED';

ALTER TYPE "AuditEntityType" RENAME VALUE 'ARTICLE' TO 'THOUGHT';
ALTER TYPE "AnalyticsContentType" RENAME VALUE 'ARTICLE' TO 'THOUGHT';
ALTER TYPE "AnalyticsEventType" RENAME VALUE 'ARTICLE_VIEW' TO 'THOUGHT_VIEW';
ALTER TYPE "ContentPublicationType" RENAME VALUE 'ARTICLE' TO 'THOUGHT';

ALTER TABLE "articles" RENAME TO "thoughts";
ALTER TABLE "article_tags" RENAME TO "thought_tags";

ALTER TABLE "thoughts" RENAME CONSTRAINT "articles_pkey" TO "thoughts_pkey";
ALTER TABLE "thoughts" RENAME CONSTRAINT "articles_coverAlbumImageId_fkey" TO "thoughts_coverAlbumImageId_fkey";

ALTER TABLE "thought_tags" RENAME CONSTRAINT "article_tags_pkey" TO "thought_tags_pkey";
ALTER TABLE "thought_tags" RENAME CONSTRAINT "article_tags_articleId_fkey" TO "thought_tags_thoughtId_fkey";
ALTER TABLE "thought_tags" RENAME CONSTRAINT "article_tags_tagId_fkey" TO "thought_tags_tagId_fkey";

ALTER TABLE "thought_tags" RENAME COLUMN "articleId" TO "thoughtId";
ALTER TABLE "analytics_events" RENAME COLUMN "articleId" TO "thoughtId";
ALTER TABLE "user_notification_preferences" RENAME COLUMN "notifyOnArticles" TO "notifyOnThoughts";

ALTER TABLE "analytics_events" RENAME CONSTRAINT "analytics_events_articleId_fkey" TO "analytics_events_thoughtId_fkey";

ALTER INDEX "articles_slug_key" RENAME TO "thoughts_slug_key";
ALTER INDEX "articles_slug_idx" RENAME TO "thoughts_slug_idx";
ALTER INDEX "articles_title_trgm_idx" RENAME TO "thoughts_title_trgm_idx";
ALTER INDEX "articles_coverAlbumImageId_idx" RENAME TO "thoughts_coverAlbumImageId_idx";
ALTER INDEX "articles_status_visibility_idx" RENAME TO "thoughts_status_visibility_idx";
ALTER INDEX "article_tags_tagId_articleId_idx" RENAME TO "thought_tags_tagId_thoughtId_idx";
ALTER INDEX "analytics_events_articleId_occurredAt_idx" RENAME TO "analytics_events_thoughtId_occurredAt_idx";
