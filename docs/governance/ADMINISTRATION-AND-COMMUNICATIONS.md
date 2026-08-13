---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Cross-lane and cross-queue communication transport, evidence routing, repository-state reconciliation, acknowledgment, escalation, hold/resume administration, collaboration routing, reporting, closeout policy, and closeout delegation boundaries
Does Not Own: Product outcomes, priority decisions, queue ownership decisions, design decisions, implementation methods, PR approval decisions, incident recovery strategy, runner host maintenance, or Production authorization
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2640, #2641, #2639, #2648, #2695, #2699, #2700, #2709, #3055, #3113
Last Reviewed: 2026-08-06
---

# Administration and Communications

## Purpose

Administration & Communications is the vertical control lane supporting every durable role, promotion profile, and work queue.

It moves decisions, evidence, assignments, collaboration requests, acknowledgments, escalations, holds, resumes, reports, and closeout records reliably between authorized participants. It may execute authorized state transitions, but it does not create the decisions underlying those transitions.

Detailed queue, priority, Project Graduation, and collaboration semantics are owned by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

## Operating position

Administration & Communications follows:

- PMO / Engineering;
- Implementation / Operations;
- Day-2 Operations;
- Sandbox, Development, Promotion Candidate, and Production profiles;
- the Operations interrupt queue;
- the peer PMO Active and Engineering Pipeline queues.

Lanes define authority. Queues define work precedence. Administration & Communications supplies transport, reconciliation, authorized transaction execution, and evidence continuity across both structures.

