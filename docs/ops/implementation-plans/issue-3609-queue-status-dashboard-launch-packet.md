---
Doc Type: Implementation Plan / Launch Packet
Audience: Implementers (Grok), PMO, reviewers
Authority Level: Design lock for #3609 — preparation only until Product Graduation GO
Owns: Architecture, classification, event matrix, surface contract, child sequence, acceptance, rollback for the LGFC queue-status dashboard
Does Not Own: PMO portfolio book views, Production Cloudflare site content, priority decisions
Canonical parent: GitHub Issue #3609
Related: #3615 (PMO event refresh / agent ownership), PMO dashboard how-to
Last Reviewed: 2026-09-28
---

# Launch packet: LGFC queue-status dashboard (#3609)

## Status

**Graduation Candidate ready (design evidence complete).**  
This packet is sufficient for one implementer to execute start-to-finish after an explicit Product/PMO **Graduation GO**. It does **not** authorize implementation by itself.

Parent Issue remains Engineering-owned (`team:engineering`) per #3609 unless Product reclassifies into PMO Active. Stage language below is the **evidence bar**, not a claim that #3609 currently carries `pmo:stage:graduation-candidate`.

## 1. Purpose (locked)

Build a **queue-status operational dashboard** that lists open Issues in Operations, Engineering, and Governance with agent ownership, plus 10 newest and 20 oldest open Issues across those queues. Refresh primarily from repository events; schedule is fallback only.

This is **not** the PMO Active/Pipeline portfolio book. Do not apply PMO lifecycle placement rules to these team lists.

## 2. Architecture (locked)

| Decision | Choice |
| --- | --- |
| Surface | **Sibling** under GitHub Pages path `/pmo-dashboard/` (reuse CSS/visual language), new page `queue-status.html` |
| Data | New JSON `queue-status-data.json` generated alongside existing PMO dashboard output |
| Generator home | `scripts/pmo-dashboard/` (shared fetch/classify helpers; **separate** entry module `queue-status.mjs` + tests) |
| Deploy | Same artifact → Pages path as PMO dashboard (no dashboard commits → no refresh loop) |
| Primary workflow | Extend **PMO dashboard CI build** (or thin wrapper job in same workflow) so one event matrix rebuilds both surfaces |

**Rationale:** #3615 already solved event refresh, concurrency, artifact publish, and `agent:*` ownership. Duplicating a second workflow would diverge and risk loops. Sibling page keeps PMO book assumptions out of the queue-status UI.

### Paths (allowlist intent for implementation PRs)

```text
scripts/pmo-dashboard/queue-status.mjs
scripts/pmo-dashboard/test-queue-status.mjs
scripts/pmo-dashboard/static/queue-status.html
scripts/pmo-dashboard/static/queue-status.js   (optional if inline is simpler)
scripts/pmo-dashboard/build-dashboard.mjs      (wire generation)
scripts/pmo-dashboard/run-dashboard-build.mjs  (if needed)
scripts/pmo-dashboard/validate-dashboard.mjs   (validate new JSON)
.github/workflows/pmo-dashboard-ci-build.yml   (add PR events if missing)
.github/workflows/pmo-dashboard-ci-deploy.yml  (ensure artifact includes new files)
docs/how-to/pmo/pmo-dashboard.md               (operator section for queue-status)
docs/reference/pmo/queue-status-dashboard-contract.md  (JSON + classification contract)
```

## 3. Classification rules (locked)

Reuse and **extend** `classifyTeamQueue` semantics for the three team lists only (`operations` | `engineering` | `governance`). Ignore PMO parent buckets for list membership.

