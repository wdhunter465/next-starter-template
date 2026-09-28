---
Doc Type: Implementation Plan / Launch Packet
Audience: Implementers (Grok), PMO, reviewers
Authority Level: Design lock for #3609 — preparation only; Engineering No-Go for PMO Active (2026-09-28)
Owns: Architecture, classification, event matrix, surface contract, child sequence, acceptance, rollback for the LGFC queue-status dashboard
Does Not Own: PMO portfolio book views, Production Cloudflare site content, priority decisions, Graduation Go
Canonical Reference: GitHub Issue #3609; docs/reference/pmo/queue-status-dashboard-contract.md
Related: #3615 (PMO event refresh / agent ownership), PMO dashboard how-to, PR #4403
Last Reviewed: 2026-09-28
---

# Launch packet: LGFC queue-status dashboard (#3609)

## Status

**Design feasible. PMO Graduation into Active: No-Go (Engineering review 2026-09-28).**

This packet is the design record for implementation under **Engineering start authority** once Product records that path, or after a future real PMO Pipeline parent carries `pmo:stage:graduation-candidate` and an explicit Graduation Go. It does **not** authorize Active implementation and does **not** claim #3609 currently holds graduation-candidate or Active labels.

Parent Issue remains Engineering-owned (`team:engineering`) per #3609 unless Product reclassifies it.

## 1. Purpose (locked)

Build a **queue-status operational dashboard** that lists open Issues in Operations, Engineering, and Governance with agent ownership, plus 10 newest and 20 oldest open Issues across those queues. Refresh primarily from repository events; schedule is fallback only.

This is **not** the PMO Active/Pipeline portfolio book. Do not apply PMO lifecycle placement rules to these team lists.

## 2. Architecture (locked)

| Decision | Choice |
| --- | --- |
| Surface | **Sibling** under GitHub Pages path `/pmo-dashboard/` (reuse CSS/visual language), new page `queue-status.html` |
| Data | New JSON `queue-status-data.json` generated alongside existing PMO dashboard output |
| Generator home | `scripts/pmo-dashboard/` (**separate** module `queue-status.mjs` + tests; may share label helpers, not `classifyTeamQueue` return semantics) |
| Deploy | Same artifact → Pages path as PMO dashboard (no dashboard commits → no refresh loop) |
| Primary workflow | Extend **PMO dashboard CI build** so one event matrix rebuilds both surfaces |

**Rationale:** #3615 already solved event refresh, concurrency, artifact publish, and `agent:*` ownership. Sibling page keeps PMO book assumptions out of the queue-status UI.

### Paths (allowlist intent for implementation PRs)

```text
scripts/pmo-dashboard/queue-status.mjs
scripts/pmo-dashboard/test-queue-status.mjs
scripts/pmo-dashboard/static/queue-status.html
scripts/pmo-dashboard/static/queue-status.js   (optional if inline is simpler)
scripts/pmo-dashboard/build-dashboard.mjs      (wire generation)
scripts/pmo-dashboard/run-dashboard-build.mjs  (if needed)
scripts/pmo-dashboard/validate-dashboard.mjs   (validate new JSON)
.github/workflows/pmo-dashboard-ci-build.yml   (add issue_comment + selected PR types)
.github/workflows/pmo-dashboard-ci-deploy.yml  (ensure artifact includes new files)
docs/how-to/pmo/pmo-dashboard.md               (operator section for queue-status)
docs/reference/pmo/queue-status-dashboard-contract.md
```

## 3. Classification rules (locked)

**Do not reuse `classifyTeamQueue` null as a catch-all.** That function’s `null` today means excluded (`pmo:task`, closed, PR) *or* non-team. Queue-status must return an explicit result:

```text
{ kind: 'team', team: 'operations' | 'engineering' | 'governance' }
{ kind: 'dataQuality', reason: 'missing-team' | 'multi-team' }
{ kind: 'excluded', reason: 'closed' | 'pull_request' | 'team-pmo' | 'pmo-task' }
```

| Input | Result |
| --- | --- |
| Closed Issue | `excluded` (`closed`) |
| Pull request | `excluded` (`pull_request`) |
| Labels include `ops-pr-escalation` **or** `post-merge-failure` | `team` → **operations** |
| Exactly one of `team:operations` / `team:engineering` / `team:governance` | `team` → that team |
| `team:pmo` (and not exception) | `excluded` (`team-pmo`) |
| `pmo:task` (and not exception) | `excluded` (`pmo-task`) |
| Zero `team:*` and not exception | `dataQuality` (`missing-team`) |
| Multiple `team:*` | `dataQuality` (`multi-team`) |

**Locked UI placement:** team tables get only `kind: 'team'`. **Data quality** subsection gets only `kind: 'dataQuality'`. Newest/oldest use **only** `kind: 'team'` Issues. Excluded rows are omitted from all sections.

### Agent ownership (locked — same as PMO #3615)

| Live labels | Display |
| --- | --- |
| Exactly one `agent:*` | Normalized name (Claude, Cursor, Grok, …) |
| Zero `agent:*` | `Unassigned` |
| More than one `agent:*` | `Conflicting agent ownership: …` |

