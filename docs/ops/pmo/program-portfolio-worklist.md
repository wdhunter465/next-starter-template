---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Portfolio-level worklist for active and blocked LGFC program work
Does Not Own: Individual issue bodies, PR content, or launch-gate authorization
Canonical Reference: /docs/reference/pmo/lgfc-program-portfolio-model.md
Related Issues: #1335, #1346, #1351, #4776
Last Reviewed: 2026-10-26
---

# Program Portfolio Worklist

## Purpose

Provide a compact worklist for Cursor and PMO so each task can reference durable portfolio guidance instead of receiving a large prompt.

## Current State Note

As of PR #1375 merge (2026-06-06), Program 1 Tasks 001–007 are **complete**.
`#1058` remains open as the Program 2 CI maintenance umbrella. Task 008
(`#1346`) — Program 2 launch gate — is the **final Program 1 task** and remains
`status:blocked` until queue advancement promotes it for PMO Admin sign-off work.

Evidence on `main`:

| Task | Merge PR | Primary deliverable |
|---|---|---|
| 006 | `#1374` | `docs/ops/reports/program-1-operational-health-review.md` |
| 007 | `#1375` | `docs/ops/reports/program-1-automation-backlog.md` |

## Active Program 1 Sequence

| Task ID | issue | Task | Agent | Status rule |
|---|---|---|---|---|
| Task 001 | #1339 | PMO registry and critical path | ChatGPT | complete |
| Task 002 | #1340 | CI as-built closeout | Cursor | complete |
| Task 003 | #1341 | Website as-built reconciliation | Cursor | complete |
| Task 004 | #1342 | Docs/DIATAXIS transition status | Cursor | complete |
| Task 005 | #1343 | OPS monitoring snapshot | Cursor | complete |
| Task 006 | #1344 | Operational health review | Cursor (impl) / ChatGPT (review) | complete — PR `#1374` |
| Task 007 | #1345 | Automation backlog classification | Cursor (impl) / ChatGPT (review) | complete — PR `#1375` |
| Task 008 | #1346 | Program 2 launch gate | ChatGPT (sign-off) | blocked — next eligible after `#1345` closeout |

Task 007 closeout completed via PR #1375; `#1345` is closed. Task 008 (`#1346`)
requires queue promotion before implementation PRs; launch gate deliverable:
`docs/ops/reports/program-2-launch-gate.md`.

## Read-Only Parallel Work

Read-only research may support upcoming tasks after Task 001, but implementation PRs remain serial.

## Program 2 Holding Area

Program 2 candidates remain blocked until Task 008 sign-off:

- CI maintenance under `#1058`;
- website follow-up under `#1255`;
- selected OPS improvements;
- automation items classified in `docs/ops/reports/program-1-automation-backlog.md`.

## Program 3 Holding Area

Program 3 candidates include broader documentation remediation and non-critical cleanup that does not block Program 2 launch.
