---
Doc Type: Operations
Audience: Human + AI
Authority Level: Historical / Superseded
Owns: Historical July 2026 PMO issue-contract snapshot
Does Not Own: Current lifecycle, ordered priority, or dashboard contract
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2100, #2296, #2487, #2516, #2610, #2611, #2699, #2709, #3597
Last Reviewed: 2026-08-18
---

# PMO July 2026 Operating Model

## Status

**Superseded for current PMO lifecycle, ordered priority, and stage semantics (#3597).**

Still-valid operating content has been migrated to:

| Topic | Canonical owner |
| --- | --- |
| Why the model exists | `docs/explanation/pmo/engineering-qualification-and-pmo-lifecycle.md` |
| Lifecycle/priority/label contract | `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md` |
| Stage, priority, and graduation procedure | `docs/how-to/pmo/run-pmo-lifecycle-and-priority.md` |
| Weekly meeting procedure | `docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md` |
| Dashboard operator procedure | `docs/how-to/pmo/pmo-dashboard.md` |
| Queue policy | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` |
| Portfolio decisions | `docs/governance/PMO-PORTFOLIO.md` |
| Open-Issue remap | `docs/ops/pmo/issue-3597-pmo-lifecycle-migration-plan.md` |

Do not use this July file for current stage names, P1–P4 capacity bands, or `team:engineering` Pipeline ownership. Physical archive move remains a later recorded disposition after zero current-document navigation links remain.

This document is the historical operational PMO issue-contract and reporting standard from July 2026.

Canonical policy ownership is divided as follows:

| Topic | Canonical owner |
| --- | --- |
| Portfolio decisions, sizing, launch, and Project Graduation authority | `docs/governance/PMO-PORTFOLIO.md` |
| Queue precedence, Active and Pipeline priority semantics, preparation assignment, and collaboration | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` |
| PMO issue contract, lifecycle, stage, task accounting, and reporting procedure | this file |
| Dashboard JSON and view contract | `docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md` |
| Weekly decision procedure | `docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md` |
| Dashboard operator procedure | `docs/how-to/pmo/pmo-dashboard.md` |

This file must not redefine queue or priority policy in conflict with the canonical governance documents.

## Purpose

Define how PMO-tracked GitHub Issues represent Pipeline preparation, Active project delivery, project tasks, completion, and data-quality defects.

GitHub Issues remain executable authority. Dashboard output, registries, backlogs, Drive drafts, and chat are reporting or planning inputs only.

## Authority and decision model

Bill and ChatGPT conduct the weekly PMO review.

The PMO meeting governs:

- parent portfolio priority;
- Pipeline placement and preparation priority;
- project launch and Project Graduation;
- project hold and reprioritization;
- Active project completion and removal from Active.

The project governs:

- child-task sequence;
- dependencies;
- implementation order;
- technical execution within approved authority.

ChatGPT prepares classifications, recommendations, launch packages, and readiness evidence. Bill makes final Product Authority and priority decisions.

Website delivery may be designated the top portfolio priority by a PMO decision. It is not permanently or automatically Priority 1.

## Drive and repository authority

Google Drive may be used as a freeform PMO drafting notebook.

- Drive drafts are planning inputs, not repository authority.
- Repository policy becomes authoritative only through the Issue and PR path.
- GitHub Issues are the live portfolio and execution record.
- Subordinate inventories must not override current Issue state.

## PMO tracking eligibility

The `pmo` label controls portfolio tracking.

- `pmo` means the Issue is included in PMO portfolio reporting.
- No `pmo` label means the Issue is outside PMO portfolio reporting.
- `pmo:task` identifies a project implementation task and never creates a standalone portfolio row.

Supported standalone portfolio title prefixes include:

- `PROGRAM:`;
- `PROJECT:`;
- `PROGRAM CANDIDATE:`;
- `STRATEGY:`;
- `STRATEGY REVIEW:`.

Engineering preparation Issues and standalone Operations Issues are peer source records, not PMO project tasks. They must not use `pmo:task` merely because they relate to a portfolio parent.

## Lifecycle labels

Every PMO-tracked parent or task carries exactly one lifecycle label:

| Label | Meaning | Dashboard placement |
| --- | --- | --- |
| `pmo:pipeline` | Parent retained for Engineering preparation and future graduation review | Pipeline |
| `pmo:active` | Parent or child work in authorized Active delivery | Active parent or task accounting |
| `pmo:closed` | Completed, closed, or intentionally terminal work | Completed parent or completed task accounting |

Closed GitHub state must reconcile to `pmo:closed`. Contradictory open/closed and lifecycle state is an Incomplete defect.

Lifecycle does not determine team priority. Team priority belongs only to portfolio parents or standalone team work as defined below.

## Pipeline stage labels

Every `pmo:pipeline` parent carries exactly one stage:

| Order | Label | Stage | Meaning |
| ---: | --- | --- | --- |
| 1 | `pmo:stage:intake` | Intake | Topic captured; discovery has not begun |
| 2 | `pmo:stage:discovery` | Discovery | Purpose, risks, ownership, and rough boundaries are being shaped |
| 3 | `pmo:stage:definition` | Definition | Requirements, design, and repository authority are being defined |
| 4 | `pmo:stage:planning` | Planning | Implementation sequence, dependencies, and acceptance are being planned |
| 5 | `pmo:stage:prep` | Preparation | Documentation, issue chain, file scope, and verification package are being prepared |
| 6 | `pmo:stage:ready-for-launch` | Ready for Launch | Graduation package is complete enough for explicit Go/No-Go review |

Priority and Pipeline stage are independent.

A project may be Engineering P1 at any stage. Engineering P1 means prepare it ahead of lower-priority Pipeline work; it does not assert readiness.

Ready for Launch does not authorize implementation. Execution begins only after explicit Project Graduation and implementation Go.

## Team and priority contract

### Active PMO parents

An Active portfolio parent uses:

- `team:pmo`;
- exactly one of `pmo:priority:1` through `pmo:priority:4`.

Active priority selects which launched parent receives focus.

Capacity and eligibility rules:

| Priority | Execution meaning | Parent capacity | Eligibility signal |
| --- | --- | ---: | --- |
| P1 | Current team focus when executable | Maximum 4 | Not applicable |
| P2 | Work when no executable P1 exists | Maximum 4 | 80% complete may be considered for P1 |
| P3 | Work when no executable P1 or P2 exists | Maximum 4 | 70% complete may be considered for P2 |
| P4 | Opportunistic work when higher tiers are not executable | No fixed limit | 50% complete may be considered for P3 |

Eligibility is informational. Priority never changes automatically. A project may complete at any priority.

### Pipeline Engineering parents

A Pipeline portfolio parent uses:

- `team:engineering`;
- exactly one of `eng:priority:1` through `eng:priority:4`, or `eng:priority:idea`;
- exactly one Pipeline stage.

Engineering priority orders design, documentation, planning, and graduation-package preparation. It is not implementation authority.

Any Pipeline parent may move directly to Engineering P1 by PMO decision. There is no mandatory priority progression and no time limit at any priority or stage.

### Project child tasks

A `pmo:task` Issue:

- has a valid parent project reference;
- uses lifecycle to report pending, active, or completed state;
- follows project-defined Task ID, predecessor, successor, dependency, and execution sequence;
- does not carry `team:pmo`, `team:engineering`, PMO priority, or Engineering priority;
- does not compete as a standalone queue item.

Parent priority selects the project. The project's sequence selects the task.

### Exclusive ownership

An Issue must never carry team or priority labels from multiple namespaces.

Invalid examples include:

- Engineering team with PMO priority;
- PMO team with Engineering priority;
- Operations priority with PMO or Engineering priority;
- multiple `team:*` labels;
- team priority on a project child task.

## Engineering preparation assignment

When a Pipeline parent is assigned Engineering P1, the same PMO closeout creates or reactivates one peer preparation Issue owned by ChatGPT.

The preparation Issue:

- references the parent with `Related Pipeline Project:` or `Graduation Target:`;
- does not use `Parent Project:`;
- does not use `pmo:task`;
- does not affect implementation completion percentage;
- remains `team:engineering` with matching Engineering priority;
- has one bounded objective: prepare the parent for Project Graduation review.

Required preparation outputs include, as applicable:

- objective, scope, and non-goals;
- requirements and acceptance criteria;
- architecture and design;
- repository authority reconciliation;
- dependencies, collisions, risks, rollback, and stop conditions;
- implementation plan;
- refined parent Issue;
- ordered implementation child Issues;
- file scopes and validation matrix;
- execution-agent recommendation;
- Go, No-Go, Hold, or Adjustment recommendation.

There must be no more than one open preparation assignment for the same Pipeline parent.

## Project Graduation

Project Graduation is the explicit transition from Pipeline/Engineering to Active/PMO.

Graduation requires:

1. a complete-enough launch package;
2. truthful Ready for Launch stage;
3. PMO meeting review;
4. explicit Go;
5. removal of Engineering team, priority, and Pipeline stage;
6. assignment of Active lifecycle, `team:pmo`, and a newly selected PMO priority;
7. recorded implementation owner, first executable task, delivery profile, and implementation authority.

Engineering priority never transfers automatically into PMO priority.

Go authorizes Development execution against the approved work package. It does not authorize Production promotion.

## Task accounting

Task accounting uses linked `pmo:task` Issues with valid parent references.

For each parent:

- `taskCount` equals all linked valid project tasks;
- `tasksCompleted` equals linked tasks with `pmo:closed`;
- `percentComplete` equals rounded completed tasks divided by total tasks when tasks exist;
- completed tasks must never exceed total tasks.

Engineering preparation Issues and standalone Operations Issues are excluded from task accounting.

Tasks with missing or invalid parents are Incomplete. Parent rows with inconsistent task accounting are Incomplete until reconciled.

## Incomplete data-quality handling

A PMO-tracked record with invalid required metadata appears in Incomplete rather than being silently coerced into Active, Pipeline, or Completed.

Incomplete detection includes:

- missing or conflicting lifecycle;
- Active parent missing or conflicting PMO team/priority;
- Pipeline parent missing or conflicting Engineering team/priority;
- Pipeline parent missing or conflicting stage;
- cross-namespace team or priority labels;
- team priority on a project child task;
- missing or invalid task parent reference;
- invalid task accounting;
- Engineering preparation misclassified as `pmo:task`;
- missing Issue identity or URL;
- closed state not reconciled to `pmo:closed`;
- unsupported or contradictory PMO classification.

The Incomplete view reports Issue identity, labels, errors, required remediation, and last update.

## Dashboard authority hierarchy

Correct data flow is:

GitHub Issue state and current labels → issue-contract validation → Active, Pipeline, Completed, or Incomplete → generated JSON and static dashboard.

The dashboard is a reporting snapshot. It never overrides live Issue state.

Static inventory may supply deterministic test fixtures or explicit non-state exclusions. It must not prescribe live lifecycle, team, priority, stage, or closeout state.

## Runtime transition boundary

The target label and dashboard contract above is authoritative policy.

Live creation of `team:*`, `ops:*`, and `eng:*` labels, dashboard generator and validator changes, routing automation, and bulk Issue migration are separately tracked in #2702.

Until #2702 completes:

- do not bulk relabel Issues;
- do not interpret legacy runtime metadata as permission for dual ownership;
- record target state in authorized migration planning;
- treat conflicts in favor of the canonical queue policy;
- keep runtime-compatible metadata only as a temporary technical representation.

## Weekly PMO procedure

The weekly PMO review follows `docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md`.

It reviews:

- numbered Operations interrupts plus Monitoring and Hold obligations;
- Active parent priority and capacity;
- Pipeline Engineering priority and stage;
- new Engineering P1 preparation assignments;
- graduation candidates;
- Go, No-Go, Hold, Adjustment, reprioritization, completion, and closeout decisions;
- stale or contradictory metadata.

The meeting does not prescribe individual child-task implementation order.

## Launch gates

A project may execute only when all applicable gates are satisfied:

1. preparation package complete enough for the selected delivery model;
2. explicit Project Graduation and implementation Go recorded;
3. blocking dependencies cleared or explicitly dispositioned;
4. one current primary source Issue per PR;
5. scope, allowlist, acceptance, verification, rollback, and stop conditions recorded;
6. no numbered Operations interrupt or explicit hold blocks dispatch;
7. promotion-profile rules remain intact.

Planning documents, planning PRs, and Ready for Launch status do not launch a project by themselves.

## Preparation package

Before Cursor implementation, ChatGPT prepares the work to the maximum feasible extent.

A package includes, as applicable:

- parent identity and objective;
- source authority;
- scope and non-goals;
- launch condition and stop conditions;
- ordered child tasks and dependencies;
- task-specific acceptance criteria;
- likely file allowlists;
- verification profiles;
- documentation targets;
- Production and Operations handoff expectations;
- known and accepted risks;
- rollback;
- execution owner;
- PR requirements.

Component projects may be prepared and graduated independently when their boundaries and dependencies permit it.

## Cursor execution boundaries

Default resource-control rule: one local Cursor agent, one child Issue, one PR, stop at Ready for Review.

Cursor may:

- implement bounded approved tasks;
- verify within the allowlist;
- produce PR-ready work;
- request collaboration on the source Issue.

Cursor may not without explicit authority:

- merge;
- close or relabel Issues;
- advance queues;
- create adjacent child work;
- expand scope;
- redesign the project;
- interpret continuous execution as permission to select unrelated work.

Cursor daily precedence is numbered Operations remediation, then Active PMO implementation selected by parent priority and project sequence, then bounded Engineering collaboration when requested.

## Universal collaboration

Operations, PMO, and Engineering use the same source-Issue collaboration method defined by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` and `docs/how-to/operations/request-agent-collaboration.md`.

Collaboration does not change queue ownership, priority namespace, implementation owner, Project Graduation status, or approval authority.

## Operations production handoff

After Production deployment and live verification, Day-2 Operations owns monitoring, support, recovery coordination, exception creation, remediation routing, and Production evidence.

A degraded or failed Production capability routes to a standalone Operations Issue.

- Numbered Operations priorities interrupt PMO and Engineering.
- Monitoring and Hold are non-blocking and interval-managed.
- Cursor is the normal remediation implementer.
- ChatGPT may be requested as Tier 2 specialist support on the same Issue.
- The Issue moves from numbered priority to Monitoring or Hold when remediation has progressed as far as possible.

Operations does not replace Project Graduation, merge authority, Engineering review, Production approval, or rollback controls.

## PMO reporting versus operations reporting

PMO reporting describes portfolio state: Pipeline, Active, priority, stage, graduation, completion, and archive.

Operations reporting describes current execution: open PRs, current tasks, numbered Operations work, Monitoring and Hold obligations, CI state, deployment, and recovery.

A parent may be PMO-prioritized while current capacity is temporarily consumed by numbered Operations remediation.

## Portfolio and backlog inventories

Live PMO-tracked GitHub parent Issues are the complete portfolio inventory unless Bill requests a subset.

`program-registry.md` and `pmo-backlog.md` are subordinate inventory and shaping surfaces. They must be reconciled when touched and must not override current Issue state.

Hard-coded workload tables in documentation are historical snapshots only and must not be cited as current portfolio truth.

## Component-project hierarchy

The normal hierarchy is:

PMO meeting → portfolio parent → component project or master Issue → ordered child implementation Issues → PRs → review and promotion → Production → Day-2 Operations → closeout.

Definitions:

| Term | Meaning |
| --- | --- |
| Program or project parent | Portfolio outcome and priority record |
| Component project or master Issue | Bounded delivery coordination record |
| Child Issue | Smallest Cursor-implementable unit with scope, acceptance, and verification |
| PR | Reviewable implementation unit tied to one primary source Issue |
| Engineering preparation Issue | Peer Pipeline-preparation assignment; not a child task |
| Operations Issue | Standalone Day-2 remediation record; not a child task |

## Reduced-gate posture

LGFC may accept bounded delivery risk for small components in exchange for lower process drag, provided that:

- project preparation is detailed;
- scope is small;
- implementation follows the parent and child structure;
- required CI and independent review remain intact;
- Promotion Candidate and Production controls are preserved;
- Day-2 Operations owns post-deployment support;
- production defects route through Operations rather than retroactive scope expansion.

Reduced-gate delivery does not mean uncontrolled implementation or skipped authority.

## Completed and historical archive

Completed and historical records remain audit evidence. They are not current workload unless reopened or promoted through a current source Issue.

Historical Issues, old program numbers, Drive snapshots, and prior PMO versions do not automatically authorize new children, queue movement, or execution.

## Opportunistic DIATAXIS migration

When authorized work touches legacy documentation, classify whether low-risk migration or normalization belongs in the current scope. Otherwise record a follow-up candidate.

Documentation cleanup must not derail current product, fundraiser, release, or Production priorities unless the drift blocks safe execution.

## Source-of-truth hierarchy

1. Explicit Product Authority decision and repository constitution.
2. Canonical domain policies.
3. This PMO operational contract and canonical dashboard specification.
4. Current source Issue and approved project package.
5. PR, checks, reviews, and deployment evidence.
6. Subordinate registry and backlog documents.
7. Drive drafts, historical Issues, prior programs, and chat.

## Documentation replacement rule

PMO changes are applied top-down:

1. update the owning governance policy;
2. update this operating model and dashboard specification;
3. update procedures and subordinate inventories;
4. update implementation plans;
5. reconcile live Issues only through authorized migration.

Do not change one PMO authority surface while knowingly leaving conflicting operational rules elsewhere.

## Related references

- PMO Portfolio policy: `/docs/governance/PMO-PORTFOLIO.md`
- Work Queues and Collaboration policy: `/docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- Weekly PMO review: `/docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md`
- PMO dashboard specification: `/docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md`
- PMO dashboard how-to: `/docs/how-to/pmo/pmo-dashboard.md`
- Queue and dispatch procedure: `/docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- Program registry: `/docs/ops/pmo/program-registry.md`
- PMO backlog: `/docs/ops/pmo/pmo-backlog.md`

## Supersession

This model supersedes prior PMO instructions that:

- hard-code website work as automatic P1;
- use one priority namespace for both Pipeline preparation and Active implementation;
- require team priority on child implementation tasks;
- treat Engineering P1 as proof of launch readiness;
- allow Pipeline-to-Active movement without explicit Project Graduation;
- allow Engineering priority to transfer automatically into PMO priority;
- treat Operations Monitoring or Hold as universal queue blockers;
- create another Issue merely to enable agent collaboration;
- allow static inventory or dashboard data to override live GitHub Issue authority.