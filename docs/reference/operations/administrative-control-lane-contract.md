---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Administration & Communications event, mutation, routing, evidence, acknowledgment, collaboration, escalation, hold/resume, blocking, closeout executor, and exception contract
Does Not Own: Product scope, priority decisions, queue ownership decisions, design, delivery-model selection, implementation authority, PR approval, recovery strategy, Production authority, or workflow implementation
Canonical Reference: /docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md
Related Issues: #2640, #2641, #2639, #2699, #2700, #2709
Last Reviewed: 2026-07-21
---

# Administration and Communications Contract

## Purpose

Define the stable repository-wide contract for the vertical Administration & Communications lane, including universal collaboration, queue integrity, and the role-based decision and transaction boundaries for closeout.

The lane follows all durable roles, promotion profiles, and the Operations, PMO, and Engineering work queues. It keeps Issues, PRs, checks, deployments, collaboration events, portfolio state, holds, resumes, closeout transactions, and evidence aligned with recorded authority.

Queue and collaboration semantics are defined by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` and represented by `docs/reference/operations/work-queue-and-collaboration-contract.md`.

## Scope

- Owns the stable Administration & Communications event, mutation, routing, evidence, acknowledgment, escalation, hold/resume, blocking, and exception contract.
- Does not own product scope, design, delivery-model selection, implementation authority, PR approval, recovery strategy, production authority, or workflow implementation.

## Current known truth

- Administration & Communications is the vertical lane across all horizontal lanes and promotion profiles.
- It may record, route, reconcile, and execute authorized state transitions only.
- It is non-blocking unless an explicit invariant is missing, contradictory, or failed.

## Intended final state

Every authorized repository event has a durable evidence path through Administration & Communications without inventing decision authority that belongs to another role or lane.

## Core rule

> Administration & Communications may record, route, reconcile, and execute authorized state transitions, but it must not create the underlying decision authority.

The lane is non-blocking unless an explicit authority, dependency, validation, approval, profile-transition, collision, safety, Production, Operations-interrupt, or closeout invariant is missing, contradictory, or failed.

## Lane and queue relationship

Lanes define authority. Work queues define precedence.

Administration & Communications follows:

- PMO / Engineering;
- Implementation / Operations;
- Day-2 Operations;
- Sandbox, Development, Promotion Candidate, and Production;
- numbered Operations interrupts;
- PMO Active implementation;
- Engineering Pipeline preparation.

Numbered Operations work interrupts the two peer normal-work queues. Monitoring and Hold are non-blocking Operations states unless a separate explicit hold covers the work.

## Durable roles

| Role | Administration & Communications relationship |
| --- | --- |
| Product Authority | Supplies final product, priority, cost, business, launch, graduation, completion, and program-closeout decisions |
| PMO / Engineering | Supplies design, acceptance, plan, Pipeline preparation, Project Graduation recommendation, implementation-Go, and aggregate project-verification decisions |
| Implementation / Operations | Supplies Development, Promotion Candidate, deployment, remediation, implementation evidence, and eligible assigned task-closeout decisions |
| PR Approver / Engineering | Supplies formal independent review, approval, changes-required, promotion disposition, and project-audit evidence |
| Day-2 Operations | Supplies incident classification, recovery strategy, Operations state, hold release, recovery verification, and incident-closeout decisions |
| Deterministic CI | Produces machine evidence and applies explicitly authorized idempotent integration and closeout actions |
| Administration & Communications | Routes, acknowledges, reconciles, records, escalates, restores, audits, and executes authorized closeout transactions |

Current people, agents, and systems are mapped to these roles in `docs/governance/AGENT-TEAM.md` or an approved project manifest. The mapping may change without changing this contract.

## Closeout executor matrix

| Closeout class | Closeout decision authority | Transaction executor |
| --- | --- | --- |
| Assigned project child task | WORK after required independent review, integration, validation, and post-integration evidence exists | Deterministic CI may attempt first; WORK verifies/reconciles the transaction and releases the successor |
| Assigned child remediation | WORK after required independent review and remediation verification exists | Deterministic CI may attempt first; WORK verifies/reconciles the transaction |
| Project/master | PMO / Engineering with independent PR Approver / Engineering verification | Designated Administration & Communications role holder who did not solely implement the underlying child work |
| Program/umbrella | Product Authority and PMO / Engineering under explicitly recorded program-closeout authority | Administration & Communications role holder |
| Promotion Candidate | PMO / Engineering, PR Approver / Engineering, and additional roles required by the applicable approval profile | Administration & Communications role holder records the disposition |
| Production | Recorded Production authority with required Engineering approval | Administration & Communications role holder records the disposition |
| Incident | Day-2 Operations after recovery verification and hold disposition | Administration & Communications role holder records the disposition |

## Delegated assigned-task transaction contract

An assigned Implementation / Operations role holder may execute task-level closeout only when all of the following are true:

1. the source Issue explicitly identifies the role holder, Issue class, and parent/master;
2. required implementation and validation are complete;
3. required independent review or authorized integration is recorded;
4. post-integration verification passes;
5. terminal task state, parent reporting, and successor disposition are determinable;
6. no protected stop, incident hold, numbered Operations interrupt, or unresolved closeout exception remains;
7. the closeout packet is complete; and
8. an equivalent successful deterministic transaction does not already exist.

The fallback role holder may:

- post the `CLOSEOUT` event;
- reconcile permitted task labels and assignment state;
- record parent/master and successor disposition;
- close the assigned project-child or child-remediation Issue; and
- re-fetch and verify the terminal state.

The fallback role holder must not:

- approve or merge its own protected work;
- infer acceptance, review, integration, Project Graduation, or Production authority;
- close a project/master, program/umbrella, Promotion Candidate, Production, release, incident, standalone `OPS:`, or Product Authority disposition Issue;
- overwrite newer evidence or an existing successful closeout;
- create dual team ownership or cross-namespace priority; or
- proceed when evidence is missing, failed, contradictory, ambiguous, or outside the assigned task boundary.

## Project/master audit contract

Project/master closeout requires independent aggregate verification that:

- all planned child work is completed, removed, superseded, or explicitly deferred;
- child closeout packets and required approvals are sufficient;
- integrated scope satisfies project acceptance criteria;
- unresolved gaps, defects, and Production risk are explicit;
- Promotion Candidate and Production dispositions are accurate when applicable;
- parent, queue, and program reporting are current;
- no required promotion profile was skipped; and
- collaboration completion did not falsely close source work.

The designated Administration & Communications transaction executor must not be solely dependent on the same role holder that implemented the underlying child work. Implementation / Operations may supply evidence but may not act as the sole independent project/master auditor.

## Communication surfaces

| Surface | Contract |
| --- | --- |
| Issues | Durable work authority, queue ownership, collaboration, escalation, incident, decision, closeout authority, and terminal records |
| Labels | Current lifecycle, team, priority, profile, owner, severity, hold, and routing state |
| Structured comments | Durable events, evidence summaries, requests, acknowledgments, responses, decisions, closeout packets, and supersession |
| PR reviews and threads | Formal Engineering review and line-specific technical evidence |
| Check runs | Deterministic validation, eligibility, readiness, and health evidence |
| Deployments | Deployment and live-release evidence |
| Artifacts and reports | Detailed evidence too large for comments |
| External notifications | Attention only; decisions require GitHub write-back |
| Runner/controller | Shared event transport and authorized deterministic execution |

## Minimum event vocabulary

- `COLLABORATION REQUEST`
- `COLLABORATION ACKNOWLEDGED`
- `COLLABORATION RESPONSE`
- `COLLABORATION COMPLETE`
- `PROBLEM FOUND`
- `GUIDANCE`
- `ADJUSTMENT`
- `HOLD`
- `PLAN CHANGE REQUIRED`
- `RESUME`
- `IMPLEMENTATION HANDOFF`
- `PR REVIEW REQUEST`
- `APPROVED FOR INTEGRATION`
- `PROMOTION CANDIDATE READY`
- `PRODUCTION GO`
- `OPERATIONAL INCIDENT`
- `RECOVERY VERIFIED`
- `CLOSEOUT`

Every event identifies:

- event type and stable ID when automated;
- authoritative source Issue;
- related PR, project, release, deployment, or incident when applicable;
- source and target agents or roles;
- current team queue and execution owner;
- current promotion profile when applicable;
- evidence;
- requested action or bounded contribution;
- blocking scope;
- retained decision authority;
- transaction executor when applicable;
- acknowledgment requirement;
- completion or resume condition;
- superseded event when applicable.

## Universal collaboration contract

Any authorized source-Issue owner may request bounded assistance from another agent on that same Issue.

### Request

`COLLABORATION REQUEST` records:

- source Issue and team;
- current execution owner;
- requesting and target agents or roles;
- exact bounded contribution;
- evidence and references;
- blocking scope;
- retained authority;
- acknowledgment requirement;
- completion condition.

### Acknowledgment

`COLLABORATION ACKNOWLEDGED` records accepted scope, evidence received, missing evidence, and response boundary.

### Response

`COLLABORATION RESPONSE` records exact evidence reviewed, bounded analysis or guidance, disposition, remaining condition, and next action returned to the source owner.

### Completion

`COLLABORATION COMPLETE` records the result, evidence identity, unresolved conditions, and return of execution to the Issue owner.

Collaboration:

- does not create another source Issue;
- does not change team ownership or priority namespace;
- does not transfer implementation ownership;
- does not create approval or Production authority;
- does not require the collaborator to modify the PR or branch.

A separate explicit handoff is required for ownership transfer.

## PR-related collaboration

The source Issue owns collaboration, routing, queue, authority, and next action. The PR owns the diff, checks, threads, and technical evidence.

Normal PR-related collaboration identifies the PR and head SHA on the source Issue. The collaborator may read the PR and respond on the Issue. The Issue owner applies the response and resumes PR work.

Formal PR review is separate. It requires reviewer authority and uses GitHub-native review surfaces. The review disposition is routed back to the source Issue and does not transfer ownership.

## Queue and priority integrity

A source Issue may carry at most one team assignment:

- `team:operations`;
- `team:governance`;
- `team:pmo`;
- `team:engineering`.

The Issue may carry only the matching team priority or state namespace.

Administration & Communications must reject or route correction for:

- multiple team labels;
- cross-team priority combinations;
- PMO, Engineering, Operations, or Governance priority/state on a project child task;
- an Engineering preparation assignment using `pmo:task` or `Parent Project:`;
- Project Graduation that retains Engineering priority or automatically maps it to PMO priority;
- collaboration metadata that is interpreted as second ownership;
- a closeout transaction whose decision authority or transaction executor conflicts with this contract.

Active PMO parent priority selects the project. Project-defined order and dependencies select the child task.

Pipeline Engineering priority orders preparation and is independent of Pipeline stage.

Governance priority orders stewardship work and does not interrupt PMO or Engineering.

## Operations state contract

A standalone Operations Issue uses one of:

- `ops:priority:1`;
- `ops:priority:2`;
- `ops:priority:3`;
- `ops:priority:4`;
- `ops:monitoring`;
- `ops:hold`.

Numbered priorities are actionable interrupts. Monitoring and Hold are non-blocking and require:

- current owner;
- reason or observation target;
- update interval or next-review time;
- expected evidence;
- condition for numbered reactivation or closeout.

A numbered Issue that cannot progress must move to Monitoring or Hold rather than remain falsely actionable.

## Governance state contract

A standalone Governance Issue uses one of:

- `gov:priority:1`;
- `gov:priority:2`;
- `gov:priority:3`;
- `gov:priority:4`;
- `gov:review`;
- `gov:hold`.

Numbered Governance priorities order stewardship work and are not Operations interrupts. Review and Hold are non-blocking and require owner, reason, interval/next-review, expected evidence, and return/close condition.

## Allowed mutations

When mechanically provable or directly authorized, the lane or delegated transaction executor may:

- reconcile lifecycle, team, priority, profile, status, routing, handoff, PMO, severity, hold, collaboration, and closeout-delegation labels;
- reconcile assignees and current execution owner;
- correct parent, child, predecessor, successor, related-project, graduation-target, release, and incident references;
- record events, acknowledgments, escalation, collaboration, decisions, evidence, closeout packets, and halt reasons;
- prepare Go/No-Go, Project Graduation, and Promotion Candidate evidence packets;
- activate or defer an already-authorized successor;
- apply, narrow, release, or restore an authorized hold;
- preserve and restore task, branch, claim, and resume context;
- reconcile Development, Promotion Candidate, Production, Day-2, queue, and dashboard state;
- create or update bounded remediation, communication-failure, and closeout-exception Issues;
- close or reopen work when current authority deterministically requires it.

## Prohibited mutations

The lane and delegated transaction executors must not independently:

- change product outcome, priority, cost, or business intent;
- assign or transfer team ownership;
- add, remove, or reinterpret acceptance criteria;
- change design, architecture, UX, scope, non-goals, or allowlist;
- select or change delivery model or promotion profile;
- authorize Sandbox adoption, Project Graduation, Development Go, Promotion Candidate Go, or Production Go;
- weaken validation, review, approval, safety, rollback, or separation-of-duty requirements;
- make PR approval or recovery-strategy decisions;
- change credentials, repository settings, paid services, infrastructure, or Production state as an administrative action;
- permit dual ownership or cross-namespace priorities;
- treat ambiguity as permission;
- permit Sandbox-to-Promotion Candidate, Sandbox-to-Production, or Development-to-Production.

## Trigger classes

| Trigger | Action |
| --- | --- |
| Pipeline intake or preparation | Validate Engineering priority and stage; route accountable preparation without inventing priority |
| Engineering P1 assigned | Ensure one peer preparation assignment exists for ChatGPT |
| Project Graduation decision | Reconcile Pipeline/Engineering removal and independently assigned Active/PMO state |
| PMO Active dispatch | Select parent by PMO priority and child by project sequence |
| Collaboration requested | Route, acknowledge, track response, and return execution without changing ownership |
| PR/check/review changes | Reflect evidence and route action without replacing Engineering judgment |
| Assigned child integrated and verified | Deterministic CI closes when eligible; assigned Implementation / Operations role holder completes the transaction or routes one exception |
| Numbered Operations Issue | Interrupt new PMO and Engineering dispatch and preserve active work |
| Operations Monitoring or Hold | Schedule interval review and resume normal queue dispatch unless another hold applies |
| Operational incident | Route assessment, containment, recovery, and applicable holds |
| Recovery verified | Release remaining authorized holds and restore eligible work |
| Project/master completion | Perform independent aggregate audit and execute closeout under the matrix |
| Contradictory state | Correct when deterministic; otherwise route clarification to the owning role |
| Stale acknowledgment | Retry or escalate without duplicating the action |
| Runner/control-plane failure | Record communications fault and route host recovery to Day-2 Operations |

## Blocking rules

Administration & Communications blocks only the affected scope when:

- no valid source authority exists;
- a required dependency is unresolved;
- required validation or independent approval is missing or failed;
- team, profile, branch, candidate, Issue class, parent/master, assigned role, or ownership identity is contradictory;
- a mandatory promotion or graduation transition is being skipped;
- a safety, Production, credential, destructive, or protected boundary is unresolved;
- a collision makes work unsafe;
- closeout cannot determine decision authority, transaction executor, source disposition, or successor disposition;
- a numbered Operations interrupt applies;
- an explicit operational, incident, Engineering, or Product Authority hold covers the work.

Reporting lag, dashboard lag, pending prose, optional comments, Monitoring, Hold without broader scope, cosmetic labels, and non-critical housekeeping do not block otherwise authorized work.

## Evidence requirements

Every mutation or routed decision uses one or more of:

- canonical policy or reference contract;
- source Issue or recorded role authority;
- current Issue, PR, label, assignment, check, review, deployment, or incident state;
- exact candidate, commit, merge, integration, deployment, or PR-head identity;
- project sequence and dependencies;
- closeout packet;
- clarification recorded on GitHub.

State must be re-read before mutation and verified afterward.

## Idempotency and collision

- Repeated equivalent inputs do not create duplicate comments, Issues, collaboration cycles, holds, resumes, transitions, or closeout transactions.
- Stable event/action keys should be used for automation.
- Stale actions do not overwrite newer decisions or evidence.
- One action revision may have one active mutation claim.
- Communication retries do not duplicate the underlying work request.
- Independent projects and peer queues are not locked by shared reporting surfaces.
- A delegated fallback must not repeat a transaction already completed by Deterministic CI.

## Exception lifecycle

`DETECTED` → `RECORDED` → `ROUTED` → `GUIDANCE OR REMEDIATION` → `VERIFIED` → `RESOLVED`

An exception identifies the affected subject, invariant, evidence, blocking scope, owning role, required action, resume condition, and resolution evidence.

## Required references

- Constitution: `docs/governance/REPOSITORY-AUTHORITY.md`
- Administration policy: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Work queues and collaboration: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- Queue/collaboration contract: `docs/reference/operations/work-queue-and-collaboration-contract.md`
- Agent roles and current mapping: `docs/governance/AGENT-TEAM.md`
- PR process: `docs/governance/PR_PROCESS.md`
- Delivery policy: `docs/governance/DELIVERY-AND-RELEASE.md`
- Day-2 policy: `docs/governance/OPERATIONS-AND-RECOVERY.md`
- Queue/dispatch procedure: `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- Closeout procedure: `docs/ops/pmo/github-issue-closeout-protocol.md`


## WORK acceptance and continuous parent-level continuation

WORK owns controlling `ACCEPT`, `HOLD`, `REMEDIATE`, or `VERIFY MORE` dispositions when substantive assurance or discrepancy handling is required, plus child/parent reconciliation. After deterministic predecessor completion, eligible agents self-claim the next package-complete serial successor under standing parent authority (#3145). Transport automation may apply an idempotent mutation but cannot invent acceptance.

A generic `BLOCKED` state is prohibited for prepared project queues. Use `PACKAGE-INCOMPLETE` for missing execution fields or `HOLD` for a named substantive condition with owner, evidence, and release criteria. WORK must not independently verify or approve a PR that WORK implemented.
