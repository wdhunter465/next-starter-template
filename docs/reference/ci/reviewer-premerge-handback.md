---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Reviewer-response pre-merge auto-repair, preparer handback, and merge-block behavior
Does Not Own: Reviewer trust policy, protected approval authority, or post-merge closeout policy
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #3281, #3703
Last Reviewed: 2026-08-25
---

# Reviewer pre-merge handback

## Purpose

Prevent a reviewer-disposition defect that is known before merge from escaping the originating pull request and becoming a post-merge exception/remediation-PR cycle.

## Current flow

`GATE — Reviewer Response Completion` runs the following sequence:

1. Determine advisory versus enforcing posture.
2. Run the existing conservative PR-body auto-repair engine for open trusted same-repository pull requests.
3. Run the reviewer lifecycle disposition audit.
4. On an enforcing event, if reviewer findings remain unresolved or the auto-repair block still contains `pending agent completion`, post/update one deterministic preparer-handback comment on the same pull request and fail the job.
5. Restore merge eligibility only after the preparer fixes the same PR, replaces any scaffold with a substantive disposition, and the enforcing reviewer-response run passes.

## Async-review protection

Issue #3281 remains controlling for ordinary implementation pushes. `opened`, `synchronize`, and `reopened` events are advisory so an asynchronous reviewer that has not posted yet cannot deadlock implementation.

`ready_for_review`, PR-body edits, reviewer submissions/comments, and manual workflow dispatch are enforcing merge-readiness events.

## Auto-repair boundary

Auto-repair may add deterministic bookkeeping and disposition scaffolds. A generated rationale containing `pending agent completion` is never final evidence. The preparer must replace it with a substantive disposition before an enforcing reviewer-response run can pass.

CI does not decide whether a substantive reviewer finding is accepted, rejected, fixed, or not applicable.

## Preparer resolution

The handback target is resolved in this order:

1. `Implementation agent:` metadata in the PR body when meaningful;
2. an `agent:*` PR/Issue label;
3. the PR author as fallback.

The handback comment contains reviewer item IDs, blocker state, required correction, final disposition syntax, and an explicit instruction to repair the originating PR rather than open another remediation PR.

## Same-PR invariant

A reviewer-disposition defect known before merge must remain on the originating PR until resolved. Post-merge exception Issues are reserved for defects/findings that genuinely appear after merge or could not have been determined at merge readiness.

## Verification

Primary regression coverage:

- `tests/reviewer-preparer-handback.test.mjs`
- existing reviewer lifecycle/disposition tests
- existing PR-body auto-repair tests

A live qualification should use a PR with a trusted reviewer finding and confirm:

1. auto-repair scaffolds bookkeeping;
2. enforcing reviewer-response blocks merge;
3. preparer handback appears on the same PR;
4. scaffold alone cannot clear the gate;
5. preparer correction + final disposition reruns green;
6. merge produces no reviewer-disposition post-merge exception.