| Input | Team list |
| --- | --- |
| Open Issue, not a PR | Eligible |
| Closed / PR | Excluded |
| Labels include `ops-pr-escalation` **or** `post-merge-failure` | **Operations** (exception path; no `team:*` required) |
| Exactly one of `team:operations` / `team:engineering` / `team:governance` | That team |
| `team:pmo` only (Active/Pipeline parents) | **Excluded** from team lists |
| `pmo:task` | **Excluded** from team lists |
| Zero `team:*` and not exception | **Malformed** row (data-quality), not silent drop |
| Multiple `team:*` | **Malformed** row |

Newest/oldest pools = union of the three team lists **plus** malformed rows that are still open Issues (so data-quality stays visible). Optional: show malformed only in a small banner count; still include them in newest/oldest if classified as open queue-relevant. **Locked default:** malformed appear only under a **Data quality** subsection, not mixed into team tables; newest/oldest use **only** successfully classified team Issues.

### Agent ownership (locked — same as PMO #3615)

| Live labels | Display |
| --- | --- |
| Exactly one `agent:*` | Normalized name (Claude, Cursor, Grok, …) |
| Zero `agent:*` | `Unassigned` |
| More than one `agent:*` | `Conflicting agent ownership: …` |

Do not use body prose, `owner:*`, or GitHub assignees to invent ownership.

### Status display (locked)

Show a short status string from labels when present, else GitHub `state`:

Priority order of first match: `status:*` label → `ops:priority:*` / `eng:priority:*` → `post-merge-failure` / `ops-pr-escalation` → empty.

## 4. Sections and fields (locked)

1. **Operations — open Issues** — table: number (link), title, agent, team, status  
2. **Engineering — open Issues** — same  
3. **Governance — open Issues** — same  
4. **10 Newest Issues** — number, agent, team, exact `created_at` (ISO)  
5. **20 Oldest Issues** — number, agent, team, exact `created_at`, **duration open** = `generatedAt − created_at` human-readable (e.g. `12d 4h`)  
6. **Data quality** — count + rows for multi-team / missing-team open Issues that are not exceptions  

Header must show `generatedAt` (ISO) and source `github-issues`.

Sort: team tables by Issue number ascending; newest by `created_at` desc; oldest by `created_at` asc.

## 5. JSON contract (locked)

`queue-status-data.json` minimum shape:

```json
{
  "source": "github-issues",
  "generatedAt": "<ISO-8601>",
  "repository": { "owner": "...", "repo": "..." },
  "teams": {
    "operations": { "title": "Operations", "issues": [ /* QueueIssue */ ] },
    "engineering": { "title": "Engineering", "issues": [ /* QueueIssue */ ] },
    "governance": { "title": "Governance", "issues": [ /* QueueIssue */ ] }
  },
  "newest": [ /* QueueIssue + createdAt */ ],
  "oldest": [ /* QueueIssue + createdAt + durationOpen */ ],
  "dataQuality": [ /* QueueIssue + reason */ ]
}
```

`QueueIssue`:

```text
number, title, htmlUrl, team, ownerAgent, statusLabel, createdAt
```

Validator must reject missing identity/URL, non-`github-issues` source without flag, and wrong types.

## 6. Event matrix (locked)

| Event | Trigger rebuild? |
| --- | --- |
| `issues`: opened, reopened, closed, labeled, unlabeled, assigned, unassigned, edited | **Yes** (already on PMO build) |
| `issue_comment`: created | **Yes** (add if absent) |
| `pull_request`: opened, reopened, closed, labeled, unlabeled, assigned, unassigned, synchronize | **Yes** — queue status can change when PR merges/closes linked work; keep cheap (same full rebuild) |
| `pull_request_review` / `pull_request_review_comment` | **No** for v1 (comment on Issue path covers most ops need; reviews rarely change team queue membership) |
| `schedule` `*/30 * * * *` | **Yes** fallback |
| `workflow_dispatch` | **Yes** repair |
| `push` to dashboard scripts/docs | Feature-branch fixture validation only (existing pattern) |

