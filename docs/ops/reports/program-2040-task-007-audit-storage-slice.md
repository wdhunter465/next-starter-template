---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 007 (#2055) audit-storage slice — append-only content_inventory publication events on the editorial write path
Does Not Own: pipeline moderation_events schema, rollback writes, /admin/clubstaging preview, slot_rotation / incoming_set, #3157 trial population, #2056 operator handoff, Production D1 writes, or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2055, #2053, #2054
Last Reviewed: 2026-08-15
---

# Program #2040 Task 007 — Audit-storage slice

## Purpose

Record the third implemented Task 007 slice: append-only audit rows for successful `POST /api/admin/editorial/publish` transitions.

Human approval remains mandatory. This slice does not auto-publish, does not add a cron fire, does not treat fixtures as real Gehrig content, and does not write Production D1.

## Scope

This report covers the #2055 audit-storage slice only:

- new `content_inventory_events` table following Task 005 append-only field design;
- event writes after legal approve / schedule / pause / cancel / publish / unpublish / archive / return_to_draft;
- `pause_schedule` stored as catalog action `pause`;
- snapshots of approval and source/credit copied at event time;
- `public_check = 1` only when `to_state` is `published`.

It does not implement rollback writes, `/admin/clubstaging` preview, or pipeline `moderation_events` changes.

## Intended final state of this slice

After merge and Dev application of migration `0048`:

- a successful editorial write also inserts one `content_inventory_events` row;
- refused gates and rollback do not insert;
- prior events are not updated in place;
- public helpers remain `publishedInventoryWhere`.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2055 (Task 007 of Program #2040) |
| Implementation start | `0b9f79a6` (`origin/main`); branch `cursor/2055-audit-storage-slice-2e48` |
| Design predecessor | Task 005 `docs/ops/reports/program-2040-task-005-audit-rollback-unpublish-retention.md` |
| Pipeline audit table | `moderation_events` remains `content_items`-scoped and is unchanged |
| Production D1 writes | None in this PR |
| Public publication | None in this PR |

## As-built behavior

| Action | Audit |
| --- | --- |
| `approve` | `action=approve`, `to_state=approved` |
| `schedule` | `action=schedule`, `to_state=scheduled` |
| `pause_schedule` | `action=pause`, `to_state=scheduled` |
| `cancel_schedule` | `action=cancel_schedule`, `to_state=approved` |
| `publish` | `action=publish`, `to_state=published`, `public_check=1` |
| `unpublish` | `action=unpublish`, `to_state=unpublished` |
| `archive` | `action=archive`, `to_state=archived` |
| `return_to_draft` | `action=return_to_draft`, `to_state=draft` |
| `rollback` | still fail-closed; no event row |

## Explicit non-goals of this slice

- No Production D1 migration apply.
- No content-pipeline candidate rows and no #3157 evidence fabrication.
- No start of #2056.
- No parent #2040 closeout.
- No rollback restore writes.
- No `slot_rotation`, `incoming_set`, or clubstaging preview.
- No change to public/member read helpers beyond keeping `publishedInventoryWhere`.

## Successor

Remaining #2055 slice: staging-surface wiring. #2056 starts only after Task 007 is accepted.
