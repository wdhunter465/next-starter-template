---
Doc Type: Reference
Audience: Human + AI
Authority Level: Historical Controlled Implementation Plan
Owns: Historical record of the #2610 frozen-inventory authority repair
Does Not Own: Current queue, priority, Project Graduation, dashboard target contract, runtime migration, or live Issue mutation
Canonical Reference: /docs/reference/pmo/pmo-lifecycle-and-priority-contract.md
Related Issues: #2610, #2611, #2612, #2699, #2702, #3597
Last Reviewed: 2026-08-18
---

# PMO Dashboard Single-Authority Implementation Plan

## Status

This document records the earlier #2610 repair that removed frozen `expectedLifecycle` and `expectedPriority` fields as competing live authority.

That repair remains valid historical context, but this document is **superseded for current queue and priority behavior** by:

- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`;
- `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`;
- `docs/how-to/pmo/pmo-dashboard.md`;
- runtime transition Issue #2702.

The July 2026 operating and dashboard documents are historical only.

The final documentation reconciliation was performed directly by ChatGPT under #2699 from the PMO meeting record. Implementation agents must not reinterpret the superseded examples in this historical plan.

Do not use the former examples in this plan to assign PMO priority to Pipeline parents or child tasks.

## Historical objective

The #2610 repair established that:

1. current GitHub Issue state and labels are the sole live authority for PMO lifecycle and priority;
2. static inventory may contain explicit non-state exclusions and deterministic fixtures only;
3. generated dashboard JSON and HTML are reporting snapshots;
4. a static `expectedLifecycle` or `expectedPriority` field must not override a legitimate live Issue transition.

## Historical failure mechanism

The previous validator loaded `scripts/pmo-dashboard/pmo-tracked-inventory.json` and compared generated rows with frozen expected lifecycle and priority fields. Legitimate live Issue changes could therefore fail until the inventory file was manually edited.

The approved repair removed or ignored those frozen state fields while preserving explicit exclusions and deterministic fixture support.

## Current authoritative data flow

```text
GitHub Issue state and current labels
                ↓
Lifecycle-specific queue and PMO contract validation
                ↓
Active / Pipeline / Completed / Incomplete
                ↓
Generated JSON and static dashboard
```

| Layer | Current authority |
| --- | --- |
| GitHub Issues | Sole live authority for lifecycle, team, priority, stage, task links, and closeout |
| Work Queues and Collaboration policy | Queue ownership, priority namespaces, Project Graduation, and collaboration |
| PMO Operating Model | Operational Issue contract and task accounting |
| Dashboard Specification | JSON fields, validation, view placement, and remediation |
| Generated dashboard | Reporting-only snapshot |
| Static inventory | Explicit non-state exclusions and offline fixtures only |

## Current queue-aware target

The current target model is:

### Active parent

```text
pmo
pmo:active
team:pmo
exactly one pmo:priority:1..4
```

### Pipeline parent

```text
pmo
pmo:pipeline
team:engineering
exactly one eng:priority:1..4 or eng:priority:idea
exactly one pmo:stage:*
```

### Project child task

```text
pmo:task
valid parent reference
lifecycle state
no team label
no team-priority label
```

Standalone Operations Issues and peer Engineering preparation Issues are not project child tasks and do not contribute to PMO completion percentages.

Engineering priority never transfers automatically into PMO priority during Project Graduation.

## Runtime transition authority

Issue #2702 owns the remaining queue-aware runtime implementation and live migration. Its implementation must:

- update generator and validator parsing;
- update deterministic fixtures and tests;
- distinguish Active PMO priority from Pipeline Engineering priority;
- exempt child tasks from team priority and reject priority when present;
- exclude standalone Operations and peer Engineering preparation work from PMO task accounting;
- fail closed on dual ownership and cross-namespace labels;
- produce a reviewed, reversible live-Issue migration plan before mutation.

Until #2702 merges, legacy runtime output may conflict with the current documentation contract. In that case, operators must follow live GitHub Issues and the current canonical policies, not the old runtime assumption.

## Current transition-test requirements

The queue-aware runtime test matrix must include at least:

| Case | Expected result |
| --- | --- |
| Active parent with `team:pmo` and one PMO priority | Active |
| Pipeline parent with `team:engineering`, one Engineering priority, and one stage | Pipeline |
| Pipeline `eng:priority:idea` | Pipeline, displayed as Idea |
| Active parent with Engineering priority | Incomplete |
| Pipeline parent with PMO priority | Incomplete |
| Child task with no team priority and valid parent | Nested task accounting |
| Child task carrying any team priority | Incomplete |
| Standalone Operations Issue referencing a project | Excluded from PMO row and task count |
| Peer Engineering preparation Issue referencing a Pipeline parent | Excluded from PMO row and task count |
| Dual team ownership or cross-namespace priority | Incomplete |
| Project Graduation retaining Engineering priority | Incomplete |
| Frozen inventory value conflicting with live Issue state | Live Issue state wins |

## Residual inventory rules

Static inventory may retain:

- explicit excluded Issue numbers with rationale;
- fixture data used only by deterministic tests;
- temporary migration notes that do not assert live state.

It must not contain or enforce live `expectedLifecycle`, `expectedTeam`, or `expectedPriority` fields.

## Rollback boundary

A runtime rollback may restore a prior code version for incident control, but it must not restore obsolete documentation authority or justify changing live Issues to satisfy the old single-priority model.

Any live queue-label migration must have its own reverse operations and pre-migration snapshot under #2702.

## Related references

- Work Queues and Collaboration: `/docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- PMO Operating Model: `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- Dashboard Specification: `/docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md`
- Dashboard operator how-to: `/docs/how-to/pmo/pmo-dashboard.md`
- Current runtime transition: `#2702`

## Supersession

The former priority examples in this plan are historical and must not be used as current operating instructions. Current queue and priority behavior is defined only by the canonical policy, operating model, and dashboard specification listed above.