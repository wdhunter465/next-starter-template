---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Repository queue watch, Operations interrupt dispatch, peer PMO and Engineering dispatch, source-Issue collaboration routing, local Cursor wake routing, acknowledgment, stale-communication recovery, profile-aware continuation, and bounded administrative reconciliation
Does Not Own: Product or priority decisions, queue ownership decisions, Engineering design decisions, PR approval, Production authorization, recovery strategy, workflow implementation, credentials, or project objectives
Canonical Reference: /docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md
Related Issues: #2396, #2492, #2640, #2641, #2639, #2695, #2699, #2709, #3055, #3113
Last Reviewed: 2026-08-06
---

# Queue Watch and Dispatch Protocol

## Purpose

Translate current GitHub state into one safe next communication or action while preserving:

- numbered Operations interrupt precedence;
- peer PMO Active and Engineering Pipeline queues;
- project-defined child sequence;
- one source Issue and one execution owner;
- universal agent collaboration;
- mandatory promotion-profile boundaries.

Queue semantics are owned by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

PMO defines **sequencing and readiness coordination**, not a general execution gate. PMO and the dispatcher order work, record prerequisites, and release successors; they do not deny otherwise authorized, collision-safe implementation. Ordinary predecessor or advisory conditions are comments, package notes, and order metadata — not queue-wide `HOLD` or `BLOCKED` states.

## Current truths

- GitHub Issues are executable work authority.
- Lanes define role authority; queues define work precedence.
- Operations is the Day-2 interrupt queue.
- PMO Active implementation and Engineering Pipeline preparation are peer normal-work queues.
- Only Operations Issues with numbered priorities interrupt normal work.
- Operations Monitoring and Hold are non-blocking states with interval-review obligations.
- Active parent priority selects the project; project sequence selects the child task.
- Pipeline priority orders preparation and does not authorize implementation.
- A source Issue has one team owner and one matching priority namespace.
- Collaboration adds a bounded participant without transferring ownership.
- Promotion Candidate remains mandatory before Production.
- Administration & Communications is non-blocking unless a substantive invariant fails or an applicable interrupt or hold exists.

## Dispatcher inputs

Every cycle inspects, as applicable:

- standalone Operations Issues and their numbered, Monitoring, or Hold state;
- PMO Active parents and project child tasks;
- Engineering Pipeline parents and peer preparation assignments;
- lifecycle, team, priority, Pipeline stage, profile, owner, and assignment labels;
- source-Issue sequence, dependencies, and current claims;
- collaboration requests, acknowledgments, responses, and completion events;
- PRs, branches, head SHAs, candidate identities, checks, reviews, and deployments;
- incidents and explicit holds;
- stale communication and acknowledgment state;
- closeout and successor state;
- runner and controller health.

Alerts are hints. They do not create authority or narrow repository review.

## Recognized event classes

The dispatcher recognizes:

- `COLLABORATION REQUEST`;
- `COLLABORATION ACKNOWLEDGED`;
- `COLLABORATION RESPONSE`;
- `COLLABORATION COMPLETE`;
- `PROBLEM FOUND`;
- `GUIDANCE`;
- `ADJUSTMENT`;
- `HOLD`;
- `PLAN CHANGE REQUIRED`;
- `RESUME`;
- `IMPLEMENTATION HANDOFF`;
- `PR REVIEW REQUEST`;
- `APPROVED FOR INTEGRATION`;
- `PROMOTION CANDIDATE READY`;
- `PRODUCTION GO`;
- `OPERATIONAL INCIDENT`;
- `RECOVERY VERIFIED`;
- `CLOSEOUT`.

Legacy ChatGPT or Cursor markers remain adapters only until authorized runtime migration completes.

## Candidate-action resolution

Before dispatch, determine:

- authoritative source Issue;
- current team queue;
- matching priority or Operations state;
- current execution owner;
- durable owner role;
- promotion profile;
- parent project and child sequence when applicable;
- current authority;
- blocking scope;
- numbered Operations interrupt state;
- Monitoring or Hold review obligation;
- explicit operational or protected hold;
- active collaboration request;
- safe next action.

Fail closed when a material required fact is ambiguous.

## Exclusive ownership validation

Reject or route reconciliation when:

- more than one `team:*` label is present;
- priority labels from multiple namespaces are present;
- an Active parent lacks PMO team and PMO priority;
- a Pipeline parent lacks Engineering team, Engineering priority, or stage;
- a project child task carries team priority;
- an Engineering preparation Issue uses `pmo:task` or `Parent Project:`;
- collaboration is being interpreted as ownership transfer;
- Project Graduation retains Engineering priority or maps it automatically into PMO priority.

