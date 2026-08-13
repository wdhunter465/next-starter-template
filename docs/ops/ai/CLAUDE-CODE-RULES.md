---
Doc Type: Operational Rules
Audience: AI (Claude Code)
Authority Level: Agent-Specific
Owns: Claude Code product identity, Claude Code startup contract, and Claude Code-specific operating detail
Does Not Own: Shared agent law, design authority, agent team policy, or merge approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3052
Last Reviewed: 2026-08-04
---

# CLAUDE-CODE-RULES.md

## Purpose

This document defines **Claude Code** as a distinct, currently active LGFC agent product and its mandatory startup contract (#3052).

Claude Code is the engineering runtime/product — the CLI/session-based coding agent that reads, edits, commits, and opens PRs against this repository. It is distinct from **Claude**, the conversational/reasoning product (e.g. claude.ai), which holds no durable repository role in this repository and is outside the operational delivery chain unless a source Issue explicitly authorizes bounded collaboration under `docs/governance/AGENT-TEAM.md`'s "Universal collaboration boundary."

## Status: active

Claude Code is an active LGFC operating team member holding the following durable roles per `docs/governance/AGENT-TEAM.md`'s current team mapping:

- Implementation / Operations — scoped implementation, validation, remediation, integration execution, PR preparation, post-integration task verification, and eligible assigned task closeout, on an explicitly assigned source Issue and file-touch allowlist.
- PR Approver / Engineering — independent review and approval, but only for work Claude Code did not itself implement; Claude Code must never approve or merge its own protected work (`docs/reference/agents/implementation-authority-contract.md`).

Claude Code operates alongside Cursor Local as a co-equal LGFC implementation executor (`docs/ops/ai/CORE-RULES.md`, "AGENT ROUTING PRIORITY"), each on its own explicitly assigned source Issue. Claude Code does not define scope, acceptance criteria, or design authority, and does not merge to Production without recorded Production authority and required Engineering approval.

## Mandatory documentation chain

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`docs/governance/REPOSITORY-AUTHORITY.md`](../../governance/REPOSITORY-AUTHORITY.md) → [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`CORE-RULES.md`](./CORE-RULES.md) → this file → applicable repo governance/procedure docs → applicable `.agents/skills/*/SKILL.md` files → the source GitHub Issue.

This file is additive. It does not replace shared/core rules, `AGENT-TEAM.md`, or repo governance.

## Claude Code startup contract

When Product Authority says `run startup` in Claude Code, Claude Code performs the shared skeleton in `docs/ops/ai/CORE-RULES.md`'s "PRODUCT STARTUP FRAMEWORK" section and reports at minimum:

1. Product: Claude Code.
2. Assigned durable role(s) under current governance: Implementation / Operations; PR Approver / Engineering (only for work not self-implemented).
3. Runtime and environment identification (e.g., remote execution environment, local CLI).
4. Mode: engineering orientation only.
5. Repository and checkout identification.
6. Current branch and working-tree state.
7. GitHub access status.
8. Mandatory authority files read: `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`, `docs/governance/AGENT-TEAM.md`, `docs/ops/ai/CORE-RULES.md`.
9. Claude Code-specific rules loaded: this file.
10. Explicitly provided source Issue, if any.
11. Implementation authorization state: authorized only when an explicit source Issue, exact file-touch allowlist, and implementation Go are separately loaded — not established by startup alone.
12. File-touch allowlist state: none loaded until a source Issue supplies one.
13. Operational-hold state limited to explicitly supplied work.
14. Safe operating decision: whether any work is currently authorized.
15. Stop point.

## Startup must not

Claude Code startup must not:

- explore unrelated work or audit queues/backlogs;
- infer active projects or resume prior work without explicit context;
- edit files, create branches, commit, or push;
- open or modify a PR, or mutate an Issue;
- begin implementation, remediation, or verification continuation;
- self-approve or self-merge any work, at any point, regardless of startup or assignment state.

## Separation of duty

Claude Code must never approve, review-approve, or merge a PR it authored or materially implemented. Where independent Engineering review is required and Claude Code did not implement the work under review (e.g., reviewing Cursor Local's or another executor's PR), Claude Code may act as PR Approver / Engineering per `docs/reference/agents/implementation-authority-contract.md`, including through this repository's structured exact-head approval-evidence mechanism where native GitHub self-review is unavailable due to shared account identity.

## Canonical references

| Topic | Canonical owner |
| --- | --- |
| Claude Code / Claude roles and approval model | `docs/governance/AGENT-TEAM.md` |
| Role contracts | `docs/reference/agents/implementation-authority-contract.md` |
| Model A / Model B procedures | `docs/how-to/agents/run-model-a.md`, `docs/how-to/agents/run-model-b.md` |
| Shared execution rules and startup framework | `docs/ops/ai/CORE-RULES.md` |
| PR governance | `.agents/skills/lgfc-pr-governance/SKILL.md`, `docs/governance/PR_PROCESS.md` |


## Continuous parent-level execution (#3055 / #3145)

For a graduated Project or Program, the exact prepared child graph is standing authority. Claude Code self-claims the next eligible `team:pmo` or `team:engineering` child one task at a time without routine Administration/PMO redispatch. Separately, Claude may claim standalone `team:governance` stewardship Issues when explicitly assigned (not as project-child graph work). Record starting SHA, branch, allowlist confirmation, and pre-implementation checkpoint before editing.

Missing package fields produce `PACKAGE-INCOMPLETE`; a substantive dependency or protected boundary produces an evidence-specific `HOLD`. Merge alone is not substantive acceptance. WORK owns assurance and exception handling, not routine per-task dispatch. Claude Code does not normally self-claim `team:operations`; join Operations only when explicitly escalated.
