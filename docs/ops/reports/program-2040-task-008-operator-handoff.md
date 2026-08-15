---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, operators, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 008 (#2056) validation, operator handoff, exception follow-up, and Product acceptance packet
Does Not Own: Parent #2040 Product acceptance, Chatterbox / #3415, Production D1 writes, public publication, rollback restore writes, slot_rotation / incoming_set, or live trial population
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2056, #2055, #2049, #2050, #2051, #2052, #2053, #2054, #3157, #3508
Last Reviewed: 2026-08-15
---

# Program #2040 Task 008 — Operator handoff

## Purpose

Validate Program #2040 completion for the implemented publication-support slices and hand the operator packet to Product Authority.

This report does not add runtime behavior. It does not write Production D1, publish public content, start Chatterbox work, or record Product acceptance of parent #2040.

## Scope

This report covers Task 008 (#2056) only:

- consolidated evidence for Tasks 001–007;
- verification of publication states, approval gates, public-route exposure, and unpublish behavior on current `main`;
- remaining exceptions converted to follow-up Issue #3508;
- operator runbook for the as-built surfaces.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2056 (Task 008 of Program #2040) |
| Parent | #2040 remains open until independent acceptance, then Product Authority acceptance |
| Starting SHA | `origin/main` @ `fcba92e6bef6b75f48f9c37f5f049ace359aa707` |
| Branch | `cursor/2056-task-008-operator-handoff-2e48` |
| Predecessor | #2055 closed complete; originating exception #3502 closed complete |
| Public helper | `functions/_lib/content-inventory-public.ts` — `publishedInventoryWhere()` |
| Production D1 writes | None in this PR; migrations `0046`–`0049` were not applied to Production D1 |
| Public publication | None in this PR |
| Cron / auto-fire | None |
| #3157 | CLOSED `not_planned`; non-blocking; do not reopen or fabricate trial evidence |
| Day-2 remainder | #3508 |

## Program evidence (Tasks 001–007)

| Task | Issue | Evidence | Status |
| ---: | ---: | --- | --- |
| 001 | #2049 | `docs/ops/reports/program-2040-task-001-publication-candidate-inventory.md` | Merged (PRs #3466 / #3469) |
| 002 | #2050 | `docs/ops/reports/program-2040-task-002-publication-state-and-authority.md` | Merged (PR #3470, `950cc3c0`) |
| 003 | #2051 | `docs/ops/reports/program-2040-task-003-admin-review-rotation-surfaces.md` | Merged (PR #3472, `a6ad0c2a`) |
| 004 | #2052 | `docs/ops/reports/program-2040-task-004-scheduled-publication-and-rotation.md` | Merged (PR #3473, `c928ef5f`) |
| 005 | #2053 | `docs/ops/reports/program-2040-task-005-audit-rollback-unpublish-retention.md` | Merged (PR #3474) |
| 006 | #2054 | `docs/ops/reports/program-2040-task-006-publication-safety-ci-fail-closed.md` | Merged (PR #3475) |
| 007 | #2055 | Four implementation slices plus `docs/ops/reports/program-2040-task-007-acceptance-reconciliation.md` | Closed complete |

### Task 007 runtime slices on `main`

| Slice | PR | Merge SHA | Operator surface |
| --- | --- | --- | --- |
| Publication-support write gate | #3488 | `8cfe5bf7` | `POST /api/admin/editorial/publish`; named human approval before `published` |
| Scheduler `first_publish` | #3492 | `0b9f79a6` | Explicit UTC `scheduled_at`; pause/cancel; operator fire; no cron |
| Audit storage | #3493 | `63970939` | Append-only `content_inventory_events` batched with inventory UPDATE |
| Staging-surface workspace | #3495 | `7bf6a008` | `/admin/clubstaging` list/preview/`stage`/`review`/`reject`; no `published` from that page |
| Staging-surface Copilot disposition | #3497 | `29db091b` | Incomplete-metadata review refusal UI |
| Acceptance-criteria reconciliation | #3500 | `42a536c8` | Docs-only AC map |
| Reviewer-disposition follow-up | #3503 | `31087f40` | Docs-only Copilot wording that missed #3500 |

## Publication-control verification

Commands run on `fcba92e6`:

```text
npx vitest run tests/publication-transition-gate.test.ts tests/club-staging.test.tsx tests/admin-editorial-archive.test.tsx tests/content-inventory-search.test.ts tests/content-inventory-club-home.test.ts
```

Result: PASS — 5 files / 103 tests.

| Control | As-built | Verified by |
| --- | --- | --- |
| Nine operational states | `operational_state` on `content_inventory` | Gate tests + Task 002 report |
| Named human approval before public `published` | A1–A7 / S4 / S9 on editorial `publish` | `tests/publication-transition-gate.test.ts`, `tests/admin-editorial-archive.test.tsx` |
| Public route exposure | `publishedInventoryWhere()` requires `status = 'published'`, section allowlist, non-empty `source_name` and `credit_line` | `tests/content-inventory-search.test.ts`, `tests/content-inventory-club-home.test.ts` |
| Clubstaging preview is not public | Preview bind does not write `published` | `tests/club-staging.test.tsx` |
| Unpublish | Editorial `unpublish` sets operational `unpublished` and inventory `archived`; reason required | Gate + archive tests |
| Rollback restore | Unimplemented; A7 fail-closed | Gate tests |
| Scheduler fire | Operator `publish` after `scheduled_at` while unpaused; no cron | Gate + archive tests |

Not verified here: browser/visual walkthrough, Production D1, live publication of real Gehrig rows, or scheduler cron (none exists).

## Operator runbook

Human approval remains mandatory. Fixture JSON is not trial evidence.

### Surfaces

1. **Editorial archive** (`/admin` editorial inventory) — approve, schedule, pause, cancel, publish, unpublish, archive, return-to-draft.
2. **Club staging** (`/admin/clubstaging`) — list/filter, preview a selected row, `stage`, `review`, `reject`. Do not publish from this page.
3. **Public site** — reads only rows matching `publishedInventoryWhere()`.

### Legal publish path

`approve` (named human `approved_by` / `approved_at`; inventory status may stay `draft` or `archived`) → optional `schedule` with explicit UTC `scheduled_at` → `publish` (inventory `status = published`).

Refused examples: `draft` → `published`; missing source/credit; approver names `scheduler`, `automation`, `system`, `bot`, `ci`, `cursor`, `chatgpt`; publish of a paused or not-yet-due schedule.

### Unpublish / archive

Unpublish requires `reason`, sets operational `unpublished` and inventory `archived`. Republish requires a new `approve` then `publish`.

### Fail-closed reminders

- Missing source, credit, rights, or privacy data refuses `review` on clubstaging.
- Rollback restore is not implemented; do not expect a restore write.
- Do not apply migrations `0046`–`0049` to Production D1 from this program packet.

## Exceptions converted to follow-up

Remaining Task 007 non-goals are recorded on **#3508** (Day-2 remainder). They are not blockers to this Task 008 READY FOR REVIEW packet.

#3157 stays closed `not_planned` and is not a follow-up to reopen.

## Product acceptance packet

Independent review of this PR, then Product Authority acceptance of parent #2040, should treat the program as:

**Ready with exceptions** — implemented slices match Tasks 002–006 design for write-gate, scheduler `first_publish`, audit events, and clubstaging review; public helpers still require `published` plus source/credit; remaining rotation-clock, rollback restore, clubstaging publish buttons, cron, and Dev/Production D1 apply of `0046`–`0049` live on #3508.

This PR is not Product acceptance. Merge of this PR is not parent closeout.

## Successor

After independent review and merge of this handoff, WORK records Task 008 acceptance. Product Authority then accepts or holds parent #2040. This Issue remains open until that independent acceptance is recorded. The parent program Issue remains open until Product Authority acceptance.
