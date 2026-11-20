---
Doc Type: Implementation Plan
Audience: Human + AI
Authority Level: Informational
Owns: Draft plan and open decisions for the Queue worklist dashboard (#4451)
Does Not Own: Queue and priority policy, label taxonomy, dashboard contract, any Product Authority decision or implementation Go
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #4451, #4447, #4070
Last Reviewed: 2026-11-20
---

# Plan draft: WORKLIST dashboard (#4451)

Status: decisions recorded 2026-11-20; superseded in detail by the reference contract and the generator pull requests.
Author: Claude Code (PMO). Date: 2026-11-20.

## What #4451 asks for

A manually configured WORKLIST dashboard that accounts for every open Issue and shows what each team queue works on next. Acceptance:

1. WORKLIST views and tier rules are documented under `docs/`.
2. Every open Issue has exactly one `team:*` label.
3. The dashboard shows per-queue order with the production-interrupt tier on top.

Tiers, highest first: (1) Production outage or degradation, (2) other `team:operations` exceptions, (3) `go-live-2027` overlay then per-queue order, (4) project work by PMO Active priority. Documents refer to role names, never agent names.

## Findings from live state (2026-11-20)

- 159 open Issues. `team:*` counts: operations 15, pmo 69, engineering 53, governance 20 (sum 157). Exactly two Issues carry no team label: **#5321** (has `agent:claude`, no team) and **#4428** (go-live P-15, `team:*` missing, `status:hold`). No Issue appears to carry two team labels. Acceptance 2 is therefore a two-label fix, not 29 as the 2026-10-05 text said.
- `scripts/pmo-dashboard/` already has `team-queue-counts.mjs`, `queue-label-contract.mjs` (the queue labels per team) and a generated Team queues page. It shows counts, not order.
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` already defines the Operations interrupt, role work order and the go-live overlay (#4447, closed). Tier rules should cite it, not restate it.
- `functions/api/admin/worklist.ts` and `admin_team_worklist` (migration 0024) are an unrelated admin task list in D1. The new dashboard must not reuse the name in code or touch D1. Call it the "Queue worklist" in docs to avoid confusion.
- Local `main` had a different `docs/ops/pmo/program-portfolio-worklist.md` (a Program 1 task list). Unrelated. Left alone.

## Proposed design

Reuse the existing static, GitHub-Pages-style generator; add one view. No D1, no Cloudflare, no workflow change in step 1.

1. **Source of truth:** live GitHub Issue labels only (the same read the Team queues page uses). No new data store.
2. **Rows:** one section per queue (operations, engineering, governance, pmo). Within a section, order by:
   1. Operations interrupt: `team:operations` with `ops:priority:1..4` (and `post-merge-failure`, `ops-pr-escalation`).
   2. Other `team:operations` exceptions (`ops-exception`).
   3. `go-live-2027` first, then the queue's own priority label (`eng:priority:*`, `gov:priority:*`, `ops:priority:*`; PMO by Active priority within parent).
   4. Held or waiting Issues (`status:hold`, `wait:*`) last, shown but marked.
3. **Per row:** number, title, queue-state label (`status:*`/`wait:*`), claim (`agent:*`), role name of the queue owner (from `AGENT-TEAM.md`, never an agent name in the sort or tier logic).
4. **Accounting check:** a footer line that total rows = open Issue count, and a list of any Issue with zero or more than one `team:*` label, so unlabeled work cannot hide.
5. **Manual, report-only:** generated on demand like the existing dashboard; nothing mutates labels.

## Delivery in three pull requests (one Issue each is not possible; #4451 is the single source Issue, so these are sequential PRs under it with keep-open dispositions)

| Step | Change | Profile |
| --- | --- | --- |
| A | Fix the two unlabeled Issues: #5321 and #4428 (label only, needs Product Authority to confirm the queue for each) | label edits, no PR |
| B | Docs: `docs/reference/pmo/queue-worklist-views-and-tiers.md` (views and tier rules, cites existing contracts) and a short how-to section in `docs/how-to/pmo/pmo-dashboard.md` | Model C docs; likely allowed namespaces |
| C | Code: `scripts/pmo-dashboard/` new `worklist-queues.mjs` + test, wired into `build-dashboard.mjs`; fixtures under `scripts/pmo-dashboard/fixtures/` | Development; confirm path allowlist and that `scripts/**` is not a protected stop |

Exact allowlists will be fixed in each PR body before any edit.

## Decisions (Product Authority, 2026-11-20, recorded on #4451)

1. #5321 goes to `team:operations`; #4428 goes to `team:engineering`. Labels applied.
2. The view is generated on demand. There is no override file; order changes by changing labels.
3. PMO is a section of the view, limited to standalone parents.
4. Published on the existing PMO dashboard site.

Delivery: the plan (this PR), the reference contract (docs PR #5385) and the generator (code PR #5386). Product Authority also set a standing rule that Claude Code recommends and proceeds with preparing pull requests; it does not lift protected stops or Production-tier merge approval.

## Out of scope and stops

No D1 or Cloudflare change, no workflow YAML, no label taxonomy change (that is #4070), no priority renumbering, no Production write. Any need for those becomes a separate Issue.

## Risks

- The sibling-priority rule means PMO order depends on parent context; a flat sort could mislead. Mitigation: show parent number beside PMO rows.
- Search-API rate limits on 159 Issues: use the paginated list call the existing generator already uses.
