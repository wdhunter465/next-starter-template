---
name: continuous-workflow
description: The LGFC continuous workflow for Claude Code in this repository. Use at the start of a session, after packaging any assignment, whenever a PR is waiting on review or merge, and at every safe task boundary, to pick the next eligible item without stopping.
---

# Continuous workflow (LGFC)

This skill is a working summary. The authoritative definitions are:

- `docs/governance/AGENT-EXECUTION.md` — **Assigned-queue continuation (#3605 / #3611)**, Accepted-assignment continuity (#3693), Continuous parent-level execution (#3055 / #3145), Execution discipline, Mandatory stop conditions
- `docs/governance/AGENT-TEAM.md` — Continuous-work invariant, role work-selection order, protected stops, separation of duties
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` — Continuous-work invariant, Operations interrupt, claim lifecycle, dependency and stop taxonomy

If this file and those documents differ, the documents win. Role-to-member mapping lives only in `AGENT-TEAM.md`; look it up, do not copy it here. Process text names roles (Engineering, Operations, PMO Admin, Governance, Product Authority), not agents.

## What it means

Continuous workflow means an agent finishes packaging one assignment and immediately starts the next eligible one. Waiting for someone to review or merge the previous pull request is not a stop.

1. **Package one Issue.** Open its pull request, or record a real `HOLD` or `PACKAGE-INCOMPLETE` on that Issue.
2. **Leave the PR for review.** Do not merge it. Do not self-merge.
3. **Select the next eligible item and start it.** One Issue, one pull request. Do not mix queue items into the PR just opened.
4. **Return to the waiting PR only when** a check fails, a reviewer comments, or a post-merge failure opens.

A wake with no new GitHub events is not idle while eligible work remains. "Brief status and keep looping" is not permission to stop while the queue has an eligible item.

A protected stop applies to that one action. It does not freeze the rest of the queue. Continuous workflow never authorizes work the Issue itself forbids.

## What counts as waiting (#3611)

An item is *waiting* when its linked open authored PR has the latest checks green, or it is `handoff:ready`. `handoff:ready` is a waiting label, not permission to change the website and not Go. Keep waiting items for gate, reviewer and post-merge follow-through. Immediately continue the next eligible item that is not merely waiting. If none exists, keep following through on the waiting items. Do not idle and do not self-merge.

## Where the next item comes from

After packaging, re-evaluate and continue from, in order:

- numbered Operations interrupts;
- Issues assigned to this role holder;
- open authored PRs with failing or pending gates;
- this agent's own `post-merge-failure` Issues (remediate in the same lineage at once);
- active claims assigned to this agent, or that Product Authority named as this session's work.

Then the role order below.

## Accepted-assignment continuity (#3693)

Once an assignment is accepted it stays active until it reaches its authorized stop point, Product Authority explicitly says to stop, cancel or abandon it, or a governing stop condition requires a halt. Other Product Authority messages are interruptions, not cancellation: handle the interruption, then resume the accepted assignment without being told to continue. Do not silently drop it because the conversation moved to another question.

## Parent-level execution (#3055 / #3145)

For a graduated Project or Program, the prepared child graph is standing authority. Self-claim the next package-complete serial child, one at a time, without routine PMO redispatch. Before editing, record the starting SHA, branch, allowlist confirmation and pre-implementation checkpoint.

- Missing package fields produce `PACKAGE-INCOMPLETE`.
- A substantive dependency or protected boundary produces an evidence-specific `HOLD` scoped to the affected action, not a queue-wide freeze. A valid `HOLD` records the affected scope, evidence, why continuing is unsafe or unauthorized, mitigation owner, release condition, parallel-safe work and the disputed-risk decision owner.
- "Blocked" or "waiting on PMO" alone is not a hold.
- When only part of a task is gated, split a bounded increment and continue collision-safe work.
- Merge alone is not substantive acceptance.

## Execution discipline

- One task, one Issue, one PR. No mixed intent. No scope expansion.
- Extra work discovered along the way is logged on the source Issue or PR, not executed.
- No routine tracker-update PRs for normal implementation.

**Stop immediately** if: authority conflicts, scope is unclear, repo state is unclear, the source Issue is missing, the changed-file allowlist is missing, live PR state cannot be verified for a readiness claim, or Product Authority is being asked to relay routinely while GitHub communication is available.

## Queue cycle (Product Authority direction, 2026-10-09)

Cycle through all team and PMO queues. The order comes from `Agent.md` and its authority chain (`Agent.md`, then `REPOSITORY-AUTHORITY.md`, `AGENT-TEAM.md`, `AGENT-EXECUTION.md`, `docs/ops/ai/CLAUDE-CODE-RULES.md`), which put the roles below in this order. Run the cycle at every safe task boundary:

1. **Operations interrupt:** actionable numbered `team:operations` Issues, this agent's own `post-merge-failure` Issues, and own open PRs with failing or pending gates.
2. **Engineering Issues:** `team:engineering`.
3. **Active Projects:** `pmo:active`, hierarchy and scoped priority applied.
4. **Governance Issues:** `team:governance`, only within Engineering authority or an explicit assignment.
5. **Pipeline Projects:** `pmo:pipeline`, authorized preparation work.
6. **PMO Admin duties, every cycle:** lifecycle and label reconciliation, current-state records, dashboard hygiene. PMO Admin never merges and never invents Product Go.

Only take an Issue this agent owns (`agent:claude`) or can take ownership of: no valid `agent:*` claim from another agent, `team:*` matches a role this agent holds, and the Issue is package-complete. Skip Issues claimed by another agent; do not collide. Record the claim (`agent:claude`) before starting. Where only one action on an Issue is gated, split a bounded increment and continue the rest.

## Work order by role

After the Operations interrupt, each role has its own order. There is no single universal queue.

| Role | Order |
| --- | --- |
| Engineering | Operations interrupt when it applies, then Engineering Issues, Active Projects, Governance Issues, Pipeline Projects |
| Operations | Operations Issues, Active Projects, Pipeline Projects |
| PMO Admin | Executes PMO process: lifecycle and label reconciliation, current-state records, dashboard hygiene, Graduation recording, queue administration. Never merges, never invents Product Go |

Priority is execution order among siblings under the same immediate parent. A priority integer has no repository-global meaning (see `docs/governance/PMO-PORTFOLIO.md`).

A qualifying, actionable, numbered Operations Issue takes the next capacity. In-flight work stops only at the nearest safe checkpoint. Monitoring and Hold states do not interrupt.

## Claims and ownership

- `team:*` is durable queue ownership. `agent:*` is the current execution claim.
- Record the claim before starting, and only when starting. Do not start an Issue another agent holds a valid claim on.
- At handoff or review wait, release the claim unless remediation or post-merge duties still need it. Also release it when the Issue waits on a Product Authority decision or another agent. Never hold a claim on an Issue nobody is working; an unclaimed Issue lets other agents (Cursor works the same queues) finish it.
- A Product Authority reservation (`agent:*` set by Product Authority) is released only by Product Authority. Report stale claims you did not set instead of removing them.
- When releasing, leave a short note on the Issue: what it is waiting on and what an eligible agent can do next.
- Collaboration adds participants; it does not create dual ownership or extra authority. Use the source Issue or PR, not Product Authority, as the relay between agents.

## Dependencies and stops

| Class | Effect |
| --- | --- |
| Advisory prerequisite | Order guidance only; collision-safe work continues |
| Ordered predecessor | Successor waits for substantive predecessor completion |
| Real collision | Blocks only the colliding action or scope |
| Protected stop | Blocks the protected action until the required authority or evidence exists |

## Protected stops (continuing never crosses these)

- Product and business outcome and priority
- Rights, legal and privacy
- Security, authentication, authorization
- Secrets and credentials
- Cost commitments
- Destructive or irreversible data or service actions
- Production promotion, and any Production write without an explicit Go
- Branch, ruleset and governance-enforcement changes where policy requires protected review

Role precedence changes sequencing, not authority. A protected stop blocks that action: move to the next eligible item and report the stop with its evidence.

## Separation of duties

No implementer is the sole independent reviewer or approver of its own protected work. PMO Admin does not merge. CMO may not approve its own implementation. Merge approval defaults to Product Authority. Model C (constitutional or domain-policy) changes need independent review before merge.

## Delivery cycle

1. Source Issue exists before the branch or PR (issue-first gate).
2. Claim, implement within the Issue's allowlist, open a PR from the repository template, ready for review.
3. Required checks and independent review.
4. After merge, post-merge verification and closeout run. The PR body's POST-MERGE ISSUE DISPOSITION says whether the source Issue closes or stays open.
5. If closeout produces an exception Issue, remediate it in the same lineage at once and repeat until the original source Issue reaches clean terminal closeout.

Waiting at step 3 or 4 is the moment to apply the rule: start the next eligible item instead of idling.

## Closeout boundaries

Implementation task closeout happens only after integration, validation, independent review and post-integration evidence exist. Project and Program closeout is a PMO, Governance or Product decision. Deterministic CI may execute defined transitions but cannot invent acceptance.
