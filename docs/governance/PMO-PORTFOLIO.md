---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: PMO intake, work sizing, delivery-model selection, Sandbox authorization, Pipeline preparation direction, Project Graduation, launch authorization, portfolio inventory, and authoritative priority decisions
Does Not Own: Queue-label mechanics, Development execution, Promotion Candidate execution, CI implementation, Administration & Communications mutation procedure, Day-2 recovery strategy, or Production approval
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2477, #2487, #2640, #2641, #2695, #2699, #3055, #3113, #3597
Last Reviewed: 2026-08-18
---

# PMO Portfolio

## Purpose

This document defines how work enters the portfolio, how it is designed and sized, how Pipeline preparation is prioritized, when an optional Sandbox is used, how a delivery model is selected, when a project is reviewed for Project Graduation, and when implementation Go is authorized.

PMO / Engineering owns the decision package. Administration & Communications prepares, routes, records, and reconciles the package but does not make the decision.

Queue classification, priority-label namespaces, queue precedence, preparation-assignment structure, and universal collaboration are defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

PMO defines **sequencing and readiness coordination**, not a general execution gate. PMO prepares launch packages, orders projects, and records prerequisites; it does not deny otherwise authorized, collision-safe implementation after Project Graduation `GO`.

## Scope

This document specifies:

- PMO portfolio intake, sizing, and delivery-model selection;
- Canonical PMO lifecycle stages (`Initial Idea`, `Drafted Design`, `Pending Launch Packet`, `Graduation Candidate`, `Active`, `Closed`);
- Engineering qualification boundaries for `team:engineering`;
- Independent ordered priority sequences (`1...XXX`) for Pipeline preparation and Active implementation;
- Project Graduation prerequisites and launch packet expectations.

## Current known truth

- The canonical PMO lifecycle consists of six explicit stages: `Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`.
- `team:engineering` is explicitly limited to initial problem definition and qualification sufficient for PMO entry. Upon satisfying qualification, `team:engineering` is removed and the project enters PMO Pipeline at `Initial Idea`.
- PMO Priority represents **execution order** (`1...XXX`) within the respective lifecycle queue, not a bounded 4-level severity/importance classification.
- Pipeline priority (`eng:priority:1...XXX`) and Active priority (`pmo:priority:1...XXX`) operate as separate, independent queue-order sequences.
- Project Graduation requires a complete design and launch packet (`Graduation Candidate`) before moving to `Active`.

## Intended final state

- Fully automated PMO portfolio queue management enforcing canonical lifecycle stage transitions and 1...XXX priority sequence sorting across all GitHub issue workflows and dashboard views.

## PMO meeting authority

The weekly PMO meeting between Product Authority and ChatGPT governs:

- parent portfolio priority;
- Pipeline preparation priority;
- project launch and Project Graduation;
- project hold or reprioritization;
- Active project completion;
- Go, No-Go, Hold, and Adjustment decisions.

The PMO meeting does not define individual child-task implementation order.

The project governs:

- child-task sequence;
- dependencies;
- implementation order;
- technical execution within approved authority.

Product Authority makes final priority and business decisions. PMO / Engineering prepares classifications, recommendations, launch packages, and readiness assessments.

## Intake and Engineering Qualification

Every project enters the portfolio through initial intake:

- **Engineering Qualification (`team:engineering`):** Explicitly limited to coherent problem definition plus remediation objectives/design direction sufficient for PMO entry. Once minimum qualification is satisfied, `team:engineering` is removed and the project enters PMO Pipeline at `Initial Idea`.
- Stated objective, provisional size, Product Authority and PMO / Engineering roles;
- Known constraints, dependencies, and unresolved design assumptions.

Provisional intake is not launch authority. Pipeline priority identifies preparation order (`eng:priority:1...XXX`). Pipeline stage identifies actual maturity. Neither establishes implementation Go.

## Canonical PMO Lifecycle Stages

