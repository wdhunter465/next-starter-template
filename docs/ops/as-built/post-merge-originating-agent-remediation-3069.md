---
Doc Type: AS-BUILT
Audience: Human + AI
Authority Level: Operational Implementation Record
Owns: Deterministic ownership, interruption, remediation, acceptance, and resumption rules for post-merge closeout exceptions
Does Not Own: Product decisions, PR approval, Production authorization, or agent role definitions
Canonical Reference: /docs/ops/pmo/github-issue-closeout-protocol.md
Related Issues: #3069, #3075, #3030, #3033, #3038, #3039, #3042
Last Reviewed: 2026-08-14
---

# Post-merge originating-agent remediation

## Purpose

Post-merge closeout exceptions are completion defects in the originating delivery. They are not backlog work and must not be reassigned to an unrelated implementation agent.

## Scope

This as-built records the operating rule for:

- identifying the originating implementation agent for a post-merge closeout exception;
- creating a new exception Issue in the same original-delivery lineage;
- assigning and activating that exception on the matching `agent:*` label without `handoff:ready` re-entry;
- pausing only that agent's next queued successor;
- re-entering the same post-merge verification/closeout workflow after every remediation merge;
- repeating exception → remediation → merge → same post-merge checks with no arbitrary retry limit until the original source Issue is cleanly closed;
- WORK independent acceptance and automatic successor resumption after clean terminal closeout.

PMO process authority for the cycle is `docs/ops/pmo/github-issue-closeout-protocol.md`. Dispatcher rules are `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`.

It does not change Product, PR-approval, Production, or role-definition authority. Product Authority may explicitly reassign an Ops exception when the originating agent cannot complete PR remediation; that override must be recorded on the exception Issue.

## Current known truth

- Originating-agent ownership is the default for post-merge exceptions created against an implementation PR.
- WORK-authored errors remain WORK-owned unless Product Authority records an explicit reassignment.
- Issue comments and label mutations alone do not implement repository policy; code or documentation changes require a reviewed PR.
- Exception #3075 records the post-merge evidence gaps on WORK-authored PR #3073 (missing allowlist / required PR-body sections / outdated reviewer dispositions) and the as-built metadata gaps corrected by the #3075 remediation PR.
- Product Authority directed Cursor Local to remediate #3075 (and related Ops PR-body exceptions) on 2026-08-06 because WORK had not completed the PR-body and documentation remediation.

## Intended final state

- Every actionable post-merge exception is a new Issue in the original delivery lineage, active on the correct originating agent (or an explicit Product Authority override).
- Required reviewer dispositions and verification/allowlist evidence live on the originating PR body before closeout replay.
- Repository policy changes land only through reviewed PRs.
- Remediation merge re-enters the same post-merge verification/closeout workflow. Another exception repeats the same cycle; there is no one-pass completion.
- The original source Issue cannot reach valid terminal completion while any exception in its chain remains unresolved.
- After clean terminal closeout, the paused successor resumes automatically without a new dispatch.
- Exceptions do not accumulate as deferred cleanup backlog or `handoff:ready` competition.

## Closed-loop cycle

`source Issue claimed → implementation → pull request → merge → post-merge verification/closeout`

- **Clean:** reconcile/close the original source Issue; resume the paused successor automatically.
- **Exception:** create a new exception Issue; keep the same originating owner; remediate; merge the remediation PR; re-run the same post-merge verification/closeout workflow; if verification fails again, create another new exception Issue in the same lineage and repeat until clean.

There is no PMO/Bill reassignment step inside this cycle when originating ownership is known. `handoff:ready` is a normal queue-entry/claim mechanism and is not reintroduced for exception work inside an already-owned cycle.

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

Post-merge exceptions must not accumulate in a deferred cleanup queue and must not become new general-queue work. If an exception is actionable, it remains active on the originating agent until corrected or placed on an evidence-specific hold with an owner, release condition, and next review time.

A premature closeout of the original source Issue is invalid while any exception in its remediation chain remains unresolved. Restore active state on the original source Issue if it was closed early, correct the repository through a reviewed PR, re-enter the same post-merge verification/closeout workflow, and repeat independent acceptance until the original source Issue is completely and properly resolved.

## Current application

- Claude Code exceptions: #3030 and #3042 (historical mapping from #3069).
- Cursor Local exceptions: #3033, #3038, and #3039 (historical mapping from #3069).
- WORK remediation source-Issue: #3069 (reopened 2026-08-14 for recursive-cycle proof after PR #3460 routing-only closeout).
- Active Ops exception remediated under Product Authority override: #3075 (PR #3073 evidence + this as-built correction).
- Regression that proved routing-only closeout is insufficient: #3458 (PR #3457 / #3459).

## Validation

The implementation that operationalizes this rule must test at minimum:

- Cursor-created PR routing;
- Claude-created PR routing;
- WORK-created error ownership;
- agent-specific successor pausing;
- unrelated-lane continuity;
- a two-or-more-exception sequence in the same original-delivery lineage with the same originating owner;
- withholding original source-Issue terminal closeout while any exception in that chain remains open;
- automatic successor resumption only after the original source Issue reaches clean terminal closeout;
- refusal to treat issue-only mutations as implementation of code or documentation changes;
- refusal to reintroduce `handoff:ready` or ChatGPT/Bill owner-assignment when originating ownership is determinable.