Do not use body prose, `owner:*`, or GitHub assignees to invent ownership.

### Status display (locked)

First match: `status:*` label → `ops:priority:*` / `eng:priority:*` → `post-merge-failure` / `ops-pr-escalation` → empty.

## 4. Sections and fields (locked)

1. **Operations — open Issues** — number (link), title, agent, team, status  
2. **Engineering — open Issues** — same  
3. **Governance — open Issues** — same  
4. **10 Newest Issues** — number, agent, team, exact `created_at` (ISO)  
5. **20 Oldest Issues** — number, agent, team, exact `created_at`, **duration open** = `generatedAt − created_at` (e.g. `12d 4h`)  
6. **Data quality** — missing-team / multi-team open Issues  

Header: `generatedAt` (ISO), `source: github-issues`.

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

`QueueIssue`: `number`, `title`, `htmlUrl`, `team`, `ownerAgent`, `statusLabel`, `createdAt`.

Validator must reject missing identity/URL, non-`github-issues` source without flag, and wrong types.

## 6. Event matrix (locked)

| Event | Trigger rebuild? |
| --- | --- |
| `issues`: opened, reopened, closed, labeled, unlabeled, assigned, unassigned, edited | **Yes** (already on PMO build) |
| `issue_comment`: created | **Yes** (add if absent) |
| `pull_request`: opened, reopened, closed, labeled, unlabeled, assigned, unassigned | **Yes** |
| `pull_request`: **synchronize** | **No** (v1) — every push rebuild is waste; does not change queue membership |
| `pull_request_review` / `pull_request_review_comment` | **No** (v1) — team membership does not change; Product may re-open later |
| `schedule` `*/30 * * * *` | **Yes** fallback |
| `workflow_dispatch` | **Yes** repair |
| `push` to dashboard scripts/docs | Feature-branch fixture validation only |

**Loop prevention:** Pages **artifact only**. Never commit generated HTML/JSON on main as part of the build.  
**Concurrency:** `pmo-dashboard-build-${{ github.repository }}`, `cancel-in-progress: true`.

## 7. Implementation plan and sequence

| Order | Work unit | Deliverable | Depends |
| --- | --- | --- | --- |
| 1 | Classification + unit tests | `queue-status.mjs` + tests: team, exception, dataQuality, excluded, newest/oldest, duration | — |
| 2 | Wire into build + validate | Emit `queue-status-data.json`; validate schema | 1 |
| 3 | HTML/JS page | `queue-status.html` (+ JS), reuse PMO CSS | 2 |
| 4 | Workflow event matrix | `issue_comment` + selected PR types (**not** synchronize); deploy artifact includes new files | 2–3 |
| 5 | Docs | How-to operator section + link from PMO dashboard how-to | 3 |
| 6 | Main verify | Manual dispatch; confirm Pages URL + freshness | 4–5 |

**Intended implementation owner (after start authority):** **Grok**.  
**First executable action:** Work unit 1 — classification module + tests on a feature branch with source Issue #3609.

## 8. Acceptance (maps to #3609)

- [ ] Every open Operations / Engineering / Governance Issue (per §3) listed with agent or Unassigned  
- [ ] 10 newest / 20 oldest with required fields and duration  
- [ ] Exception labels land under Operations  
- [ ] Missing-team / multi-team under Data quality (not silent omit)  
- [ ] Issue create/assign/close/label/comment and listed PR events trigger rebuild (or coalesce)  
- [ ] No `synchronize`-driven rebuilds in v1  
- [ ] Schedule remains fallback; no infinite commit loop  
- [ ] Live GitHub labels only for team/agent  
- [ ] Docs updated  
- [ ] Published URL under `/pmo-dashboard/queue-status.html`  

## 9. Rollback / disable

1. Revert the implementation PR(s).  
2. Or omit `queue-status.*` from the deploy artifact and stop linking the page.  
3. PMO book dashboard must keep working if queue-status is disabled.

## 10. Operational handoff

- Operators use published `generatedAt`; GitHub Issues remain authority.  
- Failures: **PMO dashboard CI build** logs; same remediation path as PMO dashboard.

## 11. Protected decisions

- No Production Cloudflare website change.  
- No live bulk label mutation.  
- No inventing ownership from chat.  
- Reporting-only.

## 12. Graduation / start authority (Engineering review 2026-09-28)

| Path | Requirement |
| --- | --- |
| **PMO Active graduation** | **No-Go** until: Product chooses PMO path; Issue holds `pmo:stage:graduation-candidate`; at Go: `pmo:active` + `pmo:priority:<n>`; design docs merged on main |
| **Engineering start** | Product records Engineering start authority on #3609; design PR #4403 merged as design record; first action remains classification + tests (Grok) |

**Explicit Graduation Go is not granted by this document or by PR #4403.**

## 13. Path after Product chooses authority

1. Merge design PR #4403 (design record only).  
2. Product records Engineering start **or** completes PMO Pipeline labels + Graduation Go.  
3. Implement units 1–N; independent review; dispatch build; verify Pages.  
