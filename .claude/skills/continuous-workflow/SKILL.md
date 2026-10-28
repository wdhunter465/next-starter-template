---
name: continuous-workflow
description: The LGFC continuous workflow for Claude Code in this repository. Use at the start of a session, after packaging any assignment, whenever a PR is waiting on review or merge, and at every safe task boundary, to pick the next eligible item without stopping.
---

# Continuous workflow (LGFC)

This skill is a working checklist, not policy. The definitions are:

- `docs/governance/AGENT-EXECUTION.md`: Session lifecycle, Assigned-queue continuation (#3605 / #3611), Accepted-assignment continuity (#3693), Continuous parent-level execution (#3055 / #3145), Mandatory stop conditions
- `docs/governance/AGENT-TEAM.md`: role work-selection order, protected stops, separation of duties
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`: Operations interrupt, claim lifecycle, dependency and stop taxonomy
- `docs/ops/ai/CLAUDE-CODE-RULES.md`: Claude Code's resume queue, claims, Operations monitoring and operating notes

If this file and those documents differ, the documents win. Process text names roles, not agents; look the role holders up in `AGENT-TEAM.md`.

## At every safe task boundary

1. **Package one Issue.** Open its pull request, or record a real `HOLD` or `PACKAGE-INCOMPLETE` on that Issue.
2. **Get the PR to ready-to-merge.** Merge it yourself only when it is non-production and every required check passes (`REPOSITORY-AUTHORITY.md`, Merge authority); leave the merge record the constitution defines. Never merge a Production-tier PR: leave it for the human approver and continue.
3. **Check the Operations interrupt**, then run the queue searches in order (`CLAUDE-CODE-RULES.md`, Continuous run).
4. **Start the next item that can move.** One Issue, one pull request; do not mix queue items into the PR just opened. Set the claim when you start; release it, with a note, when the Issue waits on someone else. An item that cannot move this tick gets a `wait:*` label and a comment naming the blocker and its release event, then you take the next one. Break a cycle with the smallest reversible action. When a wait ends, act on the result in the next pass. Never give a third identical status (`AGENT-EXECUTION.md`, A blocked head does not hold the queue).
5. **Return to a waiting PR only when** a check fails, a reviewer comments, or a post-merge failure opens.

A wake with no new events is not idle while eligible work remains. A protected stop or a real `HOLD` blocks that one action, not the rest of the queue. Waiting items (green PR, `handoff:ready`, `wait:*`) get follow-through only when nothing else can move.

## Stop immediately if

Authority conflicts, scope is unclear, repo state is unclear, the source Issue or the changed-file allowlist is missing, live PR state cannot be verified for a readiness claim, or Product Authority is being asked to relay routinely while GitHub communication is available.
