---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Operational Authority
Owns: Rationale for issue disposition categories and PMO lifecycle alignment in LGFC program closeout
Does Not Own: Actual GitHub issue mutation or merge authority
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #1335, #1351, #3597
Last Reviewed: 2026-08-18
---

# Issue Disposition Model

## Purpose

Provide a shared vocabulary and rationale for classifying open issues and tracking project lifecycle disposition during PMO closeout and portfolio alignment.

## Scope

This explanation covers:

- Disposition categories (`complete`, `superseded`, `deferred-pipeline`, `duplicate`, `not-planned`);
- Alignment with canonical PMO lifecycle stages (`Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`);
- Evidence and timing requirements for issue state changes.

## Current known truth

- Issues enter PMO through canonical stages: `Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`.
- `team:engineering` is restricted to initial problem definition and qualification sufficient for PMO entry.
- PMO priority represents **execution order sequence** (`1...XXX`), not a severity classification.
- Issue disposition during closeout requires evidence pointers (PR number, authority doc path, replacement issue, or owner decision).

## Intended final state

- Standardized issue disposition classification across all repository closeout procedures, preventing orphaned, stale, or ambiguously categorized issues.

## Disposition Categories

| Category | Meaning | Typical action |
| --- | --- | --- |
| `complete` | Merged work already satisfies the issue | Evidence comment, then close |
| `superseded` | Newer authority or project replaces the issue | Superseded-by comment, then close |
| `deferred-pipeline` | Valid follow-up idea deferred to PMO Pipeline | Route to `Initial Idea` or `Drafted Design` |
| `duplicate` | Same obligation exists on another canonical issue | Reference canonical issue, then close |
| `not-planned` | No longer part of accepted scope or rejected | Rationale comment required, then close |

## Evidence Rule

Every disposition needs an evidence pointer:

- PR number;
- Authority document path;
- Replacement issue;
- Launch-gate decision;
- Owner decision.

## Timing Rule

Disposition comments may be prepared during implementation, but issue state changes occur after PR merge and verification unless an issue-management-only task authorizes earlier action.
