---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 006 (#2054) publication-safety CI/ops checks, fail-closed failure behavior, operator-alert/follow-up rules, and implementation-PR validation expectations
Does Not Own: Runtime check implementation, Task 007 slices (#2055), Production D1 writes, or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2054, #2050, #2051, #2052, #2053, #2055, #3157, #2273, #2286
Last Reviewed: 2026-08-14
---

# Program #2040 Task 006 — Publication safety CI/ops checks and fail-closed rules

## Purpose

Define deterministic checks that prevent incomplete or unapproved content from becoming public, and the failure, alert, and implementation-PR validation behavior those checks must use.

This is **design-time only**. It does not add workflows, tests, or publish content.

## Scope

This report covers Task 006 (#2054) only:

- approval-state checks;
- source, credit, rights, and route-exposure checks;
- failure behavior for incomplete metadata;
- operator alerts and follow-up issue behavior;
- validation expectations for later implementation PRs.

It does not implement Task 007 slices. Runtime remains gated on #3157.

## Intended final state

After Task 006 is accepted:

- every public-path write and public-helper read has a named fail-closed check;
- missing approval, source, credit, rights, or route metadata fails the affected action, not the whole program;
- operators get an explicit alert/follow-up rule when a check fails;
- Task 007 may implement only slices that satisfy these checks.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2054 (Task 006 of Program #2040) |
| Predecessor | #2050–#2052 on `main` (PRs #3470, #3472, #3473); #2053 Task 005 in review as PR #3474 |
| Implementation start | `c928ef5f` (`origin/main`); branch `cursor/2054-publication-safety-ci-2e48`; allowlist is this report only |
| State/authority | `docs/ops/reports/program-2040-task-002-publication-state-and-authority.md` |
| Surfaces | `docs/ops/reports/program-2040-task-003-admin-review-rotation-surfaces.md` |
| Schedule/pause | `docs/ops/reports/program-2040-task-004-scheduled-publication-and-rotation.md` |
| Audit/unpublish | `docs/ops/reports/program-2040-task-005-audit-rollback-unpublish-retention.md` (PR #3474) |
| Public helper | `functions/_lib/content-inventory-public.ts` — `publishedInventoryWhere` requires `status = 'published'`, matching `allowed_sections`, non-empty `source_name` and `credit_line` |
| Human approval | Mandatory before public publication |

If PR #3474 changes audit field names before merge, Task 007 must follow the merged Task 005 report; this check catalog stays aligned to those contracts.

## Approval-state checks

Fail closed (block the write / refuse the fire) when any of the following is true:

| ID | Check |
| --- | --- |
| A1 | Inventory `status` would become `published` while operational state is not `approved` or `scheduled` |
| A2 | `approved_by` or `approved_at` is missing on `approved` → `scheduled`, `approved` → `published`, or `scheduled` → `published` |
| A3 | Transition is an illegal jump (`draft`/`staged`/`reviewed`/`rejected`/`unpublished` → `published`) |
| A4 | Scheduler fire runs before `scheduled_at`, or while paused/held |
| A5 | Automation writes `approve` or invents `approved_by` |
| A6 | Republish from `unpublished` skips a new `approved` step |
| A7 | Rollback would publish without an approval snapshot or a new `approved_by` / `approved_at` |

Unit tests for Task 007 must cover A1–A7 with fixtures; CI must fail the PR if a public-path helper can return a row that fails A1 or A2.

## Source, credit, rights, and route-exposure checks

| ID | Check |
| --- | --- |
| S1 | Public-path metadata from Task 002 is complete (source title/owner/citation, acquisition, rights, credit, provenance/factual confidence, privacy review when flagged) |
| S2 | `rights_status` is not `permission-needed`, `rejected`, or `link-only` for a public-copy target |
| S3 | `privacy_flag` is not unresolved `minors` / living-person/donor risk |
| S4 | `source_name` and `credit_line` are non-empty on any row public helpers would return (matches `publishedInventoryWhere`) |
| S5 | `allowed_sections` contains only registry keys and matches the recorded approval target |
| S6 | Public/member routes and `publishedInventoryWhere` require `status = 'published'` and never select `staged`, `reviewed`, `approved` (not published), `scheduled`, `rejected`, or `unpublished` |
| S7 | Admin preview (`/admin/clubstaging` or adjacent) does not call public helpers with non-published rows |
| S8 | `search` or `library` in `allowed_sections` does not create public hits before `published` |
| S9 | Unpublish/suppress: public helpers must stop returning the row; audit `reason` present (Task 005) |
| S10 | Task 007 runtime is refused until #3157 records real trial rows |

Existing tests in `tests/content-inventory-search.test.ts` and `tests/content-inventory-club-home.test.ts` already encode S4/S6 for current helpers. Task 007 must keep those assertions and add A* / S7–S10 for new write paths.

## Failure behavior

| Condition | Behavior |
| --- | --- |
| Any A* or S* fail on a **write/fire** | Refuse that action. Do not write `published`. Do not throw away the row. Record an audit event when Task 005 storage exists. |
| Any S4/S6 fail on a **read helper** | Exclude the row. Do not fail the whole page empty unless the surface has no published fallback. |
| Incomplete metadata on `reviewed` or later | Editor preview may render with a blocking banner; the state transition still fails. |
| Missing `reason` on unpublish/rollback/reject/pause/suppress | Refuse the recovery action. |
| CI assertion fail on an implementation PR | Required check fails; PR is not merge-ready. Do not warn-and-merge. |
| #3157 still open | Task 007 public-path writes stay blocked even if unit fixtures pass. |

Fail the **affected transition or PR**, not Program #2040.

## Operator alerts and follow-up issues

| Event | Operator signal | Follow-up |
| --- | --- | --- |
| CI safety check fails on a Task 007 PR | Required GitHub check + PR comment naming the check ID (A1–S10) | Fix in the same PR; do not open a new program child for a test fail |
| Live fire/unpublish refused at runtime | Admin-visible error with check ID and missing fields | Comment on the governing Task 007 slice Issue; do not page Production deploy |
| Public helper would have returned a non-published row | Treat as incident evidence on the slice Issue | Open a follow-up Issue only if the defect is outside the open slice allowlist |
| #3157 missing when a slice tries a real-row write | Fail closed with pointer to #3157 | Do not create a bypass Issue |

Do not use GitHub comments as the operational audit store (Task 005). Alerts here are operator visibility only.

## Validation expectations for implementation PRs

Every Task 007 implementation PR must record:

1. documentation header checks for docs changes;
2. targeted tests for changed route/component/API behavior;
3. route/auth/navigation tests for admin or public route changes;
4. publication-state and public-exposure tests mapped to A1–A7 and S1–S10 that the slice touches;
5. rollback/unpublish validation when the slice changes recovery paths;
6. one source-issue line and an exact file-touch allowlist;
7. proof that public helpers still use `publishedInventoryWhere` (or a stricter successor);
8. explicit non-run of Production D1 writes and of Task 007 before #3157.

A slice is **approved for implementation** only when Tasks 001–006 reports are on `main` (or the slice Issue names the merged SHAs) and the slice allowlist is bounded. This Task 006 PR does not authorize those slices.

## Fail-closed stops for this task's later CI

When implemented, stop the affected job when:

- a fixture published row lacks `approved_by` / `approved_at` in the operational model;
- a helper query omits `status = 'published'` or source/credit predicates;
- a test suite for a publication write path has no A* coverage;
- a workflow would write Production D1;
- Task 007 is attempted before #3157.

## Explicit non-goals of this task

- No application, workflow, migration, or new CI workflow files in this PR.
- No start of Task 007 in this PR (one issue, one PR; #3157 still gates runtime).
- No public publication.

## Successor

#2055 — Implementation of approved publication support slices, after this Task 006 PR is independently reviewed and merged **and** #3157 records real trial rows.
