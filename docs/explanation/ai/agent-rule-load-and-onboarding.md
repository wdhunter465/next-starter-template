---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: The minimum read path and the human-versus-agent route for #2088
Does Not Own: The text of mandatory safety rules, CI behavior, or a second copy of the authority chain
Canonical Reference: /Agent.md
Related Issues: #2088
Last Reviewed: 2026-09-27
---

# Agent rule load and human onboarding

Agents and humans do not read the same stack, and neither reads every governance file. `Agent.md` already owns the mandatory chain, the task-scoped read order, and the startup stop. This file routes to that chain. It does not weaken it and it does not restate it.

## Minimum agent path

Read in this order, then stop unless the task's canonical reference names another file:

1. `Agent.md`
2. The role record in `docs/governance/AGENT-TEAM.md`
3. The product rules file `Agent.md` names for the active product
4. The one canonical document the source Issue names for the task

Do not load retired product rules (`CHATGPT-RULES.md`, `CODEX-RULES.md`, `WORK-RULES.md`) as current instructions. They are historical.

## Optional layer

Read these only when the source Issue or the canonical reference points at them:

- `docs/governance/REPOSITORY-AUTHORITY.md` when authority level is in dispute
- `docs/governance/PMO-PORTFOLIO.md` when the task is PMO lifecycle or priority
- `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md` when the task is pull-request state
- The design standard or auth model when the task changes a product invariant
- A how-to when the task is a procedure rather than a rule

## Human route

A person onboarding to the repository reads:

1. `context.md` for orientation only
2. `README.md` for how to enter the repository
3. `Agent.md` only if they will direct or review agent work

Humans do not need the agent product-rule files unless they are reviewing that product's startup behavior.

## Stop and escalation

The stop rules stay in `Agent.md` and `docs/ops/ai/CORE-RULES.md`. Startup remains orientation-only. A missing source Issue, a missing allowlist, or a conflict between this file and `Agent.md` stops the agent. `Agent.md` wins.

## What this file does not change

`Agent.md`, `AGENTS.md`, and the product rule files stay the rule surfaces. This explanation does not add a parallel checklist and does not change CI.
