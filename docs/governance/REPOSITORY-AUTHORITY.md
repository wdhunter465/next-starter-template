---
Doc Type: Governance
Audience: Human + AI
Authority Level: Constitutional
Owns: Repository precedence, the top-down document hierarchy, merge-authority tiers, pull-request readiness, GitHub Issue authority, domain ownership, lane topology, queue topology, role-based work-selection delegation, canonical-source rules, supersession, and unresolved-conflict escalation
Does Not Own: Detailed PMO, delivery, agent, CI, Administration, Operations, collaboration, or platform procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2678, #3629, #3825, #4174
Last Reviewed: 2026-10-15
---

# Repository Authority

## Purpose

This document is the LGFC repository constitution. It defines precedence, canonical domain ownership, operating lanes, top-level queue topology, and escalation. Detailed role mapping and role-specific work-selection order live in `docs/governance/AGENT-TEAM.md`.

## Precedence

When sources conflict, resolve in this order:

1. Locked Product decisions and explicit Product Authority decisions above the source Issue.
2. Valid approved temporary constitutional adjustments in #2678, limited to their stated subject while that mechanism remains active.
3. This constitution.
4. Canonical domain policy documents named below.
5. Shared contracts under `docs/reference/**`.
6. Open same-repository source Issue for the active task.
7. Procedures under `docs/how-to/**`.
8. Implementation/as-built state.
9. Issue comments, PR bodies, chat, external notifications, and agent memory.

Live GitHub Issues, PRs, checks, reviews, threads, branches, deployments, and repository files are the operational execution record.

## GitHub Issue authority

- One open, same-repository, non-PR source Issue is required for repository-changing implementation.
- The source Issue must predate branch creation and first commit.
- The Issue objective, scope/allowlist, acceptance criteria, role authority, protected stops, validation, rollback, and delivery model bound the work.
- Labels/comments route and evidence work; they do not replace source authority.

## Canonical-source rule

Each topic has one canonical owner. Lower-level documents may reference that owner but must not create competing policy.

A superseding documentation change is complete only when the new/updated canonical source is merged and contradictory active copies are reconciled or explicitly subordinated.

## Top-down hierarchy

The repository is organized top-down. Each level takes its authority from the level above and may add detail but never contradict it. A lower level that conflicts with a higher level is wrong and is corrected to match it; the higher level is not bent to fit.

| Level | What it holds | Where | Authority Level header |
| --- | --- | --- | --- |
| 0 | Product decisions | Product Authority decisions, locked Product documents | Product |
| 1 | Constitution | This document | Constitutional |
| 2 | Domain policy | `docs/governance/*.md` (one owner per domain, table below) | Domain Policy |
| 3 | Reference contracts | `docs/reference/**` | Reference |
| 4 | Procedures | `docs/how-to/**`, `docs/tutorials/**` | Procedure |
| 5 | Pointers, templates, skills, rules files | `docs/ops/ai/**`, `docs/templates/**`, `.claude/**`, `.cursor/**`, `.agents/**`, `CLAUDE.md`, `.github/pull_request_template.md` | Pointer / Template |
| 6 | Automation | `.github/workflows/**`, `scripts/**` | Implementation |

Rules:

1. Policy is written at the highest level that owns it and nowhere lower. Lower levels link to it.
2. A change flows down: when a rule changes, the level that owns it changes first, then each level beneath it is brought into line, in order.
3. Automation enforces what policy says. A gate with no policy behind it, or a policy with no gate and no stated reason, is a defect to correct.
4. A requirement is either enforced by a named deterministic gate or is stated to be a convention that a reviewer checks. Documents must say which.

## Merge authority

Who may approve a merge depends on where the change lands, not on who wrote it. This section is the only place the tiers are defined. Every lower level points here.

| Tier | Change lands in | Approval | CMO |
| --- | --- | --- | --- |
| Production | `main` as a Production change, Production deploy, promotion to Production, or any protected decision named in Protected boundaries | Human only: Product Authority, or the CMO holder recorded in `docs/governance/AGENT-TEAM.md` | Required, human |
| Non-production | Sandbox, Development component branches, Promotion Candidate preparation, documentation, tooling and other work that does not change Production behavior | Self-approved: the implementing agent's own approval is sufficient once the deterministic gates pass; no CMO review | Not required |

Product Authority set the non-production tier on purpose, to speed up development. It is not a gap.

Limits on self-approval, which do not move:

- It never covers a protected decision (see Protected boundaries), whatever the tier.
- It needs every required deterministic check to pass on the current head, and every review thread to be resolved.
- It still needs the source Issue, the allowlist and the stable PR facts.
- Production approval is human only. No agent may supply it.

## Pull-request readiness

A pull request is opened ready for review, not as a draft. Every pull request must be in the ready-for-review state before anyone approves or merges it. Draft is not a working state in this repository; do not open or keep a draft PR. Work that is not ready is not yet a PR: keep it on the branch.

Ready for review means: a source Issue that predates the branch, a diff inside the allowlist, stable facts in the PR body, builder validation recorded, and the required checks running on the current head.

## Operating lane topology

Horizontal lanes:

1. PMO / Engineering
2. Implementation / Operations
3. Day-2 Operations

