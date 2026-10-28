# Claude Code session preferences (this repo)

The operating rules for Claude Code are in `docs/ops/ai/CLAUDE-CODE-RULES.md`, reached through `Agent.md`'s authority chain. If this file and those documents differ, the documents win.

## Pull requests: create ready for review, not draft

When opening a pull request in this repo, create it ready for review
(`draft: false`), not as a draft, so it's immediately visible to
reviewers instead of sitting in draft state.

This changes only the draft/ready flag at creation time. It does not
grant merge-readiness, skip required checks, or override any other PR
governance in this repo (protected-path review requirements, the Production-tier
merge prohibition, reviewer-lifecycle gate, issue-first requirements, etc.) —
a PR opened this way still must satisfy every canonical PR requirement
before it is actually mergeable.

## Session start and continuous workflow

Every new session begins with the Claude Code startup in `docs/ops/ai/CLAUDE-CODE-RULES.md`. It includes the read-only permission inbox check (`.claude/skills/permission-inbox-check/SKILL.md`). Startup is orientation only and stops; the run then continues from the ready queue in role order. No task list is required, and a list from Product Authority only sets priority (`docs/governance/AGENT-EXECUTION.md`, Session lifecycle).

After that, work continuously: finishing one assignment is not a stop, and waiting on review, checks or a merge is not a stop. The sequence is `docs/governance/AGENT-EXECUTION.md` (Session lifecycle, Assigned-queue continuation); the mechanics are in `docs/ops/ai/CLAUDE-CODE-RULES.md`; the working checklist is the `continuous-workflow` skill (`.claude/skills/continuous-workflow/SKILL.md`).

Continuing never crosses a protected stop. One Issue, one pull request; no mixed
intent; no merging a Production-tier pull request; no Production write without an
explicit Go. A protected stop or a real `HOLD` blocks that one action, not the rest
of the queue. A message from Product Authority is an interruption, not a
cancellation: handle it, then resume the accepted assignment.
