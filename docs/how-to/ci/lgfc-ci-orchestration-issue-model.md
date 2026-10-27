---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Status: Retired
Owns: Historical record of the #1075 CI implementation issue model
Does Not Own: Current CI strategy, issue generation, PR policy, or workflow behavior
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #1075, #2469
Last Reviewed: 2026-07-12
---

# Retired #1075 CI Orchestration Issue Model

## Purpose

Explain how to interpret the retired #1075 issue model without reactivating it.

## Scope

This How-To covers historical markers, the retired fixed-state phase model, preserved generic orchestration, and the procedure for routing new CI work. It does not authorize current issue generation from #1075 artifacts.

## Current known truth

The dedicated CI redesign issue model generated serial `lgfc-ci-phase:*` issues from a fixed JSON state file. It is retired by #2469 after completion, Program #1500 stabilization, and the July 2026 PR-process rebuild.

## Intended final state

Historical markers remain evidence only. New CI work uses a current scoped GitHub issue, current authority, and the single-owner post-merge closeout model.

## Disposition

The old model must not generate new work, block current work, or define current completion state.

## Procedure

For current CI work, follow:

1. GitHub Issues as executable work truth.
2. `/docs/governance/PR_PROCESS.md` as canonical PR-process policy.
3. `/docs/reference/ci/pr-process-current-state.md` for the current implementation baseline.
4. `/docs/reference/ci/merge-protection-surface.md` for required checks.
5. One scoped issue and one PR for authorized CI changes.
6. Single-owner post-merge closeout through `.github/workflows/post-merge-closeout.yml`.

There is no active dedicated CI phase engine.

## Preserved generic capability

The repository may still use the generic implementation-plan issue factory and serial queue for explicitly approved plans. That capability is documented in `/docs/reference/architecture/orchestration-model.md` and does not reactivate #1075.

## Historical markers

Existing `lgfc-ci-phase:*` markers and #1075 task issues are historical evidence. They do not authorize implementation, block current work, or define completion state.

## New CI work

New CI changes require a current issue with:

- explicit objective and authority;
- bounded files;
- current-state validation;
- rollback boundary;
- acceptance criteria;
- confirmation that the change does not restore retired #1075 behavior.
