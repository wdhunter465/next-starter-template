---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Issue closeout evidence, role-based closeout execution, profile-aware completion accounting, deterministic closeout, exception handling, parent/reporting reconciliation, and successor disposition
Does Not Own: Merge authority, delivery or promotion decisions, project objectives, PR approval, Production authorization, recovery strategy, or workflow implementation
Canonical Reference: /docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md
Related Issues: #1411, #2359, #2640, #2641, #2639, #2700
Last Reviewed: 2026-07-21
---

# GitHub Issue Closeout Protocol

## Purpose

Define how LGFC tasks, projects, programs, Promotion Candidates, Production releases, and incidents are reconciled after their required technical and decision evidence exists.

Closeout is an Administration & Communications function. It records what happened and confirms no required work was lost. It does not replace implementation, independent PR approval, integration authority, Promotion Candidate qualification, Production authorization, or Day-2 recovery authority.

## Core rules

1. A successful deterministic closeout transaction must not be duplicated.
2. Closeout blocks only the affected transition when a substantive invariant is missing.
3. Routine administrative closeout does not block the next independent Development task.
4. A task may complete at Development integration while its project continues toward Promotion Candidate.
5. Promotion Candidate, Production, and incident closeout each require their own evidence.
6. No closeout may claim that a skipped promotion profile was completed.
7. Named agents do not own closeout authority; current role assignments determine who may act.
8. Project/master closeout is an independent aggregate audit and must not rely solely on the role holder that implemented the child work.

## Closeout executor matrix

