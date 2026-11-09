-- 0098_social_post_ledger_5156.sql
-- #5156 (design #5143): one row per post per platform that the scheduled job has sent, so a rerun,
-- a delayed cron tick or a retry never posts the same item twice.
--
--   social_post_ledger   post_id matches an id in data/social-post-queue.json. status is
--                        'posted' or 'failed'. platform_post_id is the platform's own id when it
--                        gave one. attempts counts tries. It holds no member data.
--
-- Additive only. Reverse with: DROP TABLE social_post_ledger;

CREATE TABLE IF NOT EXISTS social_post_ledger (
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('x','facebook','instagram','pinterest')),
  status TEXT NOT NULL CHECK (status IN ('posted','failed')),
  platform_post_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, platform)
);
