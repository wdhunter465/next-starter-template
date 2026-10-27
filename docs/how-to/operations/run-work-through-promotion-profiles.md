---
Doc Type: How-To
Audience: Human + AI operators
Authority Level: Procedure
Owns: Procedure for moving approved work through Sandbox, Development, Promotion Candidate, Production, and Day-2 Operations
Does Not Own: Product decisions, role assignments, gate implementation, or production credentials
Canonical Reference: /docs/reference/operations/operating-lanes-and-promotion-profiles.md
Related Issues: #2640, #2641, #2639
Last Reviewed: 2026-07-19
---

# Run Work Through the Promotion Profiles

## Purpose

Provide the operator procedure for moving approved work through Sandbox, Development, Promotion Candidate, Production, and Day-2 Operations under the four-lane model.

## Scope

- Owns procedural steps for allowed profile transitions and handoff checkpoints.
- Does not own product decisions, role assignments, gate implementation, or production credentials.
- Canonical definitions remain in `docs/reference/operations/operating-lanes-and-promotion-profiles.md`.

## Current known truth

- Work must enter through repository authority (`Agent.md` and the authority chain) before profile transitions.
- Sandbox is optional; Development → Promotion Candidate → Production is mandatory for public production use.
- Administration & Communications records and routes; the active horizontal lane retains decision authority.

## Intended final state

Operators can execute an authorized profile path without skipping profiles, inventing a fifth lane, or treating Administration as a universal decision gate.

## Procedure

### 1. Enter through repository authority

Before work begins:

1. Read `Agent.md` and the required authority chain.
2. Identify the current durable role.
3. Identify the active horizontal lane.
4. Identify the current promotion profile.
5. Load the source Issue, project manifest, dependencies, and any active operational hold.
6. Confirm the requested transition is allowed.

Administration & Communications records and routes this context. The horizontal lane retains decision authority.

### 2. PMO / Engineering intake

PMO / Engineering defines:

- objective and non-goals;
- requirements and acceptance criteria;
- architecture and design constraints;
- dependencies and protected stops;
- verification and rollback expectations;
- priority;
- whether a Sandbox experiment is useful;
- implementation Go.

Proceed directly to Development when the design is sufficiently factual. Use Sandbox when material uncertainty can be reduced through isolated proof-of-concept work.

### 3. Run Sandbox work

1. Create or select an isolated remote Sandbox branch.
2. Confirm no production credentials, writes, bindings, or direct promotion path exist.
3. Define the question the experiment must answer.
4. Run only the scaled-down checks needed for repository safety and useful evidence.
5. Record the result:
   - discard;
   - retain as design evidence; or
   - adopt into Development.
6. When adopting, create or update the normal Development work package and identify experimental shortcuts that must be removed or hardened.

Do not send Sandbox output directly to Promotion Candidate or Production.

### 4. Run Development

1. Work from the approved Model B task and component branch.
2. Implement, test, and push the bounded change.
3. Open or update the PR against the Development/component branch.
4. Let automated PR gates validate build, tests, security, scope, metadata, branch state, and protected paths.
5. When eligible, permit automated non-main integration according to Delivery policy.
6. Route protected changes or material design concerns to PR Approver / Engineering.
7. Continue the next independent task while earlier work is review- or administration-pending.
8. When the integrated Development result is complete enough for release qualification, define the exact scope and immutable identity of the Promotion Candidate.

### 5. Handle a problem found during work

Use the lightweight path first:

```text
PROBLEM FOUND
  -> route to the role that made the controlling decision
  -> GUIDANCE or ADJUSTMENT
  -> Administration & Communications records the decision
  -> RESUME
```

The report should include:

- affected task or incident;
- observed fact;
- why the current action cannot proceed as intended;
- evidence;
- smallest known affected scope;
- whether independent work remains safe.

Pause only the affected scope unless evidence requires more.

Use `PLAN CHANGE REQUIRED` only when product objective, architecture, acceptance criteria, dependency structure, delivery model, production boundary, or recovery strategy materially changes.

### 6. Build the Promotion Candidate

1. Select the exact integrated Development result.
2. Freeze or identify the candidate SHA/release identity.
3. Prepare the release-qualification plan appropriate to scope and risk.
4. Run applicable:
   - integrated acceptance testing;
   - regression testing;
   - load and performance testing;
   - security and privacy validation;
   - migration and data-integrity testing;
   - resilience and failure-path testing;
   - deployment rehearsal;
   - rollback validation;
   - monitoring and operational-readiness validation;
   - planned-versus-built and unresolved-gap review;
   - documentation and repository-standards reconciliation.
5. If the solution legitimately changes repository assumptions or standards, route the change to the owning role and repeat affected tests after reconciliation.
6. Record Go, No-Go, or return-to-Development disposition.

Promotion Candidate is a mandatory barrier. Development cannot move directly to Production.

### 7. Promote to Production

1. Confirm the approved candidate identity has not changed.
2. Confirm required manual approvals and production authority.
3. Confirm current `main`, branch, environment, binding, migration, and rollback state.
4. Execute the controlled promotion and deployment.
5. Run live smoke, route, asset, service-connectivity, and feature verification.
6. Record the production result and transfer the feature to Day-2 Operations.
7. If verification fails, contain or roll back and enter the Day-2 incident path.

### 8. Operate in Day-2

When production degradation, outage, unsafe behavior, or material risk is detected:

1. Create or elevate the operational Issue with evidence.
2. Apply an assessment hold while impact is unknown.
3. Determine impact, probable cause, containment, affected scope, and resolution ownership.
4. Narrow the broad hold when unrelated work can resume safely.
5. Attempt only pre-authorized, deterministic, reversible automation.
6. Route corrective implementation through Development and Promotion Candidate when required by risk.
7. Validate recovery and sustained health.
8. Release remaining holds.
9. Administration & Communications restores preserved work state and records closeout.

### 9. Close work

Administration & Communications verifies:

- planned work is dispositioned;
- required evidence exists;
- acceptance and promotion decisions are recorded;
- unresolved gaps or production risks are explicit;
- issue, project, program, release, and incident state agree;
- no profile transition was skipped.