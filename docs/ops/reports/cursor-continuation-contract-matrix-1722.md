---
Doc Type: Operations
Audience: Bill, Atlas, Cursor, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #1722 durable Cursor continuation/stop contract matrix for main vs Model B component-auto-integration vs continuous reduced-gate serial paths
Does Not Own: Workflow YAML implementation, CI script changes, merge to main, or unauthorized issue mutation
Canonical Reference: /docs/reference/pmo/lgfc-cursor-execution-contract.md
Related Issues: #1722, #1719, #1720, #1721, #1723, #1724, #1725
Last Reviewed: 2026-08-18
---

# Cursor Continuation and Queue Contract Matrix (#1722)

## Purpose

Publish the authoritative continuation/stop matrix promised by Task `#1721`
gap G-01 and harden
`docs/reference/pmo/lgfc-cursor-execution-contract.md` for Program `#1719`.

## Scope

This report owns the Task #1722 continuation/stop matrix for `main`, Model B component-auto-integration, and continuous reduced-gate paths. It does not change workflow YAML, CI scripts, or merge authority.

## Current known truth

Cursor handoff, merge authority, and successor rules differ by PR base. Non-`main` component PRs may auto-merge when authorized; `main` requires Bill/ChatGPT approval. Material stops remain authority conflict, allowlist overrun, unauthorized protected-surface change, material design/priority decisions, unremediable required checks, and unclean predecessor integration.

## Intended final state

Program #1719 children use this matrix instead of a universal stop-at-READY-FOR-REVIEW rule.

## Authority

- Current PMO authority: `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- Cursor contract: `docs/reference/pmo/lgfc-cursor-execution-contract.md`
- Program `#1719` continuous reduced-gate authorization (2026-07-16)
- Operator rule: non-`main` component PRs may auto-merge; `main` requires
  Bill/ChatGPT approval
- Documentation authority levels: `docs/governance/PR_PROCESS.md` and
  Task `#1723` evidence
- Issue mutation matrix: `docs/ops/reports/issue-mutation-closeout-permission-1724.md`

## Matrix

| Path | PR base | Cursor handoff | Merge authority | Successor rule |
| --- | --- | --- | --- | --- |
| Default / Model A | `main` | `READY FOR REVIEW` | Bill/ChatGPT | Explicit resume/launch unless continuous reduced-gate applies |
| Continuous reduced-gate to `main` | `main` | `READY FOR REVIEW` | Bill/ChatGPT | After merge + clean post-merge → next child |
| Model B component-auto-integration | `component/**` | No inter-child human review handoff | Atlas-controlled / authorized non-`main` auto-merge | After clean component integration → next child |
| Model B promotion | `main` | Review / protected as required | Bill/ChatGPT | Per promotion issue |

Tasks `#1723` and `#1724` follow the Model B component-auto-integration row.
Governance-doc edits on the project component branch do not invent an
intermediate human gate. Repository-wide authority still requires
Bill/ChatGPT-approved promotion to `main`.

## Material stops (all paths)

- Unresolved authority conflict without deterministic precedence
- Required work outside allowlist
- Unauthorized workflow/CI/runtime/secret/production/irreversible external change
- Material design or prioritization decision
- Required checks unremediable in child scope
- Unclean predecessor integration

Non-stops: routine PR transitions, normal review findings, documentation
placement, correctable validation failures, governance-folder placement alone.

## Program #1719 application

| Task | Status | Notes |
| ---: | --- | --- |
| #1720 | Complete on `main` (PR #2543) | Authority reconciliation |
| #1721 | Complete on component (PR #2545) | Gap inventory |
| #1722 | Complete on component (PR #2548) | Contract matrix |
| #1723 | Complete on component (PR #2555) | PR readiness / merge authority; two-level docs authority |
| #1724 | Complete on component | Component-doc model; no intermediate human gate for governance docs |
| #1725 | Complete | Do not rerun |
| #1726 / #1727 | Later | Implementation candidates / terminal |

## Out of scope

- Workflow YAML / CI scripts
- Runtime / website / package files
- Unauthorized issue mutation
- Merge or promotion to `main` from this child
