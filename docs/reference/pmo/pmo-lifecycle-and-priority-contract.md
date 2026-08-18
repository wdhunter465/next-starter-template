---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Canonical PMO lifecycle states, Engineering qualification mapping, ordered priority representation, dashboard and routing invariants
Does Not Own: Product priority decisions, weekly meeting procedure, live GitHub label creation, or bulk Issue mutation
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3597, #2699, #2724
Last Reviewed: 2026-08-18
---

# PMO Lifecycle and Priority Contract

## Purpose

Record the machine-readable PMO lifecycle and ordered-priority representation used by governance, the PMO dashboard, and queue routing.

Policy owners:

- queue and priority semantics: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- portfolio and graduation decisions: `docs/governance/PMO-PORTFOLIO.md`

## Engineering qualification

Qualification Issues use `team:engineering` and do not carry `pmo:pipeline`.

Minimum qualification fields:

| Field | Meaning |
| --- | --- |
| Problem / current-state deficiency | What is wrong or missing |
| Why remediation is required | Why the deficiency cannot remain |
| Intended outcome | What success looks like |
| Remediation objectives / design direction | What should be adopted |
| Known constraints, dependencies, risks, protected decisions | Fail-closed boundaries already known |
| Useful candidate direction | Optional commentary; not a complete design |

Qualification does not include final detailed design, full implementation plan, or complete launch packet.

Optional Engineering order labels remain `eng:priority:1` through `eng:priority:4` or `eng:priority:idea`. Those labels order qualification work only. They are not Pipeline or Active PMO positions.

## Lifecycle states

| Stage | Lifecycle label | Stage label | Team |
| --- | --- | --- | --- |
| Engineering qualification | none (`pmo:pipeline` absent) | none | `team:engineering` |
| Initial Idea | `pmo:pipeline` | `pmo:stage:initial-idea` | `team:pmo` |
| Drafted Design | `pmo:pipeline` | `pmo:stage:drafted-design` | `team:pmo` |
| Pending Launch Packet | `pmo:pipeline` | `pmo:stage:pending-launch-packet` | `team:pmo` |
| Graduation Candidate | `pmo:pipeline` | `pmo:stage:graduation-candidate` | `team:pmo` |
| Active | `pmo:active` | none | `team:pmo` |
| Closed | `pmo:closed` | none | historical team, not `team:operations` |

Exactly one of `pmo:pipeline`, `pmo:active`, or `pmo:closed` appears on a PMO-tracked portfolio parent.

## Stage entry, exit, authority, deliverables

| Stage | Entry | Exit | Authority | Deliverables |
| --- | --- | --- | --- | --- |
| Engineering qualification | Proposed project or program needs a coherent problem | Minimum qualification fields present | PMO / Engineering | Problem statement and remediation objectives / design direction |
| Initial Idea | Qualification complete; `team:engineering` removed | Design draft exists for feedback | PMO Pipeline | Accepted problem/objectives; assigned Pipeline priority |
| Drafted Design | Design documented | Stakeholder feedback reconciled and design approved | PMO Pipeline with named reviewers | Design record plus reconciled feedback |
| Pending Launch Packet | Design approved | Launch packet complete | PMO Pipeline | Linked children, implementation plan, sequence/dependencies, acceptance/validation, rollback/recovery, operational handoff, one intended implementation owner |
| Graduation Candidate | Design and launch packet complete | Explicit Project Graduation Go | PMO meeting | Graduation package ready for review |
| Active | Graduation Go; Active priority and one implementation owner recorded | Required implementation, acceptance, Production path where applicable, and closeout complete, or another explicit terminal disposition | Implementation / Operations under the launch packet; protected decisions unchanged | Active delivery through operational handoff |
| Closed | Terminal disposition recorded | Not applicable | PMO plus required independent closeout | Durable evidence and required operational handoff |

Pipeline work is not Active because design, Sandbox, or Development evidence exists.

## Ordered priority

| Queue | Label pattern | Meaning |
| --- | --- | --- |
| Active | `pmo:priority:<n>` where `<n>` is `[1-9][0-9]*` | Independent Active execution order |
| Pipeline | `pmo:pipeline-priority:<n>` where `<n>` is `[1-9][0-9]*` | Independent Pipeline preparation order |

Invariants:

- Priority is work order, not severity and not a 1–4 capacity band.
- `1` is the next/highest position in that lifecycle queue.
- Pipeline and Active sequences are independent; the same integer is not a shared rank across queues.
- Child tasks do not carry `pmo:priority:*`, `pmo:pipeline-priority:*`, `eng:priority:*`, or `team:*`.
- `pmo:priority:none` is invalid.
- Dashboard sort of Active and Pipeline views is numeric ascending on the lifecycle-specific priority display.

## Dashboard mapping

| View | Valid parent shape |
| --- | --- |
| Active | `pmo` + `pmo:active` + `team:pmo` + exactly one `pmo:priority:<n>` |
| Pipeline | `pmo` + `pmo:pipeline` + `team:pmo` + exactly one `pmo:pipeline-priority:<n>` + exactly one canonical stage label |
| Completed | `pmo` + `pmo:closed` |
| Incomplete | any PMO-tracked parent that fails the contract |

Engineering qualification Issues and standalone Operations/Governance Issues are not Pipeline or Active portfolio rows.

## Routing mapping

| Shape | Lane | Authorizes Active implementation |
| --- | --- | --- |
| `team:engineering` without `pmo:pipeline` | `engineering_qualification` | no |
| `pmo:pipeline` + `team:pmo` + pipeline priority | `pmo_pipeline` | no |
| `pmo:active` child with valid Active parent | `pmo_active` | yes, when sequence and implementation authorization already exist |
| numbered `ops:priority:*` | `operations` | no |

Project Graduation is the only Pipeline-to-Active transition. Graduation Candidate without Go remains preparation.

## Legacy labels

The following labels are non-canonical on Pipeline parents and fail closed until migrated:

```text
team:engineering on pmo:pipeline
eng:priority:* on pmo:pipeline
pmo:stage:intake
pmo:stage:discovery
pmo:stage:definition
pmo:stage:planning
pmo:stage:prep
pmo:stage:ready-for-launch
```

Migration mapping: `docs/ops/pmo/issue-3597-pmo-lifecycle-migration-plan.md`.
