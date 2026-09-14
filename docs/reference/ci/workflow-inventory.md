---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current closeout-related workflow inventory excerpt and retirement disposition as a supporting specification
Does Not Own: CI and Verification Domain Policy; complete repository workflow inventory; branch protection settings; CI policy rationale
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #2689, #1500, #2175, #2208, #2469, #3746, #2769
Last Reviewed: 2026-09-14
---

# GitHub Actions Closeout Workflow Inventory Excerpt

This document is a **supporting closeout workflow inventory** under the CI and Verification Domain Policy (`docs/governance/CI-AND-VERIFICATION.md`). The complete live workflow file index is `docs/ops/workflows-inventory.md`.

It is **not** a Domain Policy co-owner. Conflicts with domain policy resolve through `docs/governance/CI-AND-VERIFICATION.md`. PR lifecycle procedure remains in `docs/governance/PR_PROCESS.md`.

## Purpose

Identify the current closeout-related workflow surface and record the retirement of obsolete #1075 paths.

## Scope

This reference covers automatic closeout ownership, supporting post-merge workflows, and the legacy assets retired by #2469. It does not define branch protection or the complete repository workflow inventory.

## Current known truth

`.github/workflows/post-merge-closeout.yml` is the only automatic source-issue closeout owner. Supporting workflows may provide manual backfill, remediation, evidence, metrics, or scheduled cleanup, but must not race the same automatic mutation boundary.

## Intended final state

Closeout remains single-owner and idempotent. Retired #1075 workflows and state must remain absent, while legitimate exception reporting and incremental housekeeping remain available.

## Current closeout surface

| Workflow | Classification | Current role |
| --- | --- | --- |
| `post-merge-closeout.yml` | Operational | Single automatic source-issue validation and closeout owner |
| `post-merge-pr-body-closeout.yml` | Operational | Manual/backfill and active-manifest closeout |
| `post-merge-remediation.yml` | Operational | Failure remediation support |
| `ops-post-merge-self-healing.yml` | Operational | Scheduled/manual exception hygiene |
| `ops-pr-process-metrics.yml` | Operational | PR-process metrics |
| `ops-pr-issue-accounting.yml` | Manual-only | Pre-merge source-issue accounting while paused |
| `post-merge-intent-verification.yml` | Compatibility marker | Manual-only, read-only, no validation or mutation |

## Retired by #2469

- `ci-orchestration-engine.yml`
- `gate-close-work-issue.yml`
- `gate-reviewer-response.yml`
- parked legacy `ci.yml`, `deploy*.yml`, `lgfc-validate.yml`, `test.yml`, and `test-homepage.yml`
- the hardcoded legacy implementation formerly stored in `post-merge-intent-verification.yml`

The #1075 state file and phase-generation scripts are also retired. No current inventory may treat them as effective workflows or queue owners.

## Ownership rule

`.github/workflows/post-merge-closeout.yml` is the only automatic source-issue closeout owner. Supporting workflows may provide manual backfill, remediation, evidence, metrics, or scheduled cleanup, but must not race the same automatic mutation boundary.

## Required-check boundary

The current required PR checks are maintained in `/docs/reference/ci/merge-protection-surface.md`. Closeout and OPS workflows are not merge-protection checks.

## Exception boundary

Existing exception issues are handled incrementally through routine housekeeping. The #2469 retirement removes obsolete exception generation without disabling legitimate failure reporting.
