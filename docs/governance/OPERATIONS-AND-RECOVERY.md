---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Production health, degraded-service routing, incident classification, containment, recovery strategy, operational hold release, component recovery, stabilization-first boundaries, and Operations queue completion criteria
Does Not Own: Cross-team queue semantics, Administration & Communications policy, delivery-model selection, PMO sizing, PR approval roles, CI implementation, project objectives, or daily operator checklists
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2495, #2640, #2641, #2695, #2699
Last Reviewed: 2026-09-22 (role-name reconciliation, #4213)
---

# Operations and Recovery

## Purpose

This document is the canonical Day-2 Operations policy. It defines how Operations interrupts are coordinated, how production health is monitored, how degradation and outages are classified, how work is paused, how recovery strategy is selected, and how normal project work resumes.

Queue precedence, Operations priority labels, Monitoring, Hold, and universal collaboration are defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

Administration & Communications policy is owned separately by `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`.

## Day-2 Operations lane

Day-2 Operations begins when a feature reaches Production and continues for the life of the service. It also coordinates repository operational work that is validly opened as a standalone `OPS:` source Issue.

It owns:

- Operations interrupt coordination and release within its authority;
- production monitoring and health interpretation;
- incident severity and impact classification;
- containment and rollback decisions;
- recovery strategy;
- operational assessment and targeted holds;
- runner host/service health and recovery;
- corrective implementation routing;
- recovery validation and sustained-health criteria;
- release of operational holds.

All current team members may participate according to their durable roles.

`OPS:` is a cross-lane interrupt classification, not a fifth operating lane. PMO / Engineering retains design and implementation-Go authority, Implementation / Operations performs corrective work, PR Approver / Engineering performs independent review, Deterministic CI provides machine evidence, and Administration & Communications records and routes state.

## Operations queue states

A qualifying standalone Operations Issue carries `team:operations` and exactly one of:

- `ops:priority:1`;
- `ops:priority:2`;
- `ops:priority:3`;
- `ops:priority:4`;
- `ops:monitoring`;
- `ops:hold`.

All numbered priorities are actionable and interrupt PMO Active implementation and Engineering Pipeline preparation. The priority number orders concurrent Operations remediation; it does not determine whether the interrupt applies.

### Monitoring

Use `ops:monitoring` when remediation has progressed as far as currently possible and the next required action is observation for stability, recurrence, external behavior, or sustained health.

Monitoring must record:

- what is being observed;
- owner;
- update interval or next-review time;
- evidence expected;
- success, reactivation, and closeout conditions.

Monitoring is non-blocking for PMO and Engineering work.

### Hold

Use `ops:hold` when further remediation cannot proceed because information, access, authority, vendor action, external evidence, time-bound behavior, or another prerequisite is pending.

Hold must record:

- hold reason;
- owner of the missing condition;
- next-review time;
- evidence or event required;
- condition for return to a numbered priority or closeout.

Hold is non-blocking for PMO and Engineering work unless a separate protected or incident hold explicitly covers that work.

A numbered Operations Issue that has been worked as far as possible must move to Monitoring or Hold rather than remain falsely actionable.

## Operations interrupt precedence

A qualifying standalone numbered `OPS:` source Issue interrupts normal PMO and Engineering work immediately under the standing Product Authority rule in `docs/governance/PMO-PORTFOLIO.md`.

The Operations interrupt applies whether the Issue concerns:

- an active Production incident;
- degraded service or a corrective release;
- runner, bridge, controller, CI, deployment, recovery, capacity, security, or communication infrastructure;
- repository operational reliability or hardening; or
- another bounded Day-2 Operations need validly classified as a standalone `OPS:` source Issue.

The interrupt does not require a separate material-risk finding or case-by-case reprioritization after the Issue qualifies.

When a numbered Operations interrupt activates:

1. Administration & Communications stops new PMO and Engineering dispatch and records the hold.
2. Active work reaches the nearest safe checkpoint and preserves its state.
3. Day-2 Operations confirms the operational owner, immediate objective, affected systems, and release condition.
4. The Operations Issue receives the next available capacity required from the existing lanes.
5. The work follows the delivery, validation, approval, Production, and rollback controls required by its risk.
6. Normal work remains interrupted until no numbered Operations Issue remains actionable.

A safe checkpoint protects in-flight branch, claim, test, deployment, migration, rollback, and evidence state. The interrupt must not terminate work in a way that creates a second operational problem.

Tracker-only, duplicate, bookkeeping, advisory, and evidence-only records do not trigger the interrupt unless Product Authority explicitly elevates them into authoritative standalone Operations work.

## Primary and Tier 2 ownership

Implementation / Operations (current holder in `docs/governance/AGENT-TEAM.md`) is the normal primary owner for Operations remediation implementation.

Engineering (current holder in `docs/governance/AGENT-TEAM.md`) participates as Tier 2 specialist support when the Issue requires:

- original design interpretation;
- architecture or dependency analysis;
- acceptance-criteria clarification;
- recovery-plan adjustment;
- protected Engineering judgment;
- independent PR or Production review;
- cross-lane coordination.

Tier 2 participation uses the universal collaboration method on the same Operations source Issue. The Issue remains owned by `team:operations`, retains its Operations priority/state, and does not receive an Engineering team or priority label.

Engineering does not take over the branch or PR merely because Tier 2 support is active. Implementation / Operations applies the response and resumes remediation unless an explicit ownership handoff or formal review responsibility is separately recorded.

## Detection and incident creation

Trusted evidence may come from:

- deployment status;
- route or uptime monitoring;
- application health checks;
- CI/CD runtime checks;
- D1, B2, or external-service connectivity;
- logs and alerts;
- verified human reports.

Deterministic automation may create or elevate a deduplicated operational Issue and attach evidence. It must not invent cause, recovery strategy, production authority, or authoritative `OPS:` classification beyond pre-authorized deterministic rules.

Not every Operations interrupt is a Production incident. Day-2 Operations must classify Production impact separately after the interrupt is active.

## Assessment hold

When production impact is unknown, Day-2 Operations may authorize a broad incident assessment hold in addition to the standing numbered Operations interrupt.

The incident assessment hold exists to prevent project work from worsening an incident or consuming the small team before scope is understood.

During assessment determine:

- user and system impact;
- severity;
- probable cause or bounded hypothesis;
- containment;
- affected projects, branches, environments, and resources;
- recovery owner;
- safe next action.

Administration & Communications records the hold, preserves work state, routes assignments, and tracks acknowledgment.

## Narrowing and releasing holds

An incident assessment hold should not remain broad until full recovery when the incident has been sufficiently bounded.

Once impact, probable cause, containment, affected scope, and resolution ownership are understood:

- convert the broad incident hold to targeted project or incident-task holds;
- release resources not required by the incident when safe;
- continue incident work with the assigned team;
- preserve any collision or safety restrictions that remain.

Day-2 Operations authorizes incident-hold narrowing and release. Administration & Communications executes state restoration and routes `RESUME`.

Changing the queue state from a numbered Operations priority to Monitoring or Hold releases the standing queue interrupt unless a separate explicit operational or incident hold remains active.

## Recovery paths

A single incident uses one primary path at a time.

| Path | Trigger | Primary goal |
| --- | --- | --- |
| Emergency stabilization | Production unavailable, unsafe, exploited, data at risk, or materially degraded | Restore safe service first |
| Bounded corrective release | Known, isolated defect with a complete low-risk fix | Restore behavior through the applicable Promotion Candidate and Production path |
| Structural recovery | Multi-component, architectural, data, or standards change | Return through PMO / Engineering, Development, Promotion Candidate, and Production |

Changing the recovery path requires a Day-2 Operations decision recorded on the incident Issue. If the new path changes architecture, acceptance, product outcome, delivery model, or Production boundary, route the decision to the owning role.

## Degraded-service routing

| Symptom | Default route |
| --- | --- |
| Site unavailable, active exploit, data-loss risk, unsafe auth/admin behavior | Emergency stabilization |
| Single feature broken with known bounded fix | Bounded corrective release |
| Material performance issue with known isolated cause | Bounded corrective release |
| Structural performance, architecture, or multi-component regression | Structural recovery |
| Cosmetic or documentation-only defect | Routine delivery inside the active Operations interrupt unless Product Authority defers it |

When uncertain, stabilize and contain before choosing a broader implementation path.

## Emergency stabilization

Response order:

1. confirm impact and severity;
2. pause conflicting Production promotions and Development integration when necessary;
3. contain traffic, writes, or affected functionality;
4. roll back to last known good when possible;
5. apply the smallest safe recovery when rollback is insufficient;
6. obtain required protected Production authority;
7. run targeted recovery verification;
8. restore safe bounded service;
9. create follow-up work for root cause, hardening, standards, and documentation.

Emergency automation is limited to pre-authorized, deterministic, reversible actions. It must not mutate credentials, paid services, destructive data, or repository settings without authority.

## Corrective implementation and promotion

Operational corrective work uses the profile path required by its risk:

```text
Day-2 Operations
  -> Development
  -> Promotion Candidate
  -> Production
  -> recovery verification
```

A narrowly authorized emergency action may stabilize Production before full release qualification, but the resulting state must be followed by normal Development and Promotion Candidate work when required.

Sandbox may be used by PMO / Engineering to test uncertain recovery assumptions, but Sandbox output cannot move directly into Production.

Operations interrupt precedence never authorizes bypass of a required profile, independent review, Production approval, or rollback plan.

## Lightweight recovery-strategy adjustment

When new evidence invalidates the current recovery approach:

```text
PROBLEM FOUND
  -> Day-2 Operations reviews evidence
  -> GUIDANCE, ADJUSTMENT, or PLAN CHANGE REQUIRED
  -> Administration & Communications records and routes
  -> RESUME under the revised strategy
```

A bounded adjustment does not require a full incident redesign. A material change to recovery strategy, architecture, Production boundary, or risk classification requires recorded authority.

Agent-to-agent assistance uses `COLLABORATION REQUEST`, `COLLABORATION ACKNOWLEDGED`, `COLLABORATION RESPONSE`, and `COLLABORATION COMPLETE` on the same source Issue.

## Component and Development health

Component integration health is recorded through checks or branch status.

| State | Meaning | Effect |
| --- | --- | --- |
| Green | Required Development checks pass | Eligible independent work may integrate when no numbered Operations interrupt applies |
| Red | Broken build, integration failure, or unresolved protected issue | Affected integration stops until green is restored |
| Hold | Explicit operational or Engineering hold | Covered work stops |

A red Development component is not automatically a Production incident. Classify Production impact separately. A qualifying standalone numbered `OPS:` Issue may nevertheless interrupt normal work before Production impact is known.

When Development integration breaks:

1. identify the failing change and evidence;
2. stop affected successor integration;
3. remediate on a bounded branch;
4. rerun integrated checks;
5. restore green state through the applicable approval path;
6. resume independent work only when no numbered Operations interrupt or explicit hold remains.

## Runner service operations

The runner is communications/control-plane infrastructure, but its host and service are Day-2 Operations assets.

Day-2 Operations owns:

- registration and service availability;
- `systemd` operation;
- capacity and storage;
- patching and security;
- unexpected workload containment;
- stop/start, disable, rollback, and recovery.

Administration & Communications owns runner event routing, acknowledgments, retries, escalation, and communication-health state. Implementation / Operations owns workflow creation and onboarding.

## Operations completion and project resume

An Operations Issue is complete, non-blocking, or releasable when one of the following is true:

- acceptance and validation requirements are satisfied and the Issue can close;
- remediation has progressed as far as possible and the Issue is validly moved to Monitoring;
- remediation cannot proceed and the Issue is validly moved to Hold;
- Product Authority or Day-2 Operations explicitly defers the work;
- an authorized `RESUME` releases a separate hold.

Before closeout verify:

- the service or repository capability is safe and functioning within accepted bounds;
- corrective change and required Promotion Candidate checks are complete;
- Production verification passes when Production was touched;
- monitoring shows sustained health for the required period;
- unresolved root cause, hardening, or standards work is tracked;
- the Operations Issue, evidence, and interrupted work state are reconciled.

Administration & Communications then restores preserved PMO and Engineering work without duplicate claims or stale assignments.

## Canonical references

| Topic | Owner |
| --- | --- |
| Queue precedence, Operations states, collaboration | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` |
| PMO priority and Operations interrupt decision authority | `docs/governance/PMO-PORTFOLIO.md` |
| Administration & Communications policy | `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md` |
| Lane and profile contract | `docs/reference/operations/operating-lanes-and-promotion-profiles.md` |
| Delivery and promotion policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Runner contract | `docs/reference/ci/repository-runner-contract.md` |
| Emergency recovery procedure | `docs/how-to/ops/run-emergency-recovery.md` |
| Rollback evidence | `docs/reference/delivery/delivery-and-rollback-profiles.md` |

## Supersession

This policy supersedes lower-level instructions that:

- treat qualifying standalone numbered Operations Issues as ordinary project backlog;
- treat Operations as peer to PMO and Engineering rather than interrupting them;
- require a separate risk threshold before interrupt precedence applies;
- keep an Operations Issue falsely actionable after it has reached a Monitoring or Hold condition;
- allow Monitoring or Hold records to stagnate without interval review;
- assign Administration independent recovery authority;
- require a second Issue merely to obtain Tier 2 specialist collaboration;
- permit operational corrective work to bypass required Development, Promotion Candidate, or Production controls.
