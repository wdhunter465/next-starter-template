---
Doc Type: Governance
Audience: AI agents and repository maintainers
Authority Level: Operational
Owns: Cross-agent governance rules for LGFC repository work
Does Not Own: Canonical product design, runtime architecture, or PR template structure
Canonical Reference: Agent.md
Last Reviewed: 2026-06-02
---

# Agent Governance

## Purpose

This document defines the longer-form operating rules for agents working in the LGFC repository. The root `Agent.md` file remains the single agent entry point and routing file.

## Authority order

Agents must resolve conflicts in this order:

1. Locked governance / design / platform documents.
2. `Agent.md` navigation and skill routing.
3. `docs/ops/ai/SHARED-AGENT-RULES.md` categorized shared agent law.
4. `docs/ops/ai/CORE-RULES.md` detailed execution rules.
5. Source issue scope.
6. Task-specific implementation plan or queue issue.
7. Repository skill files under `.agents/skills/`.
8. Cross-agent operational guidance under `governance/` and `ops/`.
9. Historical thread logs and tracker context.

Tracker files are historical/status indexes. They may be read for verification when relevant, but they are not task authority for normal implementation work unless the source issue explicitly scopes tracker governance, tracker reconciliation, or status-index maintenance.

When sources conflict, use the higher authority and document the conflict in the PR.

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
