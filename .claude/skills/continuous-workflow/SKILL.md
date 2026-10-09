---
name: continuous-workflow
description: The LGFC continuous-work model for Claude Code in this repository. Use at the start of a session, whenever the current task is waiting on review, CI or another agent, and at every safe task boundary, to pick the next eligible item without stopping.
---

# Continuous-work model (LGFC)

This skill is a working summary. The authoritative definitions are:

- `docs/governance/AGENT-TEAM.md` (Continuous-work invariant, role work-selection order, protected stops, separation of duties)
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` (Continuous-work invariant, Operations interrupt, claim lifecycle, dependency and stop taxonomy)

If this file and those documents differ, the documents win. Read them when in doubt. Role-to-member mapping lives only in `AGENT-TEAM.md`; look it up there, do not copy it here. Process text names roles (Engineering, Operations, PMO Admin, Governance, Product Authority), not agents.

## The invariant

An agent is not idle merely because its current task is waiting on review, checks, another agent, or non-blocking administrative work.

At every safe task boundary:

1. Re-evaluate the work order for the role you are acting in.
2. Filter for work that is package-complete, dependency-safe and authority-eligible.
3. Select the next executable item.
4. Keep the waiting items for later gate, review and post-merge follow-through.

"Safe task boundary" means: a PR is opened and handed to review, a check or review is pending, a merge landed and post-merge closeout is being verified, or the item hit a protected stop.

## Work order by role

After the Operations interrupt below, each role has its own order. There is no single universal queue.

| Role | Order |
| --- | --- |
| Engineering | Operations interrupt when it applies, then Engineering Issues, Active Projects, Governance Issues, Pipeline Projects |
| Operations | Operations Issues, Active Projects, Pipeline Projects |
| PMO Admin | Executes PMO process: lifecycle and label reconciliation, current-state records, dashboard hygiene, Graduation recording, queue administration. Never merges, never invents Product Go |

Priority is execution order among siblings under the same immediate parent. A priority integer has no repository-global meaning. Use the full hierarchy path (see `docs/governance/PMO-PORTFOLIO.md`).

## Operations interrupt

A qualifying, actionable, numbered Operations Issue takes the next capacity for remediation. In-flight work stops only at the nearest safe checkpoint. Monitoring and Hold states are not actionable and do not interrupt. When the interrupt clears, return to the role order.

## Claims and ownership

- `team:*` is durable queue ownership. `agent:*` is the current execution claim.
- Before starting, record the claim. Do not start an Issue another agent holds a valid claim on.
- At handoff or review wait, release the claim unless remediation or post-merge duties still need it.
- Stale claims are reconciled so work can continue.
- Collaboration adds participants. It does not create dual ownership or extra authority. Use the repository record (the source Issue or PR), not Product Authority, as the relay between agents.

## Dependencies and stops

| Class | Effect |
| --- | --- |
| Advisory prerequisite | Order guidance only; collision-safe work continues |
| Ordered predecessor | Successor waits for substantive predecessor completion |
| Real collision | Blocks only the colliding action or scope |
| Protected stop | Blocks the protected action until the required authority or evidence exists |

Ordinary dependencies are not queue-wide HOLD or BLOCKED states. Split a bounded increment when only one action is gated. Generic "blocked" or "waiting on PMO" language is invalid unless it is an evidence-backed `HOLD` under `docs/governance/PMO-PORTFOLIO.md`.

## Protected stops (continuing never crosses these)

- Product and business outcome and priority
- Rights, legal and privacy
- Security, authentication, authorization
- Secrets and credentials
- Cost commitments
- Destructive or irreversible data or service actions
- Production promotion and any Production write without an explicit Go
- Branch, ruleset and governance-enforcement changes where policy requires protected review

Role precedence changes sequencing, not authority. A protected stop blocks that action, not the whole queue: move to the next eligible item and report the stop with its evidence.

## Separation of duties

No implementer is the sole independent reviewer or approver of its own protected work. PMO Admin does not merge. CMO may not approve its own implementation. Merge approval defaults to Product Authority. Model C (constitutional or domain-policy) changes need independent review before merge.

## Delivery cycle (one Issue, one PR)

1. Source Issue exists before the branch or PR (issue-first gate).
2. Claim, implement within the Issue's allowlist, open a PR from the repository template, ready for review.
3. Required checks and independent review. Do not self-merge.
4. After merge, post-merge verification and closeout run. The PR body's POST-MERGE ISSUE DISPOSITION says whether the source Issue closes or stays open.
5. If closeout produces an exception Issue, remediate it in the same lineage at once; repeat until the original source Issue reaches clean terminal closeout. Exceptions pause only the originating agent's successor.

Waiting at step 3 or 4 is the moment to apply the invariant: pick the next eligible item instead of idling.

## Closeout boundaries

Implementation task closeout happens only after integration, validation, independent review and post-integration evidence exist. Project and Program closeout is a PMO, Governance or Product decision. Deterministic CI may execute defined transitions but cannot invent acceptance.
