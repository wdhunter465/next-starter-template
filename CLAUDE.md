# Claude Code session preferences (this repo)

## Pull requests: create ready for review, not draft

When opening a pull request in this repo, create it ready for review
(`draft: false`), not as a draft, so it's immediately visible to
reviewers instead of sitting in draft state.

This changes only the draft/ready flag at creation time. It does not
grant merge-readiness, skip required checks, or override any other PR
governance in this repo (protected-path review requirements, self-merge
prohibition, reviewer-lifecycle gate, issue-first requirements, etc.) —
a PR opened this way still must satisfy every canonical PR requirement
before it is actually mergeable.

## Continuous workflow

Work continuously. Finishing one assignment is not a stop, and waiting on review,
checks or a merge is not a stop. Details are in the `continuous-workflow` skill
(`.claude/skills/continuous-workflow/SKILL.md`). The authoritative definitions are
`docs/governance/AGENT-EXECUTION.md` (assigned-queue continuation, accepted-assignment
continuity), `docs/governance/AGENT-TEAM.md` and
`docs/governance/WORK-QUEUES-AND-COLLABORATION.md`. If this section and those
documents differ, the documents win.

1. Package one Issue: open its pull request, or record a real `HOLD` or
   `PACKAGE-INCOMPLETE` on that Issue.
2. Leave the pull request for review. Do not merge it.
3. Work all queues (Operations, Engineering, Governance, PMO Active and Pipeline),
   in the priority order `docs/governance/AGENT-TEAM.md` gives Claude Code's roles
   (read through `Agent.md`'s authority chain): Operations interrupts and own failing
   PRs first, then Engineering Issues, Active Projects, Governance Issues and
   Pipeline Projects, plus PMO Admin duties. Operations and Governance are secondary
   roles, so take them when higher-priority work is waiting or blocked. Cursor works
   the same queues in its own order; that is how work balances. Start the next
   eligible item, taking only Issues Claude Code owns or can claim without colliding
   with another agent's claim.
   Claim an Issue (`agent:claude`) only when starting work on it, and release the
   claim when it waits on a review, a Product Authority decision or another agent.
   Never hold a claim on an Issue nobody is working: an unclaimed Issue lets Cursor
   and other agents finish the repository's work. A Product Authority reservation is
   released only by Product Authority.
4. Come back to a waiting pull request only when a check fails, a reviewer comments,
   or a post-merge failure opens.

Continuing never crosses a protected stop. One Issue, one pull request; no mixed
intent; no self-merge; no Production write without an explicit Go. A protected stop
or a real `HOLD` blocks that one action, not the rest of the queue. A message from
Product Authority is an interruption, not a cancellation: handle it, then resume the
accepted assignment.
