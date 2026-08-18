---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Repository work-queue classification, queue precedence, team-assignment and priority namespaces, team vs agent claim lifecycle, Active and Pipeline priority semantics, Project Graduation, queue-state transitions, universal agent collaboration, and collaboration interaction with pull requests
Does Not Own: Product outcome, final priority decisions, project design, implementation methods, recovery strategy, PR approval decisions, Production authorization, dashboard runtime implementation, or label-migration execution
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2695, #2699, #3055, #3113, #3145, #3152, #3240, #3134, #3188
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

A qualifying standalone Operations Issue:

- is the authoritative source Issue for the operational problem;
- is not a child of a project master;
- interrupts new PMO implementation and Engineering preparation while it carries a numbered Operations priority;
- receives the next available capacity required for remediation;
- remains subject to scope, validation, independent review, Production authority, rollback, and recovery controls.

Cursor is the normal primary remediation implementer. WORK may participate as Tier 2 Operations support when design, architecture, acceptance, recovery planning, or independent Engineering judgment is needed.

### Governance

Governance is the repository-stewardship queue for standards, authority integrity, governance/documentation audits, policy and process-contract maintenance, Diátaxis/placement audits, agent-routing/authority-stack audits, documentation-drift reconciliation, and isolated repository-governance improvements (#3152).

Typical Governance Issues may be bounded and standalone. They do **not** require Project Graduation merely to be executable.

Governance is not:

- an Operations interrupt over PMO/Engineering;
- an Active PMO Project/Program delivery queue;
- a bypass around Engineering preparation or PMO delivery for substantial future product/system implementation.

If Governance work discovers or grows into a substantial future implementation Project, keep the stewardship finding on Governance and route the implementation candidate into Engineering preparation / PMO delivery under normal graduation rules.

Cursor Local is the normal implementation executor for bounded Governance documentation/repository changes unless the source Issue says otherwise. Claude Code may perform Governance work when explicitly assigned. WORK may own Governance analysis, policy decisions, and independent assurance according to durable-role mapping.

### PMO

PMO is the Active queue for launched projects being implemented, validated, promoted, deployed, verified, and closed. PMO coordinates **when** work runs and **in what order**; it is not a blanket deny gate for authorized implementation.

PMO priority answers:

> In what order should launched projects receive focus and be completed?

The PMO meeting governs parent priority, project launch, project hold or reprioritization, Project Graduation, and project completion.

The project governs child-task sequence, dependencies, implementation order, and technical execution within approved authority.

### Engineering

Engineering is the Pipeline-preparation queue for projects that have not received implementation Go.

Engineering priority answers:

> In what order should Pipeline projects be designed, documented, packaged, and made ready for a future Go/No-Go decision?

ChatGPT is the normal Engineering preparation owner. Cursor may collaborate for bounded repository inspection, feasibility evidence, validation design, or authorized Sandbox work. Collaboration does not authorize Active implementation.

## Exclusive queue ownership

A source Issue belongs to at most one work queue at a time:

- `team:operations`;
- `team:governance`;
- `team:pmo`;
- `team:engineering`.

An Issue must never carry more than one `team:*` assignment.

Priority and state labels must match the assigned team. Cross-namespace combinations are prohibited because they create dual ownership and contradictory routing.

Classification rule:

- accepted capability failed/degraded/unsafe → Operations;
- repository governance/standards/documentation stewardship or isolated policy/audit → Governance;
- already-launched Project/Program being delivered → PMO;
- future Project/Program being designed/prepared → Engineering.

Active Project children that edit documentation remain on the PMO parent graph (`team:pmo` parent / `pmo:task` child) — they are not moved to Governance merely because they edit docs.

Examples of invalid state:

```text
team:engineering + pmo:priority:1
team:pmo + eng:priority:1
team:operations + team:pmo
team:governance + ops:priority:1
ops:priority:2 + eng:priority:2
gov:priority:1 + pmo:priority:1
```

Collaboration labels or collaborator assignments do not change the queue owner.

## Team ownership versus agent claim lifecycle

`team:*` and `agent:*` are orthogonal and must not be conflated (#3240).

- **`team:*`** = durable queue ownership (Where does this work live?). Remains for the Issue lifecycle until completion or formal transfer.
- **`agent:*`** = active execution claim or explicit Product Authority reservation (Who has this work in hand right now?). Not permanent pre-assignment.

### Required claim lifecycle (summary)

1. New team-queue Issues enter **without** `agent:*` by default.
2. Eligible agent selects work by team priority, dependencies, collisions, and authority.
3. Before starting, agent adds its `agent:*` label and records claim/ack on the source Issue.
4. While the claim is active, other agents must not independently start the same Issue unless collaboration is requested.
5. At PR-ready / handoff, release the claim unless remediation or post-merge duties remain.
6. If the agent cannot continue or the claim is stale, remove `agent:*` so the Issue is claimable again.
7. `team:*` remains until complete or transferred.

### Reserved assignment exception

Product Authority may deliberately reserve an Issue (e.g. "Assign #3215 to Claude"). That `agent:*` remains until the reserved agent starts, authority releases it, or an authorized workflow invalidates the reservation.

### Claim hygiene

- Do not pre-populate `agent:*` on ordinary new team-queue Issues.
- Do not refuse eligible work solely because an unconfirmed `agent:*` label exists.
- Claims must be atomic enough to prevent dual independent starts.
- Stale claims must be releasable without Product Authority as routine messenger.
- Collaboration does not transfer queue ownership or the primary claim unless execution ownership changes.

### Migration classification

| Class | Action |
| --- | --- |
| ACTIVE_CLAIM | Keep |
| EXPLICIT_RESERVATION | Keep until released |
| STALE_PREASSIGNMENT | Remove only after evidence |
| AMBIGUOUS | Leave unchanged; surface |

Full detail and open-Issue audit: `docs/ops/reports/issue-3240-team-agent-claim-semantics-migration-audit.md`.

### Orthogonal example

`team:engineering` + `flow:builder` + `agent:grok` means Engineering owns the queue, Builder Flow governs behavior, and Grok currently has the Issue in hand.

## Queue labels and priority namespaces

### Operations labels

Operations source Issues use:

```text
team:operations
```

and exactly one Operations priority or non-blocking state:

```text
ops:priority:1
ops:priority:2
ops:priority:3
ops:priority:4
ops:monitoring
ops:hold
```

All numbered Operations priorities are actionable and interrupt PMO and Engineering work. The number orders multiple actionable Operations Issues.

`ops:monitoring` means remediation has progressed as far as currently possible and stability or recurrence must be observed on a recorded interval.

`ops:hold` means remediation cannot progress until specified information, authority, access, vendor action, external evidence, or another release condition is satisfied.

Monitoring and Hold do not block PMO or Engineering work. Each must record:

- reason;
- responsible owner;
- update interval or next-review time;
- evidence expected;
- condition for returning to a numbered priority or closing.

When a numbered Operations Issue has been worked as far as possible, it must move to Monitoring or Hold rather than remain falsely actionable.

### Governance labels

Governance source Issues use:

```text
team:governance
```

and exactly one Governance priority or non-blocking state:

```text
gov:priority:1
gov:priority:2
gov:priority:3
gov:priority:4
gov:review
gov:hold
```

Numbered Governance priorities order stewardship work. They do **not** interrupt PMO or Engineering the way numbered Operations priorities do.

`gov:review` means the stewardship task is awaiting recorded independent/governance review or assurance evidence on a defined interval.

`gov:hold` means the stewardship task cannot progress until specified information, authority, access, or another release condition is satisfied.

Review and Hold must record reason, owner, update interval or next-review time, expected evidence, and return/close condition.

### PMO labels

Active portfolio parents use:

```text
team:pmo
pmo:priority:1 | pmo:priority:2 | pmo:priority:3 | pmo:priority:4
```

PMO priority is defined only on the Active project or program parent. Child tasks do not receive PMO priority labels.

### Engineering labels

Pipeline portfolio parents and their peer Engineering preparation assignments use:

```text
team:engineering
eng:priority:1 | eng:priority:2 | eng:priority:3 | eng:priority:4 | eng:priority:idea
```

Engineering priority is not implementation authority and does not indicate actual readiness. Pipeline stage separately reports maturity.

## Active PMO priority model

| Priority | Execution meaning | Capacity | Promotion eligibility signal |
| --- | --- | ---: | --- |
| P1 | Current team focus whenever executable work exists | Maximum 4 parent projects | Not applicable |
| P2 | Work when no executable P1 work exists | Maximum 4 parent projects | Eligible for P1 consideration at 80% complete |
| P3 | Work when no executable P1 or P2 work exists | Maximum 4 parent projects | Eligible for P2 consideration at 70% complete |
| P4 | Opportunistic work when higher-priority work is not executable | No fixed limit | Eligible for P3 consideration at 50% complete |

Rules:

- All priority changes are manual PMO meeting decisions.
- Percentage completion is completed linked tasks divided by total linked tasks.
- Thresholds signal eligibility only; they never change priority automatically.
- Eligibility may be stated in the parent description.
- Capacity limits apply to parent projects/programs, not child tasks.
- A project may complete and close at P2, P3, or P4.
- Lower-priority completion is valid use of otherwise idle execution capacity.
- Verification, promotion, deployment validation, and administrative closeout remain Active project work.
- Website delivery may be established as the top LGFC priority by the PMO meeting, but it is not permanently hard-coded as automatic P1 policy.

## Engineering Pipeline priority model

Pipeline priority controls preparation order, not implementation order.

| Engineering priority | Meaning |
| --- | --- |
| P1 | Prepare this project for the next applicable PMO graduation review ahead of lower-priority Pipeline work |
| P2 | Next preparation wave after current P1 preparation needs |
| P3 | Future definition and planning work |
| P4 | Opportunistic or longer-range preparation |
| Idea | Retained for PMO awareness without numbered preparation priority |

Rules:

- Priority and Pipeline stage are independent.
- Any Pipeline project may move directly from P2, P3, P4, or Idea to Engineering P1.
- Engineering P1 may truthfully remain at Intake, Discovery, Definition, Planning, Preparation, or Ready for Launch.
- There is no time limit for a project to remain at any Engineering priority or Pipeline stage.
- Priority changes are manual PMO meeting decisions.
- Engineering P1 creates accountable preparation work; priority alone is not considered sufficient routing.

## Engineering preparation assignment

When the PMO meeting sets a Pipeline parent to Engineering P1, the same meeting closeout must create or reactivate one peer Engineering preparation Issue owned by ChatGPT.

The preparation Issue:

- is peer to the Pipeline parent;
- references the parent with `Related Pipeline Project: #<number>` or `Graduation Target: #<number>`;
- must not use `Parent Project:`;
- must not use `pmo:task`;
- does not count toward implementation completion percentage;
- carries `team:engineering` and the applicable `eng:priority:*` label;
- has one bounded objective: prepare the project for Project Graduation review.

Required preparation outputs include, as applicable:

- reconciled objective, scope, and non-goals;
- requirements and acceptance criteria;
- architecture and design;
- repository authority and document disposition;
- dependency and collision analysis;
- implementation plan;
- master Issue refinement;
- ordered implementation child Issues;
- file scopes and validation requirements;
- risk, rollback, stop, and Production boundaries;
- execution-agent recommendation;
- launch-readiness assessment;
- Go, No-Go, Hold, or Adjustment recommendation.

There must be no more than one open Engineering preparation assignment for the same Pipeline parent.

## Project Graduation

Project Graduation is the explicit PMO transition from Pipeline/Engineering preparation into Active/PMO implementation.

Graduation requires:

1. a complete-enough launch package;
2. truthful `Ready for Launch` Pipeline stage;
3. PMO meeting review;
4. explicit Go;
5. assignment of an Active PMO priority;
6. recorded execution owner, first executable task, and implementation authority.

At graduation:

- remove the Pipeline lifecycle and stage representation;
- remove `team:engineering` and `eng:priority:*`;
- add the Active lifecycle representation;
- add `team:pmo` and the PMO-selected `pmo:priority:*`;
- preserve the prepared task sequence and dependencies.

Engineering priority never transfers automatically to PMO priority. Engineering P1 means prepare first; PMO P1 means execute and complete first.

## Child-task execution order

Child tasks are ordered according to project needs, not PMO or Engineering priority.

A child task should identify ordering through Issue-body metadata such as:

- Task ID;
- predecessor;
- successor;
- dependency;
- execution sequence.

Sequence labels may be introduced only when a separate implementation decision proves they improve deterministic routing. Team priority labels are prohibited on child tasks.

## Dependency and stop taxonomy

Every recorded condition must use exactly one class:

| Class | Meaning | Representation |
| --- | --- | --- |
| Advisory prerequisite | Soft ordering or helpful context; does not deny collision-safe work | Comment, package note, or dependency-map row |
| Ordered predecessor | Serial child waits for deterministic predecessor completion (validated merge + post-merge closeout, or WORK `ACCEPT` only when the project defines a substantive acceptance gate on that edge) | Predecessor/successor metadata in Issue body or task graph |
| Real collision | Overlapping branch, file, credential, or deployment surface | Evidence-specific hold scoped to the colliding action |
| Protected stop | Legal, privacy, rights, security, credential, cost, destructive-data, Production-authority, unsafe-operation, or independent-review boundary | Evidence-specific `HOLD` scoped to the affected unsafe action only |

Ordinary predecessor or advisory conditions are **not** `HOLD` or `BLOCKED`. When only part of a task is gated, split bounded increments and continue collision-safe work. A gated final step must not freeze the queue.

### Examples

- **Advisory-dependent work:** A child notes "prefer Task 003 design context." Docs and validation increments proceed; only the integration step requiring unverified design waits.
- **Docs/evidence increment:** Split "implement feature" (executable) from "Production promotion" (protected stop until `PRODUCTION GO`).
- **Serial child chain:** After deterministic predecessor completion, an eligible agent self-claims the next package-complete successor under standing parent authority without routine PMO redispatch (#3055 / #3145).
- **Production-only gate:** Development tasks continue under standing authority; Production dispatch pauses only for the promotion action.

## Standing graduated-project authority and continuous parent-level execution

Project or Program Graduation to Active, with a complete prepared child graph and eligible implementation agents recorded at the parent, is standing implementation authority for that exact graph (#3055 / #3145). It is not consumed after the first child and does not require Administration, PMO, Product Authority, or an agent to restate unchanged authority between prepared serial children.

`team:*` labels record durable Team ownership for the Issue's entire lifecycle. `agent:*` labels record the current execution claim or explicit reservation only and do not transfer Team, Project, Program, or portfolio ownership. Full claim lifecycle is defined in **Team ownership versus agent claim lifecycle** above (#3240).

Eligible agents **self-claim** the next package-complete child one task at a time. Routine PMO redispatch, WORK "release," or administrative confirmation between already-authorized tasks is not required and must not idle an otherwise eligible executor.

A serial successor becomes claimable when all of the following are true:

- the recorded project/program sequence identifies it as next (or explicitly authorizes parallel disjoint work);
- its predecessor is deterministically complete for graph purposes — validated merge plus successful post-merge closeout, or an evidence-backed WORK `ACCEPT` when the project defines a substantive acceptance gate on that edge;
- its live Issue is package-complete under `docs/templates/executable-child-task-template.md`;
- the starting target, branch rule, writable allowlist, non-goals, tests, failure paths, evidence, rollback, independent review, handoff, closeout, and protected stops are explicit;
- no technical dependency, collision, numbered Operations interrupt, evidence-specific hold, failed verification, or protected decision blocks it; and
- the claiming agent is eligible for the Issue's owning Team (`team:operations`, `team:governance`, `team:pmo`, or `team:engineering`).

Before each claim, the agent evaluates recorded order, predecessor evidence, factual dependencies, active claims and repository collisions, protected stops, required Product/Production/privacy/security/cost/rights authority, Operations precedence, and Team eligibility.

### WORK assurance versus dispatch

WORK, acting through PMO / Engineering and Administration & Communications, owns preparation and graduation, monitoring and assurance, substantive acceptance where a judgment gate is defined, child/parent reconciliation, exception and HOLD handling, and portfolio reconciliation. WORK is **not** a routine per-task dispatcher after a fully prepared parent is Active.

After verified integration, WORK records `ACCEPT`, bounded correction via `REMEDIATE`, evidence-specific `HOLD` (protected stop or real collision only), or `VERIFY MORE` when judgment is required or a discrepancy appears. Deterministic CI remains the single automatic source-Issue closeout owner and may attempt mechanically provable closeout and bookkeeping first; it does not invent acceptance, waive disputed risks, or authorize protected decisions.

While a predecessor is in review or verification, WORK prepares the successor package so implementer idle time does not occur after deterministic completion. A missing package is `PACKAGE-INCOMPLETE`, not an implementation assignment and not a generic dependency block. A wake event, label, or dispatcher message transports existing authority; it does not recreate it.

Product-authorized agent routing is preserved: each claimed task has exactly one implementation executor (Cursor Local or Claude Code per Team eligibility in `docs/governance/AGENT-TEAM.md`). PMO sequencing does not invent unprepared tasks or bypass the parent graph.

Parallel execution is permitted only when the project master explicitly authorizes it and records disjoint writable scopes, collision safety, dependency independence, and separate review/closeout evidence.

## Daily work precedence

### Cursor

1. Actionable `team:operations` Issues (self-claim by queue priority and eligibility).
2. Active `team:pmo` project/program children under standing parent authority (self-claim next eligible child).
3. Actionable `team:governance` stewardship Issues (self-claim by `gov:*` priority/eligibility).
4. Engineering collaboration only when explicitly requested and bounded — Cursor is not a normal Engineering executor.

Operations Monitoring and Hold Issues receive their required interval updates but do not block PMO, Governance, or Engineering work. An actionable Operations Issue interrupts ordinary PMO and Governance implementation at the nearest safe checkpoint; Cursor resumes after the interrupt clears. Governance does not interrupt PMO or Engineering.

### Claude Code

1. Active `team:pmo` project/program children under standing parent authority (self-claim when eligible).
2. `team:engineering` Pipeline and Active Engineering work (self-claim by Engineering priority and eligibility).
3. `team:governance` stewardship work when explicitly assigned.
4. Bounded `team:operations` support only when an Operations Issue is explicitly escalated beyond normal Cursor-only handling — Claude does not normally self-claim the Operations queue, and escalation does not create a fifth Team or change Team ownership.

### Work

1. Numbered Operations Issues when assigned for Tier 2 support, Engineering judgment, review, or coordination.
2. Governance analysis, policy/design decisions, repository-governance review, and independent assurance when assigned.
3. PMO preparation, graduation, monitoring, assurance, substantive acceptance, exception handling, and closeout.
4. Engineering Pipeline preparation and portfolio reconciliation.

## Universal collaboration method

Any agent working an authoritative source Issue may request bounded collaboration from another agent on that same Issue.

Collaboration does not:

- create a second source Issue;
- change team ownership;
- change priority namespace;
- replace the Issue owner;
- authorize implementation, approval, Production action, or Project Graduation beyond the collaborator's recorded role.

Use four universal events:

```text
COLLABORATION REQUEST
COLLABORATION ACKNOWLEDGED
COLLABORATION RESPONSE
COLLABORATION COMPLETE
```

### Collaboration request

A request identifies:

- source Issue;
- source team and current owner;
- requesting agent and role;
- target agent and role;
- exact bounded contribution;
- evidence and references;
- blocking scope;
- authority retained by the source owner or controlling role;
- acknowledgment requirement;
- completion condition.

### Acknowledgment

The target agent acknowledges on the same source Issue, states the accepted scope, and identifies any missing evidence.

Acknowledgment is required before the target claims unrelated work, unless a higher-priority numbered Operations interrupt applies. Acknowledgment does not transfer queue ownership or manufacture approval.

### Response

The collaborator records evidence-specific analysis, guidance, validation, or recommendation on the same source Issue. Existing decision vocabulary may be used when applicable:

- `GUIDANCE`;
- `ADJUSTMENT`;
- `PROBLEM FOUND`;
- `PLAN CHANGE REQUIRED`;
- `HOLD`;
- `RESUME`.

### Completion

The collaborator records completion, the evidence reviewed, the bounded result, any remaining condition, and the next action returned to the Issue owner.

The Issue owner then resumes execution.

## Collaboration involving pull requests

The source Issue owns assignment, routing, authority, queue, and collaboration state.

The pull request owns the diff, checks, review threads, and technical evidence.

Normal collaboration involving a PR works as follows:

1. request collaboration on the source Issue and identify the PR and relevant head SHA;
2. collaborator reads the PR, diff, checks, or threads as necessary;
3. collaborator records the bounded response on the source Issue;
4. Issue owner applies the response and continues branch/PR work;
5. collaborator does not modify the PR or branch unless a separately authorized contribution or handoff exists.

Formal GitHub PR review is a separate exception. When policy requires independent review, the authorized reviewer must use GitHub-native review and thread surfaces. Advisory collaboration is not approval, and a formal review does not change source-Issue ownership.

A response tied to a PR or commit is valid only for the identified evidence. Materially changed evidence may require a new request or re-review.

## Peer and child relationships

These are peer source records:

- standalone Operations Issues;
- Active PMO project/program parents;
- Pipeline portfolio parents;
- Engineering preparation Issues.

Peer Issues reference one another with fields such as:

- Related Project;
- Related Pipeline Project;
- Graduation Target;
- Affected Production Feature;
- Source Operations Issue.

Only real project implementation tasks use `Parent Project:` and child-task classification.

## Weekly PMO meeting

The weekly PMO meeting between Bill and ChatGPT reviews:

- all PMO dashboard portfolio parents;
- Active priority and capacity;
- Engineering Pipeline priority and stage;
- new Engineering P1 preparation assignments;
- graduation candidates;
- Go, No-Go, Hold, Adjustment, reprioritization, and completion decisions;
- stale or contradictory portfolio metadata.

The meeting does not define individual child-task implementation order.

## Transition and implementation boundary

This policy defines the target authoritative model.

Live creation of the new labels, dashboard generator and validator support, queue-routing automation, and bulk Issue reconciliation require a separate implementation Issue and reviewed PR.

Until that implementation is complete:

- do not bulk relabel existing Issues;
- do not interpret transitional legacy labels as permission for dual ownership;
- use this policy for decision semantics and record intended target labels in the implementation package;
- retain current runtime-compatible metadata only as a temporary technical representation;
- resolve conflicts in favor of this policy and the Product Authority decision recorded in #2699.

## Supersession

This policy supersedes lower-level or legacy instructions that:

- treat Operations, PMO, and Engineering as peer queues;
- combine PMO Active priority with Pipeline preparation priority;
- require priority labels on child implementation tasks;
- allow one Issue to belong to multiple team-priority namespaces;
- treat Pipeline P1 as proof of launch readiness;
- allow a priority change without accountable preparation work;
- create a second Issue merely to enable agent collaboration;
- require collaborators to take over branch or PR work when bounded Issue-based guidance is sufficient;
- treat advisory collaboration as formal PR approval;
- use queue-wide `HOLD` or `BLOCKED` for ordinary predecessor or advisory conditions;
- freeze an entire project or queue because one final step requires a protected stop;
- delay successor release after verified integration when the successor package is complete;
- treat `agent:*` as permanent pre-assignment rather than active claim or explicit reservation (#3240);
- refuse eligible team-queue work solely because a stale or unconfirmed `agent:*` label is present (#3240).
