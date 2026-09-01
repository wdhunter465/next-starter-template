---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Canonical PMO lifecycle states, hierarchical priority representation, stage deliverables, handoff continuity, and dashboard/routing invariants
Does Not Own: Product priority decisions, weekly meeting procedure, live GitHub label creation, or bulk Issue mutation
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3597, #3823
Last Reviewed: 2026-09-01
---

# PMO Lifecycle and Priority Contract

## Purpose

Record the machine-readable PMO lifecycle, scoped priority hierarchy, durable handoff requirements, and dashboard representation used by PMO, Governance, agents, and reporting.

## Portfolio lifecycle

The PMO dashboard has exactly three top-level portfolio lifecycle sections:

1. **Active**
2. **Pipeline**
3. **Completed**

`Incomplete` is not a PMO lifecycle state. Malformed or contradictory records are administrative/data-quality exceptions and must be reconciled separately.

## Engineering qualification

Engineering is the qualification gate immediately before Pipeline. Minimum qualification establishes the problem/current-state deficiency, why remediation is required, intended outcome, remediation objectives/design direction, material constraints/dependencies/risks/protected decisions, and useful candidate direction where available.

Engineering does not complete the final detailed design, implementation plan, or launch packet.

## Pipeline detailed lifecycle

Every Pipeline parent has exactly one detailed stage:

| Order | Stage | Canonical label |
| ---: | --- | --- |
| 1 | Idea | `pmo:stage:idea` |
| 2 | Design Needed | `pmo:stage:design-needed` |
| 3 | Design Ready | `pmo:stage:design-ready` |
| 4 | Sandbox Testing | `pmo:stage:sandbox-testing` |
| 5 | Sandbox Completed | `pmo:stage:sandbox-completed` |
| 6 | Development Testing | `pmo:stage:development-testing` |
| 7 | Development Completed | `pmo:stage:development-completed` |
| 8 | Launch Packet Needed | `pmo:stage:launch-packet-needed` |
| 9 | Launch Packet Ready | `pmo:stage:launch-packet-ready` |
| 10 | Graduation Candidate | `pmo:stage:graduation-candidate` |

The dashboard summarizes those stages into six maturity bands and displays highest maturity first:

| Dashboard order | Maturity band | Detailed stages |
| ---: | --- | --- |
| 6 | Graduation Candidate | Graduation Candidate |
| 5 | Launch Packet | Launch Packet Needed; Launch Packet Ready |
| 4 | Development | Development Testing; Development Completed |
| 3 | Sandbox | Sandbox Testing; Sandbox Completed |
| 2 | Design | Design Needed; Design Ready |
| 1 | Idea | Idea |

## Stage deliverables and exit criteria

A project advances only when the current-stage deliverables are complete and durably recorded.

| Stage | Required deliverable before advancement |
| --- | --- |
| Idea | Problem/opportunity, intended outcome, initial solution direction, constraints, and Product intent are coherent. |
| Design Needed | Idea accepted; design owner identified; discovery questions, dependencies, risks, and protected decisions recorded. |
| Design Ready | Requirements, scope/non-goals, architecture/approach, acceptance criteria, dependencies, validation, and rollback are documented and reconciled. |
| Sandbox Testing | Sandbox hypothesis/question, isolation boundary, exact experiment/test plan, evidence requirements, and success/failure criteria are recorded. Sandbox may be marked `NOT REQUIRED` with rationale. |
| Sandbox Completed | Evidence recorded; concepts proven/rejected; findings reconciled; design is updated to 100% documented based on proven concepts. |
| Development Testing | Development implementation package is defined; implementation/testing is underway or available; test matrix and evidence requirements are explicit. |
| Development Completed | Development implementation is complete; as-built design is 100% documented; Development evidence is recorded; deviations are reconciled. |
| Launch Packet Needed | Development basis accepted; remaining Production/promotion requirements, dependencies, rollback, monitoring, CI/CD, Operations handoff, and protected launch decisions are identified. |
| Launch Packet Ready | Final design package is 100% complete, including as-built documentation, tests, rollback, deployment, monitoring/CI/CD, Operations handoff, child graph, and protected decisions. |
| Graduation Candidate | Launch Packet independently checked; Go/No-Go recommendation recorded; implementation owner and first executable action identified; ready for PMO Graduation review. |

No `mostly done` stage transition is valid. The deterministic transition is:

```text
current-stage deliverables complete
  -> PMO records stage exit
  -> stage label changes
  -> next-stage missing deliverables become current work
```

## Priority invariant — hierarchical and scoped

