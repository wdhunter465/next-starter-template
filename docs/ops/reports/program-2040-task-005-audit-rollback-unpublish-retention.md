---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 005 (#2053) audit-trail fields, rollback and unpublish procedures, approval/source evidence retention, and operator closeout evidence
Does Not Own: Runtime audit tables, scheduler, safety CI (#2054), Task 007 slices (#2055), member soft-deletion, or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2053, #2050, #2052, #2051, #2054, #2919, #2273, #3157
Last Reviewed: 2026-08-14
---

# Program #2040 Task 005 — Audit trail, rollback, unpublish, and retention

## Purpose

Define the evidence and recovery behavior for publication operations so a public-path change can be reconstructed, reversed, or withdrawn without deleting approval or source history.

This is **design-time only**. It does not add tables, write D1, or publish content.

## Scope

This report covers Task 005 (#2053) only:

- required audit fields;
- rollback and unpublish procedures;
- retention of approval and source evidence;
- operator-facing closeout evidence.

It does not implement Task 006 safety CI or Task 007 runtime. Member-account soft-deletion remains owned by `docs/how-to/website/takedown-soft-delete-and-recovery.md`.

## Intended final state

After Task 005 is accepted:

- every public-path and recovery action has an append-only audit event;
- unpublish and rollback are named procedures with Product Authority;
- source, credit, approval, and schedule records survive withdrawal;
- operators have a closeout evidence list for each recovery action;
- Task 006 may encode fail-closed checks against these fields.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2053 (Task 005 of Program #2040) |
| Predecessor | #2050 merged PR #3470 (`950cc3c0`); Task 004 merged PR #3473 (`c928ef5f`) supplies schedule/pause context |
| Implementation start | `c928ef5f` (`origin/main`); branch `cursor/2053-audit-rollback-unpublish-2e48`; allowlist is this report only |
| State model | `docs/ops/reports/program-2040-task-002-publication-state-and-authority.md` |
| Schedule/pause | `docs/ops/reports/program-2040-task-004-scheduled-publication-and-rotation.md` |
| Pipeline audit table (design) | `moderation_events` in `docs/reference/content/content-pipeline-storage-model.md` |
| Rights takedown | `POST /api/admin/editorial/suppress` → inventory `archived` with reason/source/timestamp (#2919) |
| Human approval | Mandatory before public publication; republish after unpublish requires a new `approved` step |

## Audit trail requirements

Reuse the pipeline **append-only** `moderation_events` design. Do not update prior events in place. Do not treat GitHub comments as the operational audit store.

Every event must record:

| Field | Meaning |
| --- | --- |
| `event_id` | Durable identity of **this** event (unique per row; not reused as a parent key) |
| `rollback_group_id` | Shared correlation id for one rollback package; omitted on unrelated events |
| `event_at` | UTC timestamp |
| `actor` | Named human or `scheduler` executing a previously approved fire/pause |
| `actor_role` | reviewing editor, Product Authority / Bill, or automation |
| `candidate_id` | Pipeline/candidate identity |
| `inventory_id` | `content_inventory` id when converted |
| `from_state` / `to_state` | Task 002 operational states |
| `action` | See action catalog below |
| `reason` | Required for unpublish, rollback, reject, pause, suppress |
| `schedule_id` | When a clock event is involved |
| `publication_target` | Surfaces affected |
| `approval_snapshot` | `approved_by`, `approved_at`, and target copied at event time |
| `source_snapshot` | Source title/owner/citation and `credit_line` copied at event time |
| `public_check` | Whether public helpers were expected to include the row after the action |

Action catalog (minimum): `stage`, `review`, `approve`, `schedule`, `pause`, `cancel_schedule`, `publish`, `rotate`, `unpublish`, `rollback`, `archive`, `reject`, `suppress`, `reopen`.

Automation may write events for a legal fire or recorded pause. It must not write `approve` or invent `approved_by`.

## Unpublish procedure

Unpublish withdraws a **currently public** row from public and member helpers. It is not pause, hold, or suppress.

| Step | Requirement |
| --- | --- |
| Authority | Product Authority / Bill only |
| From | `published` |
| To | `unpublished` |
| Inventory | `content_inventory.status` is no longer `published`; publication-prep `publication_status` maps to `unpublished` |
| Public effect | Homepage, library, gallery, search, archive, and Fan Club helpers must stop returning the row |
| Schedule | Any active `schedule_id` for that row is cancelled; pause is insufficient if the row is already public |
| Audit | `action = unpublish` with `reason` |
| Republish | `unpublished` → `approved` (re-approval) → `published` or `scheduled`. Illegal: `unpublished` → `published` |

Unpublish must not hard-delete the inventory row, candidate, source, credit, or prior audit events.

### Related path: rights/takedown suppress

`POST /api/admin/editorial/suppress` (#2919) remains the rights-holder/subject takedown path. It sets inventory `archived` and stores `suppression_reason` / `takedown_request_source`. For Program #2040:

- editorial mistake or rotation recovery → **unpublish** (this task);
- legal/rights/takedown request → **suppress** (existing how-to);
- do not use suppress as a silent substitute for unpublish, or unpublish as a substitute for a recorded takedown.

## Rollback procedure

Rollback restores the **previous public set** after a mistaken publish or `slot_rotation` fire. It is not a general undo of `reviewed` or `approved`.

| Step | Requirement |
| --- | --- |
| Authority | Product Authority / Bill |
| Trigger | Wrong row went public, wrong `incoming_set` fired, or fire ignored a pause that should have held |
| Incoming published in error | Unpublish those rows (`published` → `unpublished`) with `action = unpublish` |
| Outgoing displaced in error | If `outgoing_action` unpublished them, restore only via `unpublished` → `approved` → `published` with recorded re-approval, unless the rollback package already contains the prior approval snapshot and Product Authority explicitly re-affirms it in the rollback event |
| Schedule | Cancel or pause remaining fires for the affected `schedule_id` |
| Audit | One parent event with `action = rollback` plus per-row `unpublish`/`publish` events; all share `rollback_group_id` (and `schedule_id` when a clock was involved). Do not reuse `event_id` as a parent key. |
| Public check | Preview on `/admin/clubstaging` (or adjacent admin path) of the restored set **before** calling the restore public; then confirm public helpers match the restored published inventory |

Rollback must fail closed when the prior approval snapshot is missing, public-path metadata is incomplete, or the operator is not Product Authority / Bill. Software must not auto-rollback a legal approved fire.

## Evidence retention

Keep these records after unpublish, rollback, archive, reject, or suppress:

- source, credit, rights, privacy, and review fields from Task 001/002;
- `approved_by` / `approved_at` and publication target;
- schedule records including cancelled and paused rows;
- append-only `moderation_events`;
- suppress/takedown fields from #2919;
- `rejection_reason` and `pause_reason`.

Do not purge or overwrite snapshots to hide a public interval. Correction is a **new** event. Hard-delete of publication evidence is out of scope and prohibited here.

Retention duration: keep for the life of the candidate/inventory row and after archive, unless a later Product Authority retention issue names a shorter retention period. This task does not authorize a purge job.

## Operator closeout evidence

For each unpublish or rollback, the operator record (Issue comment or later admin closeout view) must include:

1. `event_id` / `event_at` / `actor`;
2. `candidate_id` and `inventory_id`;
3. `from_state` → `to_state` and `action`;
4. `reason`;
5. `schedule_id` when applicable;
6. surfaces that must no longer (or must again) show the row;
7. confirmation that public/member helpers were checked against **published** inventory only;
8. statement that source/approval evidence was retained.

Do not claim closeout if the public helper still returns an unpublished row, or if audit fields are missing.

## Fail-closed stops for recovery

Stop the affected action when:

- `reason` is missing on unpublish, rollback, reject, pause, or suppress;
- actor is not Product Authority / Bill for unpublish, rollback, or republish approval;
- rollback would publish without an approval snapshot or a new `approved_by` / `approved_at`;
- unpublish would hard-delete rows or strip source/credit;
- public helpers would be queried with non-published rows to "prove" recovery;
- Task 007 runtime is attempted before #3157 records real trial rows.

## Explicit non-goals of this task

- No application, workflow, migration, or route changes.
- No member soft-deletion changes.
- No start of Task 006 in this PR (one issue, one PR; stage-before-merge).
- No public publication.

## Successor

#2054 — Publication safety CI/ops checks and fail-closed rules, after this Task 005 PR is independently reviewed and merged.
