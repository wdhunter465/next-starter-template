---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 007 (#2055) acceptance-criteria reconciliation against merged publication-support slices and post-merge verification of those slices
Does Not Own: #2056 operator handoff, parent #2040 closeout, rollback restore writes, slot_rotation / incoming_set, Production D1 writes, public publication, or #3157 trial population
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2055, #2056, #2050, #2051, #2052, #2053, #2054, #3157
Last Reviewed: 2026-08-15
---

# Program #2040 Task 007 — Acceptance-criteria reconciliation

## Purpose

Reconcile Issue #2055 acceptance criteria against the merged Task 007 implementation slices and record post-merge verification on current `main`.

This report does not add runtime behavior. It does not start #2056, close #2040, write Production D1, or treat fixtures as real Gehrig content.

## Scope

This report covers Task 007 acceptance reconciliation only:

- mapping of the four PMO-ordered implementation slices to Tasks 001–006 design;
- Issue #2055 acceptance-criteria disposition;
- targeted test re-run on `origin/main` @ `29db091b`;
- remaining program items that stay out of #2055.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2055 (Task 007 of Program #2040) |
| Starting SHA | `origin/main` @ `29db091b6ed0e3affae574b96d231d63f6dc1404` |
| Branch | `cursor/2055-task-007-ac-reconciliation-2e48` |
| Public helper | `functions/_lib/content-inventory-public.ts` — `publishedInventoryWhere` unchanged |
| Production D1 writes | None in this PR or in the merged slices |
| Public publication | None |
| Cron / auto-fire | None |
| #3157 | CLOSED `not_planned`; Product waived live-trial rows for starting these slices; do not reopen or fabricate evidence |

## Merged implementation slices

| Slice | PR | Merge SHA | As-built |
| --- | --- | --- | --- |
| Publication-support write gate | #3488 | `8cfe5bf7` | A1–A7 / S4 / S9 on `POST /api/admin/editorial/publish`; named human approval before `published` |
| Scheduler `first_publish` | #3492 | `0b9f79a6` | Explicit UTC `scheduled_at`; pause/cancel; operator fire; no cron |
| Audit storage | #3493 | `63970939` | Append-only `content_inventory_events` batched with inventory UPDATE |
| Staging-surface workspace | #3495 | `7bf6a008` | `/admin/clubstaging` list/preview/`stage`/`review`/`reject`; no `published` from that page |
| Staging Copilot disposition | #3497 | `29db091b` | Incomplete-metadata review refusal UI; waitFor on the refusal test |

Migrations `0046`–`0049` are in-repo additive schema only. They were not applied to Production D1.

## Issue #2055 acceptance criteria

| Criterion | Disposition | Evidence |
| --- | --- | --- |
| Implementation matches approved design slices | **Met for the PMO-ordered slices** | Slice table above vs Tasks 002–006 reports; deferred design items listed below |
| Tests cover approval-state behavior and public exposure boundaries | **Met** | Gate tests A1–A7 / S4 / S9; clubstaging preview does not write `published`; public helpers still require `status = published` |
| Documentation reflects as-built behavior | **Met** | Four slice reports plus this reconciliation |
| No unrelated content workflow changes | **Met** | Each slice PR stayed inside its allowlist; pipeline `moderation_events` unchanged |

This report does not record WORK `ACCEPT`. Merge of this PR is not task acceptance. #2055 stays open until WORK records acceptance. #2056 is not released.

## Design items implemented in Task 007

| Design source | Runtime on `main` |
| --- | --- |
| Task 002 nine operational states | `operational_state` on `content_inventory`; public still uses `status = published` |
| Task 002 / Task 006 A1–A7, S4, S9 | `evaluatePublicationTransition` on the editorial publish path |
| Task 003 staged review workspace | `/admin/clubstaging` list/filter, preview bind, `stage` / `review` / `reject` |
| Task 003 public exposure | Selected preview rows are not public; fixture banner remains when no real row is selected |
| Task 004 `first_publish` schedule | `schedule` / `pause_schedule` / `cancel_schedule`; fire only through `publish` after `scheduled_at` and while unpaused |
| Task 005 append-only audit | `content_inventory_events`; refused gates and rollback do not insert |
| Task 005 unpublish | Editorial `unpublish` sets operational `unpublished` and inventory `archived`; reason required |
| Task 006 S6 / S7 | Public helpers unchanged; clubstaging preview does not call them with non-published rows |

## Explicit remaining program items (not this Issue’s leftover code slice)

These were named non-goals of the merged slices. They are follow-up for #2056 or a later authorized child, not additional #2055 implementation in this PR:

- `slot_rotation`, `incoming_set`, rotation-clock fire, and preview of a future rotation set;
- rollback restore writes (A7 stays fail-closed);
- Task 003 rotation-order controls (priority / story_type / canonical vs alternate) on clubstaging;
- approve / schedule / publish buttons on `/admin/clubstaging` (editorial archive remains the publish surface);
- pipeline `moderation_events` reuse;
- cron or other auto-fire;
- Production D1 apply of migrations `0046`–`0049`;
- live trial rows (#3157 remains closed `not_planned`).

## Post-merge verification (this SHA)

Commands run on `29db091b`:

```text
npx vitest run tests/publication-transition-gate.test.ts tests/club-staging.test.tsx tests/admin-editorial-archive.test.tsx tests/content-inventory-search.test.ts tests/content-inventory-club-home.test.ts
```

Result: PASS — 5 files / 103 tests.

Not verified here: browser/visual walkthrough, Production D1, live publication, or scheduler cron (none exists).

## Successor

After independent review and merge of this reconciliation, WORK owns Task 007 acceptance. #2056 starts only after that acceptance. Parent #2040 stays open until #2056 plus Product acceptance.
