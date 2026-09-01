---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Repository work-queue classification, queue ownership, team/agent claim semantics, queue-state transitions, Operations interrupt behavior, role-work-selection integration, Project Graduation routing, and universal collaboration
Does Not Own: Product outcome, final Product priority decisions, PMO lifecycle/stage deliverables, implementation methods, recovery strategy, PR approval decisions, or Production authorization
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #3240, #3629, #3825
Last Reviewed: 2026-09-01
---

# Work Queues and Collaboration

## Purpose

This document defines durable queue classification, Team ownership, claim lifecycle, Operations interrupt behavior, and collaboration. It consumes role-specific work-selection order from `docs/governance/AGENT-TEAM.md` and PMO hierarchy/priority from `docs/governance/PMO-PORTFOLIO.md`.

## Durable work queues

The repository recognizes:

- **Operations** — accepted Production/repository capability failed, degraded, became unsafe, or stopped meeting its accepted standard.
- **PMO Active** — graduated Programs/Projects being implemented, validated, promoted, deployed, accepted, and closed.
- **PMO Pipeline** — Programs/Projects being designed, proven, documented, packaged, and prepared for Graduation.
- **Engineering** — qualification, technical design/review, and Engineering-owned issue work.
- **Governance** — governance, standards, authority integrity, documentation-policy stewardship, role/queue reconciliation, and governance audits.

A source Issue belongs to at most one durable Team queue at a time.

## Operations interrupt

A qualifying actionable numbered Operations Issue has repository-wide interrupt precedence.

Rules:

1. It receives the next capacity required for remediation.
2. In-flight work stops only at the nearest safe checkpoint.
3. Protected authority, source scope, required validation, independent review, rollback, and Production controls remain intact.
4. Monitoring/Hold states are non-actionable and do not remain falsely interrupting.
5. When the interrupt clears, each agent returns to its own role-specific work order.

## Role-specific normal work selection

After the Operations interrupt rule, there is no one-size-fits-all queue order.

Canonical role order from `AGENT-TEAM.md`:

### Operations role

1. Operations Issues
2. Active Projects
3. Pipeline Projects

### Engineering role

1. Operations interrupt when applicable
2. Engineering Issues
3. Active Projects
4. Governance Issues
5. Pipeline Projects

### PMO role

PMO continuously manages Active and Pipeline portfolio work, lifecycle readiness, hierarchical/scoped priority, Engineering/Governance execution prioritization, Graduation, and closeout under recorded authority.

### Governance role

Governance owns governance disposition, Governance Issues, assignment/prioritization policy subject to Product Authority, and resolution of lower-level role/queue conflicts.

These role orders supersede former per-product queue lists and the former universal Active -> Pipeline -> Engineering -> Governance normal-work order.

## Exclusive Team ownership

Typical durable Team labels:

```text
team:operations
team:pmo
team:engineering
team:governance
```

An Issue must not carry multiple Team ownership labels simultaneously unless a separately approved migration procedure temporarily requires evidence-only coexistence; such a state is not executable until reconciled.

Collaboration adds participants but does not create dual Team ownership.

## Team ownership versus agent claim

`team:*` and `agent:*` are orthogonal:

- `team:*` = durable queue ownership;
- `agent:*` = active execution claim or explicit Product Authority reservation.

Claim lifecycle:

1. ordinary new Team Issues are not permanently preassigned by default;
2. an eligible agent selects work according to role order, hierarchy, dependencies, collision state, and authority;
3. before starting, the agent records its claim;
4. other agents do not independently start the same Issue while the claim is valid;
5. at handoff/review wait, release the claim unless remediation/post-merge duties require it;
6. stale claims are reconciled so work can continue;
7. Team ownership persists until completion or formal transfer.

A Product Authority reserved assignment may keep an `agent:*` reservation until the reserved agent starts or authority releases it.

## Priority semantics

PMO priority semantics are not defined by this file. Controlling PMO rule:

