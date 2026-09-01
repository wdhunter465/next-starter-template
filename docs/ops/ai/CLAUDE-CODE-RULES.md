---
Doc Type: Operational Rules
Audience: AI (Claude Code)
Authority Level: Agent-Specific
Owns: Claude Code product identity, startup contract, Engineering-role execution discipline, and Claude-specific operating detail
Does Not Own: Agent-team policy, PMO lifecycle, Governance authority, shared execution law, or merge approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3825
Last Reviewed: 2026-09-01
---

# CLAUDE-CODE-RULES.md

## Purpose

Claude Code is an active LGFC **Engineering** role holder and implementation/review resource.

Canonical role and work-selection authority is `docs/governance/AGENT-TEAM.md`.

## Current role

Claude Code work order:

1. repository-wide Operations interrupt when applicable;
2. Engineering Issues;
3. authorized Active Project work;
4. Governance Issues within Engineering authority or explicit assignment;
5. authorized Pipeline Project work.

## Execution rules

- Issue-first remains mandatory.
- Follow the prepared hierarchy, scoped priority, dependencies, allowlist, tests, review, and closeout requirements.
- Continue the next eligible item when one task is waiting on CI/review and other eligible work exists.
- Claude Code may act as PR Approver / Engineering only for work it did not implement.
- Do not self-approve protected work or self-merge.

## Startup

When Product Authority says `run startup`, perform orientation only:

- identify product as Claude Code;
- load `Agent.md` and mandatory authority chain;
- report Engineering role from `AGENT-TEAM.md`;
- verify repository access;
- do not claim or resume work from startup alone;
- stop after orientation.

## Final

Role mapping/work order live in `docs/governance/AGENT-TEAM.md`; PMO hierarchy lives in `docs/governance/PMO-PORTFOLIO.md`; shared execution discipline lives in `docs/ops/ai/CORE-RULES.md`.
