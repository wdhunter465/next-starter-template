---
Doc Type: Template
Audience: Human + AI
Authority Level: Controlled Template
Owns: Required project-master Issue structure, authority identities, documentation inventory, validation, and closeout gates
Does Not Own: Project-specific product decisions, implementation scope, priority, Production approval, or runtime behavior
Canonical Reference: /docs/reference/pmo/project-documentation-closeout-contract.md
Related Issues: #1719, #3050, #3055, #3113
Last Reviewed: 2026-08-06
---

# Project Master Issue Template

## Authority

- Product Authority:
- PMO / Engineering:
- Implementer:
- Independent reviewer:
- Parent program:
- Delivery model:
- Promotion path:

## Objective

## Scope

## Non-goals

## Acceptance criteria

## Dependencies and protected boundaries

Record each condition with taxonomy class: advisory prerequisite | ordered predecessor | real collision | protected stop. Ordinary prerequisites are comments or sequencing metadata — not queue-wide `HOLD` or `BLOCKED`.

When only part of a task is gated, define bounded increments so collision-safe work can proceed.

## Ordered task graph

## Documentation inventory

Every row requires a named file with completion evidence or an explicit, justified `Not applicable` disposition. Blank rows are not valid closeout evidence.

| Documentation class | Required path(s) or justified `Not applicable` | Owner | Completion evidence |
| --- | --- | --- | --- |
| Requirements / decisions |  |  |  |
| Design |  |  |  |
| Implementation plan |  |  |  |
| Tutorial |  |  |  |
| How-to |  |  |  |
| Reference |  |  |  |
| Explanation |  |  |  |
| Governance / PMO authority |  |  |  |
| Operations / recovery |  |  |  |
| AS-BUILT | `docs/ops/as-built/<project>-as-built.md` | Implementer + PMO verification |  |
| Final closeout evidence |  |  |  |

## AS-BUILT requirements

The AS-BUILT document must describe the exact final implementation, configuration, data, operational procedures, validation, rollback, monitoring, ownership, known limitations, and final repository authority state. Planned-state documentation does not satisfy this requirement.

## Validation

## Rollback and recovery

## Post-merge verification

## Closeout gate

The project must remain open until implementation, all documentation, AS-BUILT, PMO/dashboard/queue reconciliation, GitHub state, promotion evidence, post-merge verification, and final closeout evidence are merged and independently verified.

`CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE` applies whenever any required document is missing, stale, contradictory, deferred, unmerged, or represented by an unexplained blank inventory row.

## Standing Project Authority and Execution Graph

Project Graduation decision: GO | NO-GO | HOLD  
Standing implementation authority reference: ____  
Project/component branch: ____  
PR target: ____  
Default implementation role holder by child: ____  
Task acceptance and closeout authority: WORK  
Project closeout authority: WORK with required independent verification and protected Product/Production decisions

| Sequence | Child Issue | Objective | Predecessor completion | Successor | Serial/parallel | Writable scope | Collision proof | Prerequisite class | Package state |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | #____ | ____ | ____ | #____ / terminal | serial | ____ | not applicable | ordered predecessor / advisory / protected stop | package-complete / PACKAGE-INCOMPLETE |

A Project Graduation GO remains standing authority for this exact graph. Eligible agents self-claim the next package-complete serial successor after deterministic predecessor completion without a repeat Administration or PMO dispatch (#3055 / #3145). WORK prepares each successor package before implementer idle time and records substantive ACCEPT/HOLD only when judgment is required. Parallel execution requires explicit disjoint scopes and collision proof in this table.

## Protected Stops and Continuation

Protected decisions: ____
True dependencies (ordered predecessor / real collision only): ____
Advisory prerequisites (comments; do not deny collision-safe work): ____
Operations interruption behavior: ____
Package-incomplete correction owner: WORK
Successor claim rule: after deterministic predecessor completion (validated merge + post-merge closeout, or WORK `ACCEPT` when a substantive gate is defined on that edge), an eligible agent self-claims the next package-complete task under standing parent authority. `team:*` ownership remains; `agent:*` is the execution claim only.
No generic `BLOCKED` state, queue-wide freeze, or repeat-dispatch requirement is permitted.
