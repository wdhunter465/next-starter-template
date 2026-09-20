-- 0076_content_blocks_scheduled_publish.sql
-- Purpose: #4253 -- scheduled auto-publish for content_blocks rows (e.g. the
-- Fundraiser Daily Details feed), so a series of pre-authored posts can each
-- go live on its own future date without a human clicking Publish that day.
-- Additive, forward-only, no drops. Existing content_blocks rows are
-- unaffected: scheduled_publish_at/social_caption/image_url/image_alt default
-- to NULL, and the existing draft/publish flow
-- (functions/api/admin/cms/save.ts,publish.ts) is untouched.
--
-- image_url/image_alt store a direct, already-resolved public URL (e.g. a B2
-- object already uploaded via the existing /admin/media-assets flow, or a
-- photos.url already in the photos table) rather than a foreign key into the
-- heavier content_inventory_media/rendition pipeline built for editorial
-- stories -- these are simple one-image announcement posts, not stories.

ALTER TABLE content_blocks ADD COLUMN scheduled_publish_at TEXT NULL;
ALTER TABLE content_blocks ADD COLUMN social_caption TEXT NULL;
ALTER TABLE content_blocks ADD COLUMN image_url TEXT NULL;
ALTER TABLE content_blocks ADD COLUMN image_alt TEXT NULL;

-- Used by the publish-due sweep (functions/api/scheduled-content/publish-due.ts)
-- to find draft rows whose scheduled time has arrived, without scanning every
-- content_blocks row.
CREATE INDEX IF NOT EXISTS idx_content_blocks_scheduled_publish
  ON content_blocks (status, scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;
