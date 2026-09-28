---
Doc Type: Implementation Plan / Launch Packet
Audience: Implementers (Grok), PMO Admin, reviewers
Authority Level: Design lock for #3609 — complete launch packet for PMO Graduation review
Owns: Architecture, classification, event matrix, surface contract, child sequence, acceptance, rollback for the LGFC queue-status dashboard
Does Not Own: PMO portfolio book views, Production Cloudflare site content, Active priority assignment (PMO Admin at Go), Production authorization
Canonical Reference: GitHub Issue #3609; docs/reference/pmo/queue-status-dashboard-contract.md
Related: #3615 (PMO event refresh / agent ownership), PMO dashboard how-to, PR #4403, Engineering review 2026-09-28
Last Reviewed: 2026-09-28
---

# Launch packet: LGFC queue-status dashboard (#3609)

## Status

**Launch packet complete — ready for PMO Admin Graduation review.**

Engineering (2026-09-28) found the design **feasible** on the live dashboard path and issued **No-Go for Active** only because Issue encoding and design-record merge were incomplete. Those gaps are closed in this packet and on Issue #3609 / PR #4403 as follows:

| Engineering blocker | Resolution |
| --- | --- |
| No `pmo:stage:graduation-candidate` | Applied on #3609 (Pipeline parent encoding) |
| Still `team:engineering` only | Reclassified to PMO Pipeline parent (`team:pmo`, `pmo:pipeline`, `pmo:parent`) |
| No Active priority | **Correctly deferred** — PMO Admin assigns `pmo:priority:<n>` **at Go**, not before |
| Design not on main / Diátaxis headers | Fixed in #4403 (`Canonical Reference`); merge #4403 as design record before or with Go |
| `classifyTeamQueue` null overload | Explicit `team` \| `dataQuality` \| `excluded` API (§3) |
| `pull_request` synchronize noise | **Removed** from v1 (§6) |
| PR review events in original Issue text | **Product-accepted v1 omission** — team membership does not change on review comments (§6) |

This document still **does not grant Graduation Go**. Only PMO Admin may record Go and move the parent to Active.

## 1. Purpose (locked)

Build a **queue-status operational dashboard** that lists open Issues in Operations, Engineering, and Governance with agent ownership, plus 10 newest and 20 oldest open Issues across those queues. Refresh primarily from repository events; schedule is fallback only.

This is **not** the PMO Active/Pipeline portfolio book. Do not apply PMO lifecycle placement rules to these team lists.

## 2. Architecture (locked)

| Decision | Choice |
| --- | --- |
| Surface | Sibling under GitHub Pages `/pmo-dashboard/queue-status.html` |
| Data | `queue-status-data.json` alongside existing PMO dashboard output |
| Generator | `scripts/pmo-dashboard/queue-status.mjs` + tests; shared label helpers only — **not** `classifyTeamQueue` null semantics |
| Deploy | Same Pages **artifact** path as PMO dashboard (no commit loop) |
| Workflow | Extend **PMO dashboard CI build** so one matrix rebuilds both surfaces |

### Implementation allowlist (intent)

```text
scripts/pmo-dashboard/queue-status.mjs
scripts/pmo-dashboard/test-queue-status.mjs
scripts/pmo-dashboard/static/queue-status.html
scripts/pmo-dashboard/static/queue-status.js
scripts/pmo-dashboard/build-dashboard.mjs
scripts/pmo-dashboard/run-dashboard-build.mjs
scripts/pmo-dashboard/validate-dashboard.mjs
.github/workflows/pmo-dashboard-ci-build.yml
.github/workflows/pmo-dashboard-ci-deploy.yml
docs/how-to/pmo/pmo-dashboard.md
docs/reference/pmo/queue-status-dashboard-contract.md
docs/ops/implementation-plans/issue-3609-queue-status-dashboard-launch-packet.md
```

## 3. Classification (locked)

Explicit result kinds — **never** overload `classifyTeamQueue` → `null`:

```text
{ kind: 'team', team: 'operations' | 'engineering' | 'governance' }
{ kind: 'dataQuality', reason: 'missing-team' | 'multi-team' }
{ kind: 'excluded', reason: 'closed' | 'pull_request' | 'team-pmo' | 'pmo-task' }
```

