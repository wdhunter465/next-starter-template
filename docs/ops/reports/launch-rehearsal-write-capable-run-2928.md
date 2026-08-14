---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Task Evidence
Owns: #2928 (#2781 Task 003) write-capable isolated rehearsal run against the frozen isolated candidate
Does Not Own: Production mutation, Pipeline intake closeout, or #2929 GO/HOLD/ADJUSTMENT/NO-GO
Canonical Reference: /docs/ops/reports/launch-rehearsal-write-capable-run-2928.md
Related Issues: #2928, #2781, #2926, #2927, #2929
Last Reviewed: 2026-08-14
---

# Launch rehearsal write-capable run — #2928

## Purpose

Record the remaining 10 write-capable / side-effect journeys against Cloudflare
Pages Preview bound to `lgfc-litedev`, plus cleanup/rollback proof, after the
observe-only set was already clean on the same frozen SHA.

## Current known truth

| Field | Value |
| --- | --- |
| Frozen candidate | `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` |
| Environment | Cloudflare Pages Preview / D1 `lgfc-litedev` uuid `35232809-b4c1-4df9-9f39-2f178b13c378` |
| Preview deployment | `05568c3e-a56f-45d0-a3db-1298d9b7b80c` |
| Preview URL | `https://05568c3e.next-starter-template-6yr.pages.dev` |
| Executed at | 2026-08-14T13:27:06Z APIs; 2026-08-14T13:28:07Z CMS; 2026-08-14T13:28:20Z rollback |
| Executor | Cursor Local |
| Methods | Preview POST/GET for membership/profile/discussion; wrangler `d1 execute <preview-uuid> --remote` for CMS publish/takedown and cleanup |
| Forbidden | Production D1 `lgfc_lite` / uuid `22d0dc3e-ad34-43af-8e6a-2063df1a1e04`; Production hostnames; `GET /api/matchup/current`; live GitHub Operations Issue create |

## Results (10 write-capable journeys)

| Journey | Result |
| --- | --- |
| `member-join-login` | pass — POST `/api/join` 200 `joined`, POST `/api/login` 200, GET `/api/session/me` 200 |
| `fanclub-profile-card` | pass — GET/POST `/api/fanclub/profile` 200; screen_name `r2928wc-card` |
| `fanclub-discussion-submission` | pass — POST `/api/discussions/create` 200, discussion id 9 (later deleted) |
| `member-logout-session-expiry` | pass — POST `/api/logout` 200; GET `/api/session/me` 401 |
| `content-publication-takedown` | pass — Preview D1 published CMS key visible, then `block:null` after draft |
| `email-notification-success` | pass — join returned structured provider result `disabled` / `sent: false` |
| `email-notification-failure-contingency` | pass — disabled provider is recorded, not a silent drop |
| `ops-incident-intake` | pass — rehearsal-scoped record only (no live GitHub issue) |
| `ops-operator-communication` | pass — synthetic payload; no secret patterns |
| `ops-rollback-recovery` | pass — verify counts joins/members/discs/cms = 0 on `lgfc-litedev` |

## Notes

- Join used synthetic email `rehearsal.2928.writecapable@lgfc.invalid` and
  `email_opt_in: false`. Preview mail provider is `disabled`.
- `wrangler d1 execute lgfc-litedev --env preview` fails because this component
  `wrangler.toml` does not expose that name at top level. Isolated writes used
  Preview database uuid `35232809-b4c1-4df9-9f39-2f178b13c378` with `--remote`.
- Observe-only 12-journey evidence remains in
  `docs/ops/reports/launch-rehearsal-observe-only-evidence-2928.json`. Combined
  22-journey audit concatenates that file with this increment's evidence file.

## What this increment does not do

- Mutate Production D1 `lgfc_lite` or Production hostnames.
- Invent a #2929 GO/HOLD/ADJUSTMENT/NO-GO.
- Close Pipeline intake #2776/#2777/#2783/#2786/#2787.

## Successor

All 22 registry journeys now have evidence on the frozen SHA. #2928 may close
only after independent review/integration of this increment. On clean #2928
completion, proceed to #2929.
