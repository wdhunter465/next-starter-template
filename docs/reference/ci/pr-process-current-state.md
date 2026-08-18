---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current PR process baseline after #2228 and #2469 closeout
Does Not Own: Canonical PR-process policy, live GitHub branch protection settings, or GitHub App settings
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #2175, #2208, #2228, #2469
Last Reviewed: 2026-08-18
---

# PR Process Current State

## Purpose

Define the current implemented PR-process baseline after the July 2026 rebuild and the retirement of the #1075 orchestration path.

## Scope

This reference covers required checks, active advisory checks, manual-only workflows, post-merge ownership, and the operational effect of #2469. It does not change canonical policy or live branch-protection settings.

## Current known truth

The PR-process redesign is implemented around stable-facts PR bodies, GitHub-native reviewer state, deterministic required checks, advisory-first promotion, single-owner post-merge closeout, and routine incremental exception housekeeping. There is no active dedicated #1075 CI phase-generation engine. Controlled and operational authority documents that formerly described that engine as active are reconciled by #2469. #2175 and #2208 closed complete on 2026-07-04; they are historical related Issues, not open pre-closeout operator work. If live branch protection later diverges from the documented `quality` and `gitleaks` required-check surface, handle that as a new bounded Ops correction.

## Intended final state

The repository maintains this minimal deterministic PR surface, confirms live branch protection matches documented required checks, and prevents retired #1075 mechanisms or PR-body lifecycle mutation from returning without new authorization and evidence.

## Status

Current principles:

- stable-facts PR bodies only;
- GitHub-native reviewer lifecycle;
- deterministic required checks;
- advisory-first promotion;
- single-owner post-merge closeout;
- routine incremental exception housekeeping;
- no dedicated #1075 CI phase-generation engine.

## Required operator confirmation

Before merging #2469, verify live branch protection for `main` requires only:

- `quality`
- `gitleaks`

Remove retired check names if still configured.

## Required checks

| Job | Workflow |
| --- | --- |
| `quality` | `gate-quality.yml` |
| `gitleaks` | `gitleaks.yml` |

## Active advisory checks

| Job | Workflow |
| --- | --- |
| `pr-hygiene` | `gate-pr-hygiene.yml` |
| `diff-scope` | `gate-diff-scope.yml` |
| `reviewer-response-completion` | `reviewer-response-completion.yml` |

## Manual-only / rebuild later

| Workflow | Disposition |
| --- | --- |
| `gate-intent-labeler.yml` | Manual-only |
| `ops-pr-issue-accounting.yml` | Manual-only |
| `gate-drift.yml` | Manual-only |
| `gate-branch-freshness.yml` | Manual-only |
| `docs-guardrails.yml` | Manual-only |
| `design-compliance-warn.yml` | Manual-only |
| `gate-post-merge-readiness.yml` | Manual backfill only |

## Post-merge and metrics

| Workflow | Role |
| --- | --- |
| `post-merge-closeout.yml` | Single automatic closeout owner |
| `post-merge-remediation.yml` | Failure support |
| `ops-post-merge-self-healing.yml` | Scheduled/manual exception hygiene |
| `ops-pr-process-metrics.yml` | Metrics |

## #1075 retirement

#2469 removes the old scheduled phase engine, fixed state file, orphaned decomposition assets, and legacy workflow residue. Historical #1075 phase issues do not block or authorize current CI work.

The remaining exception queue is handled incrementally through routine housekeeping rather than a new large remediation program.

## Do not promote without evidence

Do not promote advisory gates to required status or restore PR-body lifecycle mutation without satisfying `/docs/governance/PR_PROCESS.md`.
