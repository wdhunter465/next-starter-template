---
Doc Type: Implementation Plan
Audience: Human + AI
Authority Level: Operational Plan
Owns: Task #3633-002 ordered implementation plan, validation, rollback, and operating handoff for Project #3633
Does Not Own: The Phase 1 catalog (#3633-001), gap dispositions, new workflows, Production admission, or Product date changes
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3633, #3981, #3982, #3983, #2450, #2453, #2815, #2817, #2829, #4139
Last Reviewed: 2026-10-07
---

# Issue #3633-002 ordered implementation plan

## Status

`_DRAFT` — second preparation task of Active project #3633. This file adds no workflow and changes no CI. It orders the work that follows the accepted Phase 1 catalog (`docs/ops/implementation-plans/issue-3633-001-design-reconciliation.md`).

## Purpose

The parent requires six phases in a fixed order: catalog, inventory, deduplication, gap assessment, build, repeated validation. This plan turns those phases into ten bounded child Issues with dependencies, writable scope, validation, rollback, and the handoff into the November aggressive-testing rounds. It does not decide any gap. Phase 4 does.

## Dates

Parent dates are Product Authority dates and do not change here: CI and Day-2 implementation complete 2026-10-31, Round 1 support complete 2026-11-07, repair qualification through 2026-11-14, Round 2 support complete 2026-11-21, contingency through 2026-11-30, confidence checkpoint 2026-12-01.

The working dates below are proposed to fit those dates. They are targets for PMO review, not Product decisions.

| Gate | Proposed date | Exit condition |
| --- | --- | --- |
| Design gate (Phases 1–4 accepted) | 2026-10-19 | Product Authority accepts the catalog, inventory, deduplication proposal, and gap assessment |
| Build complete | 2026-10-31 | Every `MISSING_BUILD` and `EXISTING_NEEDS_HARDENING` row is implemented or has an accepted deferral |
| Repeated qualification | 2026-11-01 to 2026-11-06 | At least three consecutive runs of each scheduled qualification, with no unexplained failure |
| Handoff to Round 1 | 2026-11-07 | The handoff record below is accepted |

If the design gate slips past 2026-10-19, the build window shrinks and the first thing deferred is hardening of low-risk rows, not Day-2 monitoring or recovery.

## Ordered child graph

Ten children, in dependency order. Each is its own Issue, branch, and pull request, created at launch-package time (#3983). Each child's file scope is exact; none touches `.github/workflows/**` before the design gate.

| # | Child | Depends on | Writable scope | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Test catalog and requirements matrix | none | `docs/ops/implementation-plans/` (catalog is extracted in #3633-001) | Catalog accepted as the build gate |
| 2 | Inventory of existing CI and tests, mapped to catalog rows | 1 | `docs/ops/reports/` (one inventory file) | One row per workflow, script, and test file with the fields the parent lists |
| 3 | Deduplication and consolidation proposal | 2 | `docs/ops/reports/` | Each proposed merge proves functional duplication and keeps separate failure domains |
| 4 | Gap assessment and build plan | 2, 3 | `docs/ops/reports/` | Exactly one status per catalog row, plus risk, cadence, scope, owner, and rollback for each gap |
| 5 | PR CI hardening and buildout | design gate | `.github/workflows/**`, `scripts/ci/**`, `tests/**` | New or hardened checks, each with a failing-case test |
| 6 | Scheduled and end-to-end qualification | design gate | `.github/workflows/**`, `tests/**` | Scheduled runs with retained evidence |
| 7 | Production health and Day-2 monitoring | design gate | `.github/workflows/**`, `scripts/ops/**`, `docs/how-to/ops/` | Alerts that open an Operations Issue on failure, using the exception pattern from #4444 |
| 8 | Recovery, backup, and rollback exercises | design gate | `docs/how-to/ops/`, `scripts/ops/**` | One recorded exercise per recovery row |
| 9 | Fundraiser-specific qualification | design gate and a stable fundraiser interface (#4139) | `tests/**`, `docs/how-to/ops/` | Fundraiser rows only; blocks nothing else |
| 10 | Final integrated acceptance and handoff | 5–9 | `docs/ops/reports/` | Handoff record and parent acceptance check |

Children 1 through 4 are documentation only and run serially. Children 5 through 9 may run in parallel where writable paths do not collide; any two that touch the same workflow file run in sequence.

## Validation

For every child:

1. **Scope:** the pull request's changed files match its allowlist.
2. **Failure behavior:** every new or hardened check ships with a test that fails on the bad input, not only one that passes on the good input.
3. **Existing checks unchanged:** the required pre-merge checks (`quality`, `gitleaks`, `reviewer-response-completion`) keep the same names and trigger rules unless the child states and justifies a change.
4. **Independent review:** the implementing agent never approves its own work; Product Authority approves merges.
5. **Repeatability:** a scheduled check counts as qualified only after repeated runs, not one green run.

For the design gate: Product Authority records acceptance on #3633 after reading the inventory, the deduplication proposal, and the gap table. Without that record, children 5 through 9 do not start.

## Rollback

- Children 1–4 and 10 are documentation. Rollback is reverting the merge commit.
- Children 5–9 each add or change a small, named set of workflow, script, or test files. Rollback is reverting that child's merge commit. A new scheduled workflow is disabled by removing its `schedule` trigger, which stops runs without losing history.
- No child changes Production data, secrets, or access. A recovery exercise (child 8) runs only in an approved environment with a recorded Go from Product Authority and a documented restore path before it starts.

## Operating handoff

Child 10 produces one record for the November rounds, with four lists:

- scenarios fully covered by CI (each with the check name and its last passing run);
- scenarios partly covered, naming the part that is not;
- scenarios left for manual or agent exploratory testing;
- controlled recovery exercises done, and known residual risks entering Round 1.

Ownership after handoff: failing scheduled checks open an Operations exception Issue (#4444 pattern) in the `team:operations` queue; the Operations role triages and the Engineering role repairs CI and test defects found in this lane, as the parent requires. Monitoring, alerting, backup visibility, and the operator runbooks the parent lists stay with the Operations role as Day-2 duties after 2026-11-07.

## Acceptance of this task

#3982 is complete when this plan is on `main` and the parent records the next action, which is #3983: open the ten children with exact allowlists from the table above and record the launch package.
