---
Doc Type: Governance Standard
Audience: Human + AI
Authority Level: Binding
Owns: Cross-agent execution fidelity — approved-action contracts, literal execution of agreed elements, end-state reconciliation, blocker handling, and completion semantics for WORK, Cursor, Claude Code, Codex, and future LGFC agents
Does Not Own: Role mapping, merge authority, Product direction, assignment priority, PR process redesign, or incidental implementation details intentionally left open inside an approved contract
Canonical Reference: /Agent.md
Related Issues: #3138
Last Reviewed: 2026-08-07
---

# Agent Execution Fidelity

## Purpose

Establish a repository-wide **execution fidelity** contract so that once Product Authority (or another explicitly authorized decision role) and an agent agree to a formulated action, the **complete agreed action** is the binding execution contract.

This standard eliminates the recurring failure mode where discussion produces an agreed action (`1-2-3-4-5`) but the executing agent silently delivers a substituted result (`X-Y-Z`) through summarization, reinterpretation, optimization, redesign, scope reduction, scope expansion, or another unapproved alternative.

This is **execution failure**, not partial success.

## Current known truth

Before this standard, no single canonical document defined what "approved action" means once Product Authority and an agent agree on a formulated action. Assignment packaging (`docs/templates/agent-assignment-template.md`) and shared execution rules (`docs/ops/ai/CORE-RULES.md`) covered stop conditions, protected stops, and handoff mechanics, but not execution fidelity itself — so agents had no shared, binding definition distinguishing legitimate implementation discretion from an unapproved substitution, and no required end-state reconciliation step before claiming completion. This gap produced the recurring failure mode described in Purpose: an agreed `1-2-3-4-5` action delivered as `X-Y-Z`.

## Intended final state

This standard is the single, stable source of the execution-fidelity contract for every LGFC agent and runtime (`## Scope`). It is not phased and has no planned future revisions beyond ordinary maintenance: routing from `Agent.md`, `docs/ops/ai/CORE-RULES.md`, and `docs/templates/agent-assignment-template.md` all point here as the canonical doctrine (`## Routing (single owner)`), and agent-specific rule files remain additive only, never duplicating or weakening it. Steady state is reached once every assignment that carries an approved multi-element action records it as an Execution Contract (template section 9a) and every completion claim is backed by element-by-element `Agreed → Delivered → PASS/FAIL` verification (template section 15a).

## Scope

Applies to every LGFC agent and runtime that executes repository work under the mandatory authority chain, including WORK, Cursor (local/cloud), Claude Code, Codex, Copilot, Devin, and future members mapped in `docs/governance/AGENT-TEAM.md`.

Does not redesign agent-team roles, merge authority, assignment priority, or unrelated PR governance.

## Binding rule

> Once Product Authority explicitly approves an action formulated through discussion, the complete agreed action becomes the execution contract. The executing agent must perform every agreed element exactly as approved. The agent may not silently substitute, summarize, compress, expand, narrow, reinterpret, redesign, optimize, or replace any agreed element.
>
> If any agreed element cannot be executed exactly, the agent must stop the affected action and report the specific blocker. An alternative may be proposed, but it may not be executed without new Product Authority approval.
>
> Completion may be claimed only after the agent verifies the actual end state against every element of the execution contract.

**The requested/agreed deliverable is itself an acceptance criterion.**

## Distinctions

| Concept | Meaning |
| --- | --- |
| Discussion / exploration | Not yet a contract; agents may propose options |
| Explicitly formulated action | Numbered or otherwise discrete agreed elements ready for approval |
| Product Authority approval | Recorded authorization that elevates the formulated action to a binding contract |
| Execution fidelity | Literal delivery of every agreed element |
| Implementation discretion | Bounded technical choices **inside** an intentionally open approved contract |
| Legitimate blocker | Evidence that an agreed element cannot be performed with available authority/capability |
| Agent preference | Desire for another approach — **not** a blocker and **not** authorization to substitute |
| Proposed alternative | Suggestion only until newly approved |
| Partial execution | Incomplete; completion claim prohibited |
| Verified completion | Every required contract element `Agreed → Delivered → PASS` |

## Lifecycle

