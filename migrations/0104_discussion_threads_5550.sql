-- 0104_discussion_threads_5550.sql
-- #5550: Member Chat becomes threaded. A discussion row with parent_id NULL is a topic; a row with parent_id
-- set is a reply to that topic (one level deep). Existing posts all become topics (parent_id stays NULL).
--
--   parent_id               NULL for a topic, the topic's id for a reply
--   notify_author           1 = email the topic's author about replies (once a day); 0 = off. Topic rows only.
--   closed_at               set when the topic's author closes the thread; replies are refused while set
--   last_notified_reply_id  highest reply id already covered by a reply email for this topic (0 = none yet)
--
-- Rollback: take a D1 export first. The columns are additive; the old chat page ignores them. To reverse,
-- stop using them (nothing else reads them); SQLite column drops are not needed.

ALTER TABLE discussions ADD COLUMN parent_id INTEGER;
ALTER TABLE discussions ADD COLUMN notify_author INTEGER NOT NULL DEFAULT 1;
ALTER TABLE discussions ADD COLUMN closed_at TEXT;
ALTER TABLE discussions ADD COLUMN last_notified_reply_id INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_discussions_parent ON discussions(parent_id, status, created_at);
