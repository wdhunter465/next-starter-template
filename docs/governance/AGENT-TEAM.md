---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Durable LGFC agent roles, recognized agent products, current member mapping, role work-selection order, approval authority, protected stops, and role-transition state
Does Not Own: PMO lifecycle/stage semantics, detailed queue-label implementation, delivery-profile mechanics, CI implementation, or Production recovery procedure
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #3240, #3629, #3693, #3825
Last Reviewed: 2026-09-01
---

# Agent Team

## Purpose

This document defines the durable LGFC Agentic Team roles and maps current products/agents to those roles. Authority attaches to roles; products and vendors are replaceable role holders.

A member may act only through its currently assigned role authority plus an open source Issue or standing project authority. Member mapping never weakens builder/reviewer separation, protected decisions, or Production authority.

## Durable roles

| Role | Primary authority |
| --- | --- |
| Product Authority | Product outcome, business priority, cost, protected Product decisions, final business Go/No-Go |
| Operations | Operations Issue response and authorized project implementation when Operations is clear |
| Engineering | Engineering qualification, technical design/review, authorized project implementation/review, Governance technical work |
| PMO | Active/Pipeline portfolio management, lifecycle readiness, scoped priority, Engineering/Governance execution prioritization, Graduation and project closeout preparation |
| Governance | Final repository-governance disposition and Issue assignment/prioritization subject to Product Authority; Governance Issue ownership |
| PR Approver / Engineering | Independent validation that work meets design, acceptance, repository, and promotion requirements |
| Administration & Communications | Evidence, routing, acknowledgments, escalation, repository-state reconciliation, holds/resumes, reporting, and authorized closeout transactions |
| Day-2 Operations | Production monitoring, incident classification, containment, recovery strategy, operational hold release |
| Deterministic CI | Machine-provable checks, evidence, eligible bounded automation, and authorized non-main integration |

## Role work-selection order

A qualifying numbered Operations interrupt remains repository-wide interrupt work. After that interrupt rule, each durable operating role has its own deterministic eligible-work order.

### Operations role

Work order:

1. **Operations Issues**
2. **Active Projects**
3. **Pipeline Projects**

Operating rule:

- Operations Issues are the first responsibility.
- When no actionable Operations Issue remains, Operations capacity continuously unpins authorized Active work.
- When Active work is unavailable/non-actionable, Operations capacity continues authorized Pipeline implementation/preparation work within role authority.
- Waiting on review, checks, or another agent does not make the role idle when another eligible item exists.

### Engineering role

Work order:

1. **Operations Issues** when the repository-wide Operations interrupt applies
2. **Engineering Issues**
3. **Active Projects**
4. **Governance Issues**
5. **Pipeline Projects**

Engineering Issues are the normal role priority after the universal Operations interrupt. When Engineering qualification/review work is clear, Engineering capacity continues into authorized project implementation, Governance technical work, and Pipeline work rather than idling.

### PMO role

PMO responsibilities:

- manage all Active and Pipeline Programs/Projects through completion;
- maintain lifecycle-stage readiness and required deliverables;
- maintain durable PMO Current State records so work can change agents without losing progress;
- maintain the hierarchical/scoped priority model defined by #3823 and `docs/governance/PMO-PORTFOLIO.md`;
- prioritize Engineering and Governance Issues for execution within Product/Governance authority;
- prepare and record Graduation decisions and Active closeout packages;
- reconcile stale PMO administrative state when the correction is deterministically defined.

PMO does not create Product Authority, Production Go, or protected decisions.

### Governance role

Governance responsibilities:

- final repository-governance disposition for Issue prioritization and assignment, subject to Product Authority;
- Governance Issues and governance-policy integrity;
- role/queue policy reconciliation;
- strategic assignment direction;
- preservation of protected boundaries and separation of duties;
- final resolution of conflicting lower-level agent/queue policy.

Governance does not override Product Authority's business/product decisions or protected Product/Production boundaries.

## Current member mapping

| Member/product | Current roles |
| --- | --- |
| Bill | Product Authority; Day-2 Operations; protected approval where recorded |
| ChatGPT | **Governance**; PR Approver / Engineering for work ChatGPT did not implement; Administration & Communications; Day-2 coordination/Tier 2 support |
| Work (OpenAI) | **PMO**; PR Approver / Engineering for work Work did not implement; Administration & Communications; Day-2 coordination/Tier 2 support |
| Grok | **Operations**; authorized implementation |
| Codex | **Operations**; Operations first responder and authorized Active/Pipeline implementation resource |
| Cursor | **Operations during transition**; authorized implementation; target role is Engineering after Product Authority records the transition |
| Claude Code | **Engineering**; authorized implementation; PR Approver / Engineering only for work Claude Code did not implement |
| Jules | Implementation resource only when explicitly assigned under a compatible role/source Issue |
| Gemini | Research and repository monitoring/reporting; read-only unless separately authorized |
| CloudflareAI | Evaluation/support only under recorded access |
| GitHub Actions / repository automation | Deterministic CI; bounded Administration & Communications transport/evidence |
| Repository runner/routing controller | Administration & Communications infrastructure; host/service maintained by Day-2 Operations |

## Cursor transition

Current transition state:

- Cursor remains eligible for Operations implementation while Codex reliability is being proven.
- Cursor is **not yet removed from Operations**.
- Target state moves Cursor into Engineering alongside Claude Code.
- The transition is complete only after Product Authority records the trigger/disposition in the repository.

Do not silently place Cursor in both roles as if the transition were complete. During transition, its Operations eligibility remains controlling unless an explicit source Issue assigns bounded Engineering participation.

## Codex operating contract

Codex is a standing Operations role holder / implementation resource, not a one-off task-only agent.

Codex behavior:

1. first responder for authorized Operations Issues within role eligibility;
2. when Operations is clear, self-select/continue authorized Active project work according to the current hierarchy and claim rules;
3. when Active work is unavailable, continue authorized Pipeline project work;
4. after packaging one task at a review/wait boundary, continue the next eligible work item rather than halting;
5. follow the same Issue-first, claim, PR, CI, review, closeout, protected-stop, and separation-of-duty contracts as every other implementer.

No Codex-specific bypass or weakened governance exists.

## ChatGPT and Work separation

ChatGPT and Work are distinct OpenAI products with different primary role assignments in the current operating model:

- **ChatGPT = Governance**
- **Work = PMO**

Both retain Administration & Communications and independent review capabilities where mapped and where separation of duties is satisfied.

A product may assist another role only through explicit repository authority; the primary mapping above determines normal responsibility and work selection.

## Priority and hierarchy dependency

This document does not redefine PMO priority semantics. The controlling model is in `docs/governance/PMO-PORTFOLIO.md` and `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`:

- priority is execution order among siblings under the same immediate parent/container;
- priority numbers may be reused under different Programs, Projects, child work units, and PMO stages;
- a priority integer has no repository-global meaning;
- the full hierarchy path determines execution context.

Roles select eligible work using that hierarchy rather than flattening all Issues into one global rank.

## Team ownership versus agent claim

`team:*` and `agent:*` remain distinct:

- `team:*` = durable queue/team ownership;
- `agent:*` = current execution claim or explicit Product Authority reservation.

An agent claim does not permanently transfer role or Team ownership. Claims must be releasable when stale or at handoff according to the canonical queue/claim contract.

## Independent review and separation of duties

- No implementer may be the sole independent reviewer/approver of its own protected work.
- ChatGPT may not independently approve governance documentation it implemented.
- Work may not independently approve PMO documentation it implemented.
- Claude Code may approve only work it did not implement.
- Cursor, Codex, Grok, and other implementers do not self-approve protected work.
- Model C constitutional/domain-policy changes require independent review before merge.
- Production promotion retains the configured Engineering and Product/Production authority.

## Approval and protected boundaries

Protected decisions remain protected regardless of role order:

- Product/business outcome and priority;
- rights/legal/privacy;
- security/authentication/authorization;
- secrets/credentials;
- cost commitments;
- destructive or irreversible data/service actions;
- Production promotion;
- branch/ruleset/governance-enforcement changes where repository policy requires protected review.

Role precedence changes sequencing, not authority.

## Communication

Operating team members communicate directly through the authoritative source Issue/PR when GitHub communication is available.

Response-required handoffs, implementation questions, review requests, blockers, and collaboration requests are acknowledged and resolved in the repository record. Product Authority is not used as the routine relay between agents.

Collaboration does not create dual queue ownership or bypass role authority.

## Continuous-work invariant

An eligible operating agent is not idle merely because one task is waiting on review, CI, another agent, or a non-blocking administrative transaction.

At each safe task boundary the agent re-evaluates its role work order and selects the next eligible, package-complete item. Protected stops and real collisions block only the affected action/scope unless higher authority explicitly broadens the hold.

## Closeout boundaries

Implementation task closeout may be executed only after required integration, validation, independent review, and post-integration evidence exist.

Project/Program closeout remains a PMO/Governance/Product decision at the level required by the source authority. Deterministic CI or Administration may execute mechanically defined state transitions but cannot invent substantive acceptance.

## Supersession

This document supersedes earlier agent-team language that:

- treats ChatGPT and Work as indistinguishable primary role holders for all control-plane work;
- treats Cursor as permanently Operations-only or permanently Engineering before the recorded transition;
- treats Codex as lacking a standing durable Operations/implementation role;
- defines one universal normal-work queue order for every agent regardless of role;
- allows an agent to halt after one task while other eligible work exists;
- conflates team ownership with the current agent claim.

Lower-level product rule files must point to this mapping and must not restate conflicting role/precedence copies.
