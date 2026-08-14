---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Task Evidence
Owns: #2928 (#2781 Task 003) formal-rehearsal execution package — freeze, observe-only vs write-capable split, and deferred-entry dispositions
Does Not Own: Write-capable 10-journey remainder, Production mutation, Pipeline intake closeout for #2776/#2777/#2783/#2786/#2787, or #2929 GO/NO-GO
Canonical Reference: /docs/ops/reports/launch-rehearsal-execution-package-2928.md
Related Issues: #2928, #2781, #2926, #2927, #2929, #2818, #3382, #2784
Last Reviewed: 2026-08-14
---

# Launch rehearsal execution package — #2928

## Purpose

Keep the #2928 execution envelope current after Product/PMO freeze and the first
observe-only GET pass, without inventing write-capable authority or mutating
Production.

## Current known truth

| Field | Value |
| --- | --- |
| Parent | #2781 (Active P4; Cursor Local owns remaining chain #2928 → #2929) |
| This increment | Observe-only retest after isolated Preview D1 fixtures |
| Frozen candidate | `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` |
| Preview | `05568c3e-a56f-45d0-a3db-1298d9b7b80c` / `lgfc-litedev` |
| Isolation evidence | Satisfied on `origin/main` (#2818 CLOSED) |
| Observe-only executed | First pass 2026-08-14T12:52:02Z; retest 2026-08-14T13:11:00Z (12 journeys clean) |
| Write-capable executed | None |
| Production mutation | None |

Schema `ready: true` on the entry harness remains schema/package readiness only.

## Exact writable allowlist (this increment)

- `docs/ops/reports/launch-rehearsal-execution-package-2928.md`
- `docs/ops/reports/launch-rehearsal-execution-runbook-2928.md`
- `docs/ops/reports/launch-rehearsal-observe-only-evidence-2928.json`
- `docs/ops/reports/launch-rehearsal-observe-only-run-2928.md`
- `docs/ops/reports/launch-rehearsal-defect-ledger-2928.json`

Out of scope: wrangler, workflows, runtime, Production configuration.

## Freeze (applied)

```text
origin/main@87414533984aa9b5579b679fc8f9746b93517c5d
environment: Cloudflare Pages Preview bound to D1 lgfc-litedev
preview deployment: 05568c3e-a56f-45d0-a3db-1298d9b7b80c
preview URL: https://05568c3e.next-starter-template-6yr.pages.dev
```

Do not freeze the `component/launch-rehearsal` tip. That branch holds rehearsal
assets/runbooks only and still lacks Preview D1 isolation in `wrangler.toml`.

## Rehearsal scope split

From `docs/ops/reports/launch-rehearsal-journey-registry-2927.json` (22 journeys).

### Observe-only (executed this increment)

GET / read / contract-assert journeys; no POST; no `GET /api/matchup/current`:

- `anon-home-browse` — pass
- `anon-search` — pass
- `anon-error-fallback` — pass
- `member-unauthorized-access` — pass
- `fanclub-gallery-photo` — pass (unauthenticated)
- `fanclub-library` — pass (unauthenticated)
- `fanclub-memorabilia` — pass (unauthenticated)
- `content-media-rights-attribution` — fail then pass (D-2928-001 resolved)
- `fundraiser-enabled-state` — fail then pass (D-2928-002 resolved)
- `fundraiser-disabled-state` — pass
- `ops-deployment-monitoring` — pass
- `ops-evidence-closeout` — pass (subset)

### Write-capable / side-effect (not executed)

- `member-join-login`
- `member-logout-session-expiry`
- `fanclub-profile-card`
- `fanclub-discussion-submission`
- `content-publication-takedown`
- `email-notification-success`
- `email-notification-failure-contingency`
- `ops-incident-intake`
- `ops-rollback-recovery`
- `ops-operator-communication`

## Live entry-criteria dispositions (2026-08-14)

Satisfied:

- #2778, #2779, #2785, #2780, schema/harness, #2927 catalog
- #2818 isolation (CLOSED; isolated Preview D1 on `origin/main`)
- #2784 compliance project CLOSED
- #3382 Club Newspaper Phase 1 CLOSED
- Frozen SHA `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d`

Still deferred (Pipeline intake; **not** technical rehearsal-entry blockers per
PMO/Product 2026-08-14; carry forward into #2929 / #2782; do not waive or close):

| Issue | Live state | Owner |
| ---: | --- | --- |
| #2776 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline / PMO for #2929/#2782 |
| #2777 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline / PMO for #2929/#2782 |
| #2783 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline / PMO for #2929/#2782 |
| #2786 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline / PMO for #2929/#2782 |
| #2787 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline / PMO for #2929/#2782 |

## What this increment does not do

- Execute write-capable / side-effect journeys (next increment).
- Mutate Production D1 `lgfc_lite` or Production hostnames.
- Start #2929 GO/NO-GO or #2782.
- Close #2928.

## Successor

Observe-only set is clean after retest on the same frozen SHA. Next #2928
increment is the remaining 10 write-capable isolated journeys under the existing
runbook, with a new exact allowlist. Cleanup/rollback proof remains open. On
clean #2928 completion, proceed to #2929.
