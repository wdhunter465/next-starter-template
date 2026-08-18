---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current GitHub-native reviewer lifecycle surface and event-conditional enforcement status
Does Not Own: Canonical PR policy, branch protection settings, or post-merge closeout ownership
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #2175, #2179, #2197, #2469, #3281
Last Reviewed: 2026-08-18
---

# LGFC Reviewer Lifecycle Surface

## Purpose

Define the current reviewer lifecycle surface after the July 2026 PR-process rebuild and the #3281 race remediation.

## Scope

This reference covers GitHub-native review state, review threads, event-conditional enforcement, and the retirement of the #1075 reviewer-response stub. It does not define branch protection or automatic post-merge closeout ownership.

## Current known truth

Reviewer lifecycle state comes from GitHub-native reviews and review threads. The PR body is not a reviewer-state ledger.

`reviewer-response-completion.yml` runs on every relevant PR event but **enforces** only on merge-readiness signals:

| Event | Posture |
| --- | --- |
| `pull_request` `opened` / `synchronize` / `reopened` | **Advisory** (code-green path; no deadlock on async bots) |
| `pull_request` `ready_for_review` / `edited` | **Enforcing** (merge-readiness / body disposition update) |
| `pull_request_review` / `pull_request_review_comment` | **Enforcing** |
| `workflow_dispatch` | **Enforcing** |

`gate-reviewer-response.yml` remains retired by #2469.

## Intended final state

Reviewer checks remain GitHub-native. Closeout prefers **resolved review threads** (optional short reply). Routine PR-body `review-comment:` ledgers are not required for advisory bot notes. Body dispositions remain an accepted alternative closeout path and may still be used for human `CHANGES_REQUESTED` paper trails on protected paths.

Prior-SHA outdated trusted-bot threads do **not** block pre-merge solely because they are outdated when the finding is addressed on the current head and no unresolved actionable threads remain on head. Late / non-selected findings stay with post-merge reaudit.

Human `CHANGES_REQUESTED` and unresolved human review threads remain blocking. Protected-path review evidence rules are unchanged.

## Current model

The active reviewer workflow is:

| Workflow | Job | Status |
| --- | --- | --- |
| `reviewer-response-completion.yml` | `reviewer-response-completion` | Event-conditional: advisory on pure push; enforcing on review / ready_for_review / body edit / dispatch |

The workflow may report:

- latest human review state;
- unresolved non-outdated human threads;
- stale or outdated comments (advisory on pre-merge for prior-SHA bot threads);
- trusted-bot findings as evidence with native-resolve closeout preferred;
- pagination or data-read failures.

## Retired surface

#2469 removes `gate-reviewer-response.yml`, the retired manual stub from the #1075 design.

The prior **required** PR-body disposition-ledger model and its synchronous timing rules on every synchronize are historical. Do not reintroduce push-time deadlocks on async bot arrival.

## Post-merge boundary

Automatic post-merge validation and source-issue closeout are owned by `post-merge-closeout.yml`. Reviewer audit helpers may contribute evidence or bounded remediation on failure, but they do not own source-issue closeout. Post-merge audit still tracks late and outdated-without-disposition findings.

The retained `post-merge-intent-verification.yml` file is an inert manual compatibility marker. It has no PR trigger, mutation permissions, validator execution, or closeout ownership.

## Required policy

Use `/docs/governance/PR_PROCESS.md` and `/docs/explanation/ci/lgfc-reviewer-lifecycle-redesign.md` for current policy and rationale. See also `/docs/reference/ci/trusted-reviewer-evidence-gate.md` for selected trusted-path rules.
