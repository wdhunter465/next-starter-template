---
Doc Type: Operational Rules
Audience: Human + AI
Authority Level: Superseded
Owns: Historical LGFC AI team operating detail only — agent policy moved to governance
Does Not Own: Team roles, approval authority, protected stops, or launch-control policy
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #1754, #2494, #3142
Last Reviewed: 2026-08-08
---

# LGFC AI Team Operating Model

## Status

**Superseded for agent team policy.** Team roles, approval authority, protected stop conditions, and launch-control workflow now live exclusively in [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md).

| Topic | Canonical owner |
| --- | --- |
| Agent team policy and approval routing | `docs/governance/AGENT-TEAM.md` |
| Role contracts and protected-stop flags | `docs/reference/agents/implementation-authority-contract.md` |
| Model A execution procedure | `docs/how-to/agents/run-model-a.md` |
| Model B execution procedure | `docs/how-to/agents/run-model-b.md` |
| Shared execution detail | `docs/ops/ai/CORE-RULES.md` |
| Codex selective-use status | `docs/ops/ai/CODEX-RULES.md` and `docs/governance/AGENT-TEAM.md` (#3142) |

The body below retains historical operating-model context until a later archive pass. Do not cite this file for team roles, Bill/Chat/Cursor approval routing, protected stops, or Codex assignment policy.

**Codex routing (current):** Codex is not a standing LGFC implementation executor. Product Authority may selectively authorize Codex on a bounded source Issue without global reactivation. See [`CODEX-RULES.md`](./CODEX-RULES.md). Historical “inactive/out / do not assign / requires governance reactivation” wording in the sections below is **not** current routing authority.

## Purpose

This document was the **canonical operating model** for the LGFC AI team: who owns what, which modes apply, how work flows from requirements to closeout, and where agents must stop for human authorization.

Shared agent law remains in [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) and [`CORE-RULES.md`](./CORE-RULES.md). Tool-specific behavior remains in agent-specific rule files. This document does not weaken shared law.

## Scope

This document applies to all LGFC repository work coordinated through Bill, ChatGPT, Cursor, and historical Codex references.

This document does not own product design content, workflow YAML, runtime code, or final merge approval.

## Current known truth

As of 2026-06-17 (issue #1754):

- **Bill** is project owner and final authority.
- **ChatGPT** (ChatGPT) is design and launch-control package authority.
- **Cursor** is the **sole** LGFC implementation executor (historical; later superseded by co-equal Cursor Local + Claude Code standing executors in `AGENT-TEAM.md`).
- **Codex** historical note: described as inactive/out unless Bill reauthorized it — **superseded for current routing by #3142 selective-use** (`CODEX-RULES.md`).

Prior routing that listed Codex as a primary or secondary implementation agent is superseded for LGFC work by this document and the aligned agent rule files.

## Intended final state

Every LGFC task follows one predictable path: Bill defines requirements → ChatGPT and Bill finalize design → ChatGPT publishes a documentation package → Bill approves → ChatGPT creates program and child issues → Cursor reviews the launch-control package → Bill/ChatGPT authorize execution → Cursor implements within scope with verification stop points → ChatGPT and Bill review gates → Bill authorizes continue, hold, or revise.

PMO program lifecycle status reporting terms (**Ready for Launch**, **Implementation
Active**, **Post-Implementation Verification**, **Complete / Closed**) are
defined in `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`. Ready for Launch means prepared for Bill/ChatGPT Go/No-Go, not production complete.

---

## Team roles

### Bill — project owner / final authority

Bill owns:

- project requirements and final product decisions;
- PR approval and merge authorization;
- verification-gate authorization (continue, hold, or revise);
- final authority when sources conflict above the source issue.

Bill does not perform routine scoped file implementation when Cursor is the assigned executor.

### ChatGPT — design and launch-control authority

ChatGPT owns:

- design authority and design-package preparation;
- documentation PR and documentation-package authority;
- program master issue authorship;
- child issue authorship under approved programs;
- launch-control-ready work-package authorship;
- draft/reference implementation packages and pseudocode for Cursor handoff;
- gate review as Bill's partner before Bill authorizes continue/hold/revise.

ChatGPT does not perform scoped repository implementation when Cursor is the assigned executor unless the source issue explicitly assigns implementation to ChatGPT.

### Cursor — sole implementation executor

Cursor owns:

- all scoped LGFC implementation execution (code, configuration within allowlist, documentation implementation when assigned);
- pre-implementation review and comment on newly authored launch-control issue packages before execution begins;
- continuous execution within approved scope between authorized stop points;
- stopping at verification gates and reporting evidence before requesting continuation authorization.

Cursor does not own design authority, scope definition, merge approval, or gate authorization.

### Codex — historical inactive wording (superseded for routing)

Historical text in this superseded file described Codex as inactive/out and forbade assignment unless Bill reauthorized Codex through a future governance update.

**Current policy (#3142):** Codex is not a standing executor; Product Authority may authorize a bounded source Issue without global reactivation. Follow [`CODEX-RULES.md`](./CODEX-RULES.md) and [`AGENT-TEAM.md`](../../governance/AGENT-TEAM.md). Do not use the historical “do not assign / invalid routing / global reactivation required” phrases below as current stop reasons.

<details>
<summary>Historical Codex rules retained for archive context</summary>

Codex was described as **not** an active LGFC implementation path.

Historical rules at that time:

- Do not assign LGFC implementation work to Codex.
- Do not route new product or repository implementation tasks to Codex.
- Codex may be reactivated only through an explicit future governance update approved by Bill.

Historical Codex documentation remains for reference only. On conflict, [`AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) and [`CODEX-RULES.md`](./CODEX-RULES.md) control.

</details>

---

## ChatGPT startup orientation (`run startup`)

When Bill says `run startup`, ChatGPT performs **orientation-only** startup and **stops**. Required report sections, prohibited actions, and bounded context inspection are defined in [`CHATGPT-RULES.md`](./CHATGPT-RULES.md#lgfc-startup-contract).

`run startup` does **not** authorize queue audit, repository posture inspection, inferred next work, GitHub mutation, PMO state advance, or implementation resume. Prior chat context and active task state do **not** override the startup checklist.

---

## Operating mode taxonomy

Every LGFC repository task must be classified into **exactly one** mode before action. Do not mix modes in one PR unless the source issue explicitly allows it.

| Mode | Purpose | Typical owner |
| --- | --- | --- |
| **Design** | Architecture, decomposition, implementation strategy, acceptance framing | ChatGPT (+ Bill review) |
| **Documentation** | Canonical docs, how-to, reference, governance alignment, documentation PRs | ChatGPT (author) / Cursor (when assigned to implement doc changes) |
| **Governance** | Agent rules, PR discipline, authority alignment, process compliance | ChatGPT / Cursor per assignment |
| **Worklist** | Program hierarchy, queue organization, issue structure, closeout state | ChatGPT |
| **Verification** | PR/issue/CI inspection, post-merge validation, evidence reporting | ChatGPT / Cursor per assignment |
| **Troubleshooting** | Failed gates, broken workflows, inconsistent issue/PR state | ChatGPT (coordinate) / Cursor (when assigned to fix) |
| **Implementation** | Scoped file changes within an approved allowlist | **Cursor only** |
| **Operations cleanup** | Stale ops noise, remediation classification, blocked-workflow residue | ChatGPT (coordinate) / Cursor (when assigned) |

Mode names in agent assignments and issue packages must match this table.

---

## End-to-end workflow

```text
Bill defines requirements
        ↓
ChatGPT + Bill finalize design
        ↓
ChatGPT creates documentation package PR
        ↓
Bill reviews / approves documentation PR
        ↓
ChatGPT creates program master issue + child issues
        ↓
Cursor reviews launch-control issue package (comment / checkpoint)
        ↓
Bill / ChatGPT authorize execution
        ↓
Cursor implements continuously within scope
        ↓
Cursor stops at verification gates
        ↓
ChatGPT + Bill review gates
        ↓
Bill authorizes continue / hold / revise
```

### Step detail

1. **Bill defines requirements** — outcome, constraints, and priority. Requirements may start informal; ChatGPT converts them into repository-ready authority.
2. **ChatGPT and Bill finalize design** — locked design references, route/layout invariants, acceptance framing, and explicit non-goals.
3. **ChatGPT creates documentation package PR** — canonical docs that define what will be built, where it lives, and how it will be verified. Documentation PRs are docs-only unless the source issue explicitly authorizes otherwise.
4. **Bill reviews and approves documentation PR** — Bill is the approval authority for documentation packages that gate downstream work.
5. **ChatGPT creates master issue and child issues** — program container, scoped child tasks, exact allowlists, and launch-control fields per [`docs/templates/agent-assignment-template.md`](../../templates/agent-assignment-template.md).
6. **Cursor reviews issue package before implementation** — for newly authored launch-control packages, Cursor must review and comment on completeness (source issue, documentation package link, draft/reference code, allowlist, non-goals, acceptance criteria, verification plan, rollback plan) **before** editing files. Cursor stops if the package is incomplete.
7. **Bill / ChatGPT authorize execution** — explicit authorization to begin or continue implementation after Cursor's pre-implementation review checkpoint.
8. **Cursor implements continuously within scope** — one task, one issue, one PR; no scope expansion; respect shared agent law.
9. **Cursor stops at verification gates** — do not claim merge-readiness or request the next tranche of work until required local checks, PR gates, and review-thread obligations are satisfied or a documented blocker exists.
10. **ChatGPT + Bill review gates** — ChatGPT synthesizes PR evidence; Bill and ChatGPT partner on gate review before Bill's authorization decision.
11. **Bill authorizes continue / hold / revise** — continue to next queue item, hold for external dependency, or revise scope through updated issues/docs.

---

## Authority boundaries

| Decision | Authority |
| --- | --- |
| Requirements and final product call | Bill |
| Design and documentation package | ChatGPT |
| Documentation PR authorship | ChatGPT |
| Program / child issue authorship | ChatGPT |
| Launch-control package completeness | ChatGPT (author) + Cursor (pre-implementation review) |
| Implementation execution | **Cursor only** |
| Pre-implementation package review | Cursor (required comment/checkpoint) |
| Execution authorization | Bill / ChatGPT |
| Verification stop / continue | Bill (with ChatGPT gate-review partnership) |
| PR merge | Bill |
| Codex implementation routing | **Historical row:** forbidden unless future Bill-approved governance reauthorization — **superseded by #3142 selective-use model** in `CODEX-RULES.md` / `AGENT-TEAM.md` |

---

## Launch-control package requirements

Before Cursor may execute implementation, the issue package must include:

- source issue (exactly one primary issue);
- documentation package (merged or explicitly approved PR reference);
- draft/reference code or pseudocode;
- file allowlist;
- non-goals;
- acceptance criteria;
- verification plan;
- rollback plan;
- Cursor review checkpoint (completed comment or explicit pass);
- Bill/ChatGPT stop-gate authorization for execution.

Use [`docs/templates/agent-assignment-template.md`](../../templates/agent-assignment-template.md) as the mandatory envelope format.

---

## Continuous execution and stop points

Cursor executes **continuously** within an authorized package — multiple commits and PR updates in one session — but must **stop** at:

- missing or incomplete launch-control package fields;
- scope ambiguity or allowlist conflict;
- completed implementation tranche pending verification;
- failing required gates on the PR head;
- unresolved review threads that block readiness;
- explicit Bill/ChatGPT hold instruction;
- any mandatory stop condition in [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) or [`CORE-RULES.md`](./CORE-RULES.md).

After each stop point, Cursor reports evidence and waits for Bill/ChatGPT authorization before continuing beyond the current gate.

---

## Related canonical documents

| Document | Relationship |
| --- | --- |
| [`Agent.md`](../../../Agent.md) | Entry point; routes agents to this operating model |
| [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) | Shared agent law for all agents |
| [`CORE-RULES.md`](./CORE-RULES.md) | Detailed execution rules |
| [`CHATGPT-RULES.md`](./CHATGPT-RULES.md) | ChatGPT-specific control-plane behavior |
| [`CURSOR-RULES.md`](./CURSOR-RULES.md) | Cursor implementation authority and review checkpoint |
| [`CODEX-RULES.md`](./CODEX-RULES.md) | Codex selective-use status (#3142) |
| [`docs/templates/agent-assignment-template.md`](../../templates/agent-assignment-template.md) | Mandatory assignment envelope |

---

## Final

This operating model is canonical for LGFC AI team roles, modes, and workflow. When agent docs conflict on team roles or implementation routing, this document and [`Agent.md`](../../../Agent.md) win after locked design and shared agent law.
