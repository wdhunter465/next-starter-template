---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: The current responsibility matrix and the human-only decision list for #2456, as a reading of the role map
Does Not Own: Role assignment. The live map is `docs/governance/AGENT-TEAM.md`
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #2456, #2449, #4165, #4173, #4174, #4717
Last Reviewed: 2026-10-20
---

# AI and human responsibilities

## Purpose

This file reads the live role map into a single responsibility matrix and human-only decision list for #2456, so a reader does not have to reconstruct it from scattered role records.

## Scope

This file owns the current responsibility matrix and the human-only decision list below. It does not own role assignment — the live map is `docs/governance/AGENT-TEAM.md`, and this file copies no new roles. If it disagrees with `AGENT-TEAM.md`, that file wins. The older split that named Atlas as governance, Cursor as the sole implementer, and Codex as merely inactive is not the current map, and neither is the interim split that made Cursor the Operations holder "during the recorded transition" and Governance unowned.

## Current known truth

### Current matrix

| Holder | Responsibility | Does not do |
| --- | --- | --- |
| Bill | Product Authority and CMO: product outcome, priority, protected decisions, Production-tier merge approval, launch Go | Implement routine changes in order to approve them |
| Claude Code | PMO, Engineering and PMO Admin (primary); Operations and Governance (secondary); authorized implementation | Approve or merge a Production-tier or protected change it implemented |
| Cursor | Operations and Governance (primary); Engineering and PMO Admin (secondary); authorized implementation | Approve or merge a Production-tier or protected change it implemented |
| Deterministic CI | Machine-provable checks and evidence | Product Go or merge |
| ChatGPT | None. Retired (#4173) | Any current role |
| Codex | None. Retired (#4165) | Any current role |

### Governance role

The Governance role is held as recorded in the Team assignment in `docs/governance/AGENT-TEAM.md`. The gap left by the ChatGPT retirement is closed; this file does not name the holders again.

Overlap to avoid: the two team members must not become two copies of merge authority. Merge authority is tiered and defined in `docs/governance/REPOSITORY-AUTHORITY.md` (Merge authority): Production-tier merges stay with Bill (Product Authority and CMO); non-production Pull Requests are approved and merged by the implementing agent.

### Human-only decisions

These stay human:

- Product priority and protected product decisions
- Production-tier merge
- Production and launch Go
- Cost, legal, and secrets decisions
- Naming or retiring an agent role
- Accepting a risk or a debt row as tolerable

### Work that can be delegated

Only work already inside a role's authority and a source Issue:

- CI evidence collection
- Documentation drift findings that follow the #2087 procedure
- PMO label and dashboard hygiene by the recorded PMO Admin
- Independent review by someone who did not implement the change

### Adding a role

Add a role only when a source Issue shows a repeated gap the current holders cannot cover, names the decisions that stay human, and records how failure of the new holder is detected. A proposed organization chart is not that evidence. No new role is adopted here.

## Intended final state

This matrix is expected to change only when `docs/governance/AGENT-TEAM.md` records a role change (a new holder, a retirement, or a Governance-role assignment). This file does not anticipate its own structure changing; it is superseded in full only if the underlying role-map file itself is restructured.
