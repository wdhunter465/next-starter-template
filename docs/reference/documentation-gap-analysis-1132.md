---
Doc Type: Reference
Audience: human project owner and AI agents
Authority Level: supporting
Owns: project #1132 documentation gap analysis and completion sequencing
Does Not Own: implementation code, runtime behavior, CI workflow code, or historical as-built records
Canonical Reference: docs/reference/documentation-ownership-map-1132.md
Related issues: #1132, #1134, #1342
Last Reviewed: 2026-06-05
---

# Documentation Gap Analysis — project #1132

## Purpose

This document defines the remaining documentation gaps for the project #1132 documentation completion program. It uses the project inventory and ownership map to identify what must still be written, reconciled, migrated, or retired before the documentation program can close.

## Current baseline

The repository now has starter production definitions and implementation plans for the Fan Club, Admin, and Content Collection areas. It also has an inventory report and an ownership map. These documents establish the baseline, but they do not complete the gap analysis, legacy disposition, or remaining CI and governance package definitions.

## Gap matrix

| Area | Current status | Gap | Required follow-up |
|---|---|---|---|
| Fan Club | Starter production definition and implementation plan exist | Needs validation against live route/component state and as-built evidence | Verify against current app structure and update package if drift is found |
| Admin | Starter production definition and implementation plan exist | Needs deeper permission, workflow, and moderation boundary detail | Add admin workflow and acceptance detail after current implementation state is confirmed |
| Content Collection | Starter production definition exists | Needs editorial lifecycle, intake, review, approval, rejection, archive, and media linkage detail | Expand content collection package into operational workflow definitions |
| CI Orchestration | Multiple CI design and workflow docs exist | Needs one reconciled production definition and implementation plan tied to current gates | Produce CI orchestration package and reviewer lifecycle redesign plan |
| DIATAXIS Migration | Folder structure and guardrails exist; Phase 1 mapping populated (`DIATAXIS-MAPPING.md`, `#1342`) | Needs per-file migration execution, manifest rows, and legacy retirement PRs | Execute Program 3 migration PRs per mapping table; status report: `docs/ops/reports/program-1-diataxis-transition-status.md` |
| Legacy Retirement | Archive and legacy sources exist | Needs explicit keep, merge, split, archive, or delete decisions | Produce legacy retirement package with closure criteria |
| Governance | Authority hierarchy exists | Needs conflict map between issues, trackers, docs, and archived material | Add documentation normalization plan after migration matrix is complete |
| Operations | Trackers and as-built records exist | Needs consistent linkage between PRs, issues, implementation, and as-built docs | Define post-implementation as-built requirements per package |

## Completion sequence

1. Complete the legacy-to-DIATAXIS migration matrix.
2. Reconcile CI orchestration documentation and reviewer lifecycle rules.
3. Expand Content Collection operational definitions.
4. Validate Fan Club and Admin definitions against current implementation state.
5. Produce legacy retirement package.
6. Generate remaining child implementation issues from the finalized document set.
7. Close project #1132 only after all gaps are resolved or explicitly deferred.

## Closure criteria

project #1132 can close when each major documentation area has a clear owner, current production definition, implementation plan when needed, migration disposition, and no unresolved duplicate or conflicting authority source remains.
