---
Doc Type: Operations
Audience: Bill, Governance, Cursor, LGFC maintainers, implementation agents, and reviewers
Authority Level: Operational Authority
Owns: Program #2040 readiness decision, content publication support boundaries, child-task sequence, approval-state requirements, and launch preconditions
Does Not Own: Program #1738 source collection rules, Program #2039 club staging implementation, merge authority, production secrets, or public content approval decisions
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #1738, #2039, #2040, #2043, #2049, #2050, #2051, #2052, #2053, #2054, #2055, #2056, #4776
Last Reviewed: 2026-10-26
---

# Website Automatic Content Publication Capability

> Program #2040 defines controlled content publication support after Program #1738 proves the manual workflow and Program #2039 provides the admin staging surface. Cursor may execute only the assigned child task issue and must stop at `READY FOR REVIEW`.

## Purpose

This readiness package defines the PMO boundary for **Website Automatic Content Publication Capability**.

The program adds controlled software support for publication states, admin review, staged content promotion, content rotation, scheduled publication, audit evidence, rollback, unpublish behavior, and safety checks.

## Scope

This readiness package covers:

1. Manual workflow evidence review and publication candidate inventory.
2. Publication state model and approval authority design.
3. Admin staged-content review and rotation control surface design.
4. Scheduled publication and controlled rotation implementation planning.
5. Audit trail, rollback, unpublish, and evidence retention design.
6. Publication safety CI/ops checks and fail-closed rules.
7. Implementation of approved publication support slices.
8. Program validation and operator handoff.

This program does not replace Program #1738 content collection rules, bypass human editorial approval, bypass rights/source/credit review, or treat external source material as public-ready content without review.

## Current known truth

- Program #1738 owns Lou Gehrig content collection, source discovery, provenance, rights, and editorial conversion.
- Program #2039 owns the first admin-only visual staging route at `/admin/clubstaging`.
- Program #2040 must wait for enough Program #1738 manual workflow evidence to avoid encoding unproven assumptions.
- Human approval remains mandatory before public publication.
- Public route exposure must be tied to explicit publication states and review evidence.

## Intended final state

At the end of Program #2040:

1. Website content has explicit operational states: draft, staged, reviewed, approved, scheduled, published, archived, rejected, and unpublished.
2. Authority to move content between states is documented and enforced by implementation slices.
3. Staged content can be reviewed before public route exposure.
4. Rotation and scheduled publication behavior are controlled and operator-visible.
5. Public publication requires approval-state evidence.
6. Missing source, credit, rights, or approval metadata fails closed.
7. Publish, unpublish, rollback, and evidence-retention behavior are documented.
8. CI/ops checks verify public exposure boundaries where feasible.

## Readiness decision

| Field | Value |
| --- | --- |
| Program issue | #2040 |
| Program name | Website Automatic Content Publication Capability |
| Predecessor | #1738 — Lou Gehrig Content Collection / Research Pipeline Expansion |
| Related program | #2039 — Website Public Launch / Relaunch Readiness |
| Execution agent | Cursor |
| Current readiness | Ready for implementation planning; implementation waits for #1738 manual workflow evidence |
| Primary implementation plan | `docs/ops/implementation-plans/website-automatic-content-publication-capability.md` |
| Explicit non-goal | Public content publication without human approval |

## Child-task readiness inventory

| Task | issue | Readiness purpose | Decision |
| ---: | ---: | --- | --- |
| 001 | #2049 | Manual workflow evidence review and publication candidate inventory | Required first task after #1738 handoff evidence |
| 002 | #2050 | Publication state model and approval authority design | Ready after Task 001 |
| 003 | #2051 | Admin staged-content review and rotation control surface design | Ready after Task 002 and #2043 |
| 004 | #2052 | Scheduled publication and controlled rotation implementation plan | Ready after Tasks 002 and 003 |
| 005 | #2053 | Audit trail rollback unpublish and evidence retention design | Ready after Task 002 |
| 006 | #2054 | Publication safety CI ops checks and fail-closed rules | Ready after Tasks 002-005 |
| 007 | #2055 | Implementation of approved publication support slices | Ready after Tasks 001-006 |
| 008 | #2056 | Program validation and operator handoff report | Terminal validation task |

## Launch preconditions

Cursor implementation may begin only when:

1. Program #1738 produces manual workflow evidence.
2. Program #2039 provides or confirms the required admin staging surface for the relevant task.
3. Product Authority assigns a specific Program #2040 child task issue.
4. The assigned task identifies its own file-touch boundary.
5. The PR body cites exactly one source issue.
6. The task stops at `READY FOR REVIEW`.

## Publication control rule

Program #2040 may support publication operations, but public route exposure must require a recorded approved state. Missing source, credit, rights, or approval metadata must prevent public publication.

## Closeout requirement

Program #2040 closeout requires terminal Task #2056 evidence, validation of publication-state controls, rollback/unpublish evidence, and explicit Product Authority acceptance.
