---
Doc Type: Operational Rules
Audience: AI (Work); Chat, informationally
Authority Level: Superseded
Owns: Historical pointer only — product renamed to Work, see WORK-RULES.md
Does Not Own: Agent team policy, approval routing, or shared execution law
Canonical Reference: /docs/ops/ai/WORK-RULES.md
Related Issues: #2494, #3052
Last Reviewed: 2026-08-04
---

# CHATGPT-RULES.md

## Status

**Superseded and renamed.** The product previously referred to generically as `ChatGPT` in this repository's role assignments is `Work`. Its current startup contract, role mapping, and operating detail live in [`WORK-RULES.md`](./WORK-RULES.md) and [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) (#3052).

Ordinary conversational Chat (the same underlying model family used outside the Work product) holds no durable repository role, has no `run startup` contract, and is outside the operational delivery chain — it must state this plainly if asked to perform repository work.

| Topic | Canonical owner |
| --- | --- |
| Work roles and approval model | `docs/governance/AGENT-TEAM.md` |
| Work startup contract | `docs/ops/ai/WORK-RULES.md` |
| Role contracts | `docs/reference/agents/implementation-authority-contract.md` |
| Model A / Model B procedures | `docs/how-to/agents/run-model-a.md`, `docs/how-to/agents/run-model-b.md` |
| Shared execution rules and startup framework | `docs/ops/ai/CORE-RULES.md` |
| Cursor handoff workflow | `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` |

## Read order

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`CORE-RULES.md`](./CORE-RULES.md) → [`WORK-RULES.md`](./WORK-RULES.md) → applicable repo governance and skills.

This file is a superseded pointer. It does not replace governance, shared/core rules, `WORK-RULES.md`, or repo governance.

## Historical note

Detailed historical ChatGPT control-plane behavior (evidence posture, launch-readiness templates, operating-cycle steps, and communication rules not restated in `WORK-RULES.md`) remains in repository history and supporting ops docs until archived in a later disposition pass. For current work, apply [`AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) first, then [`CORE-RULES.md`](./CORE-RULES.md), then [`WORK-RULES.md`](./WORK-RULES.md).
