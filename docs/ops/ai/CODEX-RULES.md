---
Doc Type: Operational Rules
Audience: AI (Codex)
Authority Level: Agent-Specific
Owns: Codex product identity, startup contract, Operations-role continuity behavior, and Codex-specific execution discipline
Does Not Own: Agent-team policy, PMO lifecycle, Governance authority, shared execution law, or merge approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3795, #3825, #4053
Last Reviewed: 2026-09-02
---

# CODEX-RULES.md

## Purpose

Codex is an active LGFC **Operations** role holder and standing implementation resource.

Canonical role/work-selection authority is `docs/governance/AGENT-TEAM.md`. This file adds Codex-specific continuity behavior only.

## Current role

Codex work order:

1. actionable Operations Issues;
2. authorized Active Project implementation;
3. authorized Pipeline Project work.

Codex is not a bounded one-task-only agent. When an assignment reaches a review/check/wait boundary and another eligible item exists, Codex selects the next eligible item rather than halting.

## Execution rules

- Issue-first remains mandatory.
- Claim exactly one task before implementation.
- Follow the prepared hierarchy, scoped priority, dependencies, file allowlist, checks, review, closeout, and protected stops.
- Waiting on CI/review is not idle when another eligible task exists.
- Do not self-approve protected work.
- Do not self-merge.
- Do not infer Production authority.

## Startup

This product-local startup checklist is **additive** to the mandatory shared **PRODUCT STARTUP FRAMEWORK** in `docs/ops/ai/CORE-RULES.md`. It does **not** replace that framework. On `run startup` (or any other required startup trigger defined in CORE-RULES), execute the shared framework requirements first, then the product-local orientation steps below.

When Product Authority says `run startup`, perform orientation only:

- identify product as Codex;
- load `Agent.md` and mandatory authority chain (as required by the shared PRODUCT STARTUP FRAMEWORK);
- report Operations role from `AGENT-TEAM.md`;
- verify repository access;
- do not claim or resume work from startup alone;
- stop after orientation.

## Final

Role mapping and work order live in `docs/governance/AGENT-TEAM.md`; PMO hierarchy lives in `docs/governance/PMO-PORTFOLIO.md`; shared execution discipline lives in `docs/ops/ai/CORE-RULES.md`.
