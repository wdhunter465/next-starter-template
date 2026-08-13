---
Doc Type: Operations
Audience: Bill, WORK / PMO, Cursor, Day-2 Operations
Authority Level: Controlled
Owns: Phase 1 PMO dashboard CI redesign record — remove issue-event fan-out, single build→artifact→deploy path, schedule floor, and PR-gate isolation criteria
Does Not Own: Phase 2 debounced repository_dispatch, generator product redesign, Cloudflare production, or merge authority
Canonical Reference: /docs/how-to/pmo/pmo-dashboard.md
Related Issues: #3115, #3116, #3136, #3137
Last Reviewed: 2026-08-07
---

# PMO Dashboard Operations Redesign — Phase 1

## Purpose

Record the Phase 1 remediation that stops issue-event CI fan-out while keeping a dynamically refreshed GitHub Pages reporting snapshot.

## Problem (evidence)

After #3137 restored pre-#3115 workflows, both build and deploy listened to the same eight issue event types. One mutation could enqueue build + direct deploy regenerate + post-build deploy. Deploy ignored the build artifact, used `cancel-in-progress: false`, and competed for hosted runners with required PR gates (#3116 / #3114 incident class). Post-re-enable bursts still showed multi-cancel minutes.

## Phase 1 decision

Adopt Hybrid Phase 1 (scheduled floor + manual dispatch; no direct `issues:` triggers):

| Control | Before | After |
| --- | --- | --- |
| Issue events | Build + deploy | Removed |
| Schedule | Every 6 hours | Every 30 minutes |
| Publish path | Triple / regenerate on deploy | Build artifact → deploy via `workflow_run` |
| Deploy concurrency | `cancel-in-progress: false` | `true` |
| Manual path | Dispatch either | Prefer build; deploy dispatch regenerates only as fallback |

Phase 2 (debounced `repository_dispatch` for near-real-time bumps) remains deferred.

## Freshness contract

- Issues = live authority.
- Pages lag ≤ ~30 minutes under schedule (plus deploy), unless manually built.
- Operators check published `generatedAt` at meeting start.

## Rollback

1. Revert the Phase 1 PR, or
2. Set both workflows to `disabled_manually` via Actions API and/or re-apply #3115-style stubs.

## Validation intended for the implementing PR

- Diff limited to allowlisted workflow + how-to + this report.
- No `issues:` keys in either dashboard workflow.
- Deploy downloads artifact on `workflow_run`.
- Docs state the freshness contract.
- Post-merge: dispatch build once; confirm deploy succeeds from artifact; confirm no issue-label edit starts dashboard jobs.
---
