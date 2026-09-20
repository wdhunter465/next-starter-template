-- 0076_content_blocks_scheduled_publish.sql
-- Purpose: #4253 -- scheduled auto-publish for content_blocks rows (e.g. the
-- Fundraiser Daily Details feed), so a series of pre-authored posts can each
-- go live on its own future date without a human clicking Publish that day.
-- Additive, forward-only, no drops. Existing content_blocks rows are
-- unaffected: scheduled_publish_at/social_caption default to NULL, and the
-- existing draft/publish flow (functions/api/admin/cms/save.ts,publish.ts)
-- is untouched.

ALTER TABLE content_blocks ADD COLUMN scheduled_publish_at TEXT NULL;
ALTER TABLE content_blocks ADD COLUMN social_caption TEXT NULL;

-- Used by the publish-due sweep (functions/api/scheduled-content/publish-due.ts)
-- to find draft rows whose scheduled time has arrived, without scanning every
-- content_blocks row.
CREATE INDEX IF NOT EXISTS idx_content_blocks_scheduled_publish
  ON content_blocks (status, scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;
