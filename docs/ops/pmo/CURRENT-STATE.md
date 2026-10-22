---
Doc Type: Operations
Audience: Human + AI
Authority Level: Current-State Routing
Owns: Current LGFC repo/program status routing
Does Not Own: Detailed implementation scope, PR evidence, or Drive planning authority
Source Issue: #2086
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Last Reviewed: 2026-10-22 (Chatterbox hold, #3415)
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

## Scope

In scope:

- Routing summary of active, queued, blocked, maturity-gap, future, and historical work
- Authority rules for this surface versus Issues/PRs and governance docs
- Required read paths and operator stop conditions
- Update cadence and ownership for this file

Out of scope:

- Replacing GitHub Issues as executable work truth
- Duplicating full issue bodies or PR evidence
- Runtime code, workflow YAML, secrets, or production config changes
- Treating Drive, chat, or memory as repository authority
- Closing, relabeling, or bulk-mutating Issues as part of maintaining this page

## Current known truth

As of Last Reviewed (2026-10-22, from live Issue labels and the open-Issue list):

- GitHub Issues and PRs are the executable source of truth for work.
- This file is a routing surface only; when it and a live Issue disagree, the live Issue wins until this page is updated.
- The objective is the 2027-01-01 website go-live and the 2027 fundraiser. The calendar of record, Go/No-Go, freeze and announcement decisions are on #2093 (Bill decides). Work toward them is tracked on #4414.
- Review checkpoints for the go-live work: 2026-10-24, 2026-11-23, 2026-12-15 (fundraiser draft review package) and 2026-12-31 (Go/No-Go). Each is reported on #2093.
- Role holders are recorded only in `docs/governance/AGENT-TEAM.md`. The owner shown below is the `agent:*` label on the Issue (a claim or a Product Authority reservation), not a role assignment.
- Priority is the order among sibling work under the same parent (`docs/governance/PMO-PORTFOLIO.md`). A priority number has no repository-wide meaning.

## Intended final state

- One durable, continuously maintained current-state routing document exists under `docs/ops/pmo/`.
- README and primary PMO entrypoints can route here without competing trackers.
- Humans and agents can answer active / queued / blocked / historical questions from this page plus live Issue links.
- Update ownership and cadence are explicit; stale routing is corrected via Issue-scoped docs PRs.

## How to use this page

1. Start here for orientation of current work.
2. Follow links to the live Issue or authoritative doc for detail.
3. Do not treat this file as a substitute for reading the source Issue, PR, or canonical governance document.
4. If this page and a live Issue disagree, the live Issue wins until this page is updated.

## Authority rules

| Surface | Role |
| --- | --- |
| GitHub Issues + PRs | Executable work truth |
| This file (`CURRENT-STATE.md`) | Routing and disposition summary |
| `docs/ops/pmo/pmo-backlog.md` | PMO backlog summary |
| `docs/ops/pmo/program-registry.md` | Program status registry |
| `docs/governance/*` and domain policy docs | Policy and standards authority |
| Drive / chat / memory | Non-authoritative; never repository truth |

Document precedence follows `docs/governance/REPOSITORY-AUTHORITY.md`.

## Active parents (Lifecycle: Active)

Live labels `pmo:active` and `status:active` on 2026-10-22. Ordered by priority label within this table only.

| Parent | Priority label | Owner label | Notes |
| --- | --- | --- | --- |
| #2093 2027 launch calendar and Go/No-Go | `pmo:priority:1` | `agent:cursor` | Carries `status:hold`: freeze-in-force and announcement Go wait on Bill. 30-day readiness review 2026-10-24, next 2026-11-23, decision window 2026-12-31. |
| #3633 CI qualification and Day-2 readiness | `pmo:priority:1` | `agent:claude` | Open children include #4467 (nightly qualification, three consecutive runs before 2026-11-07), #4469, #4470, #4471. |
| #4368 Copyright permission requests | `pmo:priority:1` | `agent:claude` | Open children include #4526, #4527, #4528, #4592, #4593. Rights and publication decisions are Product Authority's. |
| #4414 2027 go-live readiness (tracker) | `pmo:priority:1` | `agent:claude` | Tracking record only; grants no Go. Children P-01 to P-36 plus #4762, #4763 and #4764. |
| #4349 Gehrig timeline on Club Home | `pmo:priority:2` | `agent:cursor` | See Issue. |
| #2291 SEO strategy and activation control | `pmo:priority:4` | `agent:claude` | Due 10/31 on the dashboard. Open children include #4424 and #4743. |
| #4138 Documentation architecture completion (Diátaxis) | `pmo:priority:6` | `agent:cursor` | See Issue. |
| #3234 Dedicated agent GitHub identities | `pmo:priority:45` | `agent:cursor` | Held per the #2093 current-state record. Related: #3407. |

Label conflict to resolve under #4441: #1039 (Diátaxis curation) carries `status:active` with `pmo:pipeline` and `agent:Bill`.

## Pipeline parents

Live labels `pmo:pipeline` on 2026-10-22. Pipeline placement does not authorize implementation.

| Parent | Stage / label | Notes |
| --- | --- | --- |
| #3609 Queue-status dashboard | graduation-candidate, priority 5 | `agent:grok` |
| #2075 Social media strategy | idea, priority 22 | `agent:claude` |
| #2077 Partner and Friends operations | idea, priority 24 | `agent:claude` |
| #2079 Community engagement cadence | idea, priority 26 | `agent:claude` |
| #2082 Store strategy | idea, priority 28 | `agent:claude` |
| #2083 Store and merchandise operations | idea, priority 29 | `agent:claude` |
| #3047 Digital Lou Gehrig portrait and voice | idea, priority 31 | no `agent:*` label |
| #2817 Governance implementation remediation | priority 61, `status:hold` | Children #2818 to #2832 remain open. |
| #3415 Chatterbox communication layer | development-testing, priority 65, `status:hold` until 2027-07-01 | `agent:claude` |
| #2076 Cost analysis and growth heat map | idea, priority 71 | `agent:claude` |
| #2081 Monetization strategy | idea, priority 72 | `agent:claude` |
| #3635 Cloudflare AI Agents pool | sandbox-testing, priority 73 | `agent:cloudflareAI` |
| #2078 Adam Wilson Award and recognition | idea, no priority number | no `agent:*` label |

## Blocked / parked work

| Item | Disposition | Action |
| --- | --- | --- |
| #2093 freeze and announcement Go | `status:hold`; waits on Bill | Bill decides Go/No-Go on or before 2026-12-31; readiness reviewed on #2093 |
| #3234 agent identities | Held per #2093 record | Resume only on Product Authority direction |
| #2817 governance remediation | `status:hold` | Children stay open; do not claim without Product Authority direction |
| #4537, #4541 (children of #4534) | `status:hold` | See Issues |
| #3407 agent GitHub identities | `status:hold` | See Issue |
| #3415 Chatterbox | `status:hold` until 2027-07-01 | Open tasks #3527, #3544, and #3686 stay held. Do not resume before that date |
| #1719 closeout | `CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE` in `program-registry.md` | Verify remediation AS-BUILT and reconciliation before relying on closed state |
| #2678, #2779 | Closure subject to documentation/AS-BUILT verification | Verify before treating closed state as authoritative |

Open Operations exception Issues on 2026-10-22: #4714, #4725, #4726, #4730 (`team:operations`).

## Maturity-gap and collection Issues

- #2086 to #2092 are not in the open-Issue list on 2026-10-22; #2093 is Active (above).
- Collection Issues #2073 to #2085: only #2075 to #2079 and #2081 to #2083 are open (Pipeline, above). The rest are not open.
- Treat any collection Issue as future until explicitly claimed and labeled active.

## Active issues and PRs

- Prefer GitHub search: `is:open label:"status:active"` and `is:pr is:open`.
- Team queue ownership uses durable `team:*` labels; active claims use `agent:*` labels (see `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`).
- This section intentionally stays thin. Snapshot the highest-signal items when updating; do not enumerate every open issue.

## Historical / superseded surfaces

- Historical tracker/status files under `docs/ops/trackers/` and older PMO dashboards are not current authority unless a source Issue explicitly scopes reconciliation.
- Superseded statements in older comments or reports yield to newer AS-BUILT, this file, `program-registry.md`, and live Issues.
- `docs/ops/pmo/PMO-V2-OPERATING-MODEL.md` and `docs/ops/pmo/PMO-V3-OPERATING-MODEL.md` are historical relative to the July 2026 operating model; prefer `PMO-JULY-2026-OPERATING-MODEL.md` and the current registry.

## Required read paths

For any agent or human starting work:

1. `Agent.md` (mandatory entrypoint)
2. This file (`docs/ops/pmo/CURRENT-STATE.md`)
3. Source GitHub Issue for the task
4. Applicable design / governance / PMO docs linked from the Issue
5. `docs/governance/AGENT-EXECUTION.md` and the product-specific rules named in `Agent.md`
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
| Owner | Product Authority (Bill) or delegated PMO Admin (per `docs/governance/AGENT-TEAM.md`) |
| Cadence | At each #2093 readiness review (2026-10-24, 2026-11-23, 2026-12-31), and on material change to active programs, blockers, or maturity-gap status |
| Updater | Any agent closing or materially advancing work in the tables above must open a follow-up PR or include an update to this file in the same docs PR when the change is in-scope |
| Reconciliation | After update, confirm consistency with `pmo-backlog.md` and `program-registry.md` |

Do not bulk-edit this file for every trivial Issue state change. Prefer routing links over exhaustive lists.

## Related documents

- `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- `docs/ops/pmo/pmo-backlog.md`
- `docs/ops/pmo/program-registry.md`
- `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- `docs/governance/REPOSITORY-AUTHORITY.md`
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- `docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md`
- `Agent.md` / `README.md`
