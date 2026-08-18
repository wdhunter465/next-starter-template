---
Doc Type: Governance
Audience: Human + AI
Authority Level: Constitutional
Owns: Repository precedence, GitHub Issue authority, domain ownership, lane topology, work-queue topology, canonical-source rules, supersession, and unresolved-conflict escalation
Does Not Own: Detailed PMO, queue, delivery, agent, CI, Administration, Operations, collaboration, or platform procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2477, #2486, #2640, #2641, #2678, #2686, #2690, #2699, #2720, #2941, #3597
Last Reviewed: 2026-08-18
---

# Repository Authority

## Purpose

This document is the repository constitution for LGFC. It defines precedence, domain ownership, and the top-level operating topology so process changes update one owning domain instead of rewriting unrelated authority.

## Temporary constitutional adjustment register

Project [#2678](https://github.com/wdhunter465/next-starter-template/issues/2678) contains the temporary constitutional adjustment register while its approved governance refinements are being implemented.

All governance-sensitive agents must read this constitution and the section of the #2678 Issue body delimited exactly by:

```text
<!-- lgfc-constitutional-adjustment-register:v1 -->
<!-- /lgfc-constitutional-adjustment-register:v1 -->
```

Only schema-complete entries inside those markers with Status `APPROVED` and an approval-evidence URL recording an explicit Product Authority decision have temporary constitutional authority. For one Adjustment ID, the highest valid approved revision controls. A valid `SUPERSEDED` or `WITHDRAWN` revision removes the earlier revision from current authority.

The rest of #2678—including project narrative, acceptance criteria, labels, ordinary comments, handoffs, automation output, and unmarked text—does not receive constitutional authority from this delegation.

A valid approved register entry supplements or supersedes this constitution only for its stated subject. Malformed, duplicate-current, conflicting, or non-monotonic entries fail closed and require escalation to Product Authority before governance-sensitive work proceeds on the affected subject.

When Project #2678 is fully implemented and its approved changes are merged into the canonical governance documents, that same documentation change must remove this section and every other constitutional reference to #2678. The marked register then becomes historical evidence only.

## Precedence

When sources conflict, resolve in this order:

1. Locked product decisions and explicit Product Authority decisions above the source Issue.
2. Valid approved entries in the marked #2678 temporary constitutional adjustment register, limited to their stated subjects.
3. This constitution.
4. Domain policy documents named in the domain-ownership table.
5. Shared contracts and profiles under `docs/reference/**`.
6. Source GitHub Issue for the active task.
7. Procedures under `docs/how-to/**`.
8. Implementation and as-built state.
9. Issue comments, PR bodies, chat, external notifications, and agent memory.

GitHub Issues and Pull Requests are the authoritative execution record for normal repository work.

## GitHub Issue authority

- One open, same-repository, non-PR source Issue is task authority for implementation.
- The Issue body, allowlist, acceptance criteria, and recorded role authority define scope.
- Labels, comments, alerts, and runner events are routing and evidence surfaces; they do not replace task or approval authority.
- Tracker files are historical indexes unless a source Issue explicitly authorizes edits.

## Canonical-source rule

Each topic has one active canonical owner. Other documents may link to that owner but must not restate competing rules.

A normal PR that touches a legacy document must complete its disposition before the PR completes.

## Authority layers

| Layer | Purpose | Typical location |
| --- | --- | --- |
| 0 — Constitution | Precedence, domain ownership, lane and queue topology, escalation | `docs/governance/REPOSITORY-AUTHORITY.md` |
| 1 — Domain policy | One policy boundary per domain | `docs/governance/**` |
| 2 — Shared contracts | Stable metadata, profiles, and classification | `docs/reference/**` |
| 3 — Procedures | Single execution paths | `docs/how-to/**` |
| 4 — Implementation | Workflows, scripts, templates, live configuration | `.github/**`, `scripts/**`, as-built documents |

## Operating lane topology

Three operating lanes run horizontally:

1. **PMO / Engineering**
2. **Implementation / Operations**
3. **Day-2 Operations**

One control lane runs vertically across all three:

4. **Administration & Communications**

```text
                    Administration & Communications
                    evidence | routing | runner | state
                         |             |             |
                         v             v             v
PMO / Engineering -> Implementation / Operations -> Day-2 Operations
```

The horizontal lanes make decisions within their authority. Administration & Communications records, routes, acknowledges, escalates, and executes authorized state transitions.

The repository runner and routing controller are communications/control-plane infrastructure in the vertical lane. Their host/service health remains a Day-2 Operations responsibility.

## Work-queue topology

Lanes define durable authority and responsibility. Work queues define which authorized work receives attention first.

```text
Operations interrupt queue
        |
        +-- Governance stewardship queue
        +-- PMO Active implementation queue
        +-- PMO Pipeline preparation queue
        +-- Engineering qualification queue
```

Constitutional queue invariants:

1. Numbered Operations work has interrupt precedence over PMO and Engineering work.
2. PMO Active implementation and PMO Pipeline preparation are peer PMO queues with independent ordered priorities. Engineering qualification is the pre-Pipeline gate and is not Active implementation.
3. A source Issue belongs to at most one team queue at a time.
4. Team-priority namespaces are mutually exclusive. Active `pmo:priority:<n>` and Pipeline `pmo:pipeline-priority:<n>` are separate domains.
5. Operations Monitoring and Hold are non-blocking states subject to recorded interval review.
6. Project child tasks do not receive team-level priority; the parent priority selects the project and the project sequence selects the task.
7. Pipeline-to-Active movement requires explicit Project Graduation, a newly assigned Active ordered priority, and one start-to-finish implementation owner.
8. Collaboration may add participants but never creates dual queue ownership.

Detailed queue, priority, graduation, and collaboration rules live in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`. Machine mapping lives in `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`.

## Promotion-profile authority

The canonical promotion sequence is:

```text
Sandbox -> Development -> Promotion Candidate -> Production -> Day-2 Operations
```

- Sandbox is optional PMO / Engineering proof-of-concept work.
- Development and Promotion Candidate are technical profiles inside the conversational Implementation / Operations lane.
- Promotion Candidate is the mandatory barrier before Production.
- Sandbox cannot move directly to Promotion Candidate or Production.
- Development cannot move directly to Production.

Canonical definitions live in `docs/reference/operations/operating-lanes-and-promotion-profiles.md`. Delivery policy lives in `docs/governance/DELIVERY-AND-RELEASE.md`.

## Domain ownership

Each domain has exactly one canonical policy file.

| Domain | Canonical policy owner | Owns |
| --- | --- | --- |
| Product and Design | `docs/governance/PRODUCT-AND-DESIGN.md` | Product behavior, UX, functional requirements |
| PMO and Portfolio | `docs/governance/PMO-PORTFOLIO.md` | Intake, sizing, priority decisions, launch authorization, PMO / Engineering boundaries |
| Work Queues and Collaboration | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` | Queue classification and precedence, team/priority namespaces, ordered Active and Pipeline priority, Project Graduation, universal collaboration |
| Delivery and Release | `docs/governance/DELIVERY-AND-RELEASE.md` | Delivery models, four promotion profiles, integration, approval, rollback, promotion |
| Agent Team | `docs/governance/AGENT-TEAM.md` | Durable roles, current member mapping, approval and protected-stop policy |
| CI and Verification | `docs/governance/CI-AND-VERIFICATION.md` | Check classification, deterministic evidence, promotion criteria, failure routing, post-merge verification |
| Administration and Communications | `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md` | Cross-lane communication, routing, runner/control-plane placement, evidence, hold/resume, reporting, closeout |
| Operations and Recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` | Production health, incidents, containment, recovery strategy, operational hold release |
| Documentation and Knowledge | `docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md` | DIATAXIS routing, migration ratchet, archive rules |
| Platform and Environment | `docs/governance/PLATFORM-AND-ENVIRONMENT.md` | Cloudflare, D1, B2, environment boundaries, bindings, credentials, migrations, rollback |

All policy paths named in this table are active canonical owners. Introducing a new domain or replacing an owner requires an approved constitutional update and complete disposition of the prior owner.

## Supporting references

Supporting references inform a domain but do not share policy ownership.

| Topic | Supporting reference |
| --- | --- |
| Lane and profile contract | `docs/reference/operations/operating-lanes-and-promotion-profiles.md` |
| Work queue and collaboration contract | `docs/reference/operations/work-queue-and-collaboration-contract.md` |
| PMO lifecycle and priority contract | `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md` |
| Administration mutation contract | `docs/reference/operations/administrative-control-lane-contract.md` |
| Runner contract | `docs/reference/ci/repository-runner-contract.md` |
| Product design standards | `docs/reference/design/LGFC-Production-Design-and-Standards.md` |
| Documentation architecture | `docs/governance/DOCUMENT-ARCHITECTURE.md` |

## Role-based authority

Broad policy assigns authority to durable roles, not person or product names. Current mappings belong in `docs/governance/AGENT-TEAM.md` or a project manifest.

Required durable roles include:

- Product Authority;
- PMO / Engineering;
- Implementation / Operations;
- PR Approver / Engineering;
- Administration & Communications;
- Day-2 Operations;
- Deterministic CI.

## Lightweight problem adjustment

Any role may report `PROBLEM FOUND`.

The issue routes to the role that made the controlling decision. That role records `GUIDANCE` or `ADJUSTMENT`; Administration & Communications records the state and routes `RESUME`.

Only material changes to product outcome, architecture, acceptance criteria, dependency structure, delivery model, production boundary, or recovery strategy require formal plan revision.

## Agent material routing

| Material | Canonical location |
| --- | --- |
| Binding agent policy | `docs/governance/**` |
| Agent facts and contracts | `docs/reference/**` |
| Agent execution procedures | `docs/how-to/**` |
| Live queues, handoffs, runtime routing state | `docs/ops/**` |

Files under `docs/ops/ai/` that currently hold binding policy remain authoritative until migrated through an explicit source Issue. Do not create new binding policy there.

## Supersession

A document supersedes another only when disposition is complete: correct folder, authority header, ownership boundary, non-conflict with higher authority, and merge to the active branch or approved Model B component branch.

## Escalation

Escalate to the recorded controlling role when:

- canonical documents make an irreconcilable authority decision;
- a material product, design, production, or recovery decision is unresolved;
- preview/production isolation cannot be established safely;
- an action would bypass a mandatory promotion profile or protected boundary.

Routine document migration, header correction, reference updates, deterministic Administration reconciliation, and duplicate cleanup are not escalation events.

## Related documents

- Product and Design policy: `docs/governance/PRODUCT-AND-DESIGN.md`
- Platform and Environment policy: `docs/governance/PLATFORM-AND-ENVIRONMENT.md`
- CI and Verification policy: `docs/governance/CI-AND-VERIFICATION.md`
- Work Queues and Collaboration policy: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- Administration and Communications policy: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Lane and profile contract: `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
- Delivery and Release policy: `docs/governance/DELIVERY-AND-RELEASE.md`
- Operations and Recovery policy: `docs/governance/OPERATIONS-AND-RECOVERY.md`
- DIATAXIS folder authority: `docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md`
