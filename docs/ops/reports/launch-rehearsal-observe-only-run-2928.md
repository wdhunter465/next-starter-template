---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Task Evidence
Owns: #2928 (#2781 Task 003) observe-only GET rehearsal run against the frozen isolated candidate
Does Not Own: Write-capable 22-journey execution, Production mutation, Pipeline intake closeout, or #2929 GO/HOLD/ADJUSTMENT/NO-GO
Canonical Reference: /docs/ops/reports/launch-rehearsal-observe-only-run-2928.md
Related Issues: #2928, #2781, #2926, #2927, #2929
Last Reviewed: 2026-08-14
---

# Launch rehearsal observe-only GET run — #2928

## Purpose

Record the first live #2928 rehearsal increment after Product/PMO freeze of the
isolated website candidate: observe-only GET journeys against Cloudflare Pages
Preview bound to `lgfc-litedev`.

## Current known truth

| Field | Value |
| --- | --- |
| Frozen candidate | `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` |
| Environment | Cloudflare Pages Preview / D1 `lgfc-litedev` |
| Preview deployment | `05568c3e-a56f-45d0-a3db-1298d9b7b80c` |
| Preview URL | `https://05568c3e.next-starter-template-6yr.pages.dev` |
| Executed at | 2026-08-14T12:52:02Z |
| Executor | Cursor Local |
| Methods | GET only |
| Forbidden | POST/PUT/PATCH/DELETE; `GET /api/matchup/current`; Production hostnames |

`origin/main` was still exactly this SHA at freeze time. No replacement SHA.

The unique Pages Preview deployment URL of that SHA was used. Production
`next-starter-template-6yr.pages.dev`, `www.lougehrigfanclub.com`, and the
later `cursor/2049-manual-evidence-review-2e48` branch alias were not used.

## Results (12 observe-only journeys)

| Journey | Result |
| --- | --- |
| `anon-home-browse` | pass |
| `anon-search` | pass |
| `anon-error-fallback` | pass |
| `member-unauthorized-access` | pass |
| `fanclub-gallery-photo` | pass (unauthenticated GET / API 401) |
| `fanclub-library` | pass (unauthenticated GET / API 401) |
| `fanclub-memorabilia` | pass (unauthenticated GET / API 401) |
| `content-media-rights-attribution` | fail — D-2928-001 |
| `fundraiser-enabled-state` | fail — D-2928-002 |
| `fundraiser-disabled-state` | pass |
| `ops-deployment-monitoring` | pass |
| `ops-evidence-closeout` | pass (subset) |

## Defects

See `docs/ops/reports/launch-rehearsal-defect-ledger-2928.json`. Both defects are
`deferred-with-owner` isolated Preview D1 / CMS fixture gaps. They are not
authorization to copy Production data or to mutate Production.

## What this increment does not do

- Execute the write-capable / side-effect 10-journey set.
- Treat observe-only as fully clean for automatic write-capable start.
- Close #2928 or start #2782.
- Invent a #2929 GO/HOLD/ADJUSTMENT/NO-GO.

## Successor

Write-capable isolated rehearsal remains the next #2928 increment, with a new
exact allowlist, after PMO/Product records whether D-2928-001/D-2928-002 block
that set or remain deferred fixture work. Cleanup/rollback proof remains open.