PMO sequencing is coordination, not a general execution gate (#3113). Administration & Communications must not apply queue-wide `HOLD` or `BLOCKED` for ordinary predecessor or advisory conditions. Record those as comments, package notes, or order metadata. Protected stops block only the affected unsafe action.

## Role-based operating principle

Repository-wide policy assigns authority to durable roles. Current agents, models, tools, and automation are role holders whose mappings are maintained in `docs/governance/AGENT-TEAM.md` or an approved project manifest.

A role holder may perform only the Administration & Communications actions delegated to its assigned role. Replacing one agent with another does not change the evidence, separation-of-duty, collaboration, or closeout requirements.

## Team communication principle

LGFC agents and automation are operating team members. Direct role-holder communication on the authoritative source Issue is the normal collaboration path.

Human relay through Product Authority is reserved for:

- unavailable or materially impaired GitHub communication;
- product, priority, cost, business, credential, legal, privacy, or protected Production intervention;
- an emergency where direct routing cannot be completed safely.

Product Authority is not expected to relay routine assignments, acknowledgments, findings, remediation requests, collaboration responses, status, resumes, or completion messages.

Any externally relayed decision must be written back to the authoritative GitHub surface before repository work depends on it.

## Communication preference hierarchy

1. Structured communication on the authoritative source Issue.
2. Repository automation or controller transport, retry, acknowledgment, and escalation.
3. Human relay as the bounded fallback described above.

PR comments, reviews, checks, and threads may provide technical evidence. They do not replace source-Issue routing, collaboration, ownership, or authority records.

## Owns

Administration & Communications owns:

- Issue, project, program, PR, check, deployment, release, incident, queue, and closeout state reconciliation;
- team, priority, owner, profile, severity, hold, collaboration, closeout-delegation, and routing metadata reconciliation;
- source-Issue communication and acknowledgment tracking;
- decision, collaboration, review, and escalation routing;
- Operations interrupt administration;
- Monitoring and Hold interval-routing support;
- preservation and restoration of interrupted work state;
- traceability from requirement through task, acceptance, validation, and evidence;
- planned-versus-completed accounting and gap detection;
- stale, unanswered, duplicate, contradictory, or superseded event detection;
- runner/controller communication-health state;
- deterministic closeout and exception reconciliation;
- role-based closeout delegation and transaction boundaries;
- child-task closeout evidence audit during project/master closeout.

## Does not own

Administration & Communications must not independently change:

- product outcome, cost, business intent, or priority;
- team queue ownership;
- architecture, design, scope, or acceptance criteria;
- implementation method or delivery model;
- promotion profile or candidate identity;
- PR approval disposition;
- incident classification or recovery strategy;
- Production authorization;
- repository settings, credentials, paid services, or infrastructure.

It executes a transition only from current recorded authority. Reconciliation must never be used to invent a decision, create dual ownership, bypass independent review, or convert transaction execution into decision authority.

## Communication surfaces

| Surface | Use |
| --- | --- |
| GitHub Issues | Durable work authority, queue ownership, assignments, collaboration, decisions, holds, closeout authority, and terminal records |
| Labels | Machine-readable lifecycle, team, priority, profile, owner, severity, hold, and routing state |
| Structured Issue comments | Durable events, requests, acknowledgments, responses, decisions, closeout packets, and completion conditions |
| PR reviews and threads | Formal Engineering review and line-specific technical evidence |
| Check runs | Deterministic validation, eligibility, readiness, and health evidence |
| Deployment status | Deployment progress, failure, success, rollback, and live verification |
| Workflow artifacts and committed reports | Detailed evidence packets |
| External notifications | Attention acceleration only; decisions require GitHub write-back |

## Source-Issue-first routing

The authoritative source Issue owns:

- assignment;
- current execution owner;
- team queue;
- priority namespace;
- collaboration state;
- blocking scope;
- controlling authority;
- closeout decision and transaction state;
- next action.

The receiving role holder responds on that Issue first.

Implementation delivery uses `IMPLEMENTATION HANDOFF`. Required formal PR inspection uses `PR REVIEW REQUEST`. Universal assistance uses the collaboration lifecycle below. Eligible assigned task closeout uses a `CLOSEOUT` event on the source Issue before or as part of the terminal transaction.

A routing transaction is incomplete until the target participant, bounded request, blocking scope, retained authority, acknowledgment requirement, and completion condition are durable and unambiguous.

## Universal collaboration lifecycle

One collaboration method applies to Operations, PMO, Engineering, and PR-related work.

Use these events:

- `COLLABORATION REQUEST`;
- `COLLABORATION ACKNOWLEDGED`;
- `COLLABORATION RESPONSE`;
- `COLLABORATION COMPLETE`.

### Request

The source-Issue owner records:

- source Issue and current team;
- current execution owner;
- requesting and target agents or roles;
- exact bounded contribution;
- evidence and references;
- blocking scope;
- authority retained by the source owner or controlling role;
- acknowledgment requirement;
- completion condition.

### Acknowledgment

The collaborator records accepted scope, evidence received, missing evidence, and the boundary of the response.

### Response

The collaborator records the exact evidence reviewed and provides bounded analysis, guidance, validation, or recommendation. Existing dispositions such as `GUIDANCE`, `ADJUSTMENT`, `PROBLEM FOUND`, `PLAN CHANGE REQUIRED`, `HOLD`, or `RESUME` may be used when applicable.

### Completion

The collaborator records the result, evidence identity, remaining conditions, and return of execution to the Issue owner.

Collaboration does not:

- create another Issue merely to communicate;
- change team ownership or priority namespace;
- replace the execution owner;
- authorize implementation, approval, Project Graduation, or Production action beyond the collaborator's existing role;
- require the collaborator to modify the implementation branch or PR.

A separate explicit handoff is required to transfer ownership.

## Pull-request collaboration boundary

For normal advisory collaboration involving a PR:

1. the request is posted on the source Issue;
2. the PR and relevant head SHA are identified as evidence;
3. the collaborator reads the diff, checks, or threads as needed;
4. the collaborator responds on the source Issue;
5. the Issue owner applies the response and resumes branch and PR work.

The collaborator does not need to comment on or modify the PR.

Formal PR review is separate. When required, an authorized independent reviewer uses GitHub-native reviews and threads. The controlling disposition is routed back to the source Issue, and formal review does not transfer Issue ownership.

A response tied to a PR, commit, deployment, or check is valid only for the identified evidence. Material evidence changes may require another collaboration request or re-review.

## Team and priority integrity

Administration & Communications must fail closed on:

- more than one `team:*` label on the same source Issue;
- priority or state labels from multiple team namespaces;
- `team:operations` without exactly one Operations priority or state when the target label model is active;
- `team:engineering` with a PMO priority;
- `team:pmo` with an Engineering priority;
- PMO or Engineering team priority on a project child task;
- an Engineering preparation Issue classified as `pmo:task` or linked through `Parent Project:`;
- Project Graduation that transfers Engineering priority directly into PMO priority;
- a closeout transaction whose executor is not authorized by the role-based matrix.

Collaboration assignments do not create another team owner.

Live label creation and migration remain separately authorized implementation work under #2702.

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

Every event identifies the subject, source and target roles, evidence, requested action, blocking scope, retained authority, transaction executor when applicable, acknowledgment requirement, supersession state, and completion or resume condition when applicable.

## Operations interrupt administration

Only a qualifying standalone Operations Issue with `ops:priority:1` through `ops:priority:4` is an actionable queue interrupt.

When a numbered Operations Issue is active, Administration & Communications must:

1. verify that it is an authoritative standalone Day-2 source Issue rather than a child, duplicate, tracker, advisory, or evidence-only record;
2. stop new PMO and Engineering dispatch;
3. direct active work to the nearest safe checkpoint;
4. preserve each interrupted Issue, branch, claim, check, review, deployment, blocker, and next action;
5. route the Operations Issue to the roles and collaborators it needs;
6. give it the next available capacity without duplicate claims;
7. restore preserved normal work when no numbered Operations Issue remains actionable.

`ops:monitoring` and `ops:hold` are non-blocking queue states. They require a current owner, next review time or update interval, expected evidence, and condition for reactivation or closeout.

When numbered remediation has progressed as far as possible, the Issue must move to Monitoring or Hold rather than remain falsely actionable.

An explicit incident or protected hold may continue to block covered work independently of the queue state — scoped to the affected action only, not the entire queue.

## PMO sequencing and continuous parent-level continuation

After verified integration of a project child:

1. Deterministic CI attempts mechanically provable source-Issue closeout first (single automatic closeout owner);
2. WORK records `ACCEPT` or bounded correction (`REMEDIATE` / `VERIFY MORE`) when substantive assurance is required, without idle delay;
3. WORK verifies the successor package is complete before implementer idle time;
4. an eligible agent self-claims the next package-complete serial successor under standing Project Graduation authority (#3145);
5. a wake event may transport existing authority; it does not recreate it or require repeat PMO dispatch.

While a predecessor is in review, WORK prepares the successor package. Ordered-predecessor conditions are satisfied by deterministic predecessor completion (or WORK `ACCEPT` when a substantive gate is defined), not by queue-wide freeze or routine administrative release.

## Non-blocking rule

Pending prose, dashboard lag, routine reports, cosmetic labels, or bookkeeping do not block authorized work.

Administration & Communications may block only the affected scope when a substantive invariant is missing, contradictory, or failed, including:

- source authority;
- real collision (not ordinary ordered predecessor);
- acceptance criterion;
- validation;
- independent approval;
- safety or Production boundary (protected stop — scoped to the unsafe action);
- legal promotion transition;
- closeout decision authority or transaction integrity;
- a numbered Operations interrupt.

Advisory prerequisites, ordered-predecessor metadata, dashboard lag, routine reports, cosmetic labels, and bookkeeping do not block authorized collision-safe work. When only part of a task is gated, bounded increments continue while the gated action waits.

## Runner and controller

The runner and routing controller are communication and control-plane infrastructure.

They may normalize events, route authorized work, publish evidence, retry transport, and perform deterministic authorized actions, including eligible closeout transactions. They do not own the meaning of the event or the decision it carries.

Implementation / Operations owns workflow creation and onboarding. Day-2 Operations owns runner host availability, capacity, patching, security, stop/start, rollback, and recovery.

## Closeout policy

Closeout records an already-supported terminal decision. It does not replace implementation, independent review, merge or integration authority, Promotion Candidate qualification, Production authorization, or Day-2 recovery authority.

### Role-based closeout executor matrix

| Closeout class | Closeout decision authority | Transaction executor |
| --- | --- | --- |
| Assigned project child task | Assigned Implementation / Operations role holder after required independent review and integration evidence exists | Deterministic CI first; assigned Implementation / Operations role holder as fallback under bounded delegated Administration & Communications authority |
| Assigned child remediation | Assigned Implementation / Operations role holder after required independent review and remediation verification exists | Deterministic CI first; assigned Implementation / Operations role holder as fallback under bounded delegated Administration & Communications authority |
| Project/master | PMO / Engineering with independent PR Approver / Engineering verification | Designated Administration & Communications role holder who did not solely implement the underlying child work |
| Program/umbrella | Product Authority and PMO / Engineering under explicitly recorded program-closeout authority | Administration & Communications role holder |
| Promotion Candidate | PMO / Engineering, PR Approver / Engineering, and additional roles required by the applicable approval profile | Administration & Communications role holder records the disposition |
| Production | Recorded Production authority with required Engineering approval | Administration & Communications role holder records the disposition |
| Incident | Day-2 Operations after recovery verification and hold disposition | Administration & Communications role holder records the disposition |

### Delegated task closeout

The assigned Implementation / Operations role holder may complete the transaction for an explicitly assigned project-child or child-remediation Issue only when:

- Issue class, assignment, and parent/master identity are explicit;
- required implementation and validation are complete;
- required independent review or authorized integration is recorded;
- post-integration verification passes;
- task terminal state and successor disposition are deterministic;
- no active protected stop or operational hold applies;
- the required closeout packet is complete; and
- an equivalent successful deterministic transaction does not already exist.

This delegation is bounded Administration & Communications authority. It does not grant PR approval, merge authority, project/master closure, program closure, Promotion Candidate disposition, Production authority, release closure, incident closure, standalone `OPS:` closure, or Product Authority decision rights.

If automation already completed the same transaction, the assigned role holder must not duplicate it. If evidence is missing, failed, contradictory, ambiguous, or outside the assigned task boundary, the role holder records and routes one bounded closeout exception.

### Project/master audit control

Project/master closeout is an independent aggregate audit. It verifies:

- every planned child item is complete, removed, superseded, or explicitly deferred;
- required child closeout evidence and independent approvals exist;
- integrated scope satisfies project acceptance;
- Promotion Candidate and Production decisions are accurately recorded where applicable;
- unresolved defects and Production risks are explicit;
- Issue, project, program, queue, release, Operations, and incident state agree;
- no required promotion profile was skipped;
- interrupted work is restored or explicitly re-sequenced;
- collaboration completion does not falsely close the source work.

A role holder that implemented child work may supply evidence, but must not be the sole independent project/master auditor.

## Canonical references

- Work queues and collaboration: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- Stable queue/collaboration contract: `docs/reference/operations/work-queue-and-collaboration-contract.md`
- Administration mutation and closeout executor contract: `docs/reference/operations/administrative-control-lane-contract.md`
- Agent roles and current mapping: `docs/governance/AGENT-TEAM.md`
- PR process: `docs/governance/PR_PROCESS.md`
- Operations and recovery: `docs/governance/OPERATIONS-AND-RECOVERY.md`
- Dispatch procedure: `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- Issue closeout procedure: `docs/ops/pmo/github-issue-closeout-protocol.md`

## Supersession

This policy supersedes lower-level instructions that require a second Issue for collaboration, treat PR comments as the primary collaboration record, permit dual team ownership, require team priority on child tasks, keep PMO and Engineering blocked by Operations Monitoring or Hold without a separate explicit hold, assign closeout authority permanently to a named agent, permit delegated task closeout without required independent evidence, use queue-wide `HOLD` or `BLOCKED` for ordinary predecessor or advisory conditions, or delay successor release after verified integration when the successor package is complete.