**Priority is execution order among sibling work items under the same immediate parent/container. Priority numbering restarts and may be reused under each Program, Project, child work unit, and applicable PMO stage. A priority number has no repository-wide ordering meaning.**

Examples:

- Program 1 may contain Project 1 at Priority 1.
- Program 2 may independently contain Project 1 at Priority 1.
- A Project may contain Child 1 at Priority 1 and Child 2 at Priority 2.
- Each Child may independently contain Task priorities starting again at 1.

A unique execution position is determined by the full hierarchy path, for example:

```text
Program 2:P1 -> Project 1:P1 -> Child 2:P2 -> Task:P4
```

Lifecycle stage expresses maturity/readiness. Priority expresses execution order within the applicable parent scope.

Dependencies may record true prerequisite, collision, or protected relationships, but they do not replace scoped priority ordering and must not flatten the hierarchy into one repository-global queue.

## Durable PMO Current State handoff contract

Every Pipeline parent must contain or link to a durable PMO Current State record sufficient for a replacement agent to continue without chat history. It records:

- Pipeline lifecycle stage;
- full hierarchical priority path and priority within the immediate parent/current stage;
- current preparation owner/agent;
- objective;
- completed deliverables;
- authoritative design/evidence links;
- outstanding current-stage deliverables;
- dependencies;
- protected decisions/HOLDs;
- risks;
- exact next action;
- next-action owner;
- stage exit criteria;
- recommended next stage;
- last reconciliation date.

A replacement agent must be able to answer from the Issue/repository alone:

1. What has been decided?
2. What evidence exists?
3. What remains unfinished?
4. What is authorized next?
5. What must be true to advance?

## Active lifecycle after Graduation

Graduation moves a Project from Pipeline to Active. A graduated Project remains Active through:

1. Promotion Testing
2. Promotion Approved / production-on-main
3. Operations monitoring, CI/CD automation, and reporting setup
4. Production Testing
5. Production Accepted by Operations
6. required PMO administrative closeout

After Production Accepted and PMO closeout, the Project becomes Completed. Administrative residue does not normally move an Active Project back to Pipeline.

## Parent and child accounting

### Portfolio parent

A PMO portfolio parent is a Program or Project record and is not `pmo:task`.

Pipeline parent minimum shape:

```text
pmo
pmo:pipeline
team:pmo
exactly one pmo:stage:*
scoped priority represented in its parent/current-stage context
```

Active parent minimum shape:

```text
pmo
pmo:active
team:pmo
scoped priority represented in its parent/program context
```

### Counted child

A counted child has:

```text
pmo
pmo:task
valid parent reference
exactly one lifecycle: pmo:active or pmo:closed
```

Child priority is local to its Project/parent and must not be interpreted as a repository-global or team-global rank.

Parent rollup:

- Tasks = valid `pmo:task` children.
- Completed = valid children with `pmo:closed`.
- Percent complete = Completed / Tasks when Tasks > 0.

Malformed child records are data-quality exceptions; they are not a fourth portfolio lifecycle.

## Project Graduation

Project Graduation is the only normal Pipeline-to-Active transition. It requires:

- complete Launch Packet;
- truthful Graduation Candidate stage;
- PMO review;
- explicit Go;
- Active hierarchical priority placement;
- one start-to-finish implementation owner;
- first executable task/action;
- applicable authority and protected-stop evidence.

Implementation Go authorizes Development execution against the approved package. It does not by itself authorize Production promotion.

## Legacy migration

The former four-stage Pipeline model is superseded:

```text
Initial Idea
Drafted Design
Pending Launch Packet
Graduation Candidate
```

Existing open records using former stage labels must be reconciled from evidence into the new 10-stage model. Do not infer maturity merely to complete migration.

Former global assumptions such as one repository-wide Pipeline priority or one repository-wide Active priority are also superseded. Priority is now interpreted through the item's immediate parent/container and full hierarchy path.

## Dashboard invariants

- Top-level lifecycle sections: Active, Pipeline, Completed only.
- Pipeline display: six maturity bands, ordered 6 down to 1.
- Detailed stage remains visible/available for each Pipeline parent.
- Repeated priority numbers are valid when their parent scopes differ.
- Dashboard ordering must preserve hierarchy rather than flattening repeated priorities into one global sequence.
- Data-quality exceptions are surfaced separately from portfolio lifecycle.

## Authority boundary

Product Authority retains final business/product priority and protected decisions. PMO manages lifecycle readiness, durable project state, and authorized portfolio ordering. Governance resolves governing policy/assignment conflicts subject to Product Authority. Protected legal, privacy, security, credential, cost, destructive-data, Production, and separation-of-duty boundaries remain unchanged.
