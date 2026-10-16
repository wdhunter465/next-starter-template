---
Doc Type: Governance / Process
Audience: Human + AI Agents
Authority Level: Governance
Owns: Ready-for-review handoff requirements for pull requests
Does Not Own: General PR lifecycle state-machine rules, CI implementation, merge authority (owned by `docs/governance/REPOSITORY-AUTHORITY.md`), or post-merge automation behavior
Canonical Reference: /docs/governance/PR_LIFECYCLE_STATE_MACHINE.md
Last Reviewed: 2026-10-16
---

# PR Ready-for-Review Handoff Requirement

## Rule

A pull request is opened ready for review and stays that way (`docs/governance/REPOSITORY-AUTHORITY.md`, Pull-request readiness). Draft is not a working state. A PR that is not ready is not yet a PR: the work stays on its branch.

## Required behavior

Before reporting a PR as complete, ready, handed off, or awaiting review, the responsible agent confirms GitHub shows the PR as open and not Draft.

If GitHub shows Draft, the agent uses GitHub's **Ready for review** transition, or closes the PR and keeps the work on the branch with the blocker recorded on the source Issue.

Opening a PR, updating the PR body, running checks, or saying the PR is ready is not sufficient if GitHub still shows the PR as Draft.

## Required handoff line

Every PR handoff must report the actual GitHub state:

```text
GitHub PR state: ready for review / merged / closed
```

## Failure condition

If an agent reports a PR as ready for review while GitHub shows it as Draft, the handoff is invalid and must be corrected before any approval or merge.
