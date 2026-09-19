---
Doc Type: Reference
Audience: Human + AI
Authority Level: Operational Authority
Owns: LGFC PMO July 2026 program issue portfolio model, PMO Backlog intake model, and execution-chain reference
Does Not Own: Product design, workflow implementation, runtime behavior, GitHub issue mutation, or merge authority
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #1411, #1417, #1418, #1419, #1420, #1421, #1422, #1423, #1424, #1379, #1255, #1501, #1719, #1720, #4174
Last Reviewed: 2026-09-19
---

# LGFC Program Portfolio Model

## Purpose

Define the PMO July 2026 program issue portfolio model used to coordinate LGFC work across planning, execution, review, verification, and closeout without overloading agents with unbounded prompts or creating competing issue trees.

This document is subordinate to `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`. It explains the portfolio mechanics; PMO July 2026 controls if there is a conflict.

## Scope

This document owns:

- program issue portfolio model;
- PMO Backlog as documented inventory for ideas, project drafts, and implementation-ready projects;
- promotion from PMO Backlog into program issues;
- portfolio-level operating invariants for human and AI contributors;
- the read order for agents entering PMO-governed work.

This document does not own:

- task-level implementation plans;
- workflow YAML or runtime implementation;
- GitHub issue closure, relabeling, queue advancement, or merge actions;
- product design or website feature scope.

## Current Known Truth

- The portfolio is not limited to five programs. Each approved body of work receives or uses a GitHub program issue. The program issue number is the durable identifier.
- Program #1255 remains an active website execution program (historical label: Program 2).
- Program #1719 is Implementation Active under continuous reduced-gate serial authorization (2026-07-16).
- Program #1411 is a **completed historical planning/control artifact** (historical label: Program 1). It is not staged/blocked current authority.
- Issues #1417–#1424 are stale historical task issues from the #1411 cycle; evidence only; do not mutate.
- Former Program 5 is now PMO Backlog (`/docs/ops/pmo/pmo-backlog.md`).
- Legacy `#1379` is historical ideas/future-projects source evidence, superseded by PMO Backlog documentation.
- The prior Program 1 cycle `#1335` is closed historical evidence only and is not a parent for Program #1411 or #1719.
- Workflow Automation planning was promoted through `#1411` and continues under Priority #3 Program `#1719`.

## Intended Final State

- Every active work item has exactly one current authority path:
  PMO meeting issue → PMO Backlog review → program issue → child project → task issue → PR → verification → closeout.
- Program issues execute approved and prioritized project groups when launch state is active.
- PMO Backlog items become executable only after owner promotion, repository authority placement, program/task issue creation, and bounded issue/PR handoff.
- Program planning and execution can proceed concurrently only when their scopes do not mutate or block one another.
- Completed program cycles remain evidence, not implicit parents for later cycles.

## Portfolio Chain

PMO July 2026 uses this execution chain:

```text
PMO meeting issue → PMO Backlog review/update → program issue → child project → task issue → PR → verification → closeout
```

PMO Backlog uses this intake chain:

```text
PMO Backlog item → documentation and readiness review → prioritization → program issue or task issue creation → launch gate
```

## Program Issue Portfolio Model

Program issue numbers identify PMO work bodies. They are not permanent subject domains and are not capped at five programs.

| Program issue | Role | Current state |
| --- | --- | --- |
| #1255 | Active execution program | Website Implementation and Content Operations (historical label: Program 2) |
| #1719 | Implementation Active | PMO Governance / Workflow Automation Completion — continuous reduced-gate serial |
| #1411 | Completed historical planning artifact | PMO Automation and Agent Workflow Control (historical label: Program 1) |

A later program issue is not a child of an earlier program issue unless the current source issue explicitly creates that relationship.

## PMO Backlog Promotion Rule

A PMO Backlog item may move toward executable work only after:

1. Product Authority or PMO Admin approves promotion review during a PMO meeting or explicit recorded review.
2. The idea is converted into a documented project candidate.
3. The design source of truth is saved into the GitHub repository.
4. Readiness gaps are identified and resolved or accepted.
5. The item is prioritized against current program issues.
6. A program issue is created or updated if the work becomes a program.
7. Project/task issues are created if executable.
8. Cursor or another agent receives a specific issue, file allowlist, validation requirement, and stop condition.
9. PMO Admin records launch. Product Authority retains protected Product Go.

Workflow Automation follows this path: it was captured as backlog material, promoted into historical Program `#1411` for documentation planning, and continues under current Priority #3 Program `#1719` child issues.

## Operating Invariants

- One primary source issue controls each PR.
- Cursor edits files inside the active task allowlist and records validation.
- Cursor may not merge PRs, close issues, relabel issues, mutate queue state, or create child issues unless the active source issue explicitly authorizes it.
- PMO Admin reviews governance, source-issue accounting, queue conformance, and documentation authority.
- Product Authority retains default merge authority, protected action authority, launch-gate approval, destructive issue-action authority, and strategy decision authority. CMO may approve merge only when Product Authority is unavailable and a holder is recorded in AGENT-TEAM.
- GitHub is the shared audit trail after planning content is promoted out of chat or Drive.

## Cursor Read Order

For PMO-governed tasks, Cursor should read:

1. The active source issue.
2. `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`.
3. `/docs/ops/pmo/program-registry.md`.
4. `/docs/ops/pmo/pmo-backlog.md` when backlog or promotion context is involved.
5. `/docs/reference/pmo/lgfc-program-queue-and-dependency-map.md` when the program uses launched-program queue mode.
6. `/docs/reference/pmo/lgfc-cursor-execution-contract.md`.
7. `/docs/ops/pmo/workflow-automation.md` when workflow automation, queue control, PR readiness, or PMO Backlog promotion is involved.
8. The task-specific implementation plan and authority documents named in the source issue.

Cursor should not reread unrelated historical program packages unless the active source issue names them as context.
