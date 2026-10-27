---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: CI migration implementation sequencing, orchestration task decomposition, Cursor execution phases
Does Not Own: Final workflow implementation
Canonical Reference: /docs/explanation/ci/lgfc-ci-production-design.md
Related Issues: #1058, #1075
Last Reviewed: 2026-06-03
---

# LGFC CI Implementation Plan

## Purpose

This document defines the implementation rollout plan for the LGFC CI redesign.

The rollout is intentionally decomposed into isolated implementation tasks so repository orchestration workflows can create one implementation issue at a time for Cursor execution.

## Implementation Strategy

The repository must not attempt a large CI rewrite in one PR.

Each implementation step should:

- have isolated rollback boundaries
- contain one logical workflow concern
- include deterministic acceptance criteria
- avoid simultaneous governance and runtime changes
- preserve branch protection stability

## Execution

Use this procedure when turning the CI architecture into implementation work:

1. Confirm the previous CI implementation issue is merged and stable.
2. Select the next phase from the recommended implementation sequence.
3. Create exactly one Cursor implementation issue for that phase.
4. Include the allowed files, rollback plan, acceptance criteria, and validation requirements in the issue.
5. Assign the issue to Cursor for one implementation PR.
6. Validate the implementation PR with the current merge-protection gates.
7. After merge, run post-merge verification before creating the next issue. When validation succeeds, auto-close the linked source issue with closeout evidence; when validation fails or remediation remains required, keep the source issue open.

The orchestration layer must not create the next CI implementation issue until the current issue is merged, validated, and stable.

## Orchestration Model

The orchestration layer should create exactly one active implementation issue at a time.

When one issue closes successfully:

1. orchestration validates merge success
2. orchestration validates CI stability
3. orchestration creates the next issue automatically
4. the next issue is assigned to Cursor

## Recommended Implementation Sequence

### Phase 1 — Inventory and Documentation

Status: current PR

Goals:
- establish final CI architecture
- define lifecycle domains
- define workflow classifications
- define rebuild and retirement targets

### Phase 2 — PR Hygiene Foundation

Goals:
- add PR metadata normalization
- add deterministic docs auto-fix capability
- add Diataxis correction support
- reduce noisy governance failures

### Phase 3 — Merge Protection Consolidation

Goals:
- consolidate deterministic merge gates
- reduce overlapping workflows
- isolate catastrophic blockers
- simplify branch protection configuration

Canonical as-built reference:
- `docs/reference/ci/merge-protection-surface.md`
- `scripts/ci/merge_protection_surface.mjs`

### Phase 4 — Reviewer Gate Redesign

Goals:
- remove brittle reviewer lifecycle enforcement
- move reviewer intelligence post-merge
- preserve protected review enforcement
- support asynchronous reviewers safely

Canonical as-built reference:
- `docs/reference/ci/reviewer-lifecycle-surface.md`
- `scripts/ci/reviewer_lifecycle_gate.mjs`

### Phase 5 — Post-Merge Validation

Goals:
- implement implementation-verification workflows
- implement design-audit workflows
- implement remediation issue generation
- implement architectural drift analysis

Canonical as-built reference:
- `docs/reference/ci/post-merge-validation-surface.md`
- `scripts/ci/post_merge_validation_surface.mjs`

### Phase 6 — OPS Runtime Suite

Goals:
- consolidate operational monitoring
- improve Cloudflare validation
- improve D1/B2 operational health checks
- implement self-healing retry logic
- preserve rollback evidence

Canonical as-built reference:
- `docs/reference/ci/ops-runtime-surface.md`
- `scripts/ci/ops_runtime_surface.mjs`

### Phase 7 — As-Built Documentation Reconciliation

Goals:
- compare intended CI design with merged workflow behavior
- document variances, deferred items, and merged Task 003–005 truth separately
- map monitoring ownership and escalation paths
- refresh guardrails map and workflow inventory pointers without rewriting every historical row

Deliverables:
- `docs/reference/ci/lgfc-ci-as-built-reconciliation.md`
- `docs/ops/ci-monitoring-ownership.md`
- updates to `.github/CI_GUARDRAILS_MAP.md`, workflow inventory, and rollout closeout references

Status: merged on `main` via PR #1244.

### Phase 8 — Program Closeout and Orchestration Verification

Goals:
- close the `#1075` redesign program with evidence
- close superseded child issues (#1011, #1009, #1116, #1247, stale task issues)
- verify issue factory skips completed phase-1 tasks and creates only phase-2 tasks

Trigger plan:
- `docs/ops/implementation-plans/issue-1075-ci-phase2-closeout-rollout.md`

### Phase 9 — CI Maintenance under `#1058`

Goals:
- branch protection UI reconciliation documentation
- drift gate ZIP deduplication
- legacy workflow retirement
- full workflow inventory rewrite

Tasks 002–005 in the phase-2 closeout plan execute this maintenance backlog under
the open `#1058` program issue.

## Cursor Issue Model

Each implementation issue should contain:

- exact workflow scope
- allowed files
- rollback plan
- acceptance criteria
- CI impact statement
- post-merge verification expectations

## Success Criteria

The final CI design succeeds when:

- pre-merge gates are deterministic
- false failures are minimized
- reviewer timing deadlocks are eliminated
- post-merge validation becomes evidence-driven
- operational monitoring becomes proactive
- repository maintenance burden decreases
- AI implementation workflows remain stable
