---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current PR-workflow CI inventory and active/retired classification as a supporting specification
Does Not Own: CI and Verification Domain Policy; canonical PR-process policy; branch protection settings; production deployment; non-PR operations
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #2689, #2175, #2208, #2469, #2657
Last Reviewed: 2026-08-07
---

# PR Workflow CI Inventory

This document is a **supporting PR-workflow CI inventory** under the CI and Verification Domain Policy (`docs/governance/CI-AND-VERIFICATION.md`).

It is **not** a Domain Policy co-owner. Conflicts with domain policy resolve through `docs/governance/CI-AND-VERIFICATION.md`. PR lifecycle procedure remains in `docs/governance/PR_PROCESS.md`.

## Purpose

Record the current PR workflow surface, required checks, advisory checks, manual-only workflows, and #2469 retirements.

## Scope

This reference covers workflows that directly participate in PR readiness, review evidence, or source-issue closeout. It excludes production deployment and non-PR operations unless they directly affect those boundaries.

## Current known truth

Only `quality` and `gitleaks` are required. PR hygiene, diff scope, and reviewer response are advisory. `post-merge-closeout.yml` is the single automatic closeout owner, and the #1075 phase engine is retired.

Repository-owned GitHub API calls in the reviewer lifecycle gate and diff-scope context resolver use bounded retry/backoff for transient `5xx` and rate-limit responses (`scripts/ci/github_api_retry.mjs`, #2657). Exhausted retries fail closed with an `INFRASTRUCTURE_FAILURE` classification and do not weaken deterministic policy, scope, or review-state failures. The required `gitleaks` gate remains an upstream action (`gitleaks/gitleaks-action@v2`); its GitHub API outage handling is evaluated separately and is not silently weakened by repository scripts.

## Intended final state

The PR workflow surface remains deterministic, minimal, and documented. No manual-only or retired check may become required without explicit promotion evidence and branch-protection alignment.

## Current required surface

| Workflow | Job | Classification |
| --- | --- | --- |
| `gate-quality.yml` | `quality` | Required deterministic blocker |
| `gitleaks.yml` | `gitleaks` | Required deterministic blocker |

## Active advisory surface

| Workflow | Job | Classification |
| --- | --- | --- |
| `gate-pr-hygiene.yml` | `pr-hygiene` | Advisory |
| `gate-diff-scope.yml` | `diff-scope` | Advisory; PR context resolved by `scripts/ci/diff_scope_gate.mjs --resolve-context` with shared transient API retry (#2657) |
| `reviewer-response-completion.yml` | `reviewer-response-completion` | Advisory inventory class; script uses shared transient API retry (#2657) |

## Manual-only or paused

| Workflow | Disposition |
| --- | --- |
| `gate-intent-labeler.yml` | Manual-only |
| `ops-pr-issue-accounting.yml` | Manual-only |
| `gate-drift.yml` | Manual-only |
| `gate-branch-freshness.yml` | Manual-only |
| `docs-guardrails.yml` | Manual-only |
| `design-compliance-warn.yml` | Manual-only |
| `gate-post-merge-readiness.yml` | Manual backfill only |

These workflows must not be required while manual-only.

## Post-merge PR workflow

| Workflow | Role |
| --- | --- |
| `post-merge-closeout.yml` | Single automatic source-issue closeout owner |
| `post-merge-remediation.yml` | Failure support |
| `ops-post-merge-self-healing.yml` | Scheduled/manual exception hygiene |
| `diataxis-post-merge-validate.yml` | Documentation validation support |
| `ops-pr-process-metrics.yml` | Metrics |
| `post-merge-intent-verification.yml` | Inert manual compatibility marker only |

## Retired in #2469

The following legacy PR/CI assets are removed and must not be treated as active:

- `ci-orchestration-engine.yml`
- `gate-reviewer-response.yml`
- `gate-close-work-issue.yml`
- parked legacy `ci.yml`
- parked legacy `deploy.yml`
- parked legacy `deploy-dev.yml`
- parked legacy `deploy-prod.yml`
- parked legacy `lgfc-validate.yml`
- parked legacy `test.yml`
- parked legacy `test-homepage.yml`

The fixed #1075 state file and scripts are also removed. No workflow may recreate `lgfc-ci-phase:*` issues.

The previous hardcoded implementation of `post-merge-intent-verification.yml` is retired. Its retained marker has no PR trigger, issue-write permission, PR-write permission, body mutation, or closeout ownership.

## Non-PR operations

Production deployment, Cloudflare, D1/B2, site audits, snapshots, and other scheduled operational workflows are outside this PR inventory unless they directly participate in PR readiness or source-issue closeout.

## Promotion rule

A check may become required only after deterministic implementation, advisory observation, branch-protection alignment, and current-state documentation updates.