Runtime label creation and migration remain tracked in #2702. Until then, route target-state defects without treating legacy metadata as permission for dual ownership.

## Operations classification

A qualifying Operations Issue is:

1. open, same-repository, and not a PR;
2. a standalone Day-2 source Issue rather than project-child work;
3. tied to a Production or repository capability that failed, degraded, became unsafe, or stopped meeting its accepted operating standard;
4. bounded by objective, owner, scope, acceptance, validation, rollback, and stop conditions appropriate to the incident;
5. not merely a tracker, duplicate, bookkeeping record, advisory alert, or evidence-only record.

An Operations Issue carries exactly one state:

- `ops:priority:1`;
- `ops:priority:2`;
- `ops:priority:3`;
- `ops:priority:4`;
- `ops:monitoring`;
- `ops:hold`.

When multiple numbered Operations Issues exist, lower priority numbers are dispatched first, subject to dependency, collision, and safe-concurrency evidence. Do not silently create concurrent Cursor claims.

## Numbered Operations dispatch

Before normal PMO or Engineering dispatch, inspect for numbered Operations work.

When a numbered Operations Issue is actionable:

1. stop new PMO and Engineering dispatch;
2. identify active claims, commands, branches, tests, reviews, deployments, migrations, and rollback operations;
3. direct each affected owner to the nearest safe checkpoint;
4. preserve source Issue, branch, head SHA, claim, check, review, deployment, blocker, and next action;
5. assign the next required remediation capacity to the highest eligible Operations Issue;
6. route Cursor as the normal remediation implementer;
7. route ChatGPT through universal collaboration when Tier 2 design, architecture, acceptance, recovery planning, Engineering judgment, or independent review is needed;
8. retain `team:operations` and the Operations priority throughout collaboration;
9. follow applicable Development, Promotion Candidate, Production, validation, approval, and rollback controls;
10. resume peer normal-work dispatch when no numbered Operations Issue remains actionable and no separate explicit hold applies.

No additional risk threshold or case-by-case reprioritization is required after the Issue is validly numbered.

The interrupt is immediate but not destructive. In-flight work reaches the smallest safe checkpoint before its claim is released.

## Operations Monitoring and Hold

### Monitoring

`ops:monitoring` means active remediation has progressed as far as currently possible and the next required action is observation for stability, recurrence, external behavior, or sustained health.

### Hold

`ops:hold` means remediation cannot continue until specified information, access, authority, vendor action, external evidence, or another prerequisite is available.

Both states require:

- current owner;
- reason or observation target;
- next review time or update interval;
- expected evidence;
- condition for numbered reactivation or closeout.

Monitoring and Hold do not block PMO or Engineering dispatch. The dispatcher schedules the required update while allowing normal work to resume.

When evidence makes remediation actionable again, change the Issue to the appropriate numbered Operations priority; the interrupt then reactivates.

A separate incident, Product Authority, Engineering, or protected hold may continue to block its stated scope independently.

## Normal work selection

When no numbered Operations Issue is actionable, PMO and Engineering are peer eligible queues.

Agent-specific precedence is defined in `docs/governance/AGENT-TEAM.md`:

- Cursor: Operations, then PMO Active implementation, then bounded Engineering collaboration.
- ChatGPT: assigned Operations Tier 2, assigned PMO work, then Engineering Pipeline preparation.

Peer status means neither PMO nor Engineering priority converts into the other. It does not require both agents to use identical daily ordering.

## PMO Active dispatch

For Cursor implementation:

1. identify Active parents with `team:pmo` and PMO priority;
2. select the highest-priority parent with executable work;
3. inspect that parent's Task ID, predecessor, successor, dependency, and current-claim evidence;
4. select the next executable child according to project sequence;
5. confirm implementation Go, delivery profile, source Issue, branch, allowlist, acceptance, validation, rollback, and stop condition;
6. confirm one active Cursor claim unless explicit safe parallelism is authorized;
7. route the assignment or wake event;
8. do not report pickup until a later comment, commit, or PR proves it;
9. on `IMPLEMENTATION HANDOFF`, move only that task to review or integration disposition;
10. allow another independent task when dependencies and collision state permit it.

Do not use team priority on child tasks. Administrative closeout of a prior task is not a universal successor gate.

When only part of a task is gated, split bounded increments and continue collision-safe work. A gated final step must not freeze the queue when earlier increments remain executable.

## Dependency and stop taxonomy

