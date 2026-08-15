-- 0050_chatterbox_core.sql
-- #3415 (Chatterbox) prototype, work unit 1: persistent conference-call
-- schema for participants, rooms, the append-only event log, tasks, atomic
-- claims, and per-participant checkpoints. Additive-only; touches no
-- existing table. Prototype/Development scope only.

CREATE TABLE IF NOT EXISTS chatterbox_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_key TEXT NOT NULL UNIQUE,
  source_issue_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chatterbox_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role_class TEXT NOT NULL CHECK (role_class IN (
    'product_authority', 'pmo', 'implementation_agent', 'engineering_validation',
    'independent_verifier', 'preparation_research', 'system_clerk'
  )),
  capability_summary TEXT,
  assigned_by TEXT NOT NULL,
  source_authority TEXT NOT NULL,
  effective_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chatterbox_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES chatterbox_rooms(id),
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PLANNED' CHECK (state IN (
    'PLANNED', 'BLOCKED', 'AVAILABLE', 'CLAIMED', 'IN_PROGRESS', 'QUESTION',
    'READY_FOR_REVIEW', 'ACCEPTED', 'REWORK', 'COMPLETE', 'CANCELLED'
  )),
  collision_domain TEXT NOT NULL DEFAULT '[]',
  depends_on TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (room_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_chatterbox_tasks_room_state
  ON chatterbox_tasks(room_id, state);

CREATE TABLE IF NOT EXISTS chatterbox_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES chatterbox_tasks(id),
  participant_id INTEGER NOT NULL REFERENCES chatterbox_participants(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'STALE')),
  claimed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  renewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  released_at TEXT
);

-- The atomicity guarantee: at most one ACTIVE claim per task, enforced by
-- the database itself, not by an application-level check-then-write race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chatterbox_claims_active_task
  ON chatterbox_claims(task_id)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_chatterbox_claims_participant
  ON chatterbox_claims(participant_id, status);

CREATE TABLE IF NOT EXISTS chatterbox_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES chatterbox_rooms(id),
  participant_id INTEGER NOT NULL REFERENCES chatterbox_participants(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'CLAIM', 'RELEASE', 'STATUS', 'QUESTION', 'ANSWER', 'COMPLETE',
    'PMO_INSTRUCTION', 'PMO_ACCEPT', 'DECISION_RECORDED',
    'CHECK_IN', 'CHECK_OUT', 'SYSTEM'
  )),
  task_ref TEXT,
  target_participant_id INTEGER REFERENCES chatterbox_participants(id),
  in_reply_to_event_id INTEGER REFERENCES chatterbox_events(id),
  body TEXT NOT NULL,
  github_ref TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_chatterbox_events_room_created
  ON chatterbox_events(room_id, id);

CREATE INDEX IF NOT EXISTS idx_chatterbox_events_target
  ON chatterbox_events(target_participant_id, in_reply_to_event_id)
  WHERE target_participant_id IS NOT NULL;

-- Idempotent POST /event: a retried call with the same participant +
-- idempotency_key must not create a second event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chatterbox_events_idempotency
  ON chatterbox_events(participant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS chatterbox_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES chatterbox_rooms(id),
  participant_id INTEGER NOT NULL REFERENCES chatterbox_participants(id),
  last_seen_event_id INTEGER NOT NULL DEFAULT 0,
  checked_in_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  checked_out_at TEXT,
  UNIQUE (room_id, participant_id)
);