PMO Pipeline projects progress serially through six canonical lifecycle stages:

1. **Initial Idea:** Raw concept recorded with problem statement and initial scope outline.
2. **Drafted Design:** Architecture, design options, and technical proposals drafted and undergoing review.
3. **Pending Launch Packet:** Design approved; detailed launch packet being assembled (child tasks, implementation plan, sequence, dependencies, validation, rollback, operational handoff).
4. **Graduation Candidate:** Complete design and launch packet assembled; all prerequisites linked and ready for PMO graduation review.
5. **Active:** PMO explicitly graduates the project, assigns an Active priority (`pmo:priority:1...XXX`), and selects one start-to-finish implementation owner.
6. **Closed:** Implementation, acceptance, and closeout are complete with durable evidence recorded.

## Pipeline preparation

Before implementation Go, PMO / Engineering defines:

- requirements and acceptance criteria;
- architecture and design;
- scope and non-goals;
- dependencies and protected stops;
- verification and rollback expectations;
- delivery model;
- whether Sandbox evidence is needed;
- Development work package;
- Promotion Candidate expectations;
- Production and Day-2 boundaries.

When the PMO meeting sets a Pipeline project to Pipeline Priority 1 (`eng:priority:1`), the same decision must create or reactivate accountable Engineering preparation work owned by ChatGPT.

That preparation work is a peer Issue related to the Pipeline parent. It is not a project child task, does not use `pmo:task`, and does not count toward implementation completion percentage.

The required output is a complete-enough launch package for the next applicable PMO meeting, including the master Issue, ordered child Issues, implementation plan, dependencies, validation, rollback, stop conditions, execution recommendation, and Go/No-Go readiness assessment.

A Pipeline project may remain at any priority or stage without a time limit. Priority changes are manual PMO decisions and do not assert that the project is already launch-ready.

## Sandbox authority

Sandbox is an optional PMO / Engineering proof-of-concept profile.

Use Sandbox when factual experimentation can reduce material design uncertainty before Development.

Sandbox requirements:

- isolated remote branch or environment;
- a clear question or assumption to test;
- scaled-down safety checks;
- no Production credentials, writes, bindings, or promotion path;
- explicit result: discard, retain evidence, or adopt into Development.

Sandbox is not implementation Go and cannot promote directly to Promotion Candidate or Production.

When Sandbox output is adopted, PMO / Engineering converts the evidence into a normal Development work package and identifies experimental shortcuts that must be removed, tested, or hardened.

## Size contract

### Small

Small requires all of the following:

- one complete and independently reviewable PR;
- one-step rollback;
- full pre-Production testability;
- no unresolved architecture decision;
- no protected multi-step boundary;
- no harmful incomplete Production state.

### Large

Large is satisfied when any of the following is true:

- multiple deployable components;
- multiple planned Production promotions;
- multiple architectural or data domains requiring independent release units;
- several protected boundaries;
- a platform migration or repository-wide operating-model change.

### Medium

Medium is everything not objectively Small or Large.

## Delivery-model selection

Select Model A only when the complete solution fits one reviewable PR, can become a complete Promotion Candidate before merge, and has one-step rollback.

Any failed condition selects Model B.

Model B is the default for remote component-branch implementation, multiple Development increments, or work needing integrated Promotion Candidate qualification.

No work may use both Model A and Model B for the same release unit.

## Promotion-profile planning

PMO / Engineering records the intended profile path:

```text
optional Sandbox -> Development -> Promotion Candidate -> Production
```

For Model A, the single PR itself becomes the Promotion Candidate before Production merge.

For Model B:

- child tasks execute in Development;
- integrated component state becomes the Promotion Candidate;
- Production is a separate controlled promotion.

Development cannot promote directly to Production.

## Project Graduation and implementation Go

Project Graduation is the explicit PMO transition from Pipeline preparation (`Graduation Candidate`) to Active implementation (`Active`).

