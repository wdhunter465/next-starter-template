---
Doc Type: Reference
Audience: Human + AI implementation agents
Authority Level: Controlled
Owns: Chatterbox D1 schema (rooms, participants, tasks, claims, events, checkpoints) and the prototype API surface under /api/chatterbox/**
Does Not Own: Role-class capability definitions (see chatterbox-role-model.md); the authority/clerk boundary (see chatterbox-authority-boundary.md); operating procedure (see chatterbox-operate-a-room.md)
Canonical Reference: /docs/reference/chatterbox-event-schema.md
Related Issues: #3415
Last Reviewed: 2026-08-14
---

# Chatterbox event schema and API reference

Prototype work units 1–3 from #3415's launch package: persistence, atomic
claims, and the minimal room/task/event API. GitHub Issues/PRs remain the
system of record; this schema only records the room conversation described
in #3415.

## Tables

Migration: `migrations/0046_chatterbox_core.sql`. Additive-only; touches no
existing table.

### `chatterbox_rooms`

One row per GitHub program/project room.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | |
| `room_key` | text, unique | Stable external identity, e.g. `lgfc-website` |
| `source_issue_ref` | text | `owner/repo#number` of the governing Issue |
| `title` | text | |
| `created_at` | text | |

### `chatterbox_participants`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | |
| `participant_key` | text, unique | Stable external identity, e.g. `claude-code` |
| `display_name` | text | |
| `role_class` | text | One of `product_authority`, `pmo`, `implementation_agent`, `engineering_validation`, `independent_verifier`, `preparation_research`, `system_clerk` — see chatterbox-role-model.md |
| `capability_summary` | text, nullable | |
| `assigned_by` | text | Who authorized this assignment |
| `source_authority` | text | Repository-governance record permitting the assignment (not invented by Chatterbox) |
| `effective_at` | text | |
| `revoked_at` | text, nullable | Revoked participants are excluded from all read/write paths |
| `created_at` / `updated_at` | text | |

### `chatterbox_tasks`

The PMO-authored task graph, ingested per room. `collision_domain` and
`depends_on` mirror what the governing GitHub Issue already declares, not a
second parallel format.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | |
| `room_id` | integer fk | |
| `task_key` | text | Unique within a room (e.g. an Issue number) |
| `title` | text | |
| `state` | text | One of `PLANNED`, `BLOCKED`, `AVAILABLE`, `CLAIMED`, `IN_PROGRESS`, `QUESTION`, `READY_FOR_REVIEW`, `ACCEPTED`, `REWORK`, `COMPLETE`, `CANCELLED` |
| `collision_domain` | text (JSON array) | Free-form path/resource tags |
| `depends_on` | text (JSON array) | Other `task_key` values that must reach `ACCEPTED` or `COMPLETE` first |
| `created_at` / `updated_at` | text | |

### `chatterbox_claims`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | |
| `task_id` | integer fk | |
| `participant_id` | integer fk | |
| `status` | text | `ACTIVE`, `RELEASED`, or `STALE` |
| `claimed_at` / `renewed_at` / `released_at` | text | |

**Atomicity guarantee:** a partial unique index on `(task_id) WHERE status =
'ACTIVE'` enforces at most one active claim per task at the database level.
The API's precondition check (`canClaim` in `functions/_lib/chatterbox.ts`)
gives a specific rejection reason before ever reaching the database; the
index is what actually prevents a race, not the precondition check alone.

### `chatterbox_events`

The append-only conversation log.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | Monotonic; doubles as the catch-up cursor |
| `room_id` / `participant_id` | integer fk | |
| `event_type` | text | `CLAIM`, `RELEASE`, `STATUS`, `QUESTION`, `ANSWER`, `COMPLETE`, `PMO_INSTRUCTION`, `PMO_ACCEPT`, `DECISION_RECORDED`, `CHECK_IN`, `CHECK_OUT`, `SYSTEM` |
| `task_ref` | text, nullable | `task_key` this event concerns, if any |
| `target_participant_id` | integer fk, nullable | Set for a targeted `QUESTION`; null means broadcast |
| `in_reply_to_event_id` | integer fk (self), nullable | Set on an `ANSWER` to close the loop on a `QUESTION` |
| `body` | text | |
| `github_ref` | text (JSON), nullable | `{issue, pr, comment_id, sha}` — exact citation, not just a URL |
| `idempotency_key` | text, nullable | Deduped per-participant (see below) |
| `created_at` | text | |

**Idempotency:** a unique index on `(participant_id, idempotency_key) WHERE
idempotency_key IS NOT NULL` means a retried `POST /api/chatterbox/events`
call with the same key returns the original event (`idempotent_replay:
true`) instead of creating a duplicate.

### `chatterbox_checkpoints`

One row per `(room, participant)`, the durable check-in cursor.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | |
| `room_id` / `participant_id` | integer fk | |
| `last_seen_event_id` | integer | |
| `checked_in_at` / `checked_out_at` | text, nullable | |

## API surface

All routes under `functions/api/chatterbox/**`, protected by the existing
`ADMIN_TOKEN` gate (`requireAdmin`, `x-admin-token` header or `Authorization:
Bearer`) — the same shared-secret pattern already used by every
`functions/api/admin/**` route. This prototype does not issue per-agent
credentials; see chatterbox-authority-boundary.md for why, and what changes
before wider use.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/chatterbox/room?room=<key>` | Fetch a room |
| `POST` | `/api/chatterbox/room` | Create a room |
| `GET` | `/api/chatterbox/participants?role_class=<optional>` | List participants |
| `POST` | `/api/chatterbox/participants` | Register a participant |
| `GET` | `/api/chatterbox/tasks?room=<key>` | List a room's task graph |
| `POST` | `/api/chatterbox/tasks` | Create/update a task |
| `POST` | `/api/chatterbox/claim` | Atomically claim a task |
| `POST` | `/api/chatterbox/release` | Release the caller's active claim |
| `GET` | `/api/chatterbox/events?room=<key>&since=<id>&limit=<n>` | Raw events since an id (capped at 200) |
| `POST` | `/api/chatterbox/events` | Append an event (supports `idempotency_key`) |
| `POST` | `/api/chatterbox/check-in` | Upsert checkpoint; returns a bounded catch-up digest |

## Catch-up digest

`buildCatchUpDigest` (`functions/_lib/chatterbox.ts`) returns, not a full
replay:

- `openQuestions` — `QUESTION` events targeted at the caller (or broadcast)
  with no matching `ANSWER`, regardless of checkpoint position.
- `pmoInstructions` — the most recent unread `PMO_INSTRUCTION` events
  (capped, default 10).
- `tail` — the most recent unread events overall (capped, default 20).
- `unreadCount` — the true count, even though `tail` is capped.

This is the deliberate compression design from the #3415 review (a
lifetime-spanning room accumulates far more events than fit in one read);
the 20/10 caps are defaults, not schema constraints, and can be tuned per
call.

## Not yet built (deferred past this slice)

- GitHub event ingestion beyond the `github_ref` citation field on
  individually-posted events (no automatic mirroring of Issue/PR state yet).
- ACK stage tracking (`DELIVERED`/`SEEN`/`ACKNOWLEDGED`/`ACTED`).
- Cause→effect reconciliation.
- MCP interface (this slice is Pages Functions/REST only).
- Any push/notification adapter.
