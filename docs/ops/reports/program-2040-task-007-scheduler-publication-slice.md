---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 007 (#2055) scheduler publication-support slice — first_publish schedule writes, pause/cancel, and operator fire on the editorial publish path
Does Not Own: slot_rotation / incoming_set, /admin/clubstaging preview, moderation_events storage, rollback writes, #3157 trial population, #2056 operator handoff, Production D1 writes, or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2055, #2052, #2054, #3157
Last Reviewed: 2026-08-15
---

# Program #2040 Task 007 — Scheduler publication slice

## Purpose

Record the second implemented Task 007 slice: operator-visible `first_publish` scheduling on `POST /api/admin/editorial/publish`.

Human approval remains mandatory. This slice does not auto-publish, does not add a cron fire, does not treat fixtures as real Gehrig content, and does not write Production D1.

## Scope

This report covers the #2055 scheduler slice only:

- legal `approved` → `scheduled` writes with an explicit UTC `scheduled_at`;
- pause (reason required) and cancel (`scheduled` → `approved`);
- operator fire of a due, unpaused schedule through the existing `publish` action;
- additive `scheduled_at` / `schedule_paused` / `pause_reason` columns;
- targeted tests and this as-built note.

It does not implement `slot_rotation`, `/admin/clubstaging` preview rebuild, `moderation_events`, rollback writes, or #2056.

## Intended final state of this slice

After merge and Dev application of migration `0047`:

- `schedule` is refused unless operational state is `approved` or already `scheduled` (reschedule);
- named human `approved_by` / `approved_at` and source/credit remain required (A2/S4);
- publish of a `scheduled` row is refused before `scheduled_at` or while paused (A4);
- pause requires `reason` (S9) and leaves the row `scheduled`;
- cancel returns the row to `approved` and retains `scheduled_at` as history;
- public helpers remain `publishedInventoryWhere`;
- inventory `status` stays `draft` or `archived` until a legal `publish` write.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2055 (Task 007 of Program #2040) |
| Implementation start | `8cfe5bf7` (`origin/main`); branch `cursor/2055-scheduler-publication-slice-2e48` |
| Design predecessors | Task 004 `docs/ops/reports/program-2040-task-004-scheduled-publication-and-rotation.md`; Task 006 A4 |
| Public helper | `functions/_lib/content-inventory-public.ts` — `publishedInventoryWhere` unchanged |
| Production D1 writes | None in this PR |
| Public publication | None in this PR |
| Cron / auto-fire | None in this PR |

## As-built behavior

| Action | Runtime |
| --- | --- |
| `schedule` | Sets `operational_state = scheduled`, stores UTC `scheduled_at`, clears pause |
| `pause_schedule` | Sets `schedule_paused = 1` and `pause_reason`; does not publish |
| `cancel_schedule` | Returns `operational_state` to `approved`; keeps `scheduled_at` |
| `publish` while `scheduled` | Same A1–A7/S4 gate as the first slice, now with `scheduled_at` and pause wired from D1 |

Illegal: `draft` → `scheduled`; schedule without UTC `scheduled_at`; fire before `scheduled_at`; fire while paused; scheduler-named approvers.

## Explicit non-goals of this slice

- No Production D1 migration apply or inventory rewrite.
- No content-pipeline candidate rows and no #3157 evidence fabrication.
- No start of #2056.
- No parent #2040 closeout.
- No `slot_rotation`, `incoming_set`, or clubstaging preview.
- No `moderation_events` table.
- No change to public/member read helpers beyond keeping `publishedInventoryWhere`.

## Successor

Remaining #2055 slices: audit-storage / moderation-event, then staging-surface wiring. #2056 starts only after Task 007 is accepted.
