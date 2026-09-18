---
Doc Type: Operations
Audience: AI agents and repository maintainers
Authority Level: Operational
Owns: Cross-agent operating rules and handoff expectations
Does Not Own: Canonical product design, source Issue scope, or CI implementation details
Canonical Reference: Agent.md
Last Reviewed: 2026-05-11
---

> **SUPERSEDED (#2823, 2026-09-17):** This document is historical/non-authoritative. It is not part of the canonical agent authority chain and must not be used for conflict resolution. Current authority: `Agent.md` (mandatory authority chain) → `docs/governance/REPOSITORY-AUTHORITY.md` (constitutional) → `docs/governance/AGENT-TEAM.md` → `docs/ops/ai/CORE-RULES.md`. Retained only as a historical record of prior cross-agent operating guidance.

# Cross-Agent Operating Rules

## Purpose

This document makes LGFC repository work repeatable across ChatGPT, Codex, Cursor, Copilot, Gemini, Cubic, Deepwiki, Semgrep, and future agents.

## Shared rules

All agents must follow the chain in [`Agent.md`](../../Agent.md) and the shared execution rules in [`docs/ops/ai/CORE-RULES.md`](../../docs/ops/ai/CORE-RULES.md).

In addition:

1. Read `Agent.md` first.
2. Use the relevant `.agents/skills/*/SKILL.md` file when the task matches a skill trigger.
3. Follow the source Issue exactly.
4. Preserve canonical design and governance references.
5. Keep diffs narrow and reviewable.
6. Run applicable checks.
7. Report limitations without guessing.

Do not duplicate shared law in agent-specific files; cross-link instead.

## Role mapping

- Design agents define scope and acceptance criteria.
- Execution agents edit files only within the approved scope.
- Verification agents check the diff, tests, docs, and policy compliance.
- Governance agents enforce Issue-first workflow, file allowlists, labels, and documentation authority.
- Troubleshooting agents isolate failure, prefer rollback-first correction, and document evidence.
- Worklist agents track status without changing product behavior.

## Handoff contract

A valid handoff includes:

- What changed.
- Why it changed.
- Source Issue.
- Files touched.
- Verification performed.
- Remaining risks.

## Drift control

If an agent finds useful but out-of-scope work, it must not include that work in the current PR. It must create or recommend a separate Issue instead.

## Enforcement

The repository enforces this structure through:

- Root `Agent.md`.
- Repo-scoped skill files.
- Agent governance checks.
- PR issue-accounting checks.
- Intent labels and file allowlists.
