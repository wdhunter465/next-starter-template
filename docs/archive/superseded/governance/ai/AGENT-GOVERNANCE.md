---
Doc Type: Archived Governance
Audience: AI agents and repository maintainers
Authority Level: Historical
Owns: Historical cross-agent governance record only
Does Not Own: Current agent-team policy, repository authority, or a second governance standard
Canonical Reference: /docs/governance/AGENT-TEAM.md
Archived From: /governance/ai/AGENT-GOVERNANCE.md
Archived Reason: Superseded by #2823; archived under #3155 without authoring a replacement standard
Last Reviewed: 2026-09-27
---

> **SUPERSEDED (#2823, 2026-09-17):** This document is historical/non-authoritative. It is not part of the canonical agent authority chain and must not be used for conflict resolution. Current authority: `Agent.md` (mandatory authority chain) → `docs/governance/REPOSITORY-AUTHORITY.md` (constitutional) → `docs/governance/AGENT-TEAM.md` → `docs/ops/ai/CORE-RULES.md`. Retained only as a historical record of prior cross-agent governance rules.

# Agent Governance

## Purpose

This document defines the longer-form operating rules for agents working in the LGFC repository. The root `Agent.md` file remains the single agent entry point and routing file.

## Authority order — superseded, historical only

This section previously defined a standalone conflict-resolution order that never referenced `docs/governance/REPOSITORY-AUTHORITY.md` and competed with `Agent.md`'s "Mandatory authority chain." It is retired. For current authority order, see `Agent.md`'s "Mandatory authority chain" section — do not resolve conflicts using the list that previously appeared here.

## Agent operating model

Agents must:

- Work from one source issue.
- Keep scope narrow.
- Use the relevant repository skill before implementation.
- Preserve existing repository conventions.
- Avoid mixed-intent diffs.
- Prefer small PRs over broad PRs.
- Provide verification evidence.
- Avoid unapproved runtime, design, route, or architecture changes.

## Forbidden behavior

Agents must not:

- Create any branch, commit, or PR without a pre-existing open governing source Issue (issue-first hard gate; no operations, incident, CI, or emergency exceptions).
- Treat umbrella trackers as task authority.
- Invent requirements not present in the repository.
- Modify unrelated files opportunistically.
- Introduce secrets or local-only files.
- Commit ZIP files, build output, screenshots, or temporary artifacts.
- Claim verification that was not performed.

## Required handoff

Every agent handoff must state:

- Source issue.
- Files changed.
- Skill or governance path used.
- Verification commands run.
- Result summary.
- Known limitations.
