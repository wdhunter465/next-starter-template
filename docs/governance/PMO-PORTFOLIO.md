---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: PMO intake, Pipeline lifecycle, stage deliverables, scoped priority, Sandbox authority, Project Graduation, Active closeout, portfolio inventory, and PMO continuity
Does Not Own: Queue-label implementation mechanics, executable implementation, CI implementation, Day-2 recovery strategy, or Production approval
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #3597, #3823
Last Reviewed: 2026-09-01
---

# PMO Portfolio

## Purpose

This document defines the controlling LGFC PMO operating model for Engineering qualification, Pipeline preparation, Project Graduation, Active execution oversight, portfolio ordering, durable handoff continuity, and completion.

Product Authority makes final business/product priority and protected decisions. PMO manages lifecycle readiness, portfolio sequencing, preparation completeness, Graduation, and project closeout within recorded authority.

Machine-readable lifecycle and priority details are in `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`.

## Portfolio lifecycle

The PMO portfolio has exactly three top-level lifecycle sections:

1. **Active**
2. **Pipeline**
3. **Completed**

`Incomplete` is not a PMO lifecycle. Malformed or contradictory records are Administration/data-quality exceptions and are reconciled separately.

## Engineering qualification

Every proposed Program or Project enters Engineering qualification before Pipeline unless a higher repository authority explicitly defines another path.

Engineering qualification records, at minimum:

- problem/current-state deficiency;
- why remediation is required;
- intended outcome;
- remediation objectives/design direction;
- known constraints, dependencies, risks, and protected decisions;
- useful candidate direction where available.

Engineering does not complete final detailed design, full implementation planning, or the complete launch packet. Those are Pipeline responsibilities.

When qualification is complete, the work enters Pipeline at **Idea**.

## Pipeline detailed lifecycle

Pipeline preparation uses these 10 stages in order:

1. **Idea**
2. **Design Needed**
3. **Design Ready**
4. **Sandbox Testing**
5. **Sandbox Completed**
6. **Development Testing**
7. **Development Completed**
8. **Launch Packet Needed**
9. **Launch Packet Ready**
10. **Graduation Candidate**

The dashboard summarizes them into six maturity bands, displayed highest maturity first:

6. Graduation Candidate
5. Launch Packet
4. Development
3. Sandbox
2. Design
1. Idea

A Project may remain in any stage as long as required. Stage expresses maturity/readiness; it does not itself authorize implementation or Production.

## Stage Definition of Done

A Project advances only after the current-stage deliverables are durably complete.

### Idea

Required before exit:

- problem/opportunity;
- intended outcome;
- initial solution direction;
- known constraints;
- Product intent sufficient for design work.

### Design Needed

Required before exit:

- Idea accepted;
- design owner identified;
- discovery questions recorded;
- dependencies, risks, and protected decisions identified.

### Design Ready

Required before exit:

- requirements and acceptance criteria;
- scope and non-goals;
- architecture/approach;
- dependencies and protected stops;
- validation expectations;
- rollback expectations;
- design feedback reconciled.

### Sandbox Testing

Sandbox is optional. Use it when factual experimentation materially reduces design uncertainty.

Required before exit when used:

- hypothesis/question;
- isolated boundary;
- exact experiment/test plan;
- evidence requirements;
- success/failure criteria.

If Sandbox is not needed, record `NOT REQUIRED` with rationale and proceed to Development preparation.

### Sandbox Completed

Required before exit:

- evidence recorded;
- concepts proven/rejected;
- findings reconciled;
- design updated to 100% documented based on proven concepts.

### Development Testing

Required before exit:

- Development package defined;
- implementation/testing underway or available;
- test matrix explicit;
- evidence requirements explicit;
- deviations captured as they are discovered.

### Development Completed

Required before exit:

- Development implementation complete;
- as-built design 100% documented;
- Development test evidence recorded;
- design/as-built deviations reconciled.

### Launch Packet Needed

Required before exit:

- Development basis accepted;
- remaining promotion/Production requirements identified;
- dependencies and protected decisions identified;
- rollback, monitoring, CI/CD, reporting, and Operations handoff requirements identified.

### Launch Packet Ready

Required before exit:

- final design package 100% complete;
- as-built documentation complete;
- tests/evidence complete for launch preparation;
- rollback and deployment instructions complete;
- monitoring/CI/CD/reporting plan complete;
- Operations handoff complete;
- ordered implementation child graph complete;
- protected decisions/stops explicitly recorded.

### Graduation Candidate

Required for PMO Graduation review:

- Launch Packet independently checked;
- Go/No-Go recommendation recorded;
- implementation owner identified;
- first executable action identified;
- authority and stop conditions clear.

There is no `mostly done` stage advancement.

## Deterministic stage transition

The controlling transition is:

```text
current-stage deliverables complete
  -> PMO records stage exit
  -> detailed stage changes
  -> next-stage missing deliverables become current work
```

The durable GitHub record, not chat history, carries stage progress.