Use exactly one classification per condition:

| Class | Meaning | Dispatcher action |
| --- | --- | --- |
| Advisory prerequisite | Helpful context or soft ordering; does not deny collision-safe work | Record as comment or package note; do not set queue-wide hold |
| Ordered predecessor | Serial child sequence; next item waits for deterministic predecessor completion | Record predecessor/successor metadata; eligible agent self-claims after validated merge + post-merge closeout (or WORK `ACCEPT` when a substantive gate is defined) |
| Real collision | Same branch, file, credential, or deployment surface would conflict | Block only the colliding action; permit disjoint collision-safe work |
| Protected stop | Legal, privacy, rights, security, credential, cost, destructive-data, Production-authority, unsafe-operation, or independent-review boundary | Block only the affected unsafe action; record owner, evidence, and release condition |

`HOLD` is reserved for evidence-specific protected stops and substantive dependency or collision conditions. It is not for ordinary sequencing, advisory prerequisites, or routine predecessor state. Do not use generic `BLOCKED` placeholders.

### Examples

- **Advisory-dependent work:** Task B references Task A design notes. Task B docs/evidence increments may proceed; only the integration step that consumes unverified A output waits.
- **Docs/evidence increment:** A child splits implementation (executable now) from Production promotion (protected stop until review). Implementation proceeds; Production dispatch pauses only for the promotion action.
- **Serial child chain:** After predecessor merge and post-merge verification, an eligible agent self-claims the next package-complete child under standing parent authority without idle delay or repeat PMO dispatch (#3055 / #3145). WORK records `ACCEPT` or bounded correction when substantive assurance is required.
- **Production-only gate:** Development increments merge under standing authority; `PRODUCTION GO` blocks only the Production promotion action, not unrelated collision-safe Development tasks.

## Continuous parent-level continuation

For a graduated project, steps 4 through 7 above evaluate and transport standing authority; they do not require a new PMO or Administration assignment.

While a predecessor is in review or verification, WORK prepares the successor package so implementer idle time does not occur after deterministic completion.

After deterministic predecessor completion (validated merge + successful post-merge closeout, or WORK `ACCEPT` when a substantive gate is defined), the dispatcher must immediately:

1. verify the next live child is package-complete;
2. verify no real collision, protected stop, numbered Operations interrupt, or failed verification applies to the successor;
3. reconcile the predecessor, parent, and successor states as mechanically provable;
4. allow an eligible agent to self-claim the successor and emit the applicable runtime wake signal; and
5. record the successor's required pre-implementation checkpoint.

Ordered-predecessor conditions are satisfied by deterministic completion (or WORK `ACCEPT` when a substantive gate is defined), not by queue-wide freeze. If fields are missing, set `PACKAGE-INCOMPLETE` and return it to WORK for correction. If a substantive protected stop or real collision blocks a specific action, set evidence-specific `HOLD` with owner, required evidence, and release condition — scoped to that action only. Do not use generic `BLOCKED`, queue-wide freeze, or repeat-dispatch prose.

## Engineering Pipeline dispatch

For ChatGPT preparation:

1. identify Pipeline parents with `team:engineering`, Engineering priority, and one truthful stage;
2. select preparation work according to Engineering priority;
3. for Engineering P1, confirm one peer preparation Issue exists or create/reactivate it through authorized PMO closeout;
4. ensure the preparation Issue references `Related Pipeline Project:` or `Graduation Target:`;
5. reject `Parent Project:` and `pmo:task` on preparation work;
6. produce requirements, design, authority reconciliation, implementation plan, ordered child Issues, validation, rollback, risks, and Go/No-Go evidence;
7. request bounded Cursor feasibility or repository evidence through universal collaboration when needed;
8. do not authorize Active implementation through collaboration;
9. route the completed graduation package to the weekly PMO review.

Pipeline stage and Engineering priority remain independent. Engineering P1 does not mean Ready for Launch.

## Project Graduation dispatch

On explicit PMO Go:

1. verify the parent is truthfully Ready for Launch;
2. verify the graduation package and decision authority;
3. remove Pipeline stage, Engineering team, and Engineering priority;
4. add Active lifecycle and PMO team;
5. apply the PMO-selected Active priority independently;
6. record execution owner, first executable child, delivery profile, and implementation Go;
7. preserve the prepared child sequence and dependencies;
8. begin PMO Active dispatch only after the transition is complete.

Engineering priority never transfers automatically to PMO priority.

## Universal collaboration dispatch

Any source-Issue owner may request bounded assistance from another agent without creating another work Issue.

### Request routing

`COLLABORATION REQUEST` must identify:

- source Issue and team;
- current execution owner;
- requesting and target agents or roles;
- exact bounded contribution;
- evidence;
- blocking scope;
- retained authority;
- acknowledgment requirement;
- completion condition.

### Acknowledgment routing

Route the request to the target agent and require `COLLABORATION ACKNOWLEDGED` when requested. Acknowledgment confirms receipt and accepted scope, not successful completion.

### Response routing

The collaborator posts `COLLABORATION RESPONSE` on the same source Issue with exact evidence reviewed, bounded result, disposition, remaining condition, and next action returned to the Issue owner.

### Completion routing

`COLLABORATION COMPLETE` records the result and returns execution to the Issue owner.

Collaboration does not:

- change team or priority;
- replace the execution owner;
- create implementation Go;
- create formal approval;
- permit a collaborator to modify the branch or PR without a separate contribution handoff.

## Collaboration involving a PR

For normal advisory collaboration:

1. keep the request on the source Issue;
2. identify the PR and relevant head SHA;
3. allow the collaborator to read the diff, checks, and threads;
4. record the response on the source Issue;
5. return branch and PR work to the Issue owner.

Do not require a PR comment or review for advisory collaboration.

Formal PR review is separate. It uses GitHub-native reviews and threads, requires independent reviewer authority, and routes the controlling disposition back to the source Issue.

A material head change may require a new collaboration cycle or formal re-review.

## Sandbox dispatch

Sandbox dispatch is eligible when no numbered Operations interrupt or applicable hold blocks it.

1. Confirm PMO / Engineering authorized the experiment and question.
2. Confirm isolation and no Production path.
3. Route the bounded experiment.
4. Record discard, evidence-only, or Development adoption disposition.
5. Require a normal Development work package for adoption.
6. Block direct Sandbox-to-Promotion Candidate or Production movement.

## Promotion Candidate dispatch

Promotion Candidate dispatch pauses for a numbered Operations interrupt unless completing or reversing an in-flight transition is the smallest safe checkpoint or the controlling authority permits it.

1. Confirm the exact integrated Development candidate.
2. Confirm qualification requirements and evidence owners.
3. Route integrated, regression, performance, security, migration, rollback, readiness, and standards checks as applicable.
4. Route subjective or protected findings to PR Approver / Engineering.
5. Record Go, No-Go, or return to Development.
6. Do not route Production until the candidate is approved and unchanged.

## Production dispatch

Production dispatch pauses for a numbered Operations interrupt unless completing or reversing an in-flight operation is safest or the controlling Operations authority covers the promotion.

1. Confirm `PRODUCTION GO` and required approval.
2. Confirm the exact approved candidate.
3. Confirm no unreviewed drift.
4. Confirm rollback and environment readiness.
5. Route controlled promotion or deployment.
6. Route live verification.
7. On failure, route containment, rollback, or `OPERATIONAL INCIDENT`.

## Lightweight problem adjustment

When `PROBLEM FOUND` appears:

1. identify the controlling prior decision;
2. route to the role that made it;
3. preserve the smallest affected scope unless numbered Operations work requires broader interruption;
4. allow independent work when no interrupt, dependency, collision, or explicit hold blocks it;
5. route `GUIDANCE`, `ADJUSTMENT`, or `PLAN CHANGE REQUIRED`;
6. route `RESUME` only when its recorded condition is met.

Do not convert bounded adjustment into a project-wide replan. Use universal collaboration when another agent's bounded expertise is needed.

## Day-2 incident dispatch

An incident may be the controlling Operations Issue or evidence linked to it.

1. Create or update one deduplicated authoritative Operations source Issue.
2. Assign a numbered Operations priority when active remediation is actionable.
3. Route an additional broad assessment hold only when impact is unknown and safety requires it.
4. Preserve active PMO and Engineering state.
5. Route severity, scope, probable cause, containment, and ownership assessment.
6. Narrow incident-specific holds after the incident is bounded.
7. Move the Operations Issue to Monitoring or Hold when active work has progressed as far as possible.
8. Route corrective Development and Promotion Candidate work when required.
9. Route `RECOVERY VERIFIED`, closeout, or numbered reactivation based on evidence.

## Administration & Communications actions

When deterministic and authorized, the dispatcher may:

- reconcile team, priority, lifecycle, stage, profile, owner, severity, hold, collaboration, and status labels;
- reconcile assignments and parent, child, related-project, graduation-target, release, Operations, and incident links;
- post structured events, acknowledgments, retries, responses, and escalation;
- prepare evidence packets;
- activate or defer an already-authorized successor;
- apply, narrow, release, or restore an authorized hold;
- preserve and restore interrupted work state;
- reconcile Issue, PR, check, review, deployment, dashboard, and closeout state;
- create or update bounded remediation, communication-failure, and closeout-exception Issues;
- perform or verify authorized non-merge dispositions.

The dispatcher must not independently change product outcome, design, acceptance, implementation scope, delivery model, promotion profile, PR disposition, recovery strategy, priority, queue ownership, Project Graduation, Production authority, repository settings, credentials, or infrastructure.

## Local Cursor wake adapter

Until controller migration completes, a valid local wake requires:

1. open source Issue;
2. applicable local runtime authority;
3. current wake labels;
4. authoritative decision or event on the Issue;
5. no newer state superseding the action;
6. one bounded next action;
7. no active conflicting claim;
8. no numbered Operations Issue with higher precedence.

The wake marker is transport only. It does not prove pickup.

## Acknowledgment and stale communication

- Stable event and action identities suppress duplicates.
- Retries do not create duplicate work or collaboration cycles.
- Acknowledgment confirms receipt, not successful execution.
- Stale events do not overwrite newer decisions or evidence.
- Missed acknowledgment routes to the recorded escalation role.
- Runner failure is a communication fault routed to Day-2 Operations.
- A stale `RESUME` does not override a numbered Operations interrupt or explicit hold.
- Monitoring and Hold records are stale when their required update interval passes without evidence.

## Closeout and successor handling

`CLOSEOUT` reconciles work after required execution, validation, approval, profile transitions, deployment, and evidence are satisfied.

- A merged Development child may close after verified integration and task evidence.
- Promotion Candidate and Production require their own closeout evidence.
- A source Issue does not close because a PR is merely green, approved, or mergeable.
- Collaboration completion does not close the source Issue.
- A successful deterministic closeout transaction is not duplicated.
- Closeout exceptions block only the affected transition unless a numbered Operations interrupt applies broadly.
- Independent work continues when dependencies and collision state permit it.
- Moving an Operations Issue to Monitoring or Hold releases queue interruption unless a separate explicit hold remains.

## Idempotency and expected state

Before mutation:

1. read current live state;
2. identify exact authority and evidence;
3. compute intended state revision;
4. suppress duplicate or stale action;
5. ensure only authorized scope changes.

After mutation:

1. re-read the surface;
2. verify intended state;
3. record the next eligible action or exact halt reason;
4. resolve or supersede any exception record.

## Prohibited outcomes

The dispatcher must prevent:

- failure to halt normal dispatch for numbered Operations work;
- treating Monitoring or Hold as universal blockers;
- destructive interruption before a safe checkpoint;
- dual team ownership or cross-namespace priority;
- team priority on child tasks;
- Engineering preparation counted as project child completion;
- automatic Engineering-to-PMO priority transfer;
- Active implementation before Project Graduation;
- a second Issue created merely for collaboration;
- collaborator branch or PR modification without separate authority;
- advisory collaboration interpreted as formal approval;
- direct Sandbox-to-Promotion Candidate or Production routing;
- direct Development-to-Production routing;
- runner or controller invention of authority;
- self-approval of protected work;
- Production promotion without approved candidate identity;
- duplicate assignment, collaboration, hold, resume, integration, closeout, or incident actions;
- queue-wide freeze caused by one gated final step when collision-safe increments remain executable;
- treating ordinary predecessor or advisory conditions as universal execution denial;
- delaying eligible-agent self-claim after deterministic predecessor completion when the successor package is complete.

## Required references

- Constitution: `docs/governance/REPOSITORY-AUTHORITY.md`
- Work Queues and Collaboration: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- PMO Portfolio: `docs/governance/PMO-PORTFOLIO.md`
- PMO Operating Model: `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- Administration & Communications: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Administration contract: `docs/reference/operations/administrative-control-lane-contract.md`
- Collaboration procedure: `docs/how-to/operations/request-agent-collaboration.md`
- Agent roles: `docs/governance/AGENT-TEAM.md`
- PR process: `docs/governance/PR_PROCESS.md`
- Day-2 policy: `docs/governance/OPERATIONS-AND-RECOVERY.md`

## Supersession

This procedure supersedes dispatch instructions that treat every open Operations Issue as blocking until closure or `RESUME`, treat PMO and Engineering as one queue, require priority on child tasks, use one priority namespace across Active and Pipeline, omit universal collaboration events, or require collaborators to take over PR work.