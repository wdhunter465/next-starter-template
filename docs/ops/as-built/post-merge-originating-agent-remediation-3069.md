---
Doc Type: AS-BUILT
Audience: Human + AI
Authority Level: Operational Implementation Record
Owns: Deterministic ownership, interruption, remediation, acceptance, and resumption rules for post-merge closeout exceptions
Does Not Own: Product decisions, PR approval, Production authorization, or agent role definitions
Canonical Reference: /docs/ops/pmo/queue-watch-and-dispatch-protocol.md
Related Issues: #3069, #3075, #3030, #3033, #3038, #3039, #3042
Last Reviewed: 2026-08-06
---

# Post-merge originating-agent remediation

## Purpose

Post-merge closeout exceptions are completion defects in the originating delivery. They are not backlog work and must not be reassigned to an unrelated implementation agent.

## Scope

This as-built records the operating rule for:

- identifying the originating implementation agent for a post-merge closeout exception;
- assigning and activating that exception on the matching `agent:*` label;
- pausing only that agent's next queued successor;
- requiring PR-record dispositions and bounded remediation PRs when repository content must change;
- WORK independent acceptance and automatic resumption after closeout.

It does not change Product, PR-approval, Production, or role-definition authority. Product Authority may explicitly reassign an Ops exception when the originating agent cannot complete PR remediation; that override must be recorded on the exception Issue.

## Current known truth

- Originating-agent ownership is the default for post-merge exceptions created against an implementation PR.
- WORK-authored errors remain WORK-owned unless Product Authority records an explicit reassignment.
- Issue comments and label mutations alone do not implement repository policy; code or documentation changes require a reviewed PR.
- Exception #3075 records the post-merge evidence gaps on WORK-authored PR #3073 (missing allowlist / required PR-body sections / outdated reviewer dispositions) and the as-built metadata gaps corrected by the #3075 remediation PR.
- Product Authority directed Cursor Local to remediate #3075 (and related Ops PR-body exceptions) on 2026-08-06 because WORK had not completed the PR-body and documentation remediation.

## Intended final state

- Every actionable post-merge exception is active on the correct originating agent (or an explicit Product Authority override).
- Required reviewer dispositions and verification/allowlist evidence live on the originating PR body before closeout replay.
- Repository policy changes land only through reviewed PRs.
- After WORK acceptance and exception closeout, the paused successor resumes automatically without a new dispatch.
- Exceptions do not accumulate as deferred cleanup backlog.

## Ownership rule

When CI creates a post-merge closeout exception for a merged pull request:

1. Determine the originating implementation agent from the PR branch, source-Issue handoff, and implementation evidence.
2. Assign the exception to that same agent using the matching `agent:*` label.
3. Set the exception to `status:active` immediately.
4. Pause only that agent's next assigned project task at `status:queued`.
5. Keep unrelated agent lanes executable.

An error created by WORK is owned and remediated by WORK. WORK must not transfer its correction burden to Cursor Local, Claude Code, or another delivery agent unless Product Authority records an explicit override on the exception Issue.

## Required remediation

The originating owner must:

- reconcile every reported reviewer comment and review thread;
- record explicit dispositions in the originating PR record where required;
- correct invalid verification or source-Issue linkage evidence;
- create a bounded remediation PR only when repository content, code, workflow, or documentation must change;
- post an implementation handoff and stop for independent review.

Issue comments and label mutations alone do not implement repository policy changes. Any code or documentation change requires a branch, commit, pull request, required checks, independent review, and merge before the source-Issue may be accepted as complete.

## Acceptance and resumption

WORK owns independent acceptance and terminal closeout of agent-created remediation. WORK may not independently approve protected work that WORK implemented.

After the exception is accepted and closed:

1. restore the paused task to its prior executable state;
2. preserve its existing branch, scope, and standing authority;
3. resume automatically without a new dispatch;
4. record the resumption on the source-Issue.

## Failure handling

Post-merge exceptions must not accumulate in a deferred cleanup queue. If an exception is actionable, it remains active until corrected or placed on an evidence-specific hold with an owner, release condition, and next review time.

A premature closeout is invalid. Reopen the source-Issue, restore active state, correct the repository through a reviewed PR, and repeat independent acceptance.

## Current application

- Claude Code exceptions: #3030 and #3042 (historical mapping from #3069).
- Cursor Local exceptions: #3033, #3038, and #3039 (historical mapping from #3069).
- WORK remediation source-Issue: #3069 (closed).
- Active Ops exception remediated under Product Authority override: #3075 (PR #3073 evidence + this as-built correction).

## Validation

The implementation that operationalizes this rule must test at minimum:

- Cursor-created PR routing;
- Claude-created PR routing;
- WORK-created error ownership;
- agent-specific successor pausing;
- unrelated-lane continuity;
- automatic successor resumption after acceptance;
- refusal to treat issue-only mutations as implementation of code or documentation changes.
