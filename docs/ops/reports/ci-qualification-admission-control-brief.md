---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #2815 CI qualification brief — inventory (#4229), contract/scorecard (#4230), repeated-pilot matrix (#4231), and Production-admission recommendation (#4232)
Does Not Own: Branch-protection mutation; adding or removing required checks; workflow YAML; executing live pilot rounds; paid CI services; OpenAI-name sweep
Canonical Reference: .github/CI_GUARDRAILS_MAP.md
Related Issues: #2815, #4229, #4230, #4231, #4232, #4089, #4200, #3771, #3746
Last Reviewed: 2026-09-22
---

# CI Qualification and Production-Admission Control Brief (#2815)

## Purpose

Publish how a new CI candidate must be qualified, scored, piloted, and separately admitted before it can become a required Production check. #4229 inventories the live surface. #4230 publishes the contract and scorecard. #4231 designs the repeated-pilot matrix. This revision (#4232) publishes the Production-admission recommendation as a design statement only.

## Scope

In scope: live merge-protection classification inventory, candidate contract and scorecard, repeated-pilot matrix, and the Production-admission recommendation added in this #4232 revision.

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
| `reviewer-response-completion.yml` | `reviewer-response-completion` | Required. `.github/CI_GUARDRAILS_MAP.md` records event-conditional enforcement (#3746). `docs/governance/CI-AND-VERIFICATION.md` records that a cancelled run remains a required-gate failure until a later success on the same head (#3771 / PR #3751) |

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

## Repeated-pilot matrix (#4231)

Executing these rounds is **not** authorized by this child. A later source Issue must own live runs. This parent does not change branch protection, create a competing post-merge mutation owner, or use paid runners.

### Representative pilot identity

**Name:** `sandbox/2815-ci-admission-pilot`  
**Kind:** synthetic Model A documentation change (one file under `docs/ops/reports/**`), opened as a throwaway PR that never edits `.github/workflows/**` and never mutates GitHub rulesets.  
**Why this identity:** it is non-Production architecture, cheap to reset, and still exercises the real required surface (`quality`, `gitleaks`, `reviewer-response-completion`) plus advisory `pr-hygiene` / `diff-scope`.  
**Version identity per round:** record candidate SHA, workflow file SHA, input fixture name, started/finished timestamps, duration, findings, and whether a human intervened.

### Nine required cases

| # | Case | Expected disposition for a well-formed candidate |
| --- | --- | --- |
| 1 | Fully conforming change that should pass | Pass |
| 2 | Known scope or contract violation that should fail | Fail, with an actionable owner |
| 3 | Transient infrastructure failure | Not misclassified as a code defect |
| 4 | Agent communication or acknowledgment gap | Detected or explicitly out of scope in the contract |
| 5 | Stale or superseded event | Ignored or superseded; not a false required block |
| 6 | Duplicate delivery or retry | Idempotent; no double-close or double-mutate |
| 7 | Legitimate advisory finding | Must not become a false required blocker |
| 8 | Clean recovery and rerun | Later success on the same head restores merge eligibility |
| 9 | Disablement of the candidate | Required delivery path (`quality` / `gitleaks` / `reviewer-response-completion`) still works |

Use repeated rounds, not a single demonstration. Each round preserves exact candidate version, configuration, test inputs, outputs, duration, findings, and required human intervention.

## Production-admission recommendation (#4232)

**Recommendation (design statement only):** keep the current required surface. This parent does **not** change required checks, branch protection, credentials, or workflow YAML.

| Live job | Recommended posture | Notes |
| --- | --- | --- |
| `quality` | ADMIT — REQUIRED | Keep. Class-aware deterministic routing already in `merge_protection_surface.mjs`. |
| `gitleaks` | ADMIT — REQUIRED | Keep. Secret-exposure blocker. |
| `reviewer-response-completion` | ADMIT — REQUIRED | Keep. Do not regress to a two-check surface. |
| `pr-hygiene` | ADMIT — ADVISORY | Keep advisory. Do not promote without a later Issue plus repeated-pilot evidence. |
| `diff-scope` | ADMIT — ADVISORY | Keep advisory. Same bar. |
| Manual-only / paused PR-process jobs listed in #4229 | ADMIT — MANUAL OR SCHEDULED | Do not restore auto-triggers from this parent. #4089 already owns consolidation ranking. |

Any required-check add, remove, or swap needs **a later source Issue** plus Product/Engineering authorization and independent review. Admission remains a separate controlled transition.

Independent review of this brief is required. Parent #2815 stays open for PMO closeout after these docs merge. This wave does not authorize branch-protection edits, new credentials, or an OpenAI-name sweep.



