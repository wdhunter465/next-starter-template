---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #4089 CI design inventory (#4201) and ranked keep/consolidate/retire recommendations (#4202)
Does Not Own: Workflow YAML; GitHub ruleset mutation; test-catalog rebuild; Production admission; implementing the recommendations
Canonical Reference: docs/governance/CI-AND-VERIFICATION.md
Related Issues: #4089, #4200, #4201, #4202, #3771, #3746, #3751, #2769, #2815, #3633, #3153, #3839, #3797, #3790, #1055, #1029
Last Reviewed: 2026-09-22
---

# CI Design Improvement Decision Brief (#4089)

## Purpose

Inventory overlapping CI workflows, supporting CI documents, and related programs, then rank keep / consolidate / retire recommendations for Product and PMO.

#4201 owns the inventory tables. #4202 owns the ranked recommendation table on this same path. Neither child implements those recommendations.

## Scope

In scope: live merge-protection classification; workflow-file family counts; overlapping `docs/reference/ci/**` inventories; overlapping CI programs still visible in GitHub; carry-forward Issues named on #4089; ranked keep / consolidate / retire recommendations with benefit, risk, and later-Issue requirement.

Out of scope: implementing any recommendation; deleting or adding workflows; changing required checks; restoring retired May-gate parsers; duplicating #3633 as a second test-catalog project; closing #4089.

## Current known truth

Observed 2026-09-22 on `origin/main` (`5ce9495c` at fetch time for this inventory branch):

- Machine-readable required merge jobs in `scripts/ci/merge_protection_surface.mjs`: `quality`, `gitleaks`, `reviewer-response-completion`.
- Advisory PR-process jobs: `pr-hygiene`, `diff-scope`.
- Manual-only PR-process jobs still present as `workflow_dispatch` files: intent labeler, PR issue accounting, drift, branch freshness, docs guardrails, design-compliance warn, post-merge-readiness.
- Retired merge-protection filename `gate-zip-safety.yml` is absent; ZIP checks belong inside `gate-quality.yml`.
- `.github/workflows` contains **106** YAML workflow files.
- #4200 (PR #4293) is the docs lock for the three-check surface; this inventory does not wait on that merge and does not edit those two files.

## Intended final state

This brief holds both the inventory and the ranked recommendations. Live required merge checks stay `quality`, `gitleaks`, and `reviewer-response-completion` unless a later source Issue changes them. No recommendation in this file is authorization to edit YAML or GitHub Settings.

## Live merge-protection surface (inventory)

Source: `scripts/ci/merge_protection_surface.mjs` plus matching workflow files.