```text
Discussion
  -> Explicitly formulated action
  -> Product Authority approval
  -> Binding execution contract
  -> Literal execution of all agreed elements
  -> End-state verification against every agreed element
  -> Completion only if all required elements PASS
```

When an agreed element becomes impossible:

```text
Execution contract
  -> specific blocker discovered
  -> STOP affected action
  -> report exact blocked element and evidence
  -> propose alternative if useful
  -> obtain new Product Authority approval
  -> execute revised contract
```

No silent substitution is permitted.

## Implementation-discretion boundary

Agents retain bounded technical discretion **inside** an explicitly approved contract when the contract intentionally leaves implementation details open.

Example:

- Approved: "Create a standards document in the canonical Diataxis governance location and route all agents to it."
- Discretionary: exact heading structure, internal prose organization, or link formatting consistent with repository standards.
- Not discretionary: replacing the standards document with a short summary in an Issue comment, omitting required assignment-template enforcement, or changing all-agent scope.

Governing question:

> Would the resulting end state still satisfy every explicitly agreed element without changing its meaning, scope, source, destination, or required result?

If no, new approval is required.

## Blocker handling

Do not treat a blocker as permission to improvise a replacement outcome.

Required behavior:

1. Identify the exact agreed element that cannot be completed.
2. Record the evidence/reason.
3. Stop only the affected action/scope unless a broader protected stop applies.
4. State that the agreed execution contract is not yet satisfied.
5. Propose an alternative only as a proposal.
6. Await Product Authority approval before executing the alternative.

## Completion semantics

For an approved `1-2-3-4-5` action:

| Delivered | Result |
| --- | --- |
| `1-2-3-4-5` delivered and verified | PASS — completion may be claimed |
| `1-2-3` only | Incomplete — completion claim prohibited |
| `1-2-3-4-5` with one element materially changed | FAIL pending new approval |
| `X-Y-Z` instead | FAIL, even if useful |

An agent must not report `complete`, `done`, `accepted`, or an equivalent terminal success state when any required contract element is FAIL, missing, substituted, or unverifiable.

## Required reconciliation form

Before claiming completion, record:

```text
EXECUTION CONTRACT VERIFICATION

1. Agreed: __________
   Delivered: ________
   Result: PASS | FAIL

2. Agreed: __________
   Delivered: ________
   Result: PASS | FAIL

...

Overall: PASS only if every required element is PASS
```

## Assignment mechanics

Canonical assignment packaging lives in `docs/templates/agent-assignment-template.md`. Assignments must include:

- an explicit **Agreed Action / Execution Contract** listing discrete elements;
- pre-execution checkpoint confirmation that the contract is loaded and executable without unapproved substitution;
- completion packet with element-by-element `Agreed → Delivered → PASS/FAIL` reconciliation.

## Verification scenarios (normative)

### A — Exact execution

Agreed: `1-2-3-4-5`. Delivered: `1-2-3-4-5`. Expected: completion allowed after verification.

### B — Partial execution

Agreed: `1-2-3-4-5`. Delivered: `1-2-3`. Expected: incomplete; completion claim prohibited.

### C — Silent substitution

Agreed: `1-2-3-4-5`. Delivered: `X-Y-Z` because the agent prefers it. Expected: FAIL; substitution prohibited without new approval.

### D — Blocker

Element `4` cannot be performed. Expected: stop affected action; report element `4` and evidence; propose alternative only; do not execute alternative without approval.

### E — Legitimate discretion

Contract defines required result but leaves a minor internal detail open. Expected: agent may choose the detail when meaning, scope, source, destination, and required end state are unchanged.

## Routing (single owner)

```text
Agent.md (discovery)
  -> docs/ops/ai/CORE-RULES.md (mandatory all-agent reference)
  -> this standard (canonical doctrine)
  -> docs/templates/agent-assignment-template.md (mechanical fields)
```

Agent-specific rule files are additive and must not duplicate or weaken this doctrine.

## Related authority

- Entry routing: `Agent.md`
- Shared execution: `docs/ops/ai/CORE-RULES.md`
- Assignment template: `docs/templates/agent-assignment-template.md`
- Roles: `docs/governance/AGENT-TEAM.md`
- Source Issue / allowlist / protected stops remain independently mandatory
