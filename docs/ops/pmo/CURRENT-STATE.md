---
Doc Type: Operations
Audience: Human + AI
Authority Level: Current-State Routing
Owns: Current LGFC repo/program status routing
Does Not Own: Detailed implementation scope, PR evidence, or Drive planning authority
Source Issue: #2086
Canonical Reference: /docs/ops/pmo/PMO-V3-OPERATING-MODEL.md
Last Reviewed: 2026-08-11
---

# LGFC Current State

## Purpose

This is the single canonical current-state routing surface for the Lou Gehrig Fan Club repository.

It answers:

- What is active now?
- What is queued next?
- What is blocked or parked?
- What is historical or superseded?
- What is authoritative documentation?
- What should a human or agent read next?
- Where should work stop?

It does **not** replace GitHub Issues as the executable source of truth. It routes; it does not duplicate full issue bodies or compete with Issues/PRs.

## How to use this page

1. Start here for orientation of current work.
2. Follow links to the live Issue or authoritative doc for detail.
3. Do not treat this file as a substitute for reading the source Issue, PR, or `_MASTER` document.
4. If this page and a live Issue disagree, the live Issue wins until this page is updated.

## Authority rules

| Surface | Role |
| --- | --- |
| GitHub Issues + PRs | Executable work truth |
| This file (`CURRENT-STATE.md`) | Routing and disposition summary |
| `docs/ops/pmo/pmo-backlog.md` | PMO backlog summary |
| `docs/ops/pmo/program-registry.md` | Program status registry |
| `docs/governance/*` and `*_MASTER` docs | Policy and standards authority |
| Drive / chat / memory | Non-authoritative; never repository truth |

Document precedence follows `docs/governance/standards/document-authority-hierarchy_MASTER.md`.

## Active implementation lane

Current active PMO implementation assignments (reconcile against live Issues):

| Project | Status | Implementer | Current task | PMO owner |
| --- | --- | --- | --- | --- |
| #2615 | Active | Cursor | #2622 | ChatGPT / Atlas |
| #2784 | Active | Claude | #2918 | ChatGPT / Atlas |
| #2086 | Active | Grok | This dashboard | Product Authority |

Bill retains Product and Production authority. Post-merge exceptions return to the implementer of the originating PR.

## Current prioritized queue

Near-term program anchors (from preparation packet and PMO surfaces; verify live labels/state):

| Priority band | Issues | Notes |
| --- | --- | --- |
| Active product / website | #1685, #2039, #2040, #2072 | Website completion, launch readiness, content publication, CI as-built |
| Content / member ops | #1738, #1700 | Gehrig content Phase 1, fundraiser/charity ops |
| Governance / PMO | #1719 (closeout remediation), #2615, #2784 | Workflow automation closeout, active PMO work |
| Maturity-gap (this family) | #2086–#2093 | Current-state, docs-as-assets, agent rules, release evidence, infra readiness, launch calendar |

Exact ordering is controlled by live Issue labels, assignee, and Product Authority direction. Do not invent priority from this table alone.

## Active issues and PRs

- Prefer GitHub search: `is:open label:status:active` and `is:pr is:open`.
- Team queue ownership uses durable `team:*` labels; active claims use `agent:*` labels (see `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`).
- This section intentionally stays thin. Snapshot the highest-signal items when updating; do not enumerate every open issue.

## Blocked / parked work

| Item | Disposition | Action |
| --- | --- | --- |
| #1719 closeout | `CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE` | Complete remediation AS-BUILT, PMO/GitHub reconciliation, independent verification |
| #2678, #2779 | Closure subject to documentation/AS-BUILT verification | Verify before treating closed state as authoritative |

Any other blocked work must be recorded on the live Issue. Do not invent blockers here.

## Maturity-gap work

| Issue | Title (short) |
| --- | --- |
| #2086 | Canonical current-state authority dashboard (this work) |
| #2087 | Documentation as monitored operational assets |
| #2088 | Agent rule load and onboarding balance |
| #2089 | Production release evidence ownership |
| #2090 | Cloudflare token/config readiness |
| #2091 | D1/B2 daily sync readiness |
| #2092 | Cursor local runbook |
| #2093 | 2027 launch calendar and go/no-go plan |

## Future collection backlog

Program collection issues (not active implementation unless Product Authority promotes):

#2073–#2085 (Gehrig content Phase 2, member communications, social, cost analysis, partners, awards, engagement, monetization, store, annual Lou Gehrig Day, admin tools, etc.).

Treat as future until explicitly claimed and labeled active.

## Historical / superseded surfaces

- Historical tracker/status files under `docs/ops/trackers/` and older PMO dashboards are not current authority unless a source Issue explicitly scopes reconciliation.
- Superseded statements in older comments or reports yield to newer AS-BUILT, this file, `program-registry.md`, and live Issues.
- `docs/ops/pmo/PMO-V2-OPERATING-MODEL.md` and similar legacy files are historical; prefer V3 and current registry.

## Required read paths

For any agent or human starting work:

1. `Agent.md` (mandatory entrypoint)
2. This file (`docs/ops/pmo/CURRENT-STATE.md`)
3. Source GitHub Issue for the task
4. Applicable design / governance / PMO docs linked from the Issue
5. `docs/ops/ai/SHARED-AGENT-RULES.md` and agent-specific rules
6. `.agents/skills/lgfc-pr-governance/SKILL.md` when PR work is involved

## Operator stop conditions

Stop and escalate (do not continue) when:

- The live Issue is closed, blocked, or assigned to a different active claim.
- Scope would require changing runtime code, secrets, or protected workflows without explicit Issue authorization.
- Required DIATAXIS / AS-BUILT / closeout evidence is missing and the task is a closeout or production promotion.
- This page and the live Issue conflict and Product Authority has not resolved the conflict.
- You would need to treat Drive, chat, or memory as repository authority.
- Post-merge reviewer threads or gate failures remain undispositioned on a PR you own.

## Update cadence and owner

| Role | Responsibility |
| --- | --- |
| Owner | Product Authority (Bill) or delegated PMO (ChatGPT / Atlas) |
| Cadence | On material change to active programs, blockers, or maturity-gap status; at minimum when a major program starts/stops or closeout disposition changes |
| Updater | Any agent closing or materially advancing work in the tables above must open a follow-up PR or include an update to this file in the same docs PR when the change is in-scope |
| Reconciliation | After update, confirm consistency with `pmo-backlog.md` and `program-registry.md` |

Do not bulk-edit this file for every trivial Issue state change. Prefer routing links over exhaustive lists.

## Related documents

- `docs/ops/pmo/PMO-V3-OPERATING-MODEL.md`
- `docs/ops/pmo/pmo-backlog.md`
- `docs/ops/pmo/program-registry.md`
- `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- `docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md`
- `Agent.md` / `README.md`
