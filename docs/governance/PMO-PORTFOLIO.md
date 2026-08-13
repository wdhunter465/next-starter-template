---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: PMO intake, work sizing, delivery-model selection, Sandbox authorization, Pipeline preparation direction, Project Graduation, launch authorization, portfolio inventory, and authoritative priority decisions
Does Not Own: Queue-label mechanics, Development execution, Promotion Candidate execution, CI implementation, Administration & Communications mutation procedure, Day-2 recovery strategy, or Production approval
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2477, #2487, #2640, #2641, #2695, #2699, #3055, #3113
Last Reviewed: 2026-08-06
---

# PMO Portfolio

## Purpose

This document defines how work enters the portfolio, how it is designed and sized, how Pipeline preparation is prioritized, when an optional Sandbox is used, how a delivery model is selected, when a project is reviewed for Project Graduation, and when implementation Go is authorized.

PMO / Engineering owns the decision package. Administration & Communications prepares, routes, records, and reconciles the package but does not make the decision.

Queue classification, priority-label namespaces, queue precedence, preparation-assignment structure, and universal collaboration are defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

PMO defines **sequencing and readiness coordination**, not a general execution gate. PMO prepares launch packages, orders projects, and records prerequisites; it does not deny otherwise authorized, collision-safe implementation after Project Graduation `GO`.

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

## Intake

Every one-off, project, and program enters PMO with:

- stated objective;
- provisional size;
- Product Authority and PMO / Engineering roles;
- initial Pipeline/Engineering priority or Idea state;
- known constraints and dependencies;
- current lane and profile;
- unresolved design assumptions.

Provisional intake is not launch authority.

Pipeline priority identifies preparation order. Pipeline stage identifies actual maturity. Neither establishes implementation Go.

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

When the PMO meeting sets a Pipeline project to Engineering Priority 1, the same decision must create or reactivate accountable Engineering preparation work owned by ChatGPT.

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

Project Graduation is the explicit PMO transition from Pipeline/Engineering preparation to Active/PMO implementation.

Graduation requires:

- a complete-enough launch package;
- truthful Ready for Launch stage;
- PMO meeting review;
- explicit Go;
- a newly assigned Active PMO priority;
- recorded implementation owner, first executable task, and authority.

Engineering priority does not transfer automatically to Active PMO priority. Engineering Priority 1 means prepare first. PMO Priority 1 means implement and complete first.

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

## Dependency and stop taxonomy

PMO records conditions using the taxonomy in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`:

- **Advisory prerequisite** — comment or package note; does not deny collision-safe work.
- **Ordered predecessor** — serial sequence metadata; successor becomes claimable after deterministic predecessor completion (or WORK `ACCEPT` when a substantive gate is defined on that edge).
- **Real collision** — hold scoped to the colliding action only.
- **Protected stop** — legal, privacy, rights, security, credential, cost, destructive-data, Production-authority, unsafe-operation, or independent-review boundary; blocks only the affected unsafe action.

Ordinary predecessor or advisory conditions are not queue-wide `HOLD` or `BLOCKED`. A gated final step must not freeze the queue when earlier increments remain executable. Routine administrative confirmation is not a valid parent blocker.

### Examples

- **Advisory-dependent work:** Pipeline preparation notes a dependency on external design review. Bounded repository documentation may proceed; only the step consuming unapproved design waits.
- **Docs/evidence increment:** A child delivers governance docs now and defers Production promotion until protected review completes.
- **Serial child chain:** Standing Project Graduation authority carries the prepared graph; eligible agents self-claim each package-complete successor after deterministic predecessor completion without routine PMO redispatch (#3055 / #3145).
- **Production-only gate:** Development increments merge under standing authority; only the Production promotion action requires `PRODUCTION GO`.

## Active priority decisions

The PMO meeting manually assigns and changes Active parent priority according to the model in `WORK-QUEUES-AND-COLLABORATION.md`:

- P1, P2, and P3 each have a maximum of four parent projects;
- P4 has no fixed limit;
- completed-task percentage produces promotion-eligibility information only;
- no priority change is automatic;
- projects may complete at any Active priority;
- verification, promotion, Production validation, and closeout remain Active work.

Website delivery may be maintained as the top LGFC priority through PMO decisions. It is not an automatic permanent priority rule independent of portfolio conditions.

## Operations interrupt precedence

Normal repository execution consists primarily of authorized project tasks, Engineering preparation, and Governance stewardship. A qualifying standalone Operations source Issue is a standing Product Authority interrupt and takes precedence while it carries a numbered Operations priority. Governance is a peer stewardship queue (#3152) and is **not** an Operations interrupt.

Operations priority, Monitoring, Hold, and resume semantics — and Governance `gov:*` semantics — are defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`. Recovery authority is defined in `docs/governance/OPERATIONS-AND-RECOVERY.md`.

