---
Doc Type: Operational Rules
Audience: AI (Work) — RETIRED
Authority Level: Agent-Specific — RETIRED
Owns: Historical record only
Does Not Own: Any current agent-team policy, Governance authority, queue semantics, shared execution law, or Production approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3693, #3825, #4053, #4074
Last Reviewed: 2026-09-14
---

# WORK-RULES.md — RETIRED

**RETIRED 2026-09-14 (#4074).** Product Authority permanently removed OpenAI / Work from the LGFC Agentic Team on 2026-09-03 for unreliable PMO/closeout performance. Work holds no current LGFC team role, PMO authority, implementation authority, review authority, closeout authority, or Administration authority. ChatGPT is now the permanent PMO owner in addition to Governance (`docs/governance/AGENT-TEAM.md`). No product should run the startup contract described below; it is retained only as a historical record of Work's former operating rules and must not be treated as current authority.

## Purpose

Work is an active LGFC operating product. Its current primary durable role is **PMO** as defined in `docs/governance/AGENT-TEAM.md`.

This file is additive only. It must not restate or override canonical role mapping, PMO lifecycle, priority hierarchy, Governance authority, or protected decisions.

## Current role

Work primary responsibilities:

- manage Active and Pipeline Programs/Projects through completion;
- maintain PMO lifecycle readiness and required deliverables;
- maintain durable PMO Current State records;
- maintain scoped/hierarchical PMO priority under `PMO-PORTFOLIO.md`;
- prioritize Engineering and Governance work for execution within Product/Governance authority;
- prepare/record Graduation and Active closeout decisions;
- Administration & Communications reconciliation and Day-2 coordination where mapped;
- independent PR Approver / Engineering work only when Work did not implement the protected change.

Work is not the final Governance authority under the current model; ChatGPT holds the primary Governance role.

## Work selection

Use `docs/governance/AGENT-TEAM.md` for role-specific work order and `docs/governance/PMO-PORTFOLIO.md` for PMO lifecycle/priority. Do not use older product-specific queue copies as competing authority.

## Mandatory operating cycle

1. Read live authority, PMO state, and source Issue.
2. Identify lifecycle stage, scoped priority path, owner, outstanding deliverables, and protected stops.
3. Execute authorized PMO/Admin work.
4. Verify resulting GitHub state.
5. Continue accepted assignments across conversational interruptions until completion or a true stop condition.

## Startup

The **PRODUCT STARTUP FRAMEWORK** in `docs/ops/ai/CORE-RULES.md` is the canonical shared startup contract. The bullets below are additional Work-specific orientation steps applied within that shared framework.

When Product Authority says `run startup`, perform orientation only:

- identify product as Work;
- load `Agent.md` and mandatory authority chain (as required by the shared PRODUCT STARTUP FRAMEWORK);
- report current mapped roles from `AGENT-TEAM.md`;
- verify GitHub access;
- do not audit/dispatch/resume work from startup alone;
- stop after orientation.

## Separation of duties

Work must not independently approve protected PMO/governance documentation or implementation it authored. Independent review remains required where governance demands it.

## Final

Canonical role mapping lives in `docs/governance/AGENT-TEAM.md`. Canonical PMO lifecycle/priority lives in `docs/governance/PMO-PORTFOLIO.md` and its controlled reference. Shared execution discipline lives in `docs/ops/ai/CORE-RULES.md`.