Graduation requires:

- a complete design and launch packet;
- truthful `Graduation Candidate` stage;
- PMO meeting review;
- explicit Go;
- a newly assigned Active PMO priority (`pmo:priority:1...XXX`);
- recorded single implementation owner for start-to-finish delivery, first executable task, and authority.

Pipeline priority does not transfer automatically to Active PMO priority. Pipeline Priority 1 means prepare first. Active Priority 1 means implement and complete first.

Implementation Go authorizes Development execution against the complete work package. It does not authorize Production promotion.

After Go:

- routine PMO ceremony does not throttle Development;
- independent tasks may proceed while prior tasks are review- or administration-pending;
- PR review pauses the affected task, not the entire project;
- PMO / Engineering remains available for lightweight problem adjustment;
- material plan changes return to PMO / Engineering authority;
- when only part of a task is gated, split bounded increments and continue collision-safe work;
- WORK prepares successor packages before implementer idle time; eligible agents self-claim the next package-complete child under standing parent authority after deterministic predecessor completion (#3145);
- Product-authorized agent routing (Cursor Local, Claude Code) is preserved per Team eligibility and claim.

Active parent priority selects which project receives focus. The selected project's own task sequence and dependencies select the next executable child task. Child tasks do not carry team-level priority.

## Active and Pipeline Priority Models (Execution Order)

PMO priority is an **ordered work sequence** (`1...XXX`) within the respective lifecycle queue, not a 4-level severity/importance classification.

- **Pipeline Priority (`eng:priority:1...XXX`):** Defines the order in which PMO Pipeline projects should be prepared and packaged.
- **Active Priority (`pmo:priority:1...XXX`):** Defines the order in which Active projects should be implemented and completed.
- Priority `1` means the top position in that queue; subsequent projects follow in numerical order (`1, 2, 3...XXX`).
- Pipeline and Active maintain separate, independent priority sequences.

## Operations interrupt precedence

Normal repository execution consists primarily of authorized project tasks, Engineering preparation, and Governance stewardship. A qualifying standalone Operations source Issue is a standing Product Authority interrupt and takes precedence while it carries a numbered Operations priority. Governance is a peer stewardship queue (#3152) and is **not** an Operations interrupt.

Operations priority, Monitoring, Hold, and resume semantics — and Governance `gov:*` semantics — are defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`. Recovery authority is defined in `docs/governance/OPERATIONS-AND-RECOVERY.md`.

When a qualifying numbered Operations Issue appears:

1. no new PMO, Engineering, or Governance work may be dispatched;
2. active work stops at the nearest safe checkpoint;
3. Administration & Communications preserves exact state and records the Operations interrupt hold;
4. the Operations Issue receives the next available capacity it requires;
5. PMO, Engineering, and Governance work resume when no numbered Operations Issue remains actionable.

## Portfolio rules

- GitHub program and project Issues are the durable portfolio record.
- Product Authority makes final priority decisions.
- PMO Active priority and Engineering Pipeline priority are mutually exclusive.
- Parent portfolio Issues carry team priority; project child tasks do not.
- Pipeline Priority 1 must have accountable Engineering preparation work.
- Project Graduation is the only normal Pipeline-to-Active transition.
- Planning tools outside the repository are inputs only.
- The portfolio represents Initial Idea, Drafted Design, Pending Launch Packet, Graduation Candidate, Active, and Closed states independently.

## Canonical references

| Topic | Owner |
| --- | --- |
| Work queues, priorities, graduation, collaboration | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` |
| Lane and promotion-profile definitions | `docs/reference/operations/operating-lanes-and-promotion-profiles.md` |
| Delivery and release policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Administration & Communications | `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md` |
| Operations and recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Size and delivery-model facts | `docs/reference/pmo/work-size-and-delivery-model-contract.md` |
| Classification procedure | `docs/how-to/pmo/classify-work-and-select-delivery-model.md` |
