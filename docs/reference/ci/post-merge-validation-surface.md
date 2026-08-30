---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current post-merge validation, source-issue closeout, evidence, and remediation surface as a supporting specification
Does Not Own: CI and Verification Domain Policy; pre-merge required checks; branch protection settings; production runtime monitoring
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #2689, #1197, #1500, #2175, #2208, #2380, #2469, #2591
Last Reviewed: 2026-07-21
---

# LGFC Post-Merge Validation Surface

This document is the **supporting post-merge validation surface** under the CI and Verification Domain Policy (`docs/governance/CI-AND-VERIFICATION.md`).

It is **not** a Domain Policy co-owner. Post-merge ownership conflicts resolve through `docs/governance/CI-AND-VERIFICATION.md`. PR lifecycle procedure remains in `docs/governance/PR_PROCESS.md`.

## Purpose

Define the current post-merge validation, remediation, and source-issue closeout surface.

## Scope

This reference covers automatic closeout ownership, supporting workflows, evidence domains, failure handling, and the #1075 retirement boundary. It does not define pre-merge branch protection or production monitoring.

## Current known truth

`.github/workflows/post-merge-closeout.yml` is the sole automatic post-merge source-issue validation and closeout owner. Supporting workflows may provide remediation, documentation evidence, manual backfill, metrics, or exception housekeeping without racing the same mutation boundary.

## Intended final state

Post-merge closeout remains single-owner, evidence-driven, and idempotent. The retired #1075 phase engine cannot generate false orchestration pauses, while legitimate current failures continue to produce bounded remediation evidence.

## Current ownership

Automatic post-merge source-issue validation and reconciliation has one owner:

- `.github/workflows/post-merge-closeout.yml`

It runs for merged pull requests targeting `main`, invokes `scripts/ci/run_post_merge_closeout.mjs`, writes evidence artifacts, comments the result, and fails when current validation reports a blocking exception.

Before invoking the closeout runner, the workflow invokes
`scripts/ci/post_merge_stabilization.mjs`. The stabilization gate waits 60
seconds, re-fetches the merged PR, proves that the event merge SHA is reachable
from `main`, reads the required PR-head checks, and reads current review and
review-thread state. If those surfaces are not yet terminal and readable, it
retries every 15 seconds for at most 60 additional seconds. Normal validation
therefore starts after about 60 seconds when GitHub state is settled and no
later than about 120 seconds when bounded retries are exhausted.

A merge-SHA mismatch is not eventual consistency: it fails immediately as
`merge_sha_mismatch`. Other state that cannot be proven settled by the deadline
produces one `post_merge_stabilization_timeout` result. In both cases the normal
validator and remediation-family generation are skipped, preventing one
unstable snapshot from cascading into speculative metadata, workflow, reviewer,
or implementation exception families.

## Current workflows

| Workflow | Role |
| --- | --- |
| `post-merge-closeout.yml` | Single automatic validation and source-issue closeout owner |
| `post-merge-pr-body-closeout.yml` | Manual/backfill and active-manifest closeout only |
| `post-merge-remediation.yml` | Failure remediation support after Post-Merge Detection fails |
| `diataxis-post-merge-validate.yml` | Documentation evidence support |
| `ops-post-merge-self-healing.yml` | Scheduled/manual exception backlog hygiene |
| `post-merge-intent-verification.yml` | Inert manual compatibility marker; no validation or mutation |

#2469 removes the parked `gate-close-work-issue.yml` workflow and the previous hardcoded implementation of `post-merge-intent-verification.yml`.

## Validation boundary

Post-merge validation may inspect:

- merged PR and merge SHA;
- accepted source issue linkage;
- changed-file and implementation evidence;
- required workflow outcomes on applicable merge/head scope;
- current reviewer findings and thread state;
- documentation evidence;
- remediation requirements.

The validator must follow current `/docs/governance/PR_PROCESS.md` policy. Historical PR-body reviewer ledgers are not current authority.

## Source-issue closeout

When validation passes and no blocking remediation remains, the closeout runner may:

1. resolve the accepted source issue;
2. reconcile stale lifecycle labels;
3. add `status:complete` when available;
4. record PR, merge SHA, validator result, and closeout reason;
5. close an eligible open source issue;
6. verify terminal label integrity.

Program, umbrella, parent, roadmap, queue, and tracking boundaries remain governed by current issue/PR policy and explicit closeout decisions.

## Failure and remediation

When current validation fails:

- terminal source-issue closeout is refused;
- the source issue may be reconciled to a failure state;
- `post-merge-remediation.yml` may create or update bounded exception evidence;
- queue advancement may halt when the failure affects authorized work;
- legitimate exception issues remain available for incremental housekeeping.

Retirement of #1075 prevents obsolete CI phase issues from creating false orchestration pauses. It does not suppress legitimate current validation, security, or production failures.

## July 1+ exception-family analysis (#3800)

The July 1+ evidence in #3790, #3797, #3800, and the
#3666/#3667/#3671 remediation lineages separates timing-sensitive observations
from substantive defects:

