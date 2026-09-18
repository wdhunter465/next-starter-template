---
Doc Type: Reference
Audience: Human + AI
Authority Level: Operational Reference
Owns: PR body auto-repair behavior, trusted PR safety limits, managed repair block semantics, reviewer-disposition placeholder behavior
Does Not Own: Merge authority, issue closeout, label mutation, source issue approval, runtime implementation behavior
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #1715, #1713, #3839
Last Reviewed: 2026-06-17
---

# PR Body Auto-Repair

## Purpose

PR body auto-repair gives the reviewer-response workflow a conservative way to repair or scaffold governance evidence in trusted same-repository pull requests.

The feature exists because the repository PR process requires a complete PR body and explicit reviewer-response accounting, but earlier CI behavior mostly produced comments instead of repairable PR-body content.

## Safety model

Auto-repair is allowed only for open, same-repository pull requests.

It does not run as a write operation for fork pull requests.

It does not approve, merge, close issues, reopen issues, relabel issues, request reviewers, or mark a pull request ready for review.

It does not decide that a pull request is merge-ready. GitHub-native required checks, reviews, and branch protection remain the authoritative merge blockers. Generated `Status: BLOCKED` / `halt` lines must reflect *current* live state, not an earlier scaffold snapshot (#3839).

It may generate evidence placeholders that an agent must complete before claiming `READY FOR REVIEW`.

## Trigger surface

The existing `GATE — Reviewer Response Completion` workflow runs auto-repair before the reviewer lifecycle gate.

Supported workflow events:

- `pull_request_target`
- `issue_comment` for pull request comments
- `pull_request_review`
- `pull_request_review_comment`

## Managed block

Auto-repair writes a managed PR-body block bounded by:

```text
<!-- pr-body-auto-repair:start -->
...
<!-- pr-body-auto-repair:end -->
```

On later runs, the workflow replaces the existing managed block instead of appending duplicates.

## Generated evidence

The managed block may include:

- detected source issue status;
- inferred intent label;
- changed-file allowlist bullets;
- docs-only inference;
- missing canonical heading count;
- PR template scaffold sections;
- reviewer-response accounting placeholders.

## Reviewer-response placeholders

When trusted reviewer comments lack parseable dispositions, auto-repair can add placeholder lines such as:

```text
- review-comment:<id> — acknowledged — auto-generated disposition placeholder; agent must replace with final fix/rationale before READY FOR REVIEW — thread state: unresolved-with-rationale
```

These placeholders are intentionally not final readiness evidence. The working agent must replace them with accepted, rejected, not-applicable, or follow-up issue dispositions before handoff.

## Readiness limits

Auto-repair keeps `Status: BLOCKED` in generated evidence.

Only the working agent may claim `READY FOR REVIEW`, and only after:

- the PR body matches the final diff;
- all required gates are green;
- all reviewer comments and review threads are inspected;
- every actionable reviewer item has a final disposition;
- the latest PR head has been checked.

## Related implementation files

- `.github/workflows/reviewer-response-completion.yml`
- `scripts/ci/pr_body_auto_repair.mjs`
- `scripts/ci/run_pr_body_auto_repair.mjs`
- `scripts/ci/reviewer_lifecycle_gate.mjs`
- `scripts/ci/reviewer_comment_disposition.mjs`
- `tests/pr-body-auto-repair.test.mjs`
