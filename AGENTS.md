---
Doc Type: Entry / Control File
Audience: Human + AI
Authority Level: Navigation
Owns: Read order, authority routing, lane/profile identification, execution entry point
Does Not Own: Role policy, execution rules, design authority, communication policy, delivery policy, or governance decisions
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2640, #2641, #2686, #2690, #2794, #3052, #3138, #3142, #3693, #3755, #3815, #4126, #4173, #4716
Last Reviewed: 2026-11-20
---

# AGENTS.md

Purpose: **Mandatory starting point and routing authority** for all AI agents. No agent may begin repository work without reading this file first.

This file is navigation only. It does not grant implementation, approval, Production, recovery, or administrative authority.

Product Authority directed (#2794) that this all-caps filename is the single repository entry/control file. Tools that auto-discover `AGENTS.md` load this same authority. It does not grant Cursor-only authority to ChatGPT, Claude Code, Copilot, Grok, or any other product.

When a Cloud Agent session loads this file, the bootstrap is not complete until the agent has read the canonical chain below.

Do not merely report that these files are required. Read them before making any repo-work, readiness, implementation, or PR-governance claim.

## Cursor session bootstrap

Cursor bootstrap pointers point here and to canonical governance. They do not replace this file.

- Local sessions: `.cursor/rules/*.mdc` (always-applied minimal pointer to this file)
- Cloud sessions: this file (`AGENTS.md`)
- Verification: `docs/how-to/cursor/agent-session-bootstrap.md`

## Cursor runtime boundary

LGFC implementation defaults to local Cursor unless the source Issue explicitly authorizes another runtime.

Every Cursor assignment declares:

```text
Runtime: local | cloud | either
```

- `local` is the default.
- `cloud` or `either` requires source-Issue authority.
- `@cursor` invokes Cursor Cloud and is not a substitute for local routing.
- Labels and comments are routing evidence; they do not prove a process is running.

Canonical runtime policy: `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`.

### Cursor Cloud route (Cursor product only)

Non-Cursor products must ignore this subsection as authority and use their own product pointers and wake paths.

> **Design shift (#3013, 2026-08-03):** Cursor Local handoff is **labels/status
> only** — `agent:cursor` + `handoff:ready` on an open Issue not already handed
> off (`status:review`/`status:complete`/`status:post-merge-verify`). There is
> no comment-marker protocol.
>
> **Transport (#3212 Phase 4 / #3424):** Primary wake is GitHub Actions
> `lgfc-cursor-dispatch` on runner label `lgfc-cursor` (identifiers-only
> wrapper). Cursor Local Bridge is **decommissioned** as a primary
> auto-start path; automatic packet delivery and the local poll-wake loop
> remain **retired as execution dependencies**. Canonical:
> `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` and
> `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`.

## Mandatory authority chain

Before repository work—including exploration, design, Sandbox, implementation, PR work, review, remediation, communication, incident response, or closeout—read in this order:

1. `AGENTS.md` (this file)
2. `docs/governance/REPOSITORY-AUTHORITY.md`
3. `docs/governance/AGENT-TEAM.md`
4. `docs/governance/AGENT-EXECUTION.md` (canonical shared execution law; `docs/ops/ai/CORE-RULES.md` is a compatibility pointer and not a second policy)
5. The **applicable product-specific pointer** (choose the active product; do not default every product to Cursor):
   - `docs/ops/ai/CHATGPT-RULES.md` (retired #4173; historical only)
   - `docs/ops/ai/WORK-RULES.md` (retired #4074; historical only)
   - `docs/ops/ai/CURSOR-RULES.md`
   - `docs/ops/ai/CODEX-RULES.md` (retired #4165; historical only)
   - `docs/ops/ai/CLAUDE-CODE-RULES.md`
   - `docs/ops/ai/COPILOT-RULES.md` (still in use, #4399)
   - `docs/ops/ai/GROK-BOT-RULES.md` (Documentation maintenance role only, #5370)
   - `docs/ops/ai/DEVIN-RULES.md` (retired #4399; historical only)
6. `context.md` (orientation digest: stack, vendors, design and platform authorities; follow its pointers only when a task needs the detail)
7. Applicable domain policy and reference contracts
8. Source GitHub Issue
9. Task-linked design, plan, procedure, and skill files

For PR, issue, review, remediation, or implementation work, also read:

10. `.agents/skills/lgfc-pr-governance/SKILL.md`
11. `.github/pull_request_template.md`
12. Product-applicable how-to. Cursor PR work uses `docs/how-to/cursor/open-task-pr.md`.

Prompts, comments, external notifications, and agent memory do not override this chain.

When shared execution detail in `docs/governance/AGENT-EXECUTION.md` conflicts with current member mapping, `docs/governance/AGENT-TEAM.md` is the authoritative current-state role map. The compatibility pointer `docs/ops/ai/CORE-RULES.md` is not policy.

### First bootstrap report

Before any other repo-work response, report each file as **read**:

- AGENTS.md: read
- REPOSITORY-AUTHORITY.md: read
- AGENT-TEAM.md: read
- CORE-RULES.md: read
- product pointer: read (the active row from step 5)
- context.md: read

For PR work, also report:

- lgfc-pr-governance/SKILL.md: read
- .github/pull_request_template.md: read
- docs/how-to/cursor/open-task-pr.md: read (Cursor PR work only; other products use their mapped how-to)

Cursor Cloud first bootstrap report additionally includes:

- CURSOR-RULES.md: read

A bootstrap report that says these files are "required but not yet read" is noncompliant.

## Identify role, lane, and profile

Before action, determine:

```text
Durable role:
Horizontal lane:
Promotion profile:
Source Issue:
Operational hold:
```

### Durable roles

- Product Authority
- PMO / Engineering
- Implementation / Operations
- PR Approver / Engineering
- Administration & Communications
- Day-2 Operations
- Documentation maintenance
- Deterministic CI

Current member mapping: `docs/governance/AGENT-TEAM.md`.

### Lane topology

Horizontal lanes:

- PMO / Engineering
- Implementation / Operations
- Day-2 Operations

Vertical lane:

- Administration & Communications

### Promotion profiles

```text
Sandbox -> Development -> Promotion Candidate -> Production -> Day-2 Operations
```

- Sandbox is optional and cannot move directly to Promotion Candidate or Production.
- Development cannot move directly to Production.
- Development and Promotion Candidate are technical profiles inside the conversational Implementation / Operations lane.

Canonical contract: `docs/reference/operations/operating-lanes-and-promotion-profiles.md`.

## Task-scoped read order

Read the files that match the current task:

| Task | Required authority |
| --- | --- |
| Role or approval question | `docs/governance/AGENT-TEAM.md`; `docs/reference/agents/implementation-authority-contract.md` |
| Product, UX, route, page, or design decision | `docs/governance/PRODUCT-AND-DESIGN.md`; applicable controlled specifications under `docs/reference/design/**` |
| PMO intake, sizing, Sandbox, or launch | `docs/governance/PMO-PORTFOLIO.md` |
| Development, Promotion Candidate, Production, rollback | `docs/governance/DELIVERY-AND-RELEASE.md`; `docs/how-to/operations/run-work-through-promotion-profiles.md` |
| Platform, environment, Cloudflare, D1, B2, binding, credential, or migration boundary | `docs/governance/PLATFORM-AND-ENVIRONMENT.md`; applicable controlled specifications under `docs/reference/platform/**` |
| CI checks, validation evidence, promotion criteria, failure routing, or post-merge verification | `docs/governance/CI-AND-VERIFICATION.md`; applicable controlled references under `docs/reference/ci/**` |
| Communication, routing, labels, hold/resume, reporting, closeout | `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`; `docs/reference/operations/administrative-control-lane-contract.md` |
| Production health, incidents, runner host, recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Runner/controller behavior | `docs/reference/ci/repository-runner-contract.md`; applicable routing contract/procedure |
| PR work | `.agents/skills/lgfc-pr-governance/SKILL.md`; `.github/pull_request_template.md`; `docs/how-to/cursor/open-task-pr.md`; `docs/governance/PR_PROCESS.md`; `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md` |
| Model A/B execution | `docs/how-to/agents/run-model-a.md` or `docs/how-to/agents/run-model-b.md` |
| Approved assignment or Product Authority action (execution fidelity) | `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md`; `docs/ops/ai/CORE-RULES.md` (Execution Contract Fidelity); `docs/templates/agent-assignment-template.md` |

## Communication routing

The minimum lightweight correction path is:

```text
PROBLEM FOUND
  -> route to the role that made the controlling decision
  -> GUIDANCE or ADJUSTMENT
  -> Administration & Communications records
  -> RESUME
```

Use `PLAN CHANGE REQUIRED` only for a material change to product outcome, architecture, acceptance criteria, dependencies, delivery model, promotion path, Production boundary, or recovery strategy.

The runner and routing controller are Administration & Communications infrastructure. They transport authorized work; they do not create authority.

## Execution summary

```text
Agent entry and authority load
  -> PMO / Engineering intake and design
  -> optional Sandbox
  -> implementation Go
  -> Development
  -> Promotion Candidate
  -> Production
  -> Day-2 Operations
```

Administration & Communications spans all steps.

## Startup orientation

When Product Authority says `run startup`, the literal command resolves according to the active product. Each recognized product identifies itself and performs its own product-specific orientation-only startup, then ends startup and begins Session lifecycle phase 2 in the same turn (#5012). Claude Code is the exception: after its startup and catch-up reports it waits for Product Authority to set the session topic (#5513):

- ChatGPT: `docs/ops/ai/CHATGPT-RULES.md` (retired #4173; historical only)
- Work: `docs/ops/ai/WORK-RULES.md` (retired #4074; historical only)
- Codex: `docs/ops/ai/CODEX-RULES.md` (retired #4165; historical only)
- Claude Code: `docs/ops/ai/CLAUDE-CODE-RULES.md`
- Cursor: `docs/ops/ai/CURSOR-RULES.md` (Startup section), reached through `AGENTS.md` for Cloud and `.cursor/rules/*.mdc` for Local
- Claude (conversational): no product-specific startup contract; outside the operational delivery chain unless bounded collaboration is authorized

Shared skeleton, session-boundary rules, and the full list of what startup must never authorize: `docs/governance/AGENT-EXECUTION.md`, "PRODUCT STARTUP FRAMEWORK." Ending startup is not going idle: the session continues through the work list and the continuous run in the same turn (`docs/governance/AGENT-EXECUTION.md`, "Session lifecycle," #5012), except Claude Code, which waits for the session topic after its catch-up (#5513). Current product/role inventory: `docs/governance/AGENT-TEAM.md`.

Startup itself does not authorize, for any product:

- queue audit (inside the startup steps only);
- inferred next work as if startup alone were a Go;
- implementation resume;
- administrative reconciliation;
- GitHub mutation.

Startup and assignment loading are separate phases — startup completion is never itself interpreted as task authorization. After startup ends, the agent reads its working list from GitHub and continues. A source Issue, its acceptance criteria, an exact file-touch allowlist, the applicable promotion profile, role authority, and an explicit implementation Go are still required before edits.

## Repository skills

Use repository skills when their trigger matches:

- PR governance: `.agents/skills/lgfc-pr-governance/SKILL.md`
- Design compliance: `.agents/skills/lgfc-design-compliance/SKILL.md`
- Documentation authority: `.agents/skills/lgfc-docs-authority/SKILL.md`
- Cloudflare/static export: `.agents/skills/lgfc-cloudflare-static-export/SKILL.md`
- Verification/closeout: `.agents/skills/lgfc-verification-closeout/SKILL.md`
- Assignment envelope: `docs/templates/agent-assignment-template.md`

Tracker/status-index files are updated only when the source Issue authorizes that surface.

## Agent governance implementation references

- `.agents/checks/agent-governance-check.mjs`
- `.github/workflows/agent-governance.yml`

These remain required validation surfaces. They do not override the constitutional and domain-policy chain above.

`docs/archive/superseded/governance/ai/AGENT-GOVERNANCE.md` (prior cross-agent governance rules) and `docs/archive/superseded/ops/ai/CROSS-AGENT-OPERATING-RULES.md` (prior cross-agent operating guidance) are historical/superseded (#2823, archived #3155) — retained as a record, not as navigation or authority surfaces. Do not read them for conflict resolution; use the "Mandatory authority chain" above.

## Stop conditions

Stop the affected scope and route the problem when:

- canonical authority conflicts;
- required source Issue or role authority is missing;
- a protected product, design, credential, Production, privacy, legal, cost, or destructive boundary is unresolved;
- Sandbox/preview/component isolation is unsafe;
- required validation or independent approval is missing or failed;
- an active operational hold covers the work;
- a mandatory promotion profile is being skipped;
- evidence shows the approved plan cannot satisfy acceptance without material change.

Routine bounded correction, deterministic administrative reconciliation, and non-blocking reporting lag are not repository-wide stops.

## Stop before implementation when

- No primary source issue is identified
- No exact file-touch allowlist is defined

Task prompts do not override the chain in this file.

## Local vs cloud bootstrap

- **Cursor Local Composer/Agent:** `.cursor/rules/*.mdc` (`alwaysApply: true`) then this file
- **Cursor Cloud Agent:** this file then the Cursor product pointer
- **Other products:** this file then the matching product pointer. ChatGPT is retired (#4173). Codex is retired (#4165). Work is retired (#4074). Devin is retired (#4399).
- **Skills:** `.agents/skills/*` are relevance-selected; they are not a substitute for this bootstrap and must not override LGFC authority or add approval gates

## Final routing

- Constitution: `docs/governance/REPOSITORY-AUTHORITY.md`
- Roles: `docs/governance/AGENT-TEAM.md`
- Product and Design: `docs/governance/PRODUCT-AND-DESIGN.md`
- PMO: `docs/governance/PMO-PORTFOLIO.md`
- Delivery: `docs/governance/DELIVERY-AND-RELEASE.md`
- Platform and Environment: `docs/governance/PLATFORM-AND-ENVIRONMENT.md`
- CI and Verification: `docs/governance/CI-AND-VERIFICATION.md`
- Administration & Communications: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Day-2 Operations: `docs/governance/OPERATIONS-AND-RECOVERY.md`
- Lane/profile reference: `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
- Shared execution detail: `docs/governance/AGENT-EXECUTION.md` (`docs/ops/ai/CORE-RULES.md` is a compatibility pointer)
- Execution fidelity (approved-action contracts): `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md`

Legacy person-specific or serialized instructions must not be cited when they conflict with these canonical sources.

See `docs/how-to/cursor/agent-session-bootstrap.md` for Cursor verification steps.
See `docs/reference/ai/openai-agentic-surface-inventory.md` for the OpenAI surface inventory (#3815).

## Continuous serial implementation (#3055 / #3145)

For a graduated project, the exact prepared child graph is standing authority. Eligible agents self-claim the next package-complete serial child without a repeat Administration/PMO dispatch. Standalone `team:governance` stewardship Issues are claimed separately from the project child graph. The implementation runtime must record starting SHA, branch, allowlist confirmation, and pre-implementation checkpoint before editing.

Missing package fields produce `PACKAGE-INCOMPLETE`; a substantive dependency or protected boundary produces an evidence-specific `HOLD`. Merge alone is not substantive acceptance. Current role ownership for preparation, monitoring, assurance, and exception handling in this workflow is defined in `docs/governance/AGENT-TEAM.md`, not restated here; no role may independently verify or approve protected work it implemented.
