---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current CI workflow classification by lifecycle domain and retirement status as a supporting specification
Does Not Own: CI and Verification Domain Policy; workflow implementation details; branch protection settings
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #2689, #2683, #1058, #2175, #2208, #2469, #2524
Last Reviewed: 2026-08-05
---

# LGFC Workflow Classification Matrix

This document is the **supporting workflow classification matrix** under the CI and Verification Domain Policy (`docs/governance/CI-AND-VERIFICATION.md`).

It is **not** a Domain Policy co-owner. Check-class and ownership conflicts resolve through `docs/governance/CI-AND-VERIFICATION.md`. PR lifecycle procedure remains in `docs/governance/PR_PROCESS.md`.

## Purpose

Classify current and retired CI workflows by lifecycle role after the July 2026 PR-process rebuild and #2469 retirement.

## Scope

This reference covers required merge protection, advisory PR checks, manual-only workflows, post-merge/OPS workflows, and retired #1075 assets. It does not define implementation details or live branch protection.

## Current known truth

`gate-quality.yml` and `gitleaks.yml` are the required deterministic checks. Delivery-profile classification now fails closed inside `GATE — Quality Checks` (including Model B rollback↔delivery-model cross-check and required `Implementation agent`). PR hygiene remains non-required for branch protection, but hard-fails the hygiene job on `missing_allowlist`, `allowlist_violation`, `unchecked_acceptance_criterion`, and `forbidden_placeholder_token`. Reviewer response completion fails closed on undispositioned and outdated-without-disposition findings. Soft PR-hygiene findings and diff scope remain advisory.

## Intended final state

Each workflow remains in the correct lifecycle domain, retired assets stay absent, and no advisory or manual-only workflow becomes a branch-protection required check without explicit promotion evidence. Fail-closed pre-merge detection for the dominant post-merge exception codes is authorized by #2683 without weakening post-merge validators.

## Required merge protection

| Workflow | Classification | Current role |
| --- | --- | --- |
| `gate-quality.yml` | Keep | Deterministic class-aware quality blocker; includes fail-closed delivery-profile classification |
| `gitleaks.yml` | Keep | Secret exposure blocker |

## Active advisory PR checks

| Workflow | Classification | Current role |
| --- | --- | --- |
| `gate-pr-hygiene.yml` | Keep advisory for soft findings; hard-fail selected codes | Stable PR-body hygiene; hard-fails allowlist / unchecked AC / forbidden placeholder |
| `gate-diff-scope.yml` | Keep advisory | Allowed-path diff assessment |
| `reviewer-response-completion.yml` | Enforce disposition completeness | GitHub-native reviewer/thread assessment; fails closed on undispositioned and outdated-without-disposition |

## Manual-only / paused

| Workflow | Classification | Current role |
| --- | --- | --- |
| `gate-intent-labeler.yml` | Rebuild only if justified | Manual-only |
| `ops-pr-issue-accounting.yml` | Rebuild only if justified | Manual-only |
| `gate-drift.yml` | Rebuild only if justified | Manual-only |
| `gate-branch-freshness.yml` | Rebuild only if justified | Manual-only |
| `docs-guardrails.yml` | Rebuild only if justified | Manual-only |
| `design-compliance-warn.yml` | Rebuild only if justified | Manual-only |
| `gate-post-merge-readiness.yml` | Retired automatic role | Manual backfill only |

## Post-merge and operations

| Workflow | Classification | Current role |
| --- | --- | --- |
| `post-merge-closeout.yml` | Keep | Single automatic source-issue closeout owner |
| `post-merge-pr-body-closeout.yml` | Keep bounded | Manual/backfill closeout |
| `post-merge-remediation.yml` | Keep bounded | Failure remediation support |
| `ops-post-merge-self-healing.yml` | Keep bounded | Scheduled/manual exception hygiene |
| `diataxis-post-merge-validate.yml` | Keep support | Documentation evidence |
| `ops-assess.yml` | Keep OPS | Site assessment |
| `production-audit.yml` | Keep OPS | Production invariant audit |
| `snapshot.yml` | Keep OPS | Snapshot and rollback evidence |
| `b2-s3-smoke-test.yml` | Keep OPS | B2 smoke testing |
| `b2-d1-daily-sync.yml` | Keep OPS | B2/D1 synchronization |
| `post-merge-intent-verification.yml` | Compatibility marker | Manual-only, read-only, no mutation |

## Retired by #2469

- `ci-orchestration-engine.yml`
- `gate-reviewer-response.yml`
- `gate-close-work-issue.yml`
- parked legacy `ci.yml`, `deploy*.yml`, `lgfc-validate.yml`, `test.yml`, and `test-homepage.yml`
- fixed #1075 state and phase-generation scripts
- hardcoded maintainer-body logic formerly in `post-merge-intent-verification.yml`

## Retired by #2524

- `update-docs.md` / `update-docs.lock.yml` (Auto-Sync Documentation GitHub Agentic workflow)
  - Was Copilot-CLI README maintenance only; not Diátaxis or as-built sync
  - Removed to eliminate recurring `COPILOT_GITHUB_TOKEN` failure noise

## Architectural rule

Current CI separates deterministic merge safety, advisory branch hygiene, single-owner post-merge closeout, and production operations. Retired #1075 assets must not be restored through historical plans or stale issue state.