**Loop prevention:** publish via Pages **artifact only** (existing deploy). Never commit generated HTML/JSON on main as part of the build.  
**Concurrency:** single group `pmo-dashboard-build-${{ github.repository }}`, `cancel-in-progress: true`.

## 7. Implementation plan and sequence

| Order | Child / work unit | Deliverable | Depends |
| --- | --- | --- | --- |
| 1 | Classification + unit tests | `queue-status.mjs` + `test-queue-status.mjs` covering team, exception, malformed, newest/oldest, duration | — |
| 2 | Wire into build + validate | Emit `queue-status-data.json`; validate schema | 1 |
| 3 | HTML/JS page | `queue-status.html` (+ JS), reuse PMO CSS | 2 |
| 4 | Workflow event matrix | Add `issue_comment` + selected `pull_request` types; confirm deploy artifact includes new files | 2–3 |
| 5 | Docs | Reference contract + how-to operator section + link from PMO dashboard how-to | 3 |
| 6 | Main verify | Manual dispatch build; confirm Pages URL + freshness | 4–5 |

**Intended implementation owner (post-GO):** **Grok** (Issue #3609 historical owner; Product may reassign).  
**First executable action after GO:** Child/work unit 1 — classification module + tests on a feature branch with source Issue #3609.

### Suggested child Issue titles (create after GO)

1. `TASK: #3609 queue-status classification + tests`  
2. `TASK: #3609 queue-status build wire + validate`  
3. `TASK: #3609 queue-status HTML surface`  
4. `TASK: #3609 queue-status workflow events + deploy paths`  
5. `TASK: #3609 queue-status Diátaxis docs`  

Implementation may collapse 1–3 into one PR if size stays small and allowlist stays tight; 4–5 may ship in the same PR if gates allow.

## 8. Acceptance (maps to #3609)

- [ ] Every open Operations / Engineering / Governance Issue (per §3) listed with agent or Unassigned  
- [ ] 10 newest / 20 oldest with required fields and duration  
- [ ] Exception labels land under Operations  
- [ ] Malformed multi-team / no-team surfaced under Data quality  
- [ ] Issue create/assign/close/label/comment and listed PR events trigger rebuild (or coalesce under concurrency)  
- [ ] Schedule remains fallback; no infinite commit loop  
- [ ] Live GitHub labels only for team/agent  
- [ ] Docs updated (reference + how-to)  
- [ ] Published URL reachable under `/pmo-dashboard/queue-status.html`  

## 9. Rollback / disable

1. Revert the implementation PR(s).  
2. Or remove `queue-status.*` from the deploy artifact path and stop linking the page.  
3. PMO book dashboard remains independent and must keep working if queue-status is disabled.

## 10. Operational handoff

- Operators use published `generatedAt` for freshness; GitHub Issues remain authority.  
- Meeting startup may open queue-status for team workload; PMO books stay on existing URLs.  
- Failures: check **PMO dashboard CI build** logs; same remediation path as PMO dashboard.

## 11. Protected decisions

- No Production Cloudflare website change.  
- No live bulk label mutation as part of this project.  
- No inventing ownership from chat.  
- Reporting-only; does not change queue policy.

## 12. Graduation checklist (evidence)

| Requirement | Evidence |
| --- | --- |
| Design documented | This file + §2–§6 |
| Linked children / sequence | §7 |
| Acceptance | §8 / Issue #3609 AC |
| Rollback | §9 |
| Handoff | §10 |
| Intended implementation owner | Grok (post-GO) |
| First executable action | Classification module + tests |
| Explicit GO | **Pending Product/PMO** — not granted by this document |

## 13. Same-day implementation guidance (after GO)

1. Open feature branch from `main`.  
2. Implement units 1–3 in one PR if reviewable; else split.  
3. Keep PR allowlist exact; issue-first #3609.  
4. Run `node scripts/pmo-dashboard/test-queue-status.mjs` and existing PMO fixture tests.  
5. Independent review + merge; dispatch build; verify Pages.  
