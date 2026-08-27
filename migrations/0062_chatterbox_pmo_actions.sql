-- 0062_chatterbox_pmo_actions.sql
-- #3794 (Chatterbox self-hosted room-actor design), Layer 3: a first-class
-- PMO action queue with acknowledge/expire/escalate semantics. Generalizes
-- Jules's #3579 JULES-2 finding (missing DECISION_REQUIRED/urgency/expiry)
-- from "decisions" to "required PMO follow-through" (e.g. close an Issue,
-- update a tracker) per docs/explanation/chatterbox-self-hosted-room-actor-
-- redesign.md. Additive-only; touches no existing table.
--
-- Development-only for this package, matching migration 0050's own
-- precedent: applied to lgfc-litedev, not lgfc_lite, until separately
-- authorized for Production.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chatterbox_pmo_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES chatterbox_rooms(id),
  source_event_id INTEGER NOT NULL REFERENCES chatterbox_events(id),
  task_ref TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'CLOSE_ISSUE', 'UPDATE_TRACKER', 'RELEASE_SUCCESSOR', 'OTHER'
  )),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ACKED', 'DONE', 'EXPIRED'
  )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  acked_at TEXT,
  completed_at TEXT,
  completed_by_participant_id INTEGER REFERENCES chatterbox_participants(id),
  reconciliation_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_chatterbox_pmo_actions_room_status
  ON chatterbox_pmo_actions(room_id, status);

-- The scheduled reconciliation sweep (Layer 4) needs to find soonest-
-- expiring PENDING rows efficiently without a full table scan per room.
CREATE INDEX IF NOT EXISTS idx_chatterbox_pmo_actions_status_expires
  ON chatterbox_pmo_actions(status, expires_at);