| Input | Result |
| --- | --- |
| Closed | `excluded` (`closed`) |
| Pull request | `excluded` (`pull_request`) |
| `ops-pr-escalation` **or** `post-merge-failure` | `team` → operations |
| Exactly one of `team:operations` / `team:engineering` / `team:governance` | that team |
| `team:pmo` (not exception) | `excluded` (`team-pmo`) |
| `pmo:task` (not exception) | `excluded` (`pmo-task`) |
| Zero `team:*` | `dataQuality` (`missing-team`) |
| Multiple `team:*` | `dataQuality` (`multi-team`) |

Team tables: `kind: 'team'` only. Data quality: `kind: 'dataQuality'` only. Newest/oldest: `kind: 'team'` only. Excluded: omitted everywhere.

### Agent ownership (same as #3615)

Exactly one `agent:*` → display name; zero → `Unassigned`; multiple → conflict string. No body / `owner:*` / assignee override.

### Status display

First match: `status:*` → `ops:priority:*` / `eng:priority:*` → exception labels → empty.

## 4. Sections (locked)

1. Operations — open Issues (number/link, title, agent, team, status)  
2. Engineering — same  
3. Governance — same  
4. 10 Newest — number, agent, team, exact `created_at`  
5. 20 Oldest — number, agent, team, `created_at`, duration open (`generatedAt − created_at`)  
6. Data quality — missing-team / multi-team  

Header: `generatedAt`, `source: github-issues`.

## 5. JSON (locked)

`queue-status-data.json`: `source`, `generatedAt`, `repository`, `teams.{operations,engineering,governance}`, `newest`, `oldest`, `dataQuality`.  
`QueueIssue`: `number`, `title`, `htmlUrl`, `team`, `ownerAgent`, `statusLabel`, `createdAt`.

## 6. Event matrix (locked)

| Event | Rebuild? |
| --- | --- |
| `issues`: opened, reopened, closed, labeled, unlabeled, assigned, unassigned, edited | Yes |
| `issue_comment`: created | Yes |
| `pull_request`: opened, reopened, closed, labeled, unlabeled, assigned, unassigned | Yes |
| `pull_request`: synchronize | **No** (v1) |
| `pull_request_review` / `pull_request_review_comment` | **No** (v1; Product-accepted — membership unchanged) |
| schedule `*/30 * * * *` | Yes (fallback) |
| `workflow_dispatch` | Yes |

Loop prevention: artifact publish only. Concurrency: `pmo-dashboard-build-${{ github.repository }}`, cancel-in-progress.

## 7. Sequence after Go

| Order | Unit | Deliverable |
| --- | --- | --- |
| 1 | Classification + tests | `queue-status.mjs` + `test-queue-status.mjs` |
| 2 | Build + validate | Emit + validate `queue-status-data.json` |
| 3 | HTML surface | `queue-status.html` |
| 4 | Workflow | issue_comment + selected PR types; deploy artifact |
| 5 | Docs | How-to operator section |
| 6 | Verify | Dispatch build; confirm Pages URL |

**Implementation owner (post-Go):** Grok (`agent:grok`).  
**First executable child/action:** Unit 1 — classification module + tests, source Issue #3609.

## 8. Acceptance

Maps to Issue #3609 acceptance criteria, with Product-accepted v1 omissions: no synchronize rebuilds; no PR review-comment triggers.

## 9. Rollback

Revert implementation PR(s) or omit queue-status from deploy artifact. PMO book dashboard must remain healthy.

## 10. Handoff

Operators use `generatedAt`; Issues remain authority. Failures: PMO dashboard CI build logs.

## 11. Protected decisions

No Cloudflare Production site change; no bulk label mutation as part of build; reporting-only.

## 12. PMO Admin Graduation Go checklist

Before recording **Go**, PMO Admin confirms:

1. [x] Design feasible (Engineering 2026-09-28)  
2. [x] Launch packet complete (this file)  
3. [x] Reference contract present  
4. [x] Issue encoded as Pipeline parent at **graduation-candidate**  
5. [ ] Design PR **#4403** merged to `main` (design record)  
6. [ ] Active order `pmo:priority:<n>` chosen at Go  
7. [ ] Single start-to-finish owner confirmed: **Grok**  
8. [ ] First executable action confirmed: classification + tests  
9. [ ] Explicit **Go** comment on #3609  

**At Go, PMO Admin (only):**

```text
remove pmo:pipeline
remove pmo:pipeline-priority:*
remove pmo:stage:graduation-candidate
add pmo:active
add pmo:priority:<n>   # independent Active order
keep team:pmo, pmo, pmo:parent, agent:grok
```

Until Go, implementation PRs must not start under Active authority.
