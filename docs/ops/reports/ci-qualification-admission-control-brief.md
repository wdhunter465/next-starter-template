---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #2815 live CI-surface inventory against the admission model (#4229)
Does Not Own: Branch-protection mutation; adding or removing required checks; workflow YAML; #4089 consolidation implementation; paid CI services
Canonical Reference: .github/CI_GUARDRAILS_MAP.md
Related Issues: #2815, #4229, #4230, #4231, #4232, #4089, #4200, #3771, #3746
Last Reviewed: 2026-09-22
---

# CI Qualification and Production-Admission Control Brief (#2815)

## Purpose

Publish how a new CI candidate must be qualified, scored, piloted, and separately admitted before it can become a required Production check. This revision (#4229) inventories the live required, advisory, and manual surface and separates this parent from Active CI-design work on #4089.

## Scope

In scope: docs inventory of the live merge-protection classification.

Out of scope: `.github/workflows/**` edits; GitHub ruleset changes; duplicating #4089 keep/consolidate/retire implementation; paid CI or new credentials.

## Current known truth

Observed 2026-09-22 on `origin/main` (`567ce0dd`):

- `docs/ops/ai/**` is agent execution law and product pointers. **It is not the CI inventory.** Live required versus advisory versus manual CI is `.github/CI_GUARDRAILS_MAP.md`, with the machine-readable required set in `scripts/ci/merge_protection_surface.mjs`.
- Required pre-merge jobs: `quality`, `gitleaks`, `reviewer-response-completion`.
- Advisory: `pr-hygiene`, `diff-scope`.
- Manual-only / paused: intent labeler, PR-issue-accounting, drift, branch-freshness, docs-guardrails, design-compliance-warn, post-merge-readiness (manual backfill).
- #4089 owns current-strategy / overlap inventory / ranked consolidation recommendations (children #4200–#4202). This parent owns **qualification + repeated-pilot design + Production-admission control**. The two scopes must not be merged.
- This brief does not itself change branch protection.

## Intended final state

The live three required jobs stay the admission baseline until a later source Issue plus Product/Engineering authorization changes them. New CI enters the contract, scorecard, and pilot on later #2815 children before anyone may recommend required admission.

## Inventory versus #4089 (#4229)

| Concern | Owner | This brief |
| --- | --- | --- |
| Lock the live three-check required surface in CI policy | #4089 / #4200 | Cite only |
| Inventory overlapping workflows and rank keep/consolidate/retire | #4089 / #4201 / #4202 | Cite only; do not copy those tables |
| Qualification contract, scorecard, repeated-pilot design, admission gate | #2815 | This file |

## Live required surface (from `.github/CI_GUARDRAILS_MAP.md`)

| Workflow | Job | Admission class today |
| --- | --- | --- |
| `gate-quality.yml` | `quality` | Required |
| `gitleaks.yml` | `gitleaks` | Required |
| `reviewer-response-completion.yml` | `reviewer-response-completion` | Required (#3746 / #3771). A cancelled run remains a gate failure until a later success on the same head |

## Live advisory surface

| Workflow | Job | Admission class today |
| --- | --- | --- |
| `gate-pr-hygiene.yml` | `pr-hygiene` | Advisory |
| `gate-diff-scope.yml` | `diff-scope` | Advisory |

## Live manual-only / paused surface

| Workflow | Disposition in the map |
| --- | --- |
| `gate-intent-labeler.yml` | Manual-only pending advisory-first rebuild |
| `ops-pr-issue-accounting.yml` | Manual-only while paused |
| `gate-drift.yml` | Manual-only |
| `gate-branch-freshness.yml` | Manual-only |
| `docs-guardrails.yml` | Manual-only |
| `design-compliance-warn.yml` | Manual-only |
| `gate-post-merge-readiness.yml` | Manual backfill only |

## Post-merge mutation boundary (inventory only)

`.github/CI_GUARDRAILS_MAP.md` names one automatic source-issue closeout owner: `post-merge-closeout.yml`. Supporting post-merge workflows must not independently claim that same mutation boundary. This parent does not add a competing closeout owner.

OPS runtime, runner, Bridge, and scheduled jobs are outside the required merge set. They are not promoted by this inventory.
