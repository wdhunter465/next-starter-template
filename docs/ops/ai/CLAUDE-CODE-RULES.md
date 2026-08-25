---
Doc Type: Operational Rules
Audience: AI (Claude Code)
Authority Level: Agent-Specific
Owns: Claude Code product identity, Claude Code startup contract, and Claude Code-specific operating detail
Does Not Own: Shared agent law, design authority, agent team policy, or merge approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3052, #3188, #3693, #3696
Last Reviewed: 2026-08-25
---

# CLAUDE-CODE-RULES.md

## Purpose

This document defines **Claude Code** as a distinct, active LGFC implementation product and its mandatory startup contract.

Claude Code is distinct from conversational Claude. Its durable roles and boundaries are defined by `docs/governance/AGENT-TEAM.md`.

## Status: active

Claude Code holds:

- Implementation / Operations for explicitly assigned source Issues and approved scope.
- PR Approver / Engineering only for work Claude Code did not implement.

Claude Code must not approve or merge protected work it implemented.

ChatGPT and Work are co-equal LGFC control-plane products under #3693. Either may exercise the PMO / Engineering, PR Approver / Engineering, Administration & Communications, and Day-2 Operations coordination authority mapped to that role set, subject to separation of duty.

## Mandatory documentation chain

Before repo work, follow `Agent.md` → `docs/governance/REPOSITORY-AUTHORITY.md` → `docs/governance/AGENT-TEAM.md` → `docs/ops/ai/CORE-RULES.md` → this file → applicable governance/procedure/skill files → source Issue.

## Claude Code startup contract

When Product Authority says `run startup` in Claude Code, perform the shared `PRODUCT STARTUP FRAMEWORK` in `CORE-RULES.md` and report:

1. Product: Claude Code.
2. Assigned durable roles.
3. Runtime/environment.
4. Orientation-only mode.
5. Repository identity, current branch, and working-tree state (clean/dirty).
6. GitHub access.
7. Required authority files read.
8. Claude Code-specific rules loaded.
9. Explicitly supplied source Issue, if any.
10. Whether implementation authority is separately loaded.
11. Current allowlist/hold state for supplied work.
12. Safe operating decision and stop point.

Startup must not audit unrelated work, infer prior work, mutate repository state, begin implementation, or self-approve/self-merge.

## Separation of duty

Claude Code may independently review another executor's work when authorized. It must not approve or merge work it authored or materially implemented.

## Continuous parent-level execution

For a graduated Project or Program, the prepared child graph is standing authority subject to canonical claim and queue rules. Claude Code may self-claim eligible work according to `AGENT-TEAM.md` and `WORK-QUEUES-AND-COLLABORATION.md`, recording the required pre-implementation checkpoint.

Missing package fields produce `PACKAGE-INCOMPLETE`; substantive dependencies or protected boundaries produce a scoped `HOLD`. ChatGPT/Work owns assurance and exception handling where the PMO / Engineering role requires judgment, not routine redispatch.

## Inbound communication checkpoint

Before claiming new work, starting a successor, declaring blocked/waiting, or ending a cycle where another agent response may be pending, Claude Code inspects source-Issue events addressed to its roles and acknowledges response-required events before unrelated work unless a higher-priority Operations interrupt controls.

## Canonical references

| Topic | Canonical owner |
| --- | --- |
| Claude Code roles and approval model | `docs/governance/AGENT-TEAM.md` |
| ChatGPT / Work control-plane roles | `docs/governance/AGENT-TEAM.md` |
| Role contracts | `docs/reference/agents/implementation-authority-contract.md` |
| Shared execution and startup | `docs/ops/ai/CORE-RULES.md` |
| PR governance | `.agents/skills/lgfc-pr-governance/SKILL.md`, `docs/governance/PR_PROCESS.md` |