| Family | Stabilization effect | Controlling disposition |
| --- | --- | --- |
| PR `merged_at` or merge metadata not yet readable | Preventable when propagation completes inside the bounded window | Retry, then one stabilization timeout |
| Merge SHA not yet visible from `main` | Preventable when branch visibility is delayed | Retry, then one stabilization timeout |
| Required check/workflow visibility lag | Preventable when PR-head `quality` or `gitleaks` is queued, missing, or not yet terminal | Retry; later validation still handles a terminal failure |
| A required-check name that never produces a live check-run (for example `pr-issue-accounting` while `ops-pr-issue-accounting.yml` stays `workflow_dispatch`-only) | Never timing-classified; no amount of retrying makes an automatically-triggered check-run appear for a manual-only workflow | Excluded from the required-check surface until the workflow gets an automatic trigger; see `.github/CI_GUARDRAILS_MAP.md` |
| Review or review-thread visibility lag | Preventable when the reviews or the first page of review threads cannot yet be read | Retry; later validation still handles genuine findings |
| Review-thread page count exceeds the first 100 threads | Never timing-classified; more threads will never make `hasNextPage` settle to `false` | Immediate `review_thread_pagination_unsupported`; not a candidate for retry |
| Issue/label state immediately after another workflow mutation | Partially timing-sensitive | The initial delay reduces overlap; the canonical closeout runner must still re-fetch and reconcile idempotently because the gate cannot infer the intended label decision |
| Duplicate/stale exception creation after state self-heals | Not solved by timing alone | Existing canonical exception lookup and self-healing remain responsible; do not create a second automatic closeout owner |
| Reviewer classification and disposition defects (140 `outdated_reviewer_thread_without_disposition`, 71 `undispositioned_reviewer_comment` occurrences recorded in #3790, with overlap) | Timing can prevent visibility races only | #3790/#3805 own canonical pre/post-merge classification; human changes-requested and unresolved findings remain fail-closed |
| Verification evidence (`missing_verification_commands`, `verification_not_pass`, `verification_placeholder`; examples #3104, #3108, #3550, #3743, #3782, #3011, and #3286) | Not timing when reproduced from settled PR content | #3797 owns shift-left enforcement after the timing boundary is accepted; #3800 does not mask it |
| Wrong or stale merge-SHA evidence | Never timing-classified | Immediate `merge_sha_mismatch`; correct the evidence source |
| Stale source state after a terminal exception (#3666/#3683, #3667/#3682, #3671/#3685) | Delay can reduce races but cannot replace reconciliation | After terminal remediation, re-fetch and run the canonical closeout path; remove stale failure labels only when no substantive failure remains |
| Security, Production, protected human decisions, ambiguous ownership, or unresolved implementation failure | Not suppressible | Remain explicit, actionable, and fail-closed |

This boundary deliberately does not promise zero exception Issues. It suppresses
only speculative families caused by an unproven GitHub snapshot. Deterministic
pre-merge defects remain candidates for shift-left enforcement, while genuine
post-merge failures continue through the single-owner remediation lifecycle.

## Pre-merge hygiene versus post-merge exception ownership

Stable PR-body structure defects are owned before merge:

- Advisory detection: `GATE — PR Hygiene` / `scripts/ci/pr_hygiene_audit.mjs` reports missing substantive `Change Summary`, `Verification`, and `Acceptance Criteria` evidence on PR open/edit/synchronize/reopen.
- Blocking pre-merge readiness: `post-merge-readiness` / `scripts/ci/post_merge_readiness_gate.mjs` continues to fail when required stable sections are absent.

After merge, the same section omissions are historical hygiene evidence only:

- `missing_required_section` and legacy `missing_advisory_section` may be recorded in closeout evidence with advisory severity.
- Those codes alone must not fail closeout, create a new Ops remediation issue, or preserve an exception.
- Mixed results that also contain implementation, required-workflow, source-linkage, DIATAXIS, security, production, or actionable reviewer defects still create or update an exception.
- Self-healing unsafe classification evaluates structured failure evidence (`failure_code` and `## Detected failure condition` rows). Generated boilerplate such as `Queue advancement status` or `Required ChatGPT/Bill decision` must not independently escalate to `unsafe_operator_review_required`.

This issue does not promote `pr-hygiene` to a required branch-protection check.

## Core scripts

| Script | Role |
| --- | --- |
| `scripts/ci/run_post_merge_closeout.mjs` | Single automatic closeout runner |
| `scripts/ci/post_merge_stabilization.mjs` | Bounded merge/main/check/review settlement gate before automatic closeout |
| `scripts/ci/post_merge_validator.mjs` | Evidence aggregation and result contract |
| `scripts/ci/post_merge_remediation_issue.mjs` | Bounded remediation issue handling |
| `scripts/ci/post_merge_source_issue_closeout.mjs` | Source-issue closeout decisions and label reconciliation |
| `scripts/orchestrator/sync-pr-state.mjs` | Shared issue lifecycle synchronization used by the closeout runner |
| `scripts/ci/post_merge_validation_surface.mjs` | Current workflow/script surface validator |

## Verification

Validation command: `node scripts/ci/post_merge_validation_surface.mjs`.

The validator must confirm the active automatic owner and its required supporting scripts without requiring retired #1075 workflows.
