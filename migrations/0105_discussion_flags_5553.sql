-- 0105_discussion_flags_5553.sql
-- #5553: Member Chat flags. One row per flag on a post (a topic or a reply).
--
--   kind 'question'  the post contains @admin: a question for the admin to answer. Open until an admin
--                    replies in the topic or resolves it.
--   kind 'report'    a member reported the post. A reason is required. Only the reporter and admins see it.
--   flagged_by       who flagged (the poster for a question, the reporter for a report); recorded for every flag
--   summary_sent_at  set when the flag was included in the daily admin summary email (#5551)
--
-- One flag per post, kind and member (the unique index): flagging twice does nothing.
-- Rollback: take a D1 export first. The table is new; DROP TABLE discussion_flags reverses it.

CREATE TABLE IF NOT EXISTS discussion_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discussion_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('question', 'report')),
  flagged_by TEXT NOT NULL COLLATE NOCASE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  admin_note TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  summary_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (kind <> 'report' OR length(trim(COALESCE(reason, ''))) >= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_discussion_flags_once ON discussion_flags(discussion_id, kind, flagged_by);
CREATE INDEX IF NOT EXISTS idx_discussion_flags_status ON discussion_flags(status, created_at);
CREATE INDEX IF NOT EXISTS idx_discussion_flags_member ON discussion_flags(flagged_by, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_discussion_flags_topic ON discussion_flags(topic_id, kind, status);