| Class | Job id | Workflow file | Role |
| --- | --- | --- | --- |
| Required | `quality` | `gate-quality.yml` | Class-aware structure, ZIP, typecheck, lint, targeted tests, conditional build, delivery-profile fail-closed |
| Required | `gitleaks` | `gitleaks.yml` | Secret scan |
| Required | `reviewer-response-completion` | `reviewer-response-completion.yml` | Required ruleset check (#3771); late-review race repair (#3746 / PR #3751). Cancelled runs still fail the required gate until a later success on the same head |
| Advisory | `pr-hygiene` | `gate-pr-hygiene.yml` | PR-body validation; selected codes hard-fail the job without being a ruleset required check |
| Advisory | `diff-scope` | `gate-diff-scope.yml` | Allowlist path assessment |
| Manual-only | `label-intent` | `gate-intent-labeler.yml` | Paused auto-label path |
| Manual-only | `pr-issue-accounting` | `ops-pr-issue-accounting.yml` | Paused during #2208 |
| Manual-only | `drift-gate` | `gate-drift.yml` | Rebuild pending; no auto-trigger restore |
| Manual-only | `branch-freshness` | `gate-branch-freshness.yml` | Rebuild pending |
| Manual-only | `docs_guardrails` | `docs-guardrails.yml` | Rebuild pending |
| Manual-only | `design_compliance_warn` | `design-compliance-warn.yml` | Rebuild pending |
| Manual-only | `post-merge-readiness` | `gate-post-merge-readiness.yml` | Retired as pre-merge auto-trigger; manual backfill only |
| Retired filename | `check-no-zip-files` | `gate-zip-safety.yml` | Must stay absent |

OPS runtime and post-merge workflows are not required status checks (`docs/reference/ci/ops-runtime-surface.md`).

## Workflow file families (count, not a rewrite list)

106 files under `.github/workflows/*.yml`. Filename-prefix counts (first hyphen token):

| Prefix family | Count | Notes |
| --- | --- | --- |
| `ops-` | 28 | Runtime, D1 backup, Chatterbox, Gehrig ingest, stale communication |
| `gate-` | 9 | Merge and PR-process gates including paused manual-only files |
| `post-merge-*` | 7 | Closeout, remediation, late-review reaudit, Model C, intent verification |
| `orchestrator-` plus `project-implementation-orchestrator.yml` | 6 | Issue factory, queue, draft PR, agent trigger, state sync |
| `gehrig-` | 5 | Content/rights jobs, not merge protection |
| `library-` | 5 | Content production/preflight, not merge protection |
| `cursor-` | 4 | Review, bridge, local wake |
| `diataxis-` | 3 | Folder authority plus post-merge validate |
| remaining unique names | 39 | Includes `gitleaks.yml`, `reviewer-response-completion.yml`, PMO dashboard, Claude wake, Copilot setup, and one-off ops |

Overlapping YAML pairs observed by name (inventory only):

- `diataxis-folder-authority.yml` and `diataxis-folder-authority-check.yml`
- `design-authority-check.yml` and `design-compliance-warn.yml`
- ZIP family: `pr-triage-zip-taint.yml`, `purge-zip-history.yml`, `zip-history-audit.yml` plus ZIP steps inside `gate-quality.yml`
- Closeout family: `post-merge-closeout.yml` (single automatic source-issue closeout owner per `docs/reference/ci/workflow-inventory.md`) versus `post-merge-pr-body-closeout.yml`, `post-merge-remediation.yml`, `ops-post-merge-self-healing.yml`

## Overlapping CI documents

Supporting CI references under `docs/reference/ci/**` (33 tracked files). Several restated the required-check set after #3746:

| Path | Overlap |
| --- | --- |
| `docs/governance/CI-AND-VERIFICATION.md` | Domain policy; #4200 adds named Scope / Current known truth / Intended final state |
| `docs/reference/ci/merge-protection-surface.md` | Supporting required-check table; same #4200 lock |
| `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md` | Required / advisory / manual / retired tables (already names the three required jobs) |
| `docs/reference/ci/pr-workflow-ci-inventory.md` | PR-workflow required/advisory/retired tables |
| `docs/reference/ci/workflow-inventory.md` | Closeout excerpt; points to `docs/ops/workflows-inventory.md` for the full file index |
| `docs/reference/ci/pr-process-current-state.md` | PR-process as-built |
| `docs/reference/ci/pr-process-rebuild-retired-assets.md` | Retired #1075 / May-gate assets |
| `docs/reference/ci/lgfc-ci-as-built-reconciliation.md` | Historical as-built reconciliation |
| `docs/reference/ci/github-actions_MASTER.md` | Older Actions master index |

These files are overlapping **documentation**, not competing GitHub rulesets. Domain policy remains `docs/governance/CI-AND-VERIFICATION.md`.

## Overlapping programs (GitHub live state 2026-09-22)

| Issue | State | Overlap with #4089 |
| --- | --- | --- |
| #4089 | OPEN | This project. Model A docs-only. First executable #4200, then #4201, then #4202 |
| #2815 | OPEN | PROJECT: CI qualification, repeated pilot testing, and Production admission control. Adjacent; not a substitute for #4089 docs inventory |
| #3633 | CLOSED | PROJECT: CI qualification, test catalog, consolidation, Day-2. #4089 forbids treating this as a second test-catalog project |
| #3153 | OPEN | DESIGN: Evaluate CI-enforced hierarchical agent Skills/runtime architecture. Adjacent design; not merge-protection rewrite |
| #2769 | CLOSED | CI current-state audit vs July authority. Carry-forward named on #4089 |
| #3839 | CLOSED | Reconcile PR body auto-repair with live merge-readiness |
| #3797 | CLOSED | Prevent missing-verification post-merge exception Issues |
| #3790 | CLOSED | Prevent reviewer-disposition post-merge exception Issues when pre-merge review is clean |
| #3771 | CLOSED | Add reviewer-response-completion as required Main ruleset check |
| #3746 | CLOSED | Eliminate late-review merge race after reviewer-response gate passes |
| #3751 | MERGED (PR) | Implementation of #3746 |
| #1055 | CLOSED | Stabilize PR gate checks |
| #1029 | CLOSED | Enforcement standard and CI strategy |

Carry-forward Issues #3839, #3797, #3790, and #2769 are **closed**. This inventory does not reopen them. Residual operator friction that still appears in later PRs (cancelled `reviewer-response-completion` looking like a required-gate failure; `gh pr edit` GraphQL Projects classic errors; GATE PR Hygiene failing when a PR body names the job's forbidden-token list) is recorded as observed process cost, not as a new Issue created here.

## Ranked recommendations (#4202)

Rank 1 is highest. None of these rows is implemented in this PR.

| Rank | Disposition | Subject | Benefit | Risk | Later Issue required |
| --- | --- | --- | --- | --- | --- |
| 1 | Keep | Required jobs `quality`, `gitleaks`, `reviewer-response-completion` | Matches `merge_protection_surface.mjs`, #3771, and #3746 / PR #3751. Stops two-check regression | Cancelled reviewer-response runs still fail the required gate | No for the keep. Yes only if Product later wants cancelled-run handling changed in workflow code |
| 2 | Keep | Advisory `pr-hygiene` and `diff-scope` | Catches allowlist and unchecked-acceptance failures without adding ruleset required checks | Operators can misread a red advisory job as a missing required check | No |
| 3 | Keep | `post-merge-closeout.yml` as the only automatic source-issue closeout owner | Preserves the #2469 single-owner closeout contract | Sibling closeout/remediation workflows can still confuse operators | No unless a later audit shows a mutation race |
| 4 | Keep | Manual-only paused gates (`workflow_dispatch` only) | Avoids restoring retired May auto-triggers | Stale filenames remain in the 106-file tree | Yes if Product later chooses delete-versus-keep-as-dispatch for a named subset |
| 5 | Keep separate | OPEN #2815 (qualification / Production admission) versus #4089 | Prevents folding Production admission into a docs-only CI design project | Two CI-adjacent OPEN projects remain on the PMO board | No from this graph. PMO ownership review already planned separately |
| 6 | Keep closed | #3633 test-catalog project | Honors #4089 stop: do not recreate a second test-catalog | Agents may still cite #3633 as if it were live work | No |
| 7 | Defer | OPEN #3153 Skills/runtime CI design | Adjacent design; not merge-protection surface | Idle design Issue can look like #4089 follow-on | No new Issue. Continue only under #3153 if Product GOs that program |
| 8 | Consolidate (docs later) | Overlapping required-check restatements in `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md`, `pr-workflow-ci-inventory.md`, and `merge-protection-surface.md` | One Last Reviewed date and one table of record after #4200 | Protected-path and multi-file docs PRs | Yes. New docs-only Issue after #4200 merges. Do not mix into #4200 / #4201 / #4202 |
| 9 | Consolidate (YAML later) | `diataxis-folder-authority.yml` versus `diataxis-folder-authority-check.yml` | Fewer duplicate Diataxis Actions runs | Dropping the wrong file could miss a required path | Yes. Workflow Issue. Not this PR |
| 10 | Defer | Broad cut of the 28 `ops-*` workflows | Would shrink Actions noise if a named subset is redundant | Blind deletion can break D1 backup, Chatterbox, or Gehrig ingest | Yes, and only after Product names the subset. Not a blanket retire |
| 11 | Do not reopen | Closed carry-forwards #3839, #3797, #3790, #2769 | Avoids duplicate exception-policy projects | Residual operator cost (cancelled required checks, `gh pr edit` Projects classic errors, hygiene token false positives) remains | Yes only if Product wants a new bounded Issue for one residual, not a reopen of those four |
| 12 | Keep retired | `gate-zip-safety.yml` absent; ZIP inside `quality` | Matches machine-readable retired list | Restoring a ZIP required check would split the surface again | No |

## Rollback

One-step revert of the #4202 delta removes the ranked table and restores the #4201 inventory-only brief. It does not change GitHub required checks.
