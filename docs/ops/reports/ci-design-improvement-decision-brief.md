---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #4089 inventory of overlapping CI workflows, docs, and programs as recorded on #4201
Does Not Own: Ranked keep/consolidate/retire recommendations (#4202); workflow YAML; GitHub ruleset mutation; test-catalog rebuild; Production admission
Canonical Reference: docs/governance/CI-AND-VERIFICATION.md
Related Issues: #4089, #4200, #4201, #4202, #3771, #3746, #3751, #2769, #2815, #3633, #3153, #3839, #3797, #3790, #1055, #1029
Last Reviewed: 2026-09-22
---

# CI Design Improvement Decision Brief (#4089)

## Purpose

Inventory overlapping CI workflows, supporting CI documents, and related programs so Product and PMO can later rank keep / consolidate / retire work without rewriting YAML in this file.

This file is the #4201 inventory. Ranked recommendations belong on #4202 in a later revision of this same path.

## Scope

In scope: live merge-protection classification; workflow-file family counts; overlapping `docs/reference/ci/**` inventories; overlapping CI programs still visible in GitHub; carry-forward Issues named on #4089.

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

After #4202, this brief also holds ranked keep / consolidate / retire rows. Until then it is inventory only. Live required merge checks stay the three jobs above unless a later source Issue changes them.

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

Carry-forward Issues #3839, #3797, #3790, and #2769 are **closed**. This inventory does not reopen them. Residual operator friction that still appears in later PRs (cancelled `reviewer-response-completion` looking like a required-gate failure; `gh pr edit` GraphQL Projects classic errors; hygiene failing on the literal tokens `TODO` / `TBD` / `placeholder` in PR bodies) is recorded as observed process cost, not as a new Issue created here.

## #4202 handoff

#4202 must add ranked keep / consolidate / retire recommendations to this file only. Each row must name benefit, risk, and whether a later Issue is required. #4202 must not implement those recommendations.

## Rollback

Deleting or reverting this file removes the inventory. It does not change GitHub required checks.
