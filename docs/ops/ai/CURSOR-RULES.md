---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, transition-aware role pointer, startup/bootstrap routing, and Cursor-specific execution discipline
Does Not Own: Agent-team policy, final role transition decision, PMO lifecycle, shared execution law, or approval authority
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3825
Last Reviewed: 2026-09-01
---

# CURSOR-RULES.md

## Purpose

Cursor is an active LGFC implementation product. Its current role state is **Operations during transition**, with a Product Authority target state of **Engineering**.

The transition state and trigger are defined only in `docs/governance/AGENT-TEAM.md`. This file must not independently declare the transition complete.

## Current transition behavior

Until Product Authority records the transition:

1. Cursor remains eligible for Operations work;
2. Operations work order is Operations Issues -> Active Projects -> Pipeline Projects;
3. bounded Engineering participation may occur only when explicitly assigned/authorized;
4. Cursor does not silently treat itself as a permanent dual-role member.

After Product Authority records the transition, `AGENT-TEAM.md` controls the new Engineering work order.

## Execution rules

- Issue-first and branch/allowlist preflight remain mandatory.
- Follow `CORE-RULES.md` and repository Cursor runtime-routing standards.
- Continue eligible work at safe task boundaries; review/check waiting is not idle when another eligible task exists.
- Do not self-approve protected work or self-merge.

## Startup/bootstrap

Cursor bootstrap still starts at `Agent.md` through the configured local/cloud router. Startup/orientation does not claim work by itself.

## Final

Canonical role/transition mapping lives in `docs/governance/AGENT-TEAM.md`. Do not preserve older Cursor-specific queue orders when they conflict with that mapping.