## Hierarchical priority — controlling invariant

**Priority is the execution order among sibling work items under the same immediate parent/container. Priority numbering restarts and may be reused under each Program, Project, child work unit, and applicable PMO stage. A priority number has no repository-wide ordering meaning.**

The execution hierarchy is:

```text
Program priority
  -> Project priority within that Program
    -> child-work priority within that Project
      -> task priority within that child
```

Example:

```text
Program 1
  Project 1 — Priority 1

Program 2
  Project 1 — Priority 1
```

Both Project Priority 1 values are valid because each belongs to a different Program.

Likewise, priorities restart beneath Projects and child work units. A complete execution position is determined by the hierarchy path, not by the integer alone.

Within a Project's current PMO stage, priority also defines the order of the work required to complete that stage.

## Programs and dependencies

Programs group related Projects. Priority presents the execution order within the Program/Project/task hierarchy.

Dependencies remain explicit where needed for machine safety or protected sequencing, using the repository dependency/stop taxonomy. They explain why an item must precede or constrain another item; they do not replace scoped priority as the visible execution order.

Ordinary predecessor or advisory conditions do not create a queue-wide HOLD when collision-safe earlier work remains executable.

## Durable PMO Current State contract

Every Pipeline parent must maintain a durable PMO Current State record containing:

- lifecycle stage;
- full hierarchical priority path;
- priority within immediate parent/current stage;
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

This record exists so a different qualified agent can continue without loss of progress and without relying on prior chat history.

A replacement agent must be able to determine:

1. what has been decided;
2. what evidence exists;
3. what remains unfinished;
4. what is authorized next;
5. what must be true to advance.

## Project Graduation

Project Graduation is the explicit PMO transition from Pipeline to Active.

Graduation requires:

- complete design and Launch Packet;
- truthful Graduation Candidate stage;
- PMO review;
- explicit Go;
- Active hierarchical priority placement;
- one start-to-finish implementation owner;
- first executable action;
- applicable protected-stop and authority evidence.

Implementation Go authorizes Development execution against the approved package. It does not authorize Production promotion.

## Active lifecycle and closeout

A graduated Project remains Active through all implementation and acceptance work, including:

1. **Promotion Testing**
2. **Promotion Approved / production-on-main**
3. **Operations monitoring, CI/CD automation, and reporting setup**
4. **Production Testing**
5. **Production Accepted by Operations**
6. required PMO administrative closeout

After Production Accepted and PMO closeout, the Project transitions to Completed.

Administrative cleanup does not normally send an Active Project back to Pipeline.

## Parent/child accounting

PMO portfolio parents are Programs/Projects and are not `pmo:task`.

Valid counted child work requires:

- `pmo`;
- `pmo:task`;
- valid parent reference;
- exactly one lifecycle state: open/current or closed/completed according to the repository contract.

Child priority is local to the Project/parent scope. It must not be interpreted as team-global or repository-global priority.

Parent rollup:

- Tasks = valid linked `pmo:task` children;
- Completed = valid linked completed children;
- percent complete = Completed / Tasks when Tasks > 0.

Malformed records are data-quality exceptions, not a fourth lifecycle.

## Delivery-model selection

Use **Model C** only when every intended write is documentation-only and inside approved Model C documentation namespaces defined in `docs/governance/DELIVERY-AND-RELEASE.md`.

Use Model A or Model B when executable/runtime/configuration/CI/test/migration/deployment paths are required. Model C never authorizes writes into prohibited executable namespaces.

## Sandbox authority

Sandbox is an optional PMO proof-of-concept profile used only to reduce material uncertainty. It is isolated, has no Production credentials/writes/bindings, and cannot promote directly to Promotion Candidate or Production.

Sandbox evidence is incorporated into the durable design before the Project advances.

## Protected boundaries

Nothing in this PMO model weakens Product Authority, legal, rights, privacy, security, credential, cost, destructive-data, Production, independent-review, rollback, or separation-of-duty controls.

PMO sequencing does not bypass protected stops.

## Administration & Communications

Administration & Communications may reconcile repository state to existing authority, including labels, parent/child links, lifecycle reporting, assignment/claim state, evidence routing, handoff state, and closeout transactions.

It does not originate Product priority, Product outcome, architecture, acceptance criteria, implementation scope, Production Go, or protected decisions.

## Supersession

This policy supersedes prior PMO language that:

- defines only four Pipeline stages (`Initial Idea`, `Drafted Design`, `Pending Launch Packet`, `Graduation Candidate`);
- treats priority as one repository-global Pipeline or Active rank;
- treats repeated priority numbers in different Programs/Projects as invalid;
- relies on chat history rather than a durable PMO Current State record;
- treats `Incomplete` as a fourth PMO lifecycle section;
- allows administrative residue to move an otherwise Active Project back to Pipeline;
- treats Development completion as merely having a PR rather than complete as-built documentation and evidence.

Lower-level procedures and dashboard mappings must be reconciled to this policy before they are treated as current when they conflict.
