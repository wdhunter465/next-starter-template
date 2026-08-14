---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 004 (#2052) scheduled-publication rules, controlled rotation clock, preview-before-public behavior, and operator override/pause conditions
Does Not Own: Runtime scheduler implementation, admin UI, audit/rollback (#2053), safety CI (#2054), Task 007 slices (#2055), or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2052, #2051, #2050, #2049, #2053, #2039, #3157, #2273, #2286
Last Reviewed: 2026-08-14
---

# Program #2040 Task 004 — Scheduled publication and controlled rotation

## Purpose

Plan the schedule clock and controlled rotation behavior that sit on the Task 002 state model and the Task 003 admin review surfaces, so approved content can be queued for a future public transition without skipping human approval.

This is **design-time only**. It does not add a scheduler, write D1, or publish content.

## Scope

This report covers Task 004 (#2052) only:

- scheduling rules;
- rotation rules;
- preview-before-public behavior;
- operator override and pause conditions.

It does not implement Task 005 audit/rollback, Task 006 CI, or Task 007 runtime.

## Intended final state

After Task 004 is accepted:

- `scheduled` is a bounded, operator-visible queue, not a public state;
- rotation swaps are planned against published inventory plus approved incoming rows;
- operators can preview the set that would go live at `scheduled_at` without publishing it;
- pause and override stop or change the clock without granting software publication authority;
- Task 005 may design audit/rollback against these schedule and rotation events.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2052 (Task 004 of Program #2040) |
| Predecessor | #2050 merged PR #3470 (`950cc3c0`); #2051 merged PR #3472 (`a6ad0c2a`) |
| Implementation start | `a6ad0c2a` (`origin/main`); branch `cursor/2052-scheduled-publication-rotation-2e48`; allowlist is this report only |
| State model | `docs/ops/reports/program-2040-task-002-publication-state-and-authority.md` |
| Admin surfaces | `docs/ops/reports/program-2040-task-003-admin-review-rotation-surfaces.md` |
| Placement/rotation reference | `docs/reference/website/editorial-placement-and-rotation.md` |
| Human approval | Mandatory before public publication (`approved_by` / `approved_at`) |
| Real trial rows | Still absent; #3157 remains the gate before Task 007 |

## Scheduling rules

`scheduled` means **approved and queued**. It is not public. Public helpers must not read scheduled rows.

A schedule record is legal only when all of the following are true:

1. Operational state is `approved` before the schedule is set (Task 002: `approved` → `scheduled`).
2. `approved_by` and `approved_at` are present and name Product Authority / Bill (or a recorded delegate).
3. Publication target / `allowed_sections` on the schedule match the approval target.
4. Task 002 public-path metadata is complete.
5. `scheduled_at` is an explicit UTC instant. Display may convert to operator local time; storage is UTC.
6. The actor who sets the schedule is Product Authority / Bill. Automation must not create a schedule from `reviewed` or earlier.

Required schedule fields (design names; Task 007 binds storage):

| Field | Meaning |
| --- | --- |
| `schedule_id` | Durable identity for the queued transition |
| `candidate_id` | Row being queued |
| `scheduled_at` | UTC fire time |
| `schedule_kind` | `first_publish` or `slot_rotation` |
| `publication_target` | Named surfaces; must match approval |
| `incoming_set` | Ordered candidate ids that would occupy the target after fire |
| `outgoing_action` | `remain_published`, `unpublish`, or `archive` for displaced rows |
| `created_by` / `created_at` | Who queued it |
| `pause_reason` | Set only when paused |

Fire-time rule: a later authorized scheduler may move `scheduled` → `published` **only if** approval still exists, public-path metadata is still complete, the row is not paused/held, and `scheduled_at` has been reached. Missing any of those **fails closed** and leaves the row `scheduled` (or returns it to `approved` on explicit cancel). A missed window does **not** auto-publish late.

Illegal: `draft`/`staged`/`reviewed` → `scheduled`; scheduler-created `approved_by`; publishing when `scheduled_at` is in the future; publishing a paused schedule.

## Rotation rules

Task 003 owns the **set and order** while rows are still `staged` / `reviewed` / `approved`. This task owns the **clock** that changes what the public sees after approval.

Two schedule kinds:

| Kind | What changes at `scheduled_at` | Must already be true |
| --- | --- | --- |
| `first_publish` | Incoming row becomes `published` and enters eligible surfaces | Incoming is `scheduled` with public-path metadata |
| `slot_rotation` | Ordered published set for a named surface is replaced by the previewed incoming set | Incoming rows are `published` or `scheduled`; displaced rows follow `outgoing_action` |

Public rotation eligibility remains the editorial-placement contract: published, matching `allowed_sections`, not on hold, required source/credit present, media available or text-only allowed, canonical/alternate rules respected. Scoring inputs stay `event_date` / `event_year`, `feature_weight`, `priority`, `last_featured` penalty, `rotation_group` diversity, and canonical preference. Selection must be deterministic.

Rotation must not:

- publish a row that is not `approved` or `scheduled`;
- use Task 003 preview sets as live public inventory;
- silently replace a canonical row with an alternate;
- treat `priority` or `story_type` as a publish trigger;
- fire when any incoming member of `incoming_set` fails a Task 002 public-path gate.

After a successful public feature, `last_featured` is an implementation field for later Task 007; this plan requires it be updated only for rows that actually became public.

## Preview-before-public behavior

Operators must see the ordered set that **would** appear at `scheduled_at` before the clock fires. Attach this to the Task 003 admin path (`/admin/clubstaging` or adjacent `/admin/` workspace). It is not a public route.

Required preview capabilities:

1. Show `scheduled_at`, `schedule_kind`, `incoming_set`, `outgoing_action`, and remaining approval metadata.
2. Render the production-like clubstaging frame for that future set **without** writing `content_inventory.status = published`.
3. Fail closed (blocking banner, no fire enablement) if any incoming row lacks public-path metadata or approval.
4. Keep public/member helpers on published inventory only; preview must not query them with scheduled rows.

Fixture samples on `/admin/clubstaging` remain not live Gehrig content until Task 007 binds real rows after #3157.

## Operator override and pause

| Control | Effect | Authority | Must not |
| --- | --- | --- | --- |
| Pause | Stop the clock; row stays `scheduled` or returns to `approved`; `pause_reason` required | Product Authority / Bill | Publish, unpublish, or skip approval |
| Cancel schedule | `scheduled` → `approved`; schedule record retained as cancelled | Product Authority / Bill | Jump to `published` |
| Hold | Keep approved/scheduled but exclude from `incoming_set` / rotation eligibility | reviewing editor may request; Product Authority confirms for scheduled rows | Equal `unpublished` |
| Reschedule | Change `scheduled_at`; remaining gates unchanged | Product Authority / Bill | Create a schedule from `reviewed` |
| Immediate publish | `approved` → `published` (skip remaining wait) | Product Authority / Bill | Skip `approved_by` / `approved_at` or public-path metadata |
| Pause-at-deadline | If pause/hold is set at or before `scheduled_at`, the fire is skipped | scheduler (automatic) | Late-publish the paused row |

Software may execute a previously approved fire or a recorded pause. It must not invent approval, choose a new public target, or override a pause.

Self-approval of the live public result remains prohibited (Task 002). Emergency unpublish and rollback evidence are Task 005; pause here only stops the clock.

## Fail-closed stops for schedule and rotation

Stop the affected fire or schedule action when:

- `approved_by` / `approved_at` is missing;
- public-path metadata is incomplete;
- the row is paused, held, `rejected`, or `unpublished`;
- `scheduled_at` is in the future for a publish action;
- `incoming_set` includes a row whose approval target does not match the surface;
- preview would call public helpers with non-published rows;
- Task 007 runtime is attempted before #3157 records real trial rows.

## Explicit non-goals of this task

- No application, workflow, migration, scheduler, or route changes.
- No audit/rollback procedure (Task 005).
- No start of Task 005 in this PR (one issue, one PR; stage-before-merge).
- No public publication.

## Successor

#2053 — Audit trail, rollback, unpublish, and evidence retention design, after this Task 004 PR is independently reviewed and merged.
