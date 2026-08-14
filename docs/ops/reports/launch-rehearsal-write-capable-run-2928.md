---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2928 write-capable isolated rehearsal run narrative
Does Not Own: #2929 GO/HOLD/ADJUSTMENT/NO-GO; Production mutation
Canonical Reference: /docs/ops/reports/launch-rehearsal-write-capable-run-2928.md
Related Issues: #2928, #2781, #2927, #3442, #3443
Last Reviewed: 2026-08-14
---

# Launch rehearsal write-capable run — #2928

## Purpose

Record the remaining 10 write-capable / side-effect journeys against Cloudflare
Pages Preview bound to `lgfc-litedev`, including fail/retest evidence for
D-2928-003 and D-2928-004, plus cleanup/rollback proof, after the observe-only
set was already clean on the same frozen SHA.

## Scope

Covers isolated Preview POST/GET membership, profile, discussion, library,
email-provider logging, rehearsal-scoped ops intake, and `lgfc-litedev`
rollback. It does not cover Production mutation, Pipeline intake closeout, or
#2929 GO/HOLD/ADJUSTMENT/NO-GO.

## Current known truth

| Field | Value |
| --- | --- |
| Frozen candidate | `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` |
| Environment | Cloudflare Pages Preview / D1 `lgfc-litedev` uuid `35232809-b4c1-4df9-9f39-2f178b13c378` |
| Preview deployment | `05568c3e-a56f-45d0-a3db-1298d9b7b80c` |
| Preview URL | `https://05568c3e.next-starter-template-6yr.pages.dev` |
| Executed at | 2026-08-14T13:25:12Z–13:29:30Z |
| Executor | Cursor Local |
| Authority | CHAT PMO POST-#3440 EXECUTION HANDOFF (2026-08-14T13:21:29Z); CHAT PMO ADMIN RECONCILIATION after #3443 merge |
| Methods | Preview POST/GET; wrangler `d1 execute` against Preview uuid `35232809-b4c1-4df9-9f39-2f178b13c378 --remote` |
| Forbidden | Production D1 `lgfc_lite` / uuid `22d0dc3e-ad34-43af-8e6a-2063df1a1e04`; Production hostnames; `GET /api/matchup/current` |

`wrangler d1 execute lgfc-litedev --env preview` is not usable from this
component branch's `wrangler.toml` (Production D1 only at top level). Isolated
writes used the Preview database uuid with `--remote`.

#3443 merged a parallel pass-only narrative (13:27:06Z–13:28:20Z) without
D-2928-003/004. This file keeps the fail/retest record that the ledger cites.
#2928 is not closed by #3443.

## Intended final state

All 10 write-capable journeys have pass evidence on the frozen SHA, with
D-2928-003 and D-2928-004 resolved after isolated Preview schema ALTERs and
retest. Cleanup/rollback of this increment's synthetic Preview rows is proven.
#2929 is not started from this report.

## Results (10 write-capable journeys)

10/10 write-capable journeys evidenced as pass after two isolated Preview D1
schema remediations (same frozen SHA). Cleanup/rollback proof recorded.
Production was not mutated. `GET /api/matchup/current` was not invoked.

| Journey | Result |
| --- | --- |
| `member-join-login` | fail then pass (D-2928-003) |
| `member-logout-session-expiry` | pass |
| `fanclub-profile-card` | pass |
| `fanclub-discussion-submission` | fail then pass (D-2928-004) |
| `content-publication-takedown` | pass |
| `email-notification-success` | pass (Preview mail provider disabled; skip logged) |
| `email-notification-failure-contingency` | pass (disabled recorded, not silent) |
| `ops-incident-intake` | pass (#3442 created then dedup-updated, then closed) |
| `ops-operator-communication` | pass (no secret patterns) |
| `ops-rollback-recovery` | pass |

## Isolated Preview remediations (not candidate code)

1. `ALTER TABLE join_requests` add `first_name`, `last_name`, `screen_name`, `email_opt_in` on `lgfc-litedev` only.
2. `ALTER TABLE submission_queue` add `ownership_statement`, `permission_statement`, `credit_preference`, `consent_status` on `lgfc-litedev` only.

Those ALTERs were retained after rollback so the frozen SHA can still run
join/library on isolated Preview. Synthetic rows and observe-only fixtures were
removed.

## Cleanup proof

- Synthetic join/member/session/discussion `id=8` / library submission `id=1` deleted on `lgfc-litedev`.
- Photos 829–848 title/description/tags restored empty; `home.campaign_spotlight` deleted.
- GitHub #3442 closed.
- Post-cleanup `POST /api/login` for the synthetic email returned 404 `Email not found.`
- Post-cleanup `GET /api/photos?limit=20` had 20 empty title/description rows; CMS campaign block was null.

## What this increment does not do

- Mutate Production hostnames or Production D1 `lgfc_lite`
- Invent a #2929 GO/HOLD/ADJUSTMENT/NO-GO
- Close #2928 until this evidence PR is independently reviewed/merged