Vertical lane:

4. Administration & Communications

Lanes define authority boundaries. Roles and work queues define who acts and what receives attention.

## Work-queue topology

The repository recognizes these durable work categories:

- Operations Issues
- PMO Active Projects
- PMO Pipeline Projects
- Engineering Issues/qualification
- Governance Issues

A qualifying actionable numbered Operations Issue remains a repository-wide interrupt and takes precedence over ordinary work. It changes sequencing only; it does not bypass protected decisions, source scope, required validation, separation of duties, or Production authority.

After Operations interrupt handling, **there is no single universal normal-work queue order for every agent**. Role-specific eligible-work order is defined canonically in `docs/governance/AGENT-TEAM.md`:

- Operations role: Operations -> Active -> Pipeline.
- Engineering role: Operations interrupt -> Engineering -> Active -> Governance -> Pipeline.
- PMO role: portfolio management of Active/Pipeline plus authorized prioritization of Engineering/Governance execution.
- Governance role: governance disposition/assignment/prioritization subject to Product Authority.

This supersedes the prior constitutional assumption that every agent used one shared normal-work order of Active -> Pipeline -> Engineering -> Governance.

## Queue ownership invariants

1. A source Issue belongs to at most one durable Team queue at a time.
2. Collaboration does not create dual queue ownership.
3. `team:*` represents durable queue ownership; `agent:*` represents a current execution claim or explicit reservation.
4. Priority is interpreted through the controlling domain contract; PMO priority is hierarchical/scoped and may be reused under different parents.
5. Operations Monitoring/Hold and analogous non-actionable states do not remain falsely interrupting.
6. Protected stops block only the affected unsafe action unless higher authority explicitly broadens the hold.

Detailed queue/claim mechanics: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

## PMO hierarchy and priority

PMO lifecycle, stage deliverables, dashboard maturity, durable handoff state, and hierarchical/scoped priority are owned by:

- `docs/governance/PMO-PORTFOLIO.md`
- `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`

Constitutional invariant:

**A priority number is not repository-global. It is meaningful only inside its immediate parent/container and full hierarchy path. Repeated Priority 1 values under different Programs/Projects are valid.**

## Domain ownership

| Domain | Canonical policy owner |
| --- | --- |
| Product and Design | `docs/governance/PRODUCT-AND-DESIGN.md` |
| PMO and Portfolio | `docs/governance/PMO-PORTFOLIO.md` |
| Work Queues and Collaboration | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` |
| Delivery and Release | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Agent Team | `docs/governance/AGENT-TEAM.md` |
| CI and Verification | `docs/governance/CI-AND-VERIFICATION.md` |
| Administration and Communications | `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md` |
| Operations and Recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Documentation and Knowledge | `docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md` |
| Platform and Environment | `docs/governance/PLATFORM-AND-ENVIRONMENT.md` |

Introducing a competing owner or changing a canonical domain owner requires an approved constitutional update.

## Role-based authority

Broad authority attaches to durable roles, not vendor names. Current mappings and role-specific work-selection order live in `docs/governance/AGENT-TEAM.md`.

Required role families include Product Authority, Operations, Engineering, PMO, PMO Admin, Governance, PR Approver / Engineering, CMO (Change Management Office), Administration & Communications, Day-2 Operations, and Deterministic CI.

Current holders for PMO Admin and CMO are recorded only in `docs/governance/AGENT-TEAM.md`. Process documents name those roles, not a vendor or a person.

No mapping may weaken required independent review or protected authority.

## Promotion-profile authority

Canonical executable promotion sequence:

```text
Sandbox -> Development -> Promotion Candidate -> Production -> Day-2 Operations
```

Model C documentation-only changes use the documentation gate profile and do not claim executable Promotion Candidate qualification.

Delivery policy: `docs/governance/DELIVERY-AND-RELEASE.md`.

## Protected boundaries

Nothing in queue or role precedence bypasses:

- Product Authority decisions;
- rights/legal/privacy;
- security/authentication/authorization;
- credentials/secrets;
- cost approval;
- destructive actions;
- required independent review;
- Production Go/approval;
- rollback/recovery controls.

## Lightweight correction

Any role may record `PROBLEM FOUND`. Route to the role that owns the controlling decision for `GUIDANCE` or `ADJUSTMENT`. Use `PLAN CHANGE REQUIRED` only for material change to Product outcome, architecture, acceptance criteria, dependencies, delivery model, Production boundary, or recovery strategy.

## Supersession

A document supersedes another only after correct placement, authority header, canonical ownership, non-conflict with higher authority, required review, and merge to the active branch.

This revision specifically supersedes constitutional wording that imposes one universal Active -> Pipeline -> Engineering -> Governance normal-work selection order on all agents. Role-specific work order now comes from `AGENT-TEAM.md`.

## Escalation

Escalate to Product Authority or the controlling role when:

- canonical documents make irreconcilable authority decisions;
- a protected Product/Production/legal/privacy/security/cost decision is unresolved;
- required independent review cannot be obtained;
- a mandatory promotion/profile boundary would be bypassed;
- a requested role transition lacks recorded Product Authority disposition.

Routine documentation reconciliation, metadata correction, and deterministic Administration cleanup are not escalation events.
