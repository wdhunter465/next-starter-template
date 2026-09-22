---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #2815 CI qualification brief — live surface inventory (#4229) and candidate contract plus scorecard (#4230)
Does Not Own: Branch-protection mutation; adding or removing required checks; workflow YAML; #4089 consolidation implementation; paid CI services
Canonical Reference: .github/CI_GUARDRAILS_MAP.md
Related Issues: #2815, #4229, #4230, #4231, #4232, #4089, #4200, #3771, #3746
Last Reviewed: 2026-09-22
---

# CI Qualification and Production-Admission Control Brief (#2815)

## Purpose

Publish how a new CI candidate must be qualified, scored, piloted, and separately admitted before it can become a required Production check. #4229 inventories the live surface. This revision (#4230) publishes the reusable candidate contract, scorecard, and disposition vocabulary. Pilot design and the admission recommendation remain later children.

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

The live three required jobs stay the admission baseline until a later source Issue plus Product/Engineering authorization changes them. Every new CI candidate must complete the contract and scorecard below before implementation. This file still does not implement a workflow or promote a check to required.

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

## Candidate admission contract (#4230)

A candidate that lacks every field below does not enter implementation. Completing the contract is not Production admission.

| Field | Required content |
| --- | --- |
| Problem | The exact failure mode the candidate prevents, named against a real repository path. |
| Why existing CI is insufficient | Why `quality`, `gitleaks`, `reviewer-response-completion`, advisory hygiene/diff-scope, or a simpler script cannot already cover it. |
| Deterministic inputs and outputs | Exact GitHub events, files, and APIs in; exact pass/fail/skip disposition out. Same inputs must yield the same disposition. |
| Failure and ambiguity behavior | Fail-closed versus fail-open; what happens when the signal is cancelled, timed out, or incomplete. |
| Permissions and secrets | Least privilege; no new credential or paid service without Product Authority. |
| Frequency and expected runtime | Trigger and an upper bound that does not dominate PR latency without justification. |
| False-positive and false-negative risks | Named misclassification cases and the owner who remediates them. |
| Operational owner and remediation route | Durable role plus the Issue/PR path used when the check is wrong. |
| Test method | How the nine-case repeated-pilot matrix on #4231 will be applied to this candidate. |
| Disable and rollback | How to turn the candidate off without damaging the three required jobs or delivery. |
| Success and rejection thresholds | Numeric or binary bars that choose ADMIT versus REVISE AND RETEST versus REJECT. |

## Evaluation scorecard (#4230)

Score from repository evidence, not from a single green run.

| Dimension | Question |
| --- | --- |
| Necessity | Protects a real failure mode not already covered. |
| Determinism | Same inputs produce the same disposition. |
| Accuracy | False-positive and false-negative rate stay inside the contract thresholds. |
| Actionability | Failures name a specific owner and corrective action. |
| Non-duplication | Does not replicate another workflow or mutation owner (especially post-merge closeout). |
| Latency | Does not impose disproportionate PR or queue delay. |
| Reliability | Survives repeated rounds and recovery cases. |
| Maintainability | Ownership, tests, documentation, and rollback are understandable. |
| Security | Least privilege; no unjustified credential or permission expansion. |
| Operational value | Prevents more cost, risk, or manual work than it creates. |

## Disposition vocabulary (#4230)

Each candidate receives exactly one:

| Disposition | Meaning |
| --- | --- |
| ADMIT — REQUIRED | Proven deterministic blocker for a defined gate profile. Still needs a later authorized transition before branch protection changes. |
| ADMIT — ADVISORY | Useful signal, not justified as a required blocker. |
| ADMIT — MANUAL OR SCHEDULED | Useful only as an operator or periodic control. |
| REVISE AND RETEST | Potential value; evidence or implementation incomplete. |
| CONSOLIDATE | Value exists but belongs inside an existing workflow or shared engine. |
| REJECT | Idea does not translate into reliable or worthwhile code. |
| RETIRE | Existing workflow is duplicate, obsolete, misleading, or more costly than its value. |

No candidate may silently remain active without a disposition and owner. This child does not implement a new workflow and does not promote a check to required.

