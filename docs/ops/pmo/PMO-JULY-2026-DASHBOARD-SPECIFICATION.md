---
Doc Type: Operations Specification
Audience: PMO operators, AI agents, dashboard maintainers
Authority Level: Historical / Superseded
Owns: Historical July 2026 PMO dashboard JSON contract
Does Not Own: Current queue, priority, lifecycle, or dashboard target contract
Canonical Reference: /docs/reference/pmo/pmo-lifecycle-and-priority-contract.md
Related Issues: #2313, #2471, #2516, #2610, #2611, #2699, #2709, #3597
Last Reviewed: 2026-08-18
---

# PMO July 2026 Dashboard Specification

## Status

**Superseded for current dashboard classification, sort, and priority rules (#3597).** Use `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md` and `docs/how-to/pmo/pmo-dashboard.md`. This file remains historical evidence of the July 2026 reporting snapshot and must not be used as live authority.

## Purpose

Define how the PMO dashboard represents the approved Operations, PMO, Engineering, and Project Graduation model in generated JSON and static views.

The dashboard is reporting only. GitHub Issues remain the sole operational authority for portfolio tracking, lifecycle, team assignment, priority, Pipeline stage, parent/child relationships, comments, assignments, collaboration, and closeout evidence.

Queue and priority semantics are owned by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

## Authority hierarchy

GitHub Issue state and current labels → PMO issue-contract validation → Active, Pipeline, Completed, or Incomplete → generated JSON and static dashboard.

| Layer | Role |
| --- | --- |
| GitHub Issues | Live authority for PMO tracking and portfolio state |
| PMO Operating Model | Operational Issue contract and task accounting |
| This specification | Reporting fields, view placement, validation, and remediation display |
| Generated JSON and HTML | Reporting snapshot that may be stale between builds |
| Static inventory | Test fixtures or explicit non-state exclusions only |

Static inventory must not prescribe live lifecycle, team, priority, stage, or closeout state.

## Scope

This specification covers:

- source Issue inclusion and exclusion;
- lifecycle-specific team and priority requirements;
- JSON row fields;
- Active, Pipeline, Completed, and Incomplete placement;
- Pipeline stage mapping;
- parent task accounting;
- data-quality errors and required remediation;
- sorting and rendering expectations.

It does not authorize generator code changes, label creation, live backfill, routing changes, workflow changes, or GitHub mutation. Those runtime changes are tracked separately in #2702.

## Portfolio eligibility

An Issue is PMO-tracked when it has the `pmo` label.

A standalone portfolio row requires:

1. the `pmo` label;
2. a supported parent title classification;
3. no `pmo:task` label.

Supported parent prefixes include:

- `PROGRAM:`;
- `PROJECT:`;
- `PROGRAM CANDIDATE:`;
- `STRATEGY:`;
- `STRATEGY REVIEW:`.

Project child tasks use `pmo:task` and a valid parent reference. They do not render as standalone portfolio rows.

Standalone Operations Issues and peer Engineering preparation Issues do not become PMO portfolio rows merely because they reference a PMO parent. They are excluded from parent task accounting unless they are valid project implementation tasks.

## Lifecycle-specific contract

Validation runs before view placement.

### Active parent

A valid Active parent has:

- `pmo`;
- exactly one lifecycle label: `pmo:active`;
- exactly one team label: `team:pmo`;
- exactly one priority label: `pmo:priority:1` through `pmo:priority:4`;
- no Engineering or Operations priority/state label;
- no Pipeline stage label.

### Pipeline parent

A valid Pipeline parent has:

- `pmo`;
- exactly one lifecycle label: `pmo:pipeline`;
- exactly one team label: `team:engineering`;
- exactly one Engineering priority: `eng:priority:1` through `eng:priority:4`, or `eng:priority:idea`;
- exactly one Pipeline stage;
- no PMO or Operations priority/state label.

Engineering priority reports preparation order. Pipeline stage reports maturity. They are independent.

### Completed parent

A valid Completed parent has:

- `pmo`;
- `pmo:closed`;
- GitHub closed state or an explicitly reconciled terminal state;
- no contradictory active lifecycle or current team-priority combination.

Completed reporting may retain the last known team and priority as historical evidence when available, but historical fields must not be treated as active routing authority.

### Project child task

A valid child task has:

- `pmo:task`;
- one lifecycle label describing pending, active, or completed state;
- a valid PMO-tracked parent reference;
- no `team:operations`, `team:pmo`, or `team:engineering` label;
- no `ops:*`, `pmo:priority:*`, or `eng:priority:*` label.

Project sequence and dependencies govern the child. Parent priority selects the project.

## Pipeline stage mapping

Every valid Pipeline parent carries exactly one stage:

| Order | Label | Display |
| ---: | --- | --- |
| 1 | `pmo:stage:intake` | Intake |
| 2 | `pmo:stage:discovery` | Discovery |
| 3 | `pmo:stage:definition` | Definition |
| 4 | `pmo:stage:planning` | Planning |
| 5 | `pmo:stage:prep` | Preparation |
| 6 | `pmo:stage:ready-for-launch` | Ready for Launch |

Ready for Launch is a prepared but unlaunched state. It must not render as Active or implementation-authorized.

## Priority handling

### Active PMO priority

Accepted Active labels are:

- `pmo:priority:1`;
- `pmo:priority:2`;
- `pmo:priority:3`;
- `pmo:priority:4`.

Active rows sort by PMO priority number.

Capacity limits apply to parents only:

- maximum four P1 parents;
- maximum four P2 parents;
- maximum four P3 parents;
- no fixed P4 limit.

Completion thresholds are eligibility information only and never change priority automatically.

### Pipeline Engineering priority

Accepted Pipeline labels are:

- `eng:priority:1`;
- `eng:priority:2`;
- `eng:priority:3`;
- `eng:priority:4`;
- `eng:priority:idea`.

Pipeline rows sort by Engineering priority, then stage order, then update time.

`eng:priority:idea` displays as `Idea` and sorts after numbered Pipeline priorities unless an agenda-specific view filters it separately.

### Prohibited priority states

Validation rejects:

- `pmo:priority:none`;
- legacy `pmo:priority:idea` on a Pipeline parent after migration;
- PMO priority on Pipeline;
- Engineering priority on Active;
- any team priority on a child task;
- multiple team or priority namespaces on one Issue;
- automatic transfer of Engineering priority into PMO priority during Project Graduation.

## Required JSON parent-row fields

Every emitted parent row includes:

| Field | Requirement |
| --- | --- |
| `issueNumber` | GitHub Issue number |
| `issueUrl` | GitHub Issue URL |
| `title` | Display title |
| `labels` | Current Issue label names |
| `lifecycle` | `pipeline`, `active`, `closed`, or `incomplete` |
| `teamLabel` | Current team for valid Active or Pipeline rows; historical or null for Completed |
| `priorityLabel` | Lifecycle-matching priority for valid Active or Pipeline rows; historical or null for Completed |
| `priorityDisplay` | Numeric priority, `Idea`, historical text, or remediation text |
| `pipelineStageLabel` | Required only for valid Pipeline rows |
| `pipelineStageDisplay` | Human stage display for Pipeline rows |
| `taskCount` | Count of valid linked project tasks |
| `tasksCompleted` | Count of linked tasks with `pmo:closed` |
| `percentComplete` | Rounded completion percentage when tasks exist |
| `updatedAt` | GitHub last-updated timestamp |
| `closedAt` | GitHub closed timestamp when applicable |
| `dataQualityErrors` | Empty for valid rows; populated for Incomplete |
| `requiredRemediation` | Empty for valid rows; populated for Incomplete |

Generated output must never omit Issue identity for a PMO-tracked record.

## View placement

| Condition | View |
| --- | --- |
| Invalid or contradictory required metadata | Incomplete |
| Valid `pmo:active` parent with PMO team and PMO priority | Active |
| Valid `pmo:pipeline` parent with Engineering team, Engineering priority, and stage | Pipeline |
| Valid `pmo:closed` parent reconciled with terminal state | Completed |
| `pmo:task` with valid parent | Excluded from standalone views; included in parent accounting |
| Standalone Operations or Engineering preparation Issue | Excluded from PMO standalone views unless separately modeled by an authorized operational view |

## Task accounting

For each parent:

- `taskCount` equals linked valid `pmo:task` Issues;
- `tasksCompleted` equals linked tasks with `pmo:closed`;
- `percentComplete` equals rounded completed divided by total when tasks exist.

Validation fails when:

- a child has no valid parent;
- completed tasks exceed total tasks;
- percentage does not match task counts;
- a referenced task cannot be identified;
- standalone filtering removes a valid child from parent accounting;
- a peer Engineering preparation or Operations Issue is counted as a child;
- a child carries a team-priority label.

## Incomplete view contract

Every Incomplete row shows:

- Issue number and link;
- current labels;
- lifecycle classification;
- data-quality errors;
- required remediation;
- last-updated time.

Incomplete detection includes:

- missing or conflicting lifecycle;
- Active parent missing or conflicting `team:pmo` or PMO priority;
- Pipeline parent missing or conflicting `team:engineering`, Engineering priority, or stage;
- cross-namespace team or priority labels;
- prohibited priority label;
- priority on a child task;
- missing or invalid child parent reference;
- invalid task accounting;
- peer work misclassified as project child work;
- missing Issue identity or URL;
- unsupported PMO classification;
- closed state not reconciled to `pmo:closed`.

Incomplete rows remain visible until corrected. The dashboard must not silently invent defaults.

## Sorting

- Active rows sort by PMO priority, then update time.
- Pipeline rows sort by Engineering priority, stage order, then update time.
- Completed rows sort by close time when available, then update time.
- Incomplete rows sort by error severity, then update time.

## Rendering requirements

The static dashboard must:

- show Active, Pipeline, Completed, and Incomplete sections;
- distinguish PMO Active priority from Engineering Pipeline priority;
- display Pipeline stage separately from preparation priority;
- link Issue numbers to GitHub;
- escape Issue-derived display text;
- show task counts and completion percentage;
- show current labels and remediation for Incomplete rows;
- avoid substituting blank, `TBD`, or default values for invalid metadata;
- avoid showing child tasks as independently prioritized portfolio work.

## Validation requirements

Validation derives lifecycle, team, priority, stage, and task state from current GitHub Issue metadata reflected in generated rows.

Validation must fail output that:

- omits required identity fields;
- emits invalid metadata into Active, Pipeline, or Completed;
- accepts missing or multiple lifecycle labels;
- accepts missing, multiple, or lifecycle-incompatible parent team/priority labels;
- accepts a Pipeline row without exactly one stage;
- accepts team priority on a child task;
- accepts cross-namespace ownership;
- loses valid tasks needed for parent accounting;
- counts peer Operations or Engineering work as child tasks;
- produces invalid task math;
- uses frozen inventory lifecycle, team, or priority as live authority.

## Static inventory residual role

Static inventory may contain:

- explicit non-state exclusions with rationale;
- deterministic fixture seeds for offline tests;
- temporary migration notes.

It must not contain or enforce live `expectedLifecycle`, `expectedTeam`, or `expectedPriority` values that override GitHub.

## Runtime transition

This document defines the target dashboard contract approved in #2699 and aligned in #2709.

Runtime implementation is tracked in #2702 and must update:

- label creation and retirement;
- dashboard generator parsing;
- validator behavior;
- tests and fixtures;
- queue routing;
- live Issue migration.

Until #2702 merges, existing generated output may not satisfy this target schema. Operators must rely on live GitHub Issues and canonical policy when legacy runtime output conflicts.

## Operator remediation flow

1. Open the Incomplete view.
2. Inspect live Issue state and the reported errors.
3. Identify whether the record is an Active parent, Pipeline parent, child task, or excluded peer Issue.
4. Correct metadata only through authorized migration or reconciliation.
5. Regenerate and validate output.
6. Confirm movement into the correct view only after contract validation succeeds.

## Related references

- PMO Operating Model: `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- Work Queues and Collaboration: `/docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- Weekly PMO review: `/docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md`
- Dashboard how-to: `/docs/how-to/pmo/pmo-dashboard.md`
- Runtime implementation Issue: `#2702`

## Supersession

This specification supersedes dashboard rules that require one PMO priority namespace for all PMO-tracked Issues, require priority on child tasks, use `pmo:priority:idea` as the target Pipeline label, count peer preparation or Operations work as child completion, or allow static inventory to override current GitHub state.