---
Doc Type: Reference
Audience: Human + AI implementation agents
Authority Level: Controlled
Owns: Chatterbox D1 schema (rooms, participants, tasks, claims, events, checkpoints, pmo_actions) and the API surface under /api/chatterbox/**, as built for #3794's self-hosted room-actor design
Does Not Own: Role-class capability definitions (see chatterbox-role-model.md); the authority/clerk boundary (see chatterbox-authority-boundary.md); operating procedure (see chatterbox-operate-a-room.md)
Canonical Reference: /docs/reference/chatterbox-event-schema.md
Related Issues: #3415, #3579, #3794
Last Reviewed: 2026-08-27
---

# Chatterbox event schema and API reference

Ported forward from the #3415 prototype (`component/chatterbox-prototype`)
onto #3794's self-hosted room-actor design
(`docs/explanation/chatterbox-self-hosted-room-actor-redesign.md`), fixing
Jules's #3579 review findings along the way. GitHub Issues/PRs remain the
system of record; this schema only records the room conversation and PMO
follow-through described in #3415.

## Tables

Base schema: `migrations/0050_chatterbox_core.sql` (rooms, participants,
tasks, claims, events, checkpoints — unchanged by this package). Additive
migrations for #3794: `migrations/0062_chatterbox_pmo_actions.sql` and
`migrations/0063_chatterbox_participant_auth.sql`. All additive-only;
Development-only (`lgfc-litedev`) for this package.

### `chatterbox_rooms`, `chatterbox_tasks`, `chatterbox_claims`, `chatterbox_checkpoints`

Unchanged from the original prototype schema. See migration
`0050_chatterbox_core.sql` for exact columns.

**Atomicity guarantee (claims):** a partial unique index on
`chatterbox_claims(task_id) WHERE status = 'ACTIVE'` enforces at most one
active claim per task at the database level. The API's precondition check
(`canClaim` in `functions/_lib/chatterbox.ts`) gives a specific rejection
reason before ever reaching the database; the index is what actually
prevents a race.

### `chatterbox_participants`

Unchanged columns from `0050`, plus one addition:

| Column | Type | Notes |
| --- | --- | --- |
| `credential_hash` | text, nullable | **New in 0063.** SHA-256 hex digest of a per-participant bearer token. Never the token itself. `NULL` means this participant has no direct credential and can only be acted for through the bridge relay path (see Auth model below). Unique among non-null values. |

### `chatterbox_events`

Unchanged from `0050`. `event_type` remains one of `CLAIM`, `RELEASE`,
`STATUS`, `QUESTION`, `ANSWER`, `COMPLETE`, `PMO_INSTRUCTION`, `PMO_ACCEPT`,
`DECISION_RECORDED`, `CHECK_IN`, `CHECK_OUT`, `SYSTEM`.

**Idempotency:** unchanged — a unique index on `(participant_id,
idempotency_key) WHERE idempotency_key IS NOT NULL` deduplicates retried
`POST /api/chatterbox/events` calls.

### `chatterbox_pmo_actions` (new, migration `0062`)

The PMO action queue — #3794 Layer 3, generalizing Jules's #3579 JULES-2
finding from "decisions" to "required PMO follow-through." A row is created
automatically when a `COMPLETE` event targets a `pmo`-role participant; it
is **not** cleared by being read, only by an explicit completion callback.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer pk | |
| `room_id` | integer fk | |
| `source_event_id` | integer fk | The `COMPLETE` event that created this row |
| `task_ref` | text | Usually a GitHub Issue number |
| `action_type` | text | `CLOSE_ISSUE`, `UPDATE_TRACKER`, `RELEASE_SUCCESSOR`, or `OTHER` |
| `status` | text | `PENDING` → `ACKED` → `DONE`, or `PENDING` → `EXPIRED` |
| `created_at` / `expires_at` | text | `expires_at` defaults to 24h after creation |
| `acked_at` / `completed_at` | text, nullable | |
| `completed_by_participant_id` | integer fk, nullable | |
| `reconciliation_note` | text, nullable | |

An action is escalation-worthy only while still `PENDING` past its own
`expires_at` — see `isPmoActionOverdue` in `functions/_lib/chatterbox.ts`.
Acknowledging a row (`ACKED`) is itself evidence someone is on it and stops
escalation, without yet claiming the work is done.

## Auth model (#3794 JULES-1 fix)

The original prototype gated every route with the shared `ADMIN_TOKEN` used
by `functions/api/admin/**` — any caller holding that token could assert
any `participant_key`. `main`'s admin gate has since moved to a
website-member session model entirely incompatible with agent callers, so
this package introduces a dedicated, narrower model
(`functions/_lib/chatterbox-auth.ts`):

- **Per-participant credential.** A bearer token whose SHA-256 hash matches
  a participant's `credential_hash` authenticates as exactly that
  participant. Asserting a different `participant_key` in the request body
  than the authenticated credential resolves to is rejected (`403`) rather
  than honored.
- **Bridge/ops relay credential** (`CHATTERBOX_BRIDGE_TOKEN` env secret).
  Authenticates the GitHub-comment bridge's existing, already-documented
  self-declared trust model — the relay must still name an explicit
  `participant_key`, which is looked up and trusted as before. This same
  credential gates room/participant/task management (`POST /room`, `POST
  /participants`, `POST /tasks`), which stays PMO/ops-operated rather than
  self-service.

All requests carry `Authorization: Bearer <token>`, not the old
`x-admin-token` header.

## API surface

All routes under `functions/api/chatterbox/**`.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/chatterbox/room?room=<key>` | Fetch a room | participant or relay |
| `POST` | `/api/chatterbox/room` | Create a room | relay only |
| `GET` | `/api/chatterbox/participants?role_class=<optional>` | List participants | participant or relay |
| `POST` | `/api/chatterbox/participants` | Register a participant, optionally with a `credential` | relay only |
| `GET` | `/api/chatterbox/tasks?room=<key>` | List a room's task graph | participant or relay |
| `POST` | `/api/chatterbox/tasks` | Create/update a task | relay only |
| `POST` | `/api/chatterbox/claim` | Atomically claim a task | participant (as itself) or relay (named) |
| `POST` | `/api/chatterbox/release` | Release a claim (owner unconditionally; `pmo`/`product_authority` force-release with a required `reason`, #3794 JULES-5) | participant or relay |
| `GET` | `/api/chatterbox/events?room=<key>&since=<id>&limit=<n>` | Raw events since an id (capped at 200) | participant or relay |
| `POST` | `/api/chatterbox/events` | Append an event; a `COMPLETE` targeting a `pmo` participant also creates a `chatterbox_pmo_actions` row | participant or relay |
| `POST` | `/api/chatterbox/check-in` | Upsert checkpoint; returns a bounded catch-up digest. Atomic high-watermark (#3794 JULES-3 fix) — see below | participant or relay |
| `GET` | `/api/chatterbox/pmo-actions?room=<key>&status=<optional>` | List the PMO action queue, soonest-expiring first | participant or relay |
| `POST` | `/api/chatterbox/pmo-actions` | `{op: 'ack'\|'complete', id, reconciliation_note?}` — `pmo`/`product_authority` only | participant or relay |
| `POST` | `/api/chatterbox/reconcile` | Layer 4 sweep: expires overdue `PENDING` actions, posts a `SYSTEM` escalation event | relay only, posts as a `system_clerk` participant |

## Catch-up digest and the check-in race fix

`buildCatchUpDigest` (`functions/_lib/chatterbox.ts`) is unchanged in shape
— `openQuestions`, `pmoInstructions` (capped, default 10), `tail` (capped,
default 20), `unreadCount`.

**#3794 Layer 1 / Jules #3579 JULES-3 fix:** the old check-in path advanced
a participant's checkpoint to the id of the `CHECK_IN` event it had just
inserted, which could exceed a concurrent event's id that its own read
never saw — silently skipping that event forever. The fix
(`computeCheckInHighWatermark`) advances the checkpoint only to the highest
event id actually present in the read taken *before* this call's own
insert. Any event written concurrently necessarily receives a higher id and
is correctly left for the *next* check-in instead of being lost. See
`tests/chatterbox-check-in-race.test.ts` for the regression test.

## Built in this slice (#3794)

- Per-participant credential auth + bridge relay path (JULES-1).
- Atomic high-watermark check-in (JULES-3).
- PMO action queue with acknowledge/expire/escalate semantics (Layer 3,
  generalizing JULES-2).
- PMO/product_authority force-release with required reason (JULES-5).
- Reconciliation sweep: internal expiry (`/api/chatterbox/reconcile`) plus
  a GitHub cross-check for claimed-`DONE` `CLOSE_ISSUE` actions
  (`scripts/ci/chatterbox_reconcile_github.mjs`), run on a schedule
  (`.github/workflows/ops-chatterbox-reconciliation-sweep.yml`).

Carried forward unchanged from the original prototype: GitHub-linking
ingestion (`chatterbox_github_ingest.mjs`), Cloudflare Pages URL resolution
(`chatterbox_resolve_preview_url.mjs`), and the Development integration
check.

## Not yet built (deferred past this package)

- True real-time push delivery — named a non-goal in the design doc; no
  actor-hosting primitive exists to hold a connection open on stateless
  Pages Functions.
- The governance/CI knowledge-retrieval layer (design doc Layer 5).
- Full-text porting of `chatterbox-architecture-rationale.md`,
  `chatterbox-authority-boundary.md`, and `chatterbox-operate-a-room.md`
  from the prototype branch — flagged as a named follow-up in this
  package's PR handoff rather than rushed here.
