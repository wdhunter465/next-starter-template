---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Informational
Owns: The one-time cost and free-tier snapshot taken 2026-11-20 for #2076, with a heat map against the free-tier-crossing rule
Does Not Own: Vendor plans and renewals (the asset register), the storage policy (#2312), any tier change, billing, purchase or Cloudflare setting, or a recurring cost review
Canonical Reference: /docs/reference/platform/lgfc-asset-register.md
Related Issues: #2076, #2312, #5387
Last Reviewed: 2026-11-20
---

# Cost snapshot, 2026-11-20

## Purpose and basis

Product Authority decided on 2026-11-19 (#2076) that Claude Code produces one cost snapshot now, using the free-tier-crossing stop rule from #2312 as the threshold, with no recurring schedule. This is that snapshot. It is read-only: no plan, tier, billing or setting was changed.

The rule from #2312 is: if free-tier limits create risk, stop and surface a Product Authority decision before proceeding. For the heat map this report reads it as:

- **Red**: the service is at or within 10 percent of a free ceiling now, or has crossed it.
- **Yellow**: usage cannot be read, or is projected to cross within 90 days.
- **Green**: well under the ceiling and not projected to cross.

That reading is Claude Code's operational wording of the #2312 rule; Product Authority can change the percentages.

Plans, costs and renewals are in the vendor table of `docs/reference/platform/lgfc-asset-register.md` (recorded 2026-11-09) and are not repeated here. Ceilings below are the providers' documented free allowances as understood on 2026-11-20 and should be confirmed in each dashboard before any decision rests on them. Usage was read from the Cloudflare API and the Buffer connector on 2026-11-20. Account identifiers are not recorded here.

## Heat map

| Service | Measured use | Free ceiling | Share | Heat |
| --- | --- | --- | --- | --- |
| Cloudflare Pages builds | 497 deployments in November so far; 1,030 in the last 30 days; busiest day 211 | 500 builds a month | 99 percent of a month with 10 days left | **Red** (#5387) |
| Pages Functions requests | 133,020 in 30 days; busiest day 9,310 | 100,000 requests a day (shared Workers allowance) | about 9 percent of the daily ceiling | Green |
| Workers (`lgfc-agent-eval`) | 0 requests in 30 days | 100,000 requests a day | 0 percent | Green |
| D1 rows read | 6.7 million in 30 days; busiest day 797,213 | 5 million a day | 16 percent of the daily ceiling | Green |
| D1 rows written | 36,250 in 30 days; busiest day 8,820 | 100,000 a day | 9 percent of the daily ceiling | Green |
| D1 storage | 45 MB (`lgfc_lite`), 1.7 MB (`lgfc-litedev`) | 500 MB a database, 5 GB total | 9 percent | Green |
| R2 (`lgfc-d1-backups`) | 2.79 GB in 140 objects; 64 writes and 32 reads in 30 days | 10 GB storage | 28 percent | Yellow: growth rate not yet known |
| Backblaze B2 | 422 MB on 2026-11-09 (register); not re-read | 10 GB | 4 percent | Yellow: not re-read; archive intake can grow it quickly |
| Zapier | not readable through the connector | 100 tasks a month | unknown | Yellow |
| Buffer | 1 channel, 10 queued posts allowed | 3 channels, 10 queued posts | 33 percent of channels | Green |
| Elfsight social wall | not readable | views limit with a fallback panel | unknown | Yellow |
| MailChannels | not readable | free tier | unknown | Yellow |
| GitHub Actions | not measured; public repository | free minutes for public repositories | not applicable | Green |

## What drives growth

- **Website traffic**: Pages Functions requests and D1 rows read. Both are far under their ceilings today. The 2027 fundraiser and the 2027-03-25 contest window are the likely peaks.
- **Automation and agent activity**: Pages builds. Each push to any branch builds, and 2026-11 had up to 211 builds in a day. This is the one service at its ceiling.
- **Archive and media volume**: B2, D1 storage and R2 backups. The archive holds 163 pictures with more candidates arriving. D1 and B2 growth follow the #2312 policy (metadata in D1, binaries in B2).
- **Social tooling**: Buffer queued posts, Zapier tasks and Elfsight views grow with the posting plan.

## Findings

1. **Cloudflare Pages is at 497 of 500 builds for November.** All are `github:push` builds, with preview deployments enabled for every branch. A cap would block new builds, including the Production deploy, until 2026-12-01. Tracked as #5387 with options for Product Authority. No setting was changed.
2. **R2 backups are the next to watch.** 2.79 GB of 10 GB is held in 140 objects. One reading gives no growth rate; a second reading in about a month would show whether the backup retention keeps it under the ceiling.
3. **Several free services cannot be read from here** (Zapier, Elfsight, MailChannels, B2 live usage). Their usage needs a person to read the vendor dashboard, or a reader added later. They are Yellow for that reason only.
4. **Everything else read is far under its ceiling.**

## Lock-in and migration risk

- **Cloudflare** holds hosting, Functions, D1 and backups. A change to the Free plan terms would touch all four; D1 export and Pages static output keep the exit path short.
- **Backblaze B2** holds the media binaries; objects are portable (S3-compatible).
- **Zapier and Buffer** hold only posting automation and can be replaced by the scheduled hand-off job that opens `social-post` Issues.

## Escalation path

Any Red or a projected crossing goes to Product Authority as an Operations or Governance Issue before work proceeds, as #2312 requires. Claude Code opens the Issue; Product Authority decides on cost and Production settings. #5387 is the first.

## Limits of this snapshot

One point in time, read-only, no recurring schedule (Product Authority, 2026-11-19). It adds no decision and changes no policy.
