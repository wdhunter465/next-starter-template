---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 007 (#2055) — all four merged implementation slices, the post-merge staging-surface disposition, and acceptance-criteria reconciliation, consolidated from five separate per-slice reports
Does Not Own: #2056 operator handoff, parent #2040 closeout, rollback restore writes, slot_rotation / incoming_set, Production D1 writes, public publication, or #3157 trial population
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2055, #2056, #2050, #2051, #2052, #2053, #2054, #3157
Last Reviewed: 2026-09-25
---

# Program #2040 Task 007 — Publication support slices

## Purpose

Consolidates the five separate per-slice reports Task 007 (#2055) originally produced
into one document, now that the task is complete and accepted. Each slice below was
independently reviewed and merged; nothing here changes their as-built content —
this is a documentation consolidation only (doc-reduction pass, 2026-09-25), not a
new decision. The five original files are now short pointer stubs to this document.

Human approval remained mandatory throughout Task 007. No slice auto-published, added
a cron fire, treated fixtures as real Gehrig content, or wrote Production D1.

## Slice 1 — Publication support (editorial write gate)

Fail-closed `content_inventory` publication writes on `POST /api/admin/editorial/publish`.
`evaluatePublicationTransition` (`functions/_lib/publication-transition-gate.ts`) is the
named check catalog for this write path.

| Field | Value |
| --- | --- |
| Implementation start | `a3d2178d` (`origin/main`); branch `cursor/2055-publication-support-slice-2e48` |
| Merge | PR #3488, SHA `8cfe5bf7` |
| Migration | `0046` (additive `content_inventory` approval columns) |

| ID | Runtime |
| --- | --- |
| A1 | Refuse publish unless operational state is `approved` or `scheduled` |
| A2 | Refuse approve/publish when `approved_by` / `approved_at` is missing |
| A3 | Refuse illegal jumps, including `draft` → `published` |
| A4 | Refuse `schedule` writes; refuse scheduled fire before `scheduled_at` or while paused |
| A5 | Refuse approver names `scheduler`, `automation`, `system`, `bot`, `ci`, `cursor`, `chatgpt` |
| A6 | Refuse republish while operational state is still `unpublished` or `archived`; a new `approve` (inventory status may remain `archived`) then `publish` is the legal path |
| A7 | Rollback writes stay unimplemented and fail closed; refuses rollback-to-publish without an approval snapshot |
| S4 | Refuse publish without `source_name` and `credit_line` |
| S9 | Refuse unpublish/archive without `reason` |

Legal path: `approve` (inventory status stays `draft` or `archived`) → `publish`
(inventory `status = published`). Unpublish sets inventory `archived` and operational
`unpublished`. Public helper `publishedInventoryWhere` unchanged.

Product predecessor note (#3157): Product Authority adopted PMO option 2 on
2026-08-14. #3157 remained OPEN and deferred for this slice only — S10 live-trial
runtime was Product-authorized to stand down for starting this slice, not skipped as
if trials ran. This slice still refused fabricated trial rows and Production D1 writes.

## Slice 2 — Scheduler (`first_publish`)

Operator-visible `first_publish` scheduling on the same publish endpoint.

| Field | Value |
| --- | --- |
| Implementation start | `8cfe5bf7`; branch `cursor/2055-scheduler-publication-slice-2e48` |
| Merge | PR #3492, SHA `0b9f79a6` |
| Migration | `0047` (additive `scheduled_at` / `schedule_paused` / `pause_reason`) |

| Action | Runtime |
| --- | --- |
| `schedule` | Sets `operational_state = scheduled`, stores request-body UTC `scheduled_at` (`Z` or `+00:00` only, no stored-row fallback); refused unless state is `approved` or already `scheduled` (reschedule); clears pause |
| `pause_schedule` | Sets `schedule_paused = 1` and `pause_reason` (S9); leaves the row `scheduled` |
| `cancel_schedule` | Returns `operational_state` to `approved`; keeps `scheduled_at` as history |
| `publish` while `scheduled` | Same A1–A7/S4 gate, now wired with `scheduled_at` and pause from D1; refused before `scheduled_at` or while paused (A4) |

Illegal: `draft` → `scheduled` directly; schedule without request-body UTC
`scheduled_at`; fire before `scheduled_at`; fire while paused; scheduler-named
approvers. No cron/auto-fire — schedule fire is always operator-triggered `publish`.

## Slice 3 — Audit storage

Append-only audit rows for successful publish-path transitions.

| Field | Value |
| --- | --- |
| Implementation start | `0b9f79a6`; branch `cursor/2055-audit-storage-slice-2e48` |
| Merge | PR #3493, SHA `63970939` |
| Migration | `0048` (`content_inventory_events`, append-only, Task 005 field design) |

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

A successful editorial write batches the inventory UPDATE with one
`content_inventory_events` INSERT; refused gates and rollback do not insert; prior
events are never updated in place. Pipeline `moderation_events` (`content_items`-scoped)
is a separate, unchanged table.

## Slice 4 — Staging surface

`/admin/clubstaging` as an admin-only staged-content review workspace over
`content_inventory` and the existing production-like preview frame (#2043).

| Field | Value |
| --- | --- |
| Implementation start | `63970939`; branch `cursor/2055-staging-surface-slice-2e48` |
| Merge | PR #3495, SHA `7bf6a008` |
| Migration | `0049` (additive staging-review metadata columns) |

| Action | From | Gate | Result |
| --- | --- | --- | --- |
| `stage` | `draft` or `reviewed` | A3 | `operational_state=staged`; inventory status unchanged |
| `review` | `staged` | S4 source/credit/rights/privacy; A5 forbidden reviewer names | `operational_state=reviewed`; `reviewer` / `reviewed_at` |
| `reject` | `draft`, `staged`, or `reviewed` | S9 reason | `operational_state=rejected`; `rejection_reason` |
| Preview bind | selected row | none | existing rotation frame; no public helper call |
| Publish on this page | n/a | not offered | editorial archive remains the publish surface |

Fixture banner remains when no real row is selected; selected real rows are still not
public. `review` refuses when source, credit, rights, or privacy data is missing, or
`rights_status` is `unknown`.

**Post-merge disposition (not a fifth PMO-ordered slice):** PR #3497, merge SHA
`29db091b` — added incomplete-metadata review-refusal UI and a `waitFor` on the
refusal test.

## Acceptance-criteria reconciliation (#2055)

Reconciled Issue #2055 acceptance criteria against the four merged slices above and
recorded post-merge verification on `origin/main` @ `29db091b6ed0e3affae574b96d231d63f6dc1404`
(branch `cursor/2055-task-007-ac-reconciliation-2e48`). #3157 stayed CLOSED
`not_planned` for these slices — Product waived live-trial rows for starting them;
not reopened, no fabricated evidence.

| Criterion | Disposition | Evidence |
| --- | --- | --- |
| Implementation matches approved design slices | **Met for the PMO-ordered slices** | Slice tables above vs. Tasks 002–006 design reports; deferred items listed below |
| Tests cover approval-state behavior and public exposure boundaries | **Met** | Gate tests A1–A7 / S4 / S9; clubstaging preview does not write `published`; public helpers still require `status = published` |
| Documentation reflects as-built behavior | **Met** | This consolidated report |
| No unrelated content workflow changes | **Met** | Each slice PR stayed inside its allowlist; pipeline `moderation_events` unchanged |

Design items implemented across the four slices:

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

Post-merge verification command (on `29db091b`):

```text
npx vitest run tests/publication-transition-gate.test.ts tests/club-staging.test.tsx tests/admin-editorial-archive.test.tsx tests/content-inventory-search.test.ts tests/content-inventory-club-home.test.ts
```

Result: PASS — 5 files / 103 tests. Not verified: browser/visual walkthrough,
Production D1, live publication, or scheduler cron (none exists).

This report did not itself record WORK `ACCEPT` — see #2055/#2056 for the acceptance
and operator-handoff record.

## Explicit non-goals across all four slices

None of the merged slices implemented: `slot_rotation` / `incoming_set` / rotation-clock
fire; rollback restore writes (A7 stays fail-closed); Task 003 rotation-order controls
(priority / story_type / canonical vs alternate) on clubstaging; approve/schedule/publish
buttons on `/admin/clubstaging`; pipeline `moderation_events` reuse; cron or other
auto-fire; Production D1 apply of migrations `0046`–`0049`; or live trial rows (#3157).

## Successor

#2056 (operator handoff) started only after Task 007 acceptance. Parent #2040 stayed
open until #2056 plus Product acceptance — see `docs/ops/reports/program-2040-program-closeout.md`
and `docs/ops/reports/program-2040-task-008-operator-handoff.md`.
