---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: DIATAXIS structure, folder intent, project documentation coverage, merged-state reconciliation, and transition controls
Does Not Own: Product design decisions, implementation authority, or Production approval
Canonical Reference: /docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md
Related Issues: #1132, #1342, #1719
Last Reviewed: 2026-08-04
---

# LGFC DIATAXIS Transition and Project Documentation Model

## Purpose

DIATAXIS exists to prevent documentation-driven implementation regressions, agent drift, duplicated work, and prolonged outages by separating documentation according to user need and validating the final merged repository state.

This is not cosmetic organization. DIATAXIS coverage is part of project implementation and closeout.

## Required structure

- `docs/tutorials/**` — learning-oriented, guided paths from no knowledge to a working result.
- `docs/how-to/**` — goal-oriented procedures for a specific task.
- `docs/reference/**` — exact factual contracts, schemas, routes, commands, interfaces, configuration, and invariants.
- `docs/explanation/**` — rationale, architecture, tradeoffs, and conceptual models.
- `docs/governance/**` — binding rules, standards, authority, and enforcement.
- `docs/ops/**` — plans, reports, AS-BUILT records, operational procedures, and execution evidence.
- `docs/archive/**` — explicitly retired historical material only.

Folder purpose is strict. A document must not mix incompatible purposes when doing so creates ambiguity about authority or user intent.

## Per-project requirement

Every project master Issue and implementation plan must include a documentation inventory covering:

- requirements and decisions;
- design;
- tutorials;
- how-to procedures;
- reference contracts;
- explanation/rationale;
- governance and PMO surfaces;
- operations, rollback, recovery, and monitoring;
- AS-BUILT;
- verification and closeout evidence.

Each DIATAXIS quadrant requires named paths or an explicit, justified `Not applicable` disposition in both the source Issue and final AS-BUILT record. Silence is a missing deliverable.

Templates:

- `docs/templates/project-master-issue-template.md`
- `docs/templates/as-built-template.md`

## AS-BUILT relationship

DIATAXIS documents explain how to learn, operate, reference, and understand the capability. The AS-BUILT document records the exact final implementation and links all applicable DIATAXIS surfaces.

A project cannot close with only a plan, closeout report, or PR description. The final AS-BUILT must identify what exists, where it exists, how it operates, how it is validated, how it is recovered, and which documentation is current authority.

## PR requirements

A project PR must:

- include documentation changes whenever implementation changes repository truth;
- use an explicit documentation allowlist;
- identify affected DIATAXIS quadrants;
- update the project AS-BUILT incrementally or in the terminal delivery, as defined by the source Issue;
- pass documentation validation and contradiction review;
- avoid leaving current-authority documents describing a superseded state.

Documentation must ship with the implementation that creates the need. It may not be deferred to a later cleanup project.

## Merged-state validation

Post-merge verification must validate:

1. folder-intent compliance;
2. document-type compliance;
3. duplicate authority definitions;
4. contradictions across merged-state documents;
5. canonical links and supersession notices;
6. AS-BUILT consistency with the merged implementation;
7. PMO, queue, dashboard, dependency, role, and GitHub-state reconciliation;
8. search-visible stale current-authority statements.

This validates merged reality, not PR intent.

## Defect routing

A post-merge DIATAXIS, documentation, or AS-BUILT exception is assigned immediately to the implementer of the originating PR. ChatGPT / Atlas, as PMO / Engineering, defines the defect, routes it, coordinates independent review, verifies remediation, and controls closeout.

The project remains open or is reopened as closeout-defective until remediation is merged and verified.

## Closeout rule

A project cannot be declared complete when any applicable tutorial, how-to, reference, explanation, governance, operational, AS-BUILT, verification, PMO, queue, dashboard, dependency, or GitHub authority surface is missing, stale, contradictory, deferred, or unmerged.

The required status is:

```text
CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE
```

Completion percentage and merged code do not override this rule.

## Historical transition status

The earlier DIATAXIS transition work under #1342 and #1132 remains historical evidence. Current project documentation and closeout authority is controlled by `docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md` and the project source Issue.
