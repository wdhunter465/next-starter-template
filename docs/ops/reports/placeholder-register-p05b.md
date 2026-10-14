---
Doc Type: Report
Audience: Human + AI
Authority Level: Supporting (register for Product Authority review; not a Go packet row)
Owns: Placeholder and sample content register for go-live task P-05b (#4419): each remaining item, where it lives, its disposition and how it was verified
Does Not Own: Any code, data or migration change, the authenticated-page sweep (needs member and admin accounts, P-09), or the Go packet
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4419, #4414, #4411, #4409, #4422, #4431, #4432
Last Reviewed: 2026-10-14
---

# Placeholder register (go-live P-05b)

## Status

`_DRAFT` — repository read only, 2026-10-14. Dispositions marked *proposed* need Product Authority agreement. Nothing in this file changes code, data or a migration, and no Production query was run. Checks were made against `main`.

## What is already done

#4411 removed the sample events and the sample milestone from Production and Development, and removed the "Seed next 10 placeholders" admin button and `POST /api/admin/events/seed-next10` (verified 2026-10-05). A sweep of 16 public routes and 12 public data endpoints on 2026-10-05 found no placeholder text in the static HTML.

## Register

| # | Item | Where | Reaches a visitor? | Disposition | Verification |
| --- | --- | --- | --- | --- | --- |
| 1 | "Link coming soon" for a friend with no URL | `src/components/FriendsOfFanClub.tsx:124` | Only if a friend is added without a URL. All 8 have URLs. | Kept with reason: the branch is a guard, not shown today. *Proposed:* require a URL where friends are entered, then remove the branch after launch. | Issue sweep 2026-10-05 found no hit; branch read in source |
| 2 | "[ Photo & memorabilia feature — coming soon ]" and the halftone placeholder frame | `src/components/fanclub/ClubHomeMediaFeature.tsx:62` (member-only Club Home); halftone helper `clubHomePhotoPlaceholder` in `src/components/fanclub/clubHomeStyles.ts:101` | Yes, to a signed-in member when no media is available | *Proposed:* replace the label with neutral copy that does not promise a feature (for example, a plain "Browse the gallery" panel). Needs a Product Authority copy decision and a code PR. | Branch read in source; a member-account check is item 8 |
| 3 | 2026 campaign defaults ("ALS Fundraiser 2026", $25,000, "Launch target: April 1", 2026 Givebutter URLs) and the `/charities` placeholder CTA guard | `src/lib/campaignSpotlight.ts` | Yes, when no 2027 campaign is configured | Replaced by P-18 (#4431) once the 2027 campaign exists (P-17, #4430). Kept until then. | Tracked on #4431 |
| 4 | Sample MLB teams at zero with 2026 timestamps (3 teams) | `data/fundraiser.json`, imported by `src/lib/fundraiser.ts:1` and read by `src/lib/campaignSpotlight.ts` and `src/app/admin/fundraiser-preview/page.tsx` | Possibly: the campaign spotlight leaderboard can fall back to this file | Replaced by P-19 (#4432). Kept until then. Whether a visitor can see the fallback while the fundraiser is inactive is not confirmed here; P-19 should check it. | Import chain read in source |
| 5 | `data/mock-posts.json`, `data/mock-weekly.json` | `data/` | No. Nothing in `src/`, `functions/`, `scripts/` or `.github/` references either file. | Confirmed not user-visible. *Proposed:* delete both in a later cleanup PR so they cannot be wired in by mistake. | Repository-wide search for both names returned no reference |
| 6 | Fixture rows marked "fixture placeholder" (27 rows) | `data/research/lou-gehrig-content-candidates.json` | No by code path. Only the manual CLI `scripts/content-pipeline/import-seed-candidates.mjs` can load it, and its default `--file` is this one. The Production workflows pass other files (`...external-discovery.json`, `...wikimedia-approved-batch-2026-08-17.json`). | Confirmed not loaded by any workflow. *Proposed:* keep the file but rename the default in the CLI, or require `--file`, so a bare run cannot import fixtures into Production. | Searched all workflows for the filename: none. To prove it never reached Production, a read-only query of `content_items` for the fixture ids needs a Product Authority Go. |
| 7 | Sample rows created on a fresh database by migrations `0009_page_content_seed.sql`, `0015_milestones.sql`, `0028_seed_events_next10.sql` | `migrations/` | No. Applied migrations do not re-run on Production or Development. | Left as history with reason. Migrations are immutable once applied. `0028` seeds only when no posted events exist and #4411 deleted the rows it created. A rebuild from migrations would recreate sample events and must be followed by the #4411 cleanup. *Proposed:* note that rule in the restore runbook. | Migration text read; #4411 verification |
| 8 | Member-only pages (Club Home, `/fanclub/*`), admin pages, welcome email, membership card content | Authenticated routes; email templates | Unknown | **Open.** Needs a member and an admin test account (P-09, #4422). Not checked from the repository alone. | Not started |

## Result

| Disposition | Items |
| --- | --- |
| Confirmed not user-visible | 5, 6 (by code path), 7 |
| Kept with reason | 1, 3, 4 (until P-18 and P-19 replace them) |
| Proposed change, needs Product Authority | 2, and the cleanups proposed on 1, 5, 6 and 7 |
| Open | 8 |

The acceptance criteria on #4419 are not all met: item 8 (authenticated pages and email templates) needs the test accounts, and the "written register" criterion is met by this file once Product Authority agrees the dispositions.

## Decisions for Product Authority

| # | Question | Recommended answer |
| --- | --- | --- |
| 1 | Replace the Club Home "coming soon" label with neutral copy (item 2)? | Yes, one small code PR |
| 2 | Delete `mock-posts.json` and `mock-weekly.json` (item 5)? | Yes |
| 3 | Make the seed-candidates CLI require `--file` (item 6)? | Yes |
| 4 | Authorize a read-only Production query to prove no fixture candidate was ever imported (item 6)? | Yes, one `SELECT`, logged on #4419 |
| 5 | Add the "rebuild from migrations needs the #4411 cleanup" note to the restore runbook (item 7)? | Yes |

## Validation

Valid when Product Authority records answers on #4419 and item 8 is swept with real accounts.

## Rollback

Revert this documentation commit. No system state is created.
