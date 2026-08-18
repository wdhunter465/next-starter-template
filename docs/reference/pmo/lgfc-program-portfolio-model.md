---
Doc Type: Reference
Audience: Human + AI
Authority Level: Operational Authority
Owns: LGFC PMO program issue portfolio model, PMO Backlog intake model, and execution-chain reference
Does Not Own: Product design, workflow implementation, runtime behavior, GitHub issue mutation, or merge authority
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #1411, #1417, #1418, #1419, #1420, #1421, #1422, #1423, #1424, #1379, #1255, #1501, #1719, #1720, #3597
Last Reviewed: 2026-08-18
---

# LGFC Program Portfolio Model

## Purpose

Define the PMO program issue portfolio model used to coordinate LGFC work across initial idea intake, design, launch-packet preparation, graduation, active implementation, verification, and closeout.

## Scope

This document owns:

- Program issue portfolio model and canonical execution chain;
- PMO Pipeline lifecycle stages (`Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`);
- Independent ordered priority sequences (`1...XXX`) for Pipeline and Active queues;
- Portfolio-level operating invariants for human and AI contributors;
- The read order for agents entering PMO-governed work.

This document does not own:

- Task-level implementation plans or code execution;
- Workflow YAML or runtime implementation;
- GitHub issue closure or merge authority;
- Product design or feature scope decisions.

## Current Known Truth

- The portfolio uses a canonical 6-stage PMO lifecycle model: `Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`.
- `team:engineering` qualification is limited to coherent problem definition and PMO entry. Upon qualification, `team:engineering` is removed and the item enters PMO Pipeline at `Initial Idea`.
- Priority labels represent **execution order sequence** (`1...XXX`) within Pipeline and Active queues rather than a fixed 4-level severity cap.
- Program issues execute approved project groups when graduated to `Active` with a recorded single implementation owner.

## Intended Final State

- Fully reconciled program portfolio model where all active, pipeline, and completed project issues adhere strictly to canonical PMO lifecycle stages and 1...XXX priority sequence tracking.

## Portfolio Chain

PMO uses this canonical execution chain:

```text
Initial Idea → Drafted Design → Pending Launch Packet → Graduation Candidate → Active → Closed
```

Detailed intake and graduation steps:

```text
PMO Backlog / Initial Idea → Drafted Design → Pending Launch Packet → Graduation Candidate → PMO Graduation Review → Active (PMO Priority 1...XXX) → Executable Tasks → Verification → Closed
```

## Program Issue Portfolio Model

Program issue numbers identify PMO work bodies. They are not permanent subject domains and are not capped at five programs.

| Program issue | Role | Current state |
| --- | --- | --- |
| #1255 | Active execution program | Website Implementation and Content Operations |
| #1719 | Implementation Active | PMO Governance / Workflow Automation Completion — continuous reduced-gate serial |
| #1411 | Completed historical planning artifact | PMO Automation and Agent Workflow Control |

## PMO Backlog and Graduation Rules

A PMO project moves from Pipeline to Active implementation through explicit Project Graduation:

1. **Initial Idea:** Problem statement, scope, and objectives recorded in repository docs/issues.
2. **Drafted Design:** Architecture and technical options drafted; multi-agent review conducted.
3. **Pending Launch Packet:** Design approved; implementation plan, child tasks, dependencies, validation, rollback, and operational handoff prepared.
4. **Graduation Candidate:** Complete design and launch packet assembled; all child issues linked.
5. **Active Graduation:** PMO explicitly graduates the project, assigns Active execution order priority (`pmo:priority:1...XXX`), and selects one start-to-finish implementation owner.
6. **Active Execution:** Child tasks execute serially under standing parent authority.
7. **Closed:** Delivery verified and closeout recorded with durable evidence.

## Operating Invariants

- One primary source issue controls each PR.
- Cursor or assigned agent edits files inside the active task allowlist and records validation.
- Agent may not merge PRs, close issues, relabel issues, or mutate queue state unless explicitly authorized.
- ChatGPT reviews governance, source-issue accounting, queue conformance, and documentation authority.
- Bill retains merge authority, protected action authority, launch-gate approval, destructive issue-action authority, and strategy decision authority.

## Cursor Read Order

For PMO-governed tasks, Cursor should read:

1. The active source issue.
2. `/docs/governance/PMO-PORTFOLIO.md`.
3. `/docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.
4. `/docs/ops/pmo/program-registry.md`.
5. `/docs/ops/pmo/pmo-backlog.md` when backlog or promotion context is involved.
6. `/docs/reference/pmo/lgfc-cursor-execution-contract.md`.
7. The task-specific implementation plan and authority documents named in the source issue.