| Closeout class | Closeout decision authority | Transaction executor |
| --- | --- | --- |
| Assigned project child task | WORK when substantive assurance is required after independent review, integration, validation, and post-integration evidence exists | Deterministic CI may attempt the idempotent transaction first; WORK verifies/reconciles when judgment is required; eligible agents self-claim successors under standing parent authority (#3145) |
| Assigned child remediation | WORK after required independent review and remediation verification exists | Deterministic CI may attempt the idempotent transaction first; WORK verifies/reconciles the result |
| Project/master | PMO / Engineering with independent PR Approver / Engineering verification | Designated Administration & Communications role holder who did not solely implement the underlying child work |
| Program/umbrella | Product Authority and PMO / Engineering under explicitly recorded program-closeout authority | Administration & Communications role holder |
| Promotion Candidate | PMO / Engineering, PR Approver / Engineering, and additional roles required by the applicable approval profile | Administration & Communications role holder records the disposition |
| Production | Recorded Production authority with required Engineering approval | Administration & Communications role holder records the disposition |
| Incident | Day-2 Operations after recovery verification and hold disposition | Administration & Communications role holder records the disposition |

## Completion levels

### Task closeout

A Development task may close after:

- the source Issue explicitly identifies the Issue class, assigned role holder, and parent/master;
- required implementation and validation are complete;
- the PR is integrated into the correct non-main branch or receives an authorized non-merge disposition;
- protected independent review requirements are satisfied;
- post-integration verification passes;
- task evidence and terminal state are reconciled;
- successor dependency state is recorded; and
- no protected stop, operational hold, or unresolved closeout exception remains.

Task closeout does not mean the complete feature, project, Promotion Candidate, or Production release is complete.

### Project/master closeout

A project closes after:

- all planned tasks are completed, removed, superseded, or explicitly deferred;
- child closeout packets and required independent approvals are audited;
- integrated Development scope is reconciled against project acceptance;
- unresolved gaps are explicit;
- Promotion Candidate and Production disposition are recorded when required;
- parent and program reporting are current; and
- the designated transaction executor is not relying solely on the role holder that implemented the child work.

### Program/umbrella closeout

A program or umbrella Issue closes only when Product Authority and PMO / Engineering record the applicable closeout authority and all project, Promotion Candidate, Production, deferred-work, and reporting dispositions are complete.

### Promotion Candidate closeout

A Promotion Candidate closes with one disposition:

- approved for Production;
- returned to Development;
- superseded by a newer candidate; or
- stopped or not planned.

Required evidence includes the exact candidate identity, qualification results, standards reconciliation, rollback readiness, unresolved gaps, and decision authority.

### Production closeout

Production closeout requires:

- exact approved candidate identity;
- controlled merge or deployment evidence;
- live verification;
- rollback disposition;
- Day-2 ownership transfer; and
- any incident or remediation state.

### Incident closeout

An incident closes after:

- impact and cause are sufficiently documented;
- containment and recovery actions are recorded;
- recovery verification and sustained health meet policy;
- remaining operational holds are released;
- follow-up root-cause, hardening, standards, or documentation work is tracked; and
- paused work state is restored or explicitly re-planned.

## Required closeout packet

A closeout packet identifies:

```text
CLOSEOUT
Level: task | project | program | promotion-candidate | production | incident
Subject: #____
Source authority: #____ / canonical policy
Issue class: project-child | child-remediation | project-master | program | promotion-candidate | production | incident
Assigned role holder: ____ / not applicable
Parent/master: #____ / not applicable
Profile: sandbox | development | promotion-candidate | production | day-2
PR / candidate / deployment / incident identity: ____ / not applicable
Validation and review evidence: ____
Post-integration or live verification: pass | failed | not applicable
Decision authority: <durable role>
Transaction executor: deterministic-ci | assigned-implementation-operations | administration-communications
Terminal state: ____
Parent/program/reporting action: ____
Successor or resume action: ____
Unresolved gaps or follow-up: none | ____
Rollback or recovery evidence: ____ / not applicable
Exception: none | #____
```

Missing evidence routes to one bounded exception. It does not justify guessing.

## WORK acceptance decision

WORK independently reviews the complete task package and evidence and records exactly one disposition:

- `ACCEPT`;
- `HOLD`;
- `REMEDIATE`; or
- `VERIFY MORE`.

WORK records `ACCEPT`, `HOLD`, `REMEDIATE`, or `VERIFY MORE` when substantive assurance or discrepancy handling is required. Deterministic CI remains the single automatic source-Issue closeout owner and may reconcile mechanically provable child/parent bookkeeping. Eligible agents self-claim the next package-complete successor under standing parent authority after deterministic predecessor completion (#3145). A merge by itself is not substantive acceptance. When WORK implemented the change, WORK must obtain independent review/verification from another authorized reviewer before recording acceptance.

## Assigned task-closeout sequence

For an explicitly assigned project-child or child-remediation Issue:

1. Implementation / Operations completes scoped implementation, validation, and remediation.
2. The role holder posts `IMPLEMENTATION HANDOFF` and `PR REVIEW REQUEST` evidence.
3. PR Approver / Engineering or the applicable approval profile supplies independent review or authorized integration evidence.
4. Deterministic CI or the assigned Implementation / Operations role holder verifies the integrated task state.
5. Deterministic CI attempts the idempotent closeout transaction first when mechanically provable.
6. If automation completes successfully, the assigned role holder records no duplicate transaction.
7. If automation does not complete but all invariants are satisfied, the assigned Implementation / Operations role holder posts the closeout packet, reconciles permitted task state, closes the assigned Issue, and verifies the terminal state.
8. If any invariant is missing, failed, contradictory, ambiguous, or outside the assigned task boundary, the role holder records and routes one bounded closeout exception to Administration & Communications.

The assigned task role holder does not wait for routine project/master audit before closing an otherwise eligible child task.

## Deterministic post-merge closeout

Successful post-merge automation is the primary merge-triggered task-closeout transaction executor when the result is mechanically provable.

It may:

- verify merge or integration identity;
- verify declared Issue class, assigned role holder, and parent/master;
- reconcile source-Issue labels and state;
- record task-level completion;
- update parent/project reporting;
- disposition declared successors;
- create or update one remediation or closeout-exception record; and
- verify the final administrative state.

It must not:

- claim Promotion Candidate or Production success from a Development merge;
- invent acceptance, approval, integration, or Production authority;
- close a project/master, program/umbrella, Promotion Candidate, Production, release, incident, or standalone `OPS:` Issue without explicit authority;
- duplicate an already successful closeout; or
- block independent Development solely because prose, labels, or reporting remain pending.

## Project/master audit sequence

1. PMO / Engineering identifies the complete planned task set and acceptance criteria.
2. PR Approver / Engineering independently verifies required child approval and integrated evidence.
3. Administration & Communications reconciles child terminal states, deferred or superseded work, unresolved gaps, Promotion Candidate and Production disposition, and reporting.
4. The designated Administration & Communications role holder posts the project/master closeout packet.
5. The designated role holder closes the project/master Issue and re-fetches the final state.
6. Product Authority receives final completed-product review at the point required by the applicable delivery model.

A role holder that implemented child work may supply evidence but must not be the sole independent project/master auditor or transaction authority.

## Successor handling

Successor eligibility depends on explicit dependency, collision, hold, and authority state—not routine predecessor closeout prose.

### Independent successor

An independent Development task may start when its source authority and dependencies permit, even if the previous task remains in PR review or administrative closeout.

### Technical successor

A successor with `technical-integration`, protected, resource-collision, launch-authority, or operational dependencies remains blocked until the applicable condition clears.

### Administrative-only relationship

Administrative-only state never blocks implementation eligibility.

Closeout records the successor disposition but does not create the dependency.

## Parent and program accounting

Administration & Communications reconciles:

- task completion and remaining work;
- project and program status;
- Promotion Candidate and Production state;
- deferred, superseded, or removed work;
- unresolved defects and Production risk;
- active incidents and operational holds; and
- dashboards and reports explicitly governed by the source authority.

Parent, program, umbrella, and tracking Issues remain open until their own closeout authority and completion evidence exist.

## Non-merge dispositions

An Issue may close without a merged PR when the source authority records a valid disposition such as:

- duplicate;
- superseded;
- not planned;
- canceled;
- evidence-only Sandbox result;
- administrative-only completion; or
- no-change verification.

Non-merge closeout must not falsely represent implementation, qualification, Production, or recovery success.

Task-level non-merge closeout may be executed by the assigned Implementation / Operations role holder only when the source Issue explicitly authorizes the disposition and all other delegated task-closeout boundaries are satisfied.

## Closeout exceptions

Exception lifecycle:

```text
DETECTED -> RECORDED -> ROUTED -> CLARIFICATION OR REMEDIATION -> VERIFIED -> RESOLVED
```

One exception record identifies:

- affected subject and closeout level;
- missing or contradictory invariant;
- current evidence;
- affected blocking scope;
- owning role;
- required clarification or remediation;
- resume or successor effect; and
- resolution evidence.

Reporting lag and cosmetic metadata do not block independent work. Missing authority, validation, approval, candidate identity, Production evidence, safety, or collision state blocks only the affected transition unless the issue is shared.

## Lightweight clarification

When closeout evidence reveals a simple inconsistency:

```text
PROBLEM FOUND
  -> route to the role that made the controlling decision
  -> GUIDANCE or ADJUSTMENT
  -> Administration & Communications records
  -> RESUME or CLOSEOUT
```

Use `PLAN CHANGE REQUIRED` only when the answer changes product outcome, architecture, acceptance criteria, dependencies, delivery model, promotion path, Production boundary, or recovery strategy.

## Operational hold and resume

During a broad Day-2 assessment hold, closeout preserves active task, branch, claim, candidate, and resume state.

After Day-2 Operations authorizes hold narrowing or release, Administration & Communications:

- restores unaffected work;
- prevents duplicate claims;
- preserves superseding decisions; and
- records exact resumed tasks and remaining targeted holds.

## Idempotency

- Re-read current state before mutation.
- Skip an action when the intended state already exists.
- Do not overwrite newer check, review, decision, candidate, deployment, incident, or closeout evidence.
- Use stable action or exception identifiers when automated.
- Re-fetch and verify the final state.

## Required references

- Administration & Communications policy: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Administration contract: `docs/reference/operations/administrative-control-lane-contract.md`
- Agent role contract: `docs/reference/agents/implementation-authority-contract.md`
- Lane/profile contract: `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
- Delivery and promotion policy: `docs/governance/DELIVERY-AND-RELEASE.md`
- Day-2 Operations policy: `docs/governance/OPERATIONS-AND-RECOVERY.md`
- Queue/dispatch procedure: `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