**Priority is execution order among siblings under the same immediate parent/container. Numbering restarts and may be reused under different Programs, Projects, child work units, and applicable PMO stages.**

See:

- `docs/governance/PMO-PORTFOLIO.md`
- `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`

Operations, Engineering, and Governance may use their own approved queue-order metadata, but no priority namespace may be interpreted as a repository-global rank unless its owning contract explicitly says so.

## PMO lifecycle ownership

Pipeline detailed lifecycle and six dashboard maturity bands are owned by PMO policy, not duplicated here.

Pipeline work is not Active merely because Sandbox or Development evidence exists. Only explicit Project Graduation moves a Project to Active.

## Project Graduation routing

Graduation requires the package defined in `PMO-PORTFOLIO.md`, including complete Launch Packet, truthful Graduation Candidate stage, PMO review, explicit Go, Active hierarchy placement, implementation owner, first executable action, and protected authority evidence.

At Graduation:

- Pipeline representation is removed/reconciled;
- Active representation is established;
- durable child graph and dependencies are preserved;
- scoped priority is interpreted in the new Active hierarchy context.

## Child-task execution

Project/Program hierarchy selects child execution. Children may have priorities local to their immediate parent.

A child priority must never be treated as repository-global or automatically inherited from the parent Program/Project priority.

Eligible agents self-claim package-complete child work under standing parent authority when predecessor/dependency/protected-stop conditions permit.

Routine PMO redispatch is not required between already-authorized children.

## Dependency and stop taxonomy

| Class | Effect |
| --- | --- |
| Advisory prerequisite | Context/order guidance only; collision-safe work may continue |
| Ordered predecessor | Successor waits for deterministic predecessor completion where that edge is substantive |
| Real collision | Blocks only the colliding action/scope |
| Protected stop | Blocks the unsafe/protected action until required authority/evidence exists |

Ordinary dependencies are not queue-wide HOLD/BLOCKED states. Split bounded increments when only one action is gated.

## Continuous-work invariant

An agent is not idle merely because its current task is waiting on review, checks, another agent, or non-blocking Administration work.

At every safe task boundary the agent:

1. re-evaluates the role-specific work order;
2. filters for package-complete, dependency-safe, authority-eligible work;
3. selects the next executable item;
4. preserves waiting items for later gate/review/post-merge follow-through.

This applies to Codex, Cursor, Claude Code, Grok, and other role holders according to their mapped eligibility.

## Universal collaboration

Any source-Issue owner may request bounded collaboration on the same authoritative Issue.

Collaboration:

- does not create a second source Issue merely for communication;
- does not transfer Team ownership by itself;
- does not change priority scope;
- does not grant implementation/approval/Production authority the collaborator does not already hold;
- must be recorded through repository communication when available.

Canonical event pattern:

```text
COLLABORATION REQUEST
COLLABORATION ACKNOWLEDGED
COLLABORATION RESPONSE
COLLABORATION COMPLETE
```

Product Authority should not be used as the routine relay when direct repository communication is available.

## Governance and PMO interaction

PMO may prioritize Engineering/Governance work for execution as part of portfolio management. Governance retains final repository-governance disposition and assignment authority subject to Product Authority.

When those two functions disagree on a governance matter, Governance disposition controls unless Product Authority records another decision.

## Separation of duties

Queue or role selection never authorizes self-approval. Builders cannot supply the sole independent review for their own protected work. Model C constitutional/domain-policy changes require independent review before merge.

## Supersession

This policy supersedes earlier language that:

- assigns one universal normal-work order to every agent;
- hard-codes Cursor, Claude Code, or Work product-specific queue order inside the queue policy;
- treats child priorities as prohibited merely because they are not team-global priorities;
- treats PMO priority integers as repository-global ranks;
- lets an agent halt after packaging one task while other eligible work exists.

Product-specific files must point to `AGENT-TEAM.md` rather than restating a competing role/queue model.
