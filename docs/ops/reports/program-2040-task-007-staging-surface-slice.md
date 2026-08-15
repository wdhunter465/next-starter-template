---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 007 (#2055) staging-surface slice — admin staged-content review workspace on /admin/clubstaging
Does Not Own: slot_rotation / incoming_set, rollback writes, approve/publish/schedule controls on clubstaging, #3157 trial population, #2056 operator handoff, Production D1 writes, or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2055, #2051, #2050, #2043
Last Reviewed: 2026-08-15
---

# Program #2040 Task 007 — Staging-surface slice

## Purpose

Record the remaining Task 007 implementation slice: wire `/admin/clubstaging` as an admin-only staged-content review workspace on top of `content_inventory` and the existing production-like preview frame.

Human approval remains mandatory. This slice does not auto-publish, does not add a cron fire, does not treat fixtures as real Gehrig content, and does not write Production D1.

## Scope

This report covers the #2055 staging-surface slice only:

- list/filter inventory by operational state (`preview` = staged+reviewed, plus draft enqueue and reject-queue);
- preview a selected row in the existing clubstaging frame without writing `content_inventory.status = published`;
- record `stage`, `review`, and `reject` on `POST /api/admin/editorial/publish`;
- fail-closed `review` when source, credit, rights, or privacy data is missing;
- additive inventory columns for staging-review metadata (migration `0049`).

It does not implement rotation-clock writes, rollback restore, or editor `published` controls on this page.

## Intended final state of this slice

After merge and Dev application of migration `0049`:

- `/admin/clubstaging` lists staged candidates and can bind one row into the existing preview frame;
- fixture banner copy remains when no real row is selected;
- selected real rows still are not public;
- editors can move `draft`/`reviewed` → `staged`, `staged` → `reviewed`, or `draft`/`staged`/`reviewed` → `rejected`;
- `reviewed` refuses when source, credit, rights, or privacy is missing or `rights_status` is `unknown`;
- public helpers remain `publishedInventoryWhere`.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2055 (Task 007 of Program #2040) |
| Implementation start | `63970939` (`origin/main`); branch `cursor/2055-staging-surface-slice-2e48` |
| Design predecessor | Task 003 `docs/ops/reports/program-2040-task-003-admin-review-rotation-surfaces.md` |
| Existing preview | `/admin/clubstaging` production-like frame from #2043 |
| Production D1 writes | None in this PR |
| Public publication | None in this PR |

## As-built behavior

| Action | From | Gate | Result |
| --- | --- | --- | --- |
| `stage` | `draft` or `reviewed` | A3 | `operational_state=staged`; inventory status unchanged |
| `review` | `staged` | S4 source/credit/rights/privacy; A5 forbidden reviewer names | `operational_state=reviewed`; `reviewer` / `reviewed_at` |
| `reject` | `draft`, `staged`, or `reviewed` | S9 reason | `operational_state=rejected`; `rejection_reason` |
| Preview bind | selected row | none | existing rotation frame; no public helper call |
| Publish on this page | n/a | not offered | editorial archive remains the publish surface |

## Explicit non-goals of this slice

- No Production D1 migration apply.
- No content-pipeline candidate rows and no #3157 evidence fabrication.
- No start of #2056.
- No parent #2040 closeout.
- No rollback restore writes.
- No `slot_rotation` or `incoming_set`.
- No approve / schedule / publish buttons on `/admin/clubstaging`.
- No change to public/member read helpers beyond keeping `publishedInventoryWhere`.

## Successor

After this slice is independently reviewed and merged, remaining #2055 work is Task 007 acceptance-criteria reconciliation and post-merge verification. #2056 starts only after Task 007 is accepted.
