---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Repository work-queue classification, queue precedence, team-assignment and priority namespaces, team vs agent claim lifecycle, Active and Pipeline priority semantics, Project Graduation, queue-state transitions, universal agent collaboration, and collaboration interaction with pull requests
Does Not Own: Product outcome, final priority decisions, project design, implementation methods, recovery strategy, PR approval decisions, Production authorization, dashboard runtime implementation, or label-migration execution
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2695, #2699, #3055, #3113, #3145, #3152, #3240, #3134, #3597
Last Reviewed: 2026-08-18
---

# Work Queues and Collaboration

## Purpose

This document defines how LGFC work is classified, prioritized, interrupted, prepared, executed, and collaboratively supported across the repository.

It establishes one Operations interrupt queue above three peer normal-work queues:

```text
Operations interrupt queue
        |
        +-- Governance stewardship queue
        +-- PMO Active implementation queue
        +-- Engineering Pipeline-preparation queue
```

Operations has precedence while numbered Operations work is actionable. Governance, PMO, and Engineering are peer normal-work queues with mutually exclusive meanings and priority namespaces. Governance is **not** an Operations interrupt queue and is **not** an Active PMO Project queue.

PMO defines **sequencing and readiness coordination**, not a general execution gate. PMO orders launched projects and records prerequisites; it does not deny otherwise authorized, collision-safe work. Dependencies and prerequisites are normally comments, package notes, and order metadata — not queue-wide `HOLD` or `BLOCKED` states for ordinary predecessor or advisory conditions.

## Scope

This document covers:

- Work queue classification rules (`team:operations`, `team:governance`, `team:pmo`, `team:engineering`);
- Engineering qualification boundaries for `team:engineering`;
- Canonical PMO lifecycle stages (`Initial Idea`, `Drafted Design`, `Pending Launch Packet`, `Graduation Candidate`, `Active`, `Closed`);
- Independent ordered priority models (`1...XXX`) for Pipeline preparation and Active implementation;
- Project Graduation prerequisites and queue state transitions;
- Universal agent collaboration protocol.

## Current known truth

- The canonical PMO lifecycle comprises six explicit stages: `Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`.
- `team:engineering` is explicitly limited to initial problem definition and qualification. Once minimum Engineering qualification is satisfied, `team:engineering` is removed and the project enters the PMO Pipeline queue at `Initial Idea`.
- Priority labels represent **execution order sequence** (`1...XXX`), not a fixed 4-level severity classification.
- PMO Pipeline priority (`eng:priority:1...XXX`) and PMO Active priority (`pmo:priority:1...XXX`) operate as separate, independent queue-order sequences.
- Project Graduation moves a project from `Graduation Candidate` (Pipeline) to `Active` (PMO implementation) with a newly assigned Active priority and single implementation owner.

## Intended final state

- Unified issue tracking and dashboard visibility reflecting canonical PMO lifecycle stages and 1...XXX priority sequence sorting without 4-level priority cap constraints.

## Authority boundary

Product Authority and the weekly PMO meeting make final priority, launch, hold, reprioritization, graduation, and completion decisions.

This policy defines how those decisions are represented and executed. It does not make the decisions.

The detailed domain authorities remain:

