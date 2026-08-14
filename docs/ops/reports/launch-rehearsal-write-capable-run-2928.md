---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2928 write-capable isolated rehearsal run narrative
Does Not Own: #2929 GO/HOLD/ADJUSTMENT/NO-GO; Production mutation
Canonical Reference: /docs/ops/reports/launch-rehearsal-write-capable-run-2928.md
Related Issues: #2928, #2781, #2927, #3442
Last Reviewed: 2026-08-14
---

# Launch rehearsal write-capable run — #2928

## Target

- Frozen candidate: `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d`
- Preview: `https://05568c3e.next-starter-template-6yr.pages.dev`
- D1: `lgfc-litedev` (`35232809-b4c1-4df9-9f39-2f178b13c378`) only
- Authority: CHAT PMO POST-#3440 EXECUTION HANDOFF (2026-08-14T13:21:29Z)

## Result

10/10 write-capable journeys evidenced as pass after two isolated Preview D1 schema remediations (same frozen SHA). Cleanup/rollback proof recorded. Production was not mutated. `GET /api/matchup/current` was not invoked.

| Journey | Result |
| --- | --- |
| `member-join-login` | fail then pass (D-2928-003) |
| `member-logout-session-expiry` | pass |
| `fanclub-profile-card` | pass |
| `fanclub-discussion-submission` | fail then pass (D-2928-004) |
| `content-publication-takedown` | pass |
| `email-notification-success` | pass (Preview mail provider disabled; skip logged) |
| `email-notification-failure-contingency` | pass |
| `ops-incident-intake` | pass (#3442 created then dedup-updated, then closed) |
| `ops-operator-communication` | pass (no secret patterns) |
| `ops-rollback-recovery` | pass |

## Isolated Preview remediations (not candidate code)

1. `ALTER TABLE join_requests` add `first_name`, `last_name`, `screen_name`, `email_opt_in` on `lgfc-litedev` only.
2. `ALTER TABLE submission_queue` add `ownership_statement`, `permission_statement`, `credit_preference`, `consent_status` on `lgfc-litedev` only.

Those ALTERs were retained after rollback so the frozen SHA can still run join/library on isolated Preview. Synthetic rows and observe-only fixtures were removed.

## Cleanup proof

- Synthetic join/member/session/discussion `id=8` / library submission `id=1` deleted on `lgfc-litedev`.
- Photos 829–848 title/description/tags restored empty; `home.campaign_spotlight` deleted.
- GitHub #3442 closed.
- Post-cleanup `POST /api/login` for the synthetic email returned 404 `Email not found.`
- Post-cleanup `GET /api/photos?limit=20` had 20 empty title/description rows; CMS campaign block was null.

## Out of scope

- Production hostnames and Production D1 `lgfc_lite`
- #2929 disposition
- Closing #2928 in this increment until independent review/merge of the evidence PR
