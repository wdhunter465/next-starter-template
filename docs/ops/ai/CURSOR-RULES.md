---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Superseded
Owns: Historical pointer only — Cursor implementation policy moved to governance
Does Not Own: Agent team policy, runtime routing standard, or shared execution law
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #2494, #2564, #3212, #3424, #3188
Last Reviewed: 2026-08-18
---

# CURSOR-RULES.md

## Status

**Superseded for agent team and approval policy.** Cursor implementation authority, continuous execution boundaries, and no-self-approval rules now live in [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md).

| Topic | Canonical owner |
| --- | --- |
| Cursor roles and stop conditions | `docs/governance/AGENT-TEAM.md` |
| Role contracts and protected stops | `docs/reference/agents/implementation-authority-contract.md` |
| Model A / Model B procedures | `docs/how-to/agents/run-model-a.md`, `docs/how-to/agents/run-model-b.md` |
| Runtime routing | `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` |
| Shared execution rules | `docs/ops/ai/CORE-RULES.md` |
| Cursor handoff and wake | `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`, `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md` (primary); Cursor Local Bridge is decommissioned (`docs/reference/ci/cursor-local-bridge-contract.md`); `docs/how-to/cursor/github-poll-wake-loop.md` (retired archive) |
| Cursor Local operator runbook | `docs/how-to/cursor/local-environment-and-agent-runbook.md` |

## Read order

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) → [`CORE-RULES.md`](./CORE-RULES.md) → this pointer → applicable repo governance and skills.

Cursor is the **sole LGFC implementation executor**. Cursor must not self-approve, merge its own assigned PRs, or treat routine Bill approval as required between implementation Go and PR review on Model B child work.

## Historical note

Detailed Cursor-specific sections (pre-implementation package review steps, thread discipline, analysis-first rule, git/push boundaries, GitHub API budget discipline) remain in repository history until archived. For current work:

- pre-implementation review → `docs/governance/AGENT-TEAM.md` launch-control requirements and `docs/templates/agent-assignment-template.md`
- continuous execution without routine Bill stops → `docs/how-to/agents/run-model-b.md`
- runtime selection → `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`
- mandatory Git / branch / PR authority fields (working branch, base/target, create/commit/push/PR authorization, PR target and initial state, post-PR continuation, self-approval/self-merge/`main`-promotion prohibitions, and local-only vs branch/PR delivery class) → `docs/templates/agent-assignment-template.md` section 3 required-fields table and the Git/PR fields in the mandatory template block

Binding runtime policy: [`docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`](../../governance/standards/CURSOR-RUNTIME-ROUTING.md).

Cursor must not treat narrative prose as Git or PR authority. If required Git/PR authority fields are missing from an implementation assignment, stop and request a complete assignment envelope.


## Continuous parent-level execution (#3055 / #3145)

For a graduated Project or Program, the exact prepared child graph is standing authority. Cursor self-claims the next eligible `team:operations` or `team:pmo` child one task at a time without routine Administration/PMO redispatch. Separately, Cursor also self-claims eligible standalone `team:governance` stewardship Issues (not project-child graph work). Record starting SHA, branch, allowlist confirmation, and pre-implementation checkpoint before editing.

Missing package fields produce `PACKAGE-INCOMPLETE`; a substantive dependency or protected boundary produces an evidence-specific `HOLD`. Merge alone is not substantive acceptance. WORK owns assurance and exception handling, not routine per-task dispatch. Cursor is not a normal Engineering executor. Governance stewardship is a normal Cursor queue and is not an Operations interrupt.

## Inbound communication checkpoint (#3188)

Before claiming new work, starting a successor, declaring blocked or waiting, or ending a cycle where another agent may be pending, Cursor inspects source-Issue events addressed to Implementation / Operations. Acknowledge response-required events on that Issue before unrelated work, unless a numbered Operations interrupt has precedence. Do not ask Product Authority to relay routine messages when GitHub communication is available. Canonical detail: `docs/ops/ai/CORE-RULES.md`.
