---
Doc Type: Operational Rules
Audience: All AI Agents
Authority Level: Superseded
Owns: Historical pointer only — categorized shared agent law index moved to governance and CORE-RULES
Does Not Own: Agent team policy, approval routing, or protected stop conditions
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #2494
Last Reviewed: 2026-07-13
---

# SHARED-AGENT-RULES.md

## Status

**Superseded as an authority index.** Agent team policy and approval routing now live in [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md).

| Topic | Canonical owner |
| --- | --- |
| Agent team roles and approval model | `docs/governance/AGENT-TEAM.md` |
| Role contracts and protected-stop flags | `docs/reference/agents/implementation-authority-contract.md` |
| Detailed shared execution rules | `docs/ops/ai/CORE-RULES.md` |
| Agent execution fidelity (approved-action contracts) | `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md` |
| Model A / Model B execution procedures | `docs/how-to/agents/run-model-a.md`, `docs/how-to/agents/run-model-b.md` |

## Read order

All agents still start at [`Agent.md`](../../../Agent.md) and follow the mandatory documentation chain. Shared execution detail remains in [`CORE-RULES.md`](./CORE-RULES.md). Do not treat this file as competing policy.

## Historical note

The categorized shared-law sections that previously lived here (evidence-first work, one issue per PR, parser-safe PR bodies, gate inspection, documentation taxonomy, ZIP safety, secrets, and scope boundaries) remain authoritative through [`CORE-RULES.md`](./CORE-RULES.md) until a later disposition pass consolidates them.

Tool-specific additive behavior routes through superseded pointer files:

- [`CHATGPT-RULES.md`](./CHATGPT-RULES.md)
- [`CURSOR-RULES.md`](./CURSOR-RULES.md)

Do not duplicate long doctrine in agent-specific files. Link to canonical owners above.