- PMO portfolio and launch decisions: `docs/governance/PMO-PORTFOLIO.md`;
- team roles and approval authority: `docs/governance/AGENT-TEAM.md`;
- Operations recovery strategy: `docs/governance/OPERATIONS-AND-RECOVERY.md`;
- communication transport and reconciliation: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`;
- pull-request process and formal review: `docs/governance/PR_PROCESS.md`.

## Work queues

### Operations

Operations is Day-2 support for a website or repository capability that is already in Production and has failed, degraded, become unsafe, or stopped meeting its accepted operating standard.

### Governance

Governance is the repository-stewardship queue for standards, authority integrity, governance/documentation audits, policy and process-contract maintenance, Diátaxis/placement audits, agent-routing/authority-stack audits, documentation-drift reconciliation, and isolated repository-governance improvements (#3152).

### PMO (Active Implementation)

PMO is the Active queue for launched projects being implemented, validated, promoted, deployed, verified, and closed. PMO coordinates **when** work runs and **in what order**; it is not a blanket deny gate for authorized implementation.

PMO Active priority answers:

> In what order (`pmo:priority:1...XXX`) should launched projects receive focus and be completed?

### Engineering (Pipeline Preparation & Qualification)

`team:engineering` is the queue for initial qualification and Pipeline preparation:

- **Engineering Qualification:** `team:engineering` is explicitly limited to coherent problem definition plus remediation objectives/design direction sufficient for PMO entry.
- **Pipeline Entry:** Once minimum qualification is satisfied, remove `team:engineering` and enter the PMO Pipeline queue at `Initial Idea`.
- **Pipeline Preparation:** Engineering priority (`eng:priority:1...XXX`) answers: In what order should Pipeline projects be designed, documented, packaged, and made ready for graduation?

## Canonical PMO Lifecycle Stages

PMO projects progress serially through six canonical lifecycle stages:

1. **Initial Idea:** Concept recorded with problem statement and initial scope.
2. **Drafted Design:** Architecture, design options, and technical proposals drafted and undergoing multi-agent / stakeholder feedback.
3. **Pending Launch Packet:** Design approved; complete launch packet being created (child tasks, implementation plan, sequencing/dependencies, acceptance/validation, rollback/recovery, operational handoff).
4. **Graduation Candidate:** Complete design and launch packet assembled; ready for PMO graduation review.
5. **Active:** PMO explicitly graduates the project, assigns an Active priority (`pmo:priority:1...XXX`), and selects one end-to-end implementation owner.
6. **Closed:** Required implementation, acceptance, and closeout are complete with durable evidence recorded.

## Exclusive queue ownership

A source Issue belongs to at most one work queue at a time:

- `team:operations`;
- `team:governance`;
- `team:pmo`;
- `team:engineering`.

An Issue must never carry more than one `team:*` assignment. Priority and state labels must match the assigned team.

## Queue labels and priority namespaces

### PMO labels (Active Implementation)

Active portfolio parents use:

```text
team:pmo
pmo:priority:1 ... pmo:priority:XXX
```

Active priority represents ordered execution position (`1...XXX`).

### Engineering labels (Pipeline Preparation)

Pipeline portfolio parents and Engineering qualification/preparation assignments use:

```text
team:engineering
eng:priority:1 ... eng:priority:XXX | eng:priority:idea
```

Pipeline priority represents ordered preparation position (`1...XXX`).

## Ordered Execution Priority Model (`1...XXX`)

PMO priority is an **ordered execution sequence** within the applicable lifecycle queue, not a 4-level severity classification:

- **Pipeline Priority (`1...XXX`):** Defines preparation order for PMO Pipeline projects.
- **Active Priority (`1...XXX`):** Defines implementation order for Active PMO projects.
- **Separate Sequences:** Pipeline and Active maintain independent priority sequences.
- Priority `1` represents the top queue position; higher numbers follow in contiguous numerical order.

## Project Graduation

Project Graduation is the explicit PMO transition from Pipeline preparation (`Graduation Candidate`) into Active implementation (`Active`).

Graduation requires:

1. a complete design and launch packet;
2. truthful `Graduation Candidate` stage;
3. PMO meeting review;
4. explicit Go;
5. assignment of an Active PMO priority (`pmo:priority:1...XXX`);
6. recorded single start-to-finish execution owner, first executable task, and implementation authority.

At graduation:

- remove `team:engineering` and `eng:priority:*`;
- add `team:pmo` and the assigned `pmo:priority:*`;
- preserve prepared child tasks and dependency structure.

Engineering priority never transfers automatically to PMO priority. Pipeline Priority 1 means prepare first; Active Priority 1 means execute and complete first.

## Standing graduated-project authority and continuous parent-level execution

Project Graduation to Active, with a complete prepared child graph and eligible implementation agent recorded at the parent, provides standing implementation authority for that exact graph (#3055 / #3145).

Eligible agents self-claim the next package-complete child task one task at a time. Routine per-task PMO redispatch is not required.

## Peer and child relationships

These are peer source records:

- standalone Operations Issues;
- Active PMO project/program parents;
- Pipeline portfolio parents;
- Engineering preparation Issues.

Only real project implementation tasks use `Parent Project:` and child-task classification.

## Supersession

This policy supersedes lower-level or legacy instructions that:

- cap PMO priority at a fixed 1–4 severity range rather than supporting ordered execution sequence `1...XXX`;
- combine PMO Active priority with Pipeline preparation priority;
- permit `team:engineering` to remain on projects after minimum Engineering qualification for PMO entry is satisfied;
- allow one Issue to belong to multiple team-priority namespaces;
- treat `Graduation Candidate` or `Pending Launch Packet` as Active implementation authority before explicit PMO graduation.