A qualifying Operations interrupt is:

- an open, same-repository, non-PR Issue owned by `team:operations` with a numbered `ops:priority:*` (title may begin `OPS:`);
- a standalone source Issue rather than a child of a project lifecycle;
- bounded by an objective, owner, scope, acceptance criteria, validation, rollback, and stop conditions appropriate to the work; and
- not merely a generated tracker, duplicate, bookkeeping record, advisory alert, or evidence-only record unless Product Authority explicitly elevates it.

When a qualifying numbered Operations Issue appears:

1. no new PMO, Engineering, or Governance work may be dispatched;
2. active work stops at the nearest safe checkpoint rather than being terminated in a way that corrupts a branch, claim, test, deployment, or evidence state;
3. Administration & Communications preserves exact state and records the Operations interrupt hold;
4. the Operations Issue receives the next available capacity it requires;
5. no additional material-risk test or case-by-case reprioritization decision is required; and
6. PMO, Engineering, and Governance work resume when no numbered Operations Issue remains actionable, subject to recorded Monitoring or Hold interval obligations.

Operations interrupt precedence changes sequencing only. It does not bypass source-Issue scope, promotion profiles, validation, independent review, Production authority, rollback, or protected-stop requirements. Active PMO Project documentation children remain on the PMO graph and are not reclassified as Governance merely because they edit docs.

## Lightweight problem adjustment

When Implementation / Operations reports `PROBLEM FOUND`, PMO / Engineering should first determine whether a bounded adjustment can preserve the approved objective and acceptance criteria.

```text
PROBLEM FOUND
  -> PMO / Engineering reviews evidence
  -> GUIDANCE or ADJUSTMENT
  -> Administration & Communications records
  -> RESUME
```

Use formal `PLAN CHANGE REQUIRED` only when product outcome, architecture, acceptance, dependency structure, delivery model, Production boundary, or release strategy materially changes.

Universal agent collaboration uses the same source-Issue method defined in `WORK-QUEUES-AND-COLLABORATION.md` and does not change queue ownership.

## Emergency exit

Production degradation, outage, unsafe behavior, or material risk exits normal PMO sequencing and routes to Day-2 Operations as an incident. Incident handling is a specialized Operations path within the broader Operations interrupt precedence rule.

A broad assessment hold may pause PMO and Engineering while incident impact is unknown. Once scope, probable cause, containment, and resolution ownership are sufficiently understood, Day-2 Operations may narrow incident-specific holds. Numbered Operations work remains interrupting until changed to Monitoring, Hold, closed, deferred, or otherwise released under recorded authority.

## Portfolio rules

- GitHub program and project Issues are the durable portfolio record.
- Product Authority makes final priority decisions.
- PMO Active priority and Engineering Pipeline priority are mutually exclusive.
- Parent portfolio Issues carry team priority; project child tasks do not.
- Pipeline Priority 1 must have accountable Engineering preparation work.
- Project Graduation is the only normal Pipeline-to-Active transition.
- Planning tools outside the repository are inputs only.
- PMO reporting lag is not an execution blocker unless it prevents authority, dependency, safety, validation, approval, profile transition, or closeout from being determined.
- Independent approved projects may proceed in parallel only when no numbered Operations interrupt is active.
- The portfolio must represent Sandbox, Development, Promotion Candidate, Production, and Day-2 state independently.

## Administration & Communications interface

Administration & Communications may:

- prepare Go/No-Go and Promotion Candidate evidence packets;
- reconcile team, priority, PMO labels, parent/child links, lifecycle reporting, and dashboard state to existing authority;
- route collaboration requests, responses, decisions, acknowledgments, escalation, holds, resumes, and closeout;
- apply and release the standing Operations interrupt hold when the qualifying Issue state and owning-role decision require it;
- preserve historical evidence and interrupted work state.

It may not originate or change priority, size, delivery model, objective, acceptance, dependency, profile, launch authority, recovery strategy, or Production Go.

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

## Supersession

This policy supersedes lower-level PMO instructions where they:

- hard-code website work as automatic Priority 1 rather than recording a PMO decision;
- use one priority meaning for both Active implementation and Pipeline preparation;
- require team priority on child implementation tasks;
- allow priority without accountable Pipeline preparation work;
- treat Engineering Priority 1 as proof of launch readiness;
- permit administrative reporting, generic predecessor state, or routine per-task PMO review to block independent Development after implementation Go;
- require additional risk-based elevation before a qualifying numbered Operations Issue interrupts normal work;
- use queue-wide `HOLD` or `BLOCKED` for ordinary predecessor or advisory conditions;
- freeze an entire project because one final step requires a protected stop;
- delay successor release after verified integration when the successor package is complete.
