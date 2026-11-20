---
Doc Type: Reference
Audience: Human + AI
Authority Level: Contract
Owns: The views, ordering tiers and accounting checks of the Queue worklist (#4451)
Does Not Own: Queue and priority semantics, the Operations interrupt, the go-live overlay, label definitions, PMO lifecycle, or any Issue's content
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #4451, #4447, #4981
Last Reviewed: 2026-11-20
---

# Queue worklist: views and tiers

## Purpose

The Queue worklist is a read-only, generated view that accounts for every open Issue and shows what each team queue works on next. It is separate from the PMO book views, which report Pipeline development and Active programs. It does not decide priority and changes no label. GitHub Issues remain the only source of truth.

In code and documents call it the "Queue worklist". The admin `worklist` route and the `admin_team_worklist` table are an unrelated administrator task list and are not part of this view.

The ordering rules below only point at definitions owned elsewhere. When they differ, `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` and `docs/governance/OPERATIONS-AND-RECOVERY.md` win.

## Views

One section per queue, in this order: Operations, Engineering, Governance, PMO. Each section lists open Issues that belong to that queue and nothing else (an Issue appears once). Names are role names. An agent name is shown only in the claim column.

| Queue | Membership |
| --- | --- |
| Operations | `team:operations`, or an Operations exception label (`ops-pr-escalation`, `post-merge-failure`) |
| Engineering | `team:engineering` |
| Governance | `team:governance` |
| PMO | Standalone `team:pmo` parents with exactly one of `pmo:active` or `pmo:pipeline` |

Project children (`pmo:task`, a parent reference or a `PROJECT:` title) are counted but not listed as queue rows, as `docs/how-to/pmo/pmo-dashboard.md` already does for the team tiles (#4981). They appear under their parent in the PMO book views.

## Ordering tiers

Within a queue section, rows sort by tier, highest first. A row takes the highest tier it qualifies for.

| Tier | Rows | Defined by |
| --- | --- | --- |
| 1 | Operations interrupt: `team:operations` with `ops:priority:1` to `ops:priority:4`; Operations exception labels | `WORK-QUEUES-AND-COLLABORATION.md` (Operations interrupt) |
| 2 | Other `team:operations` Issues, including `ops-exception` | `OPERATIONS-AND-RECOVERY.md` |
| 3 | `go-live-2027` Issues first, then the queue's own priority label (`eng:priority:*`, `gov:priority:*`, `ops:priority:*`); within PMO, `pmo:priority:*` under the same parent | Go-live precedence overlay (#4447) |
| 4 | Remaining Issues in queue-priority order | The queue's own priority label |
| Held | `status:hold`, `ops:hold`, `gov:hold`, `wait:*`, `wait:product`: listed last and marked, not hidden | Queue-state labels (#4982) |

Tier 1 and 2 apply only to the Operations section. The Operations interrupt is repository-wide, so a Tier 1 row is also shown in a banner at the top of the page. `ops:monitoring` and `ops:hold` do not interrupt.

Priority numbers are sibling order under the same parent, never a repository-wide rank. The view therefore never merges two queues into one ranked list.

## Row fields

Number (linked), title, queue-state label (`status:*` or `wait:*`), claim (`agent:*`), priority label shown as written, and for PMO rows the parent number.

## Accounting checks

The footer states, from the same data:

1. Total open Issues listed plus project children equals the open Issue count.
2. Open Issues with no `team:*` label, and open Issues with more than one `team:*` label. Both lists are empty when the repository is correct.
3. Project children that carry a `team:*` label. The queue-label contract expects none (`scripts/pmo-dashboard/queue-label-contract.mjs`, role `task`). The check lists them for the PMO Admin to correct and does not alter them.

Every open Issue that is not a project child carries exactly one `team:*` label. Project children take their queue from their parent and carry none.

## Refresh and publication

Generated on demand by the existing PMO dashboard build and published on the existing PMO dashboard site, as described in `docs/how-to/pmo/pmo-dashboard.md`. No database, Cloudflare setting or workflow is involved. Ordering is computed from labels; there is no hand-edited override file. A different order is made by changing the Issue's labels.

## Limits

The view reports. It does not claim Issues, set priority, advance lifecycle or move work between queues. Those stay with the roles in `docs/governance/AGENT-TEAM.md`.
