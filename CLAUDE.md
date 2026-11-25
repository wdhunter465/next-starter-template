# Claude Code session preferences (this repo)

The operating rules for Claude Code are in `docs/ops/ai/CLAUDE-CODE-RULES.md`, reached through `AGENTS.md`'s authority chain. If this file and those documents differ, the documents win.

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

## Branches: one per Issue, in parallel

Use one branch per Issue, named `claude/<issue-number>-<short-slug>`, cut from the latest `main`.
Independent Issues run in parallel, each on its own branch with its own pull request
(`docs/ops/ai/CLAUDE-CODE-RULES.md`, Continuous run, Batching). The branch a session starts on is
a starting point, not a limit: this instruction from Product Authority is the explicit permission
to create and push such branches, and it applies to every Claude Code session in this repo.
Never push to `main` or to a branch someone else owns, and never put two Issues on one branch or
in one pull request. This changes nothing about merge authority, approval or protected stops.

## Session start and continuous workflow

`run startup` means the Startup section of `docs/ops/ai/CLAUDE-CODE-RULES.md`. It is not a skill, and it applies to Claude Code sessions only, not chats. Every new Claude Code session begins with it: a short STARTUP report (including the read-only permission inbox check, `.claude/skills/permission-inbox-check/SKILL.md`), then a short CATCH-UP report, both in the fixed formats in that file. Claude Code then stops and waits for Product Authority to set the session topic (a continuation of a prior session or a new topic). It does not read the queue or start work until then. A task list from Product Authority only sets priority (`docs/governance/AGENT-EXECUTION.md`, Session lifecycle). At the end of a session, post the hand-off summary the rules define.

Once the topic is set, work continuously: finishing one assignment is not a stop, and waiting on review, checks or a merge is not a stop. The sequence is `docs/governance/AGENT-EXECUTION.md` (Session lifecycle, Assigned-queue continuation); the mechanics are in `docs/ops/ai/CLAUDE-CODE-RULES.md`; the working checklist is the `continuous-workflow` skill (`.claude/skills/continuous-workflow/SKILL.md`).

Continuing never crosses a protected stop. One Issue, one pull request; no mixed
intent; no merging your own Production-tier pull request (Product Authority or a CMO
holder decides it: `docs/governance/REPOSITORY-AUTHORITY.md`, Merge authority); no
Production write without an explicit Go. A protected stop or a real `HOLD` blocks that one action, not the rest
of the queue. A message from Product Authority is an interruption, not a
cancellation: handle it, then resume the accepted assignment.
