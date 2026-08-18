---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Stable queue-classification, priority-namespace, Project Graduation, and universal collaboration metadata contract
Does Not Own: Product priority decisions, project scope, implementation method, recovery strategy, PR approval, Production authorization, or runtime automation
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #2699, #3597
Last Reviewed: 2026-08-18
---

# Work Queue and Collaboration Contract

## Purpose

Define the stable repository-wide representation for Operations, PMO, Engineering, Project Graduation, and agent-to-agent collaboration.

The canonical policy is `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`. Machine mapping is `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`.

## Queue hierarchy

```text
Operations interrupt queue
        |
        +-- Governance stewardship queue
        +-- PMO Active implementation queue
        +-- PMO Pipeline preparation queue
        +-- Engineering qualification queue
```

Operations has precedence while a numbered Operations Issue is actionable. PMO Active, PMO Pipeline, and Engineering qualification are peer normal-work queues.

## Exclusive team assignment

A source Issue may carry at most one team label:

```text
team:operations
team:pmo
team:engineering
```

A source Issue may carry only the matching priority or state namespace.

Invalid combinations include:

```text
team:engineering + pmo:priority:1
team:engineering + pmo:pipeline
team:pmo + eng:priority:1
team:operations + team:pmo
ops:priority:2 + eng:priority:2
pmo:priority:1 + pmo:pipeline-priority:1
```

Collaboration does not change the team label.

## Queue-specific labels

### Operations

```text
team:operations
ops:priority:1 | ops:priority:2 | ops:priority:3 | ops:priority:4
ops:monitoring | ops:hold
```

Exactly one Operations priority or non-blocking state is allowed.

Numbered Operations priorities interrupt PMO and Engineering. `ops:monitoring` and `ops:hold` do not interrupt normal work and require a recorded owner, update interval or next-review time, expected evidence, and release condition.

### PMO Active

```text
team:pmo
pmo:active
pmo:priority:<n>
```

`<n>` is a positive integer with no 1–4 cap. Active priority belongs only to the Active parent program or project.

### PMO Pipeline

```text
team:pmo
pmo:pipeline
pmo:pipeline-priority:<n>
pmo:stage:initial-idea | pmo:stage:drafted-design | pmo:stage:pending-launch-packet | pmo:stage:graduation-candidate
```

Pipeline priority belongs only to Pipeline portfolio parents. It orders preparation, not implementation, and does not report maturity.

### Engineering qualification

```text
team:engineering
eng:priority:1 | eng:priority:2 | eng:priority:3 | eng:priority:4 | eng:priority:idea
```

Engineering labels belong to pre-Pipeline qualification Issues only. They do not appear on `pmo:pipeline` parents.

## Child-task invariant

Project child tasks:

- identify their parent and execution sequence;
- do not carry team-priority labels;
- do not compete independently in Operations, PMO, or Engineering queues;
- contribute to parent task accounting only when classified as project tasks.

## Pipeline preparation assignment

A Pipeline parent at Pending Launch Packet or Graduation Candidate may have one open peer launch-packet assignment.

The assignment uses:

```text
Related Pipeline Project: #<number>
```

or:

```text
Graduation Target: #<number>
```

It must not use `Parent Project:` or `pmo:task`.

## Project Graduation transition

Project Graduation is the explicit PMO Go decision that transfers a parent from Pipeline to Active.

Transition:

```text
remove pmo:pipeline
remove pmo:pipeline-priority:*
remove Pipeline stage representation
keep team:pmo
add pmo:priority:<n>
add Active lifecycle representation
```

Pipeline priority never transfers automatically to Active priority.

## Universal collaboration events

Use one source Issue and four events:

```text
COLLABORATION REQUEST
COLLABORATION ACKNOWLEDGED
COLLABORATION RESPONSE
COLLABORATION COMPLETE
```

### Required request fields

- source Issue;
- source team and current owner;
- requesting agent and role;
- target agent and role;
- exact bounded contribution;
- evidence and references;
- blocking scope;
- retained decision authority;
- acknowledgment requirement;
- completion condition.

### Acknowledgment fields

- accepted scope;
- evidence received;
- missing evidence;
- expected response boundary.

### Response fields

- evidence reviewed;
- bounded analysis, validation, guidance, or recommendation;
- applicable disposition such as `GUIDANCE`, `ADJUSTMENT`, `PROBLEM FOUND`, `PLAN CHANGE REQUIRED`, `HOLD`, or `RESUME`;
- remaining condition;
- next action returned to the Issue owner.

### Completion fields

- collaboration result;
- evidence identity;
- unresolved conditions;
- execution ownership returned to the Issue owner.

## Pull-request boundary

The source Issue owns assignment, queue, authority, collaboration, and next action.

The pull request owns the diff, checks, review threads, and technical evidence.

Normal collaboration may inspect a PR but does not require the collaborator to modify the PR or branch. Formal GitHub review is separate, requires reviewer authority, and uses GitHub-native review surfaces.

A PR-dependent collaboration response must identify the PR and relevant head SHA. Materially changed evidence may require a new request or formal re-review.

## Runtime transition

Label creation, dashboard and validator support, queue-routing automation, and bulk Issue reconciliation require separate implementation authority. This reference defines the target contract and does not authorize those mutations.
