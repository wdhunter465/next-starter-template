---
Doc Type: Reference
Audience: Product Authority, Operations, PMO, and implementation agents
Authority Level: Controlled
Owns: Design and ordered build plan for the 2027 fundraiser dashboard and the April 30 and May 31 checkpoint prizes (slice 1 of #4573)
Does Not Own: Fundraiser dates (calendar of record, #2093); Product decisions on #4415; Givebutter or Zapier configuration; credentials; prize items or rules wording; social announcements; Production changes
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4573, #2093, #4565, #4415, #4430, #4432, #4436, #4139, #4442, #4414, #4468
Last Reviewed: 2026-10-13
---

# 2027 fundraiser dashboard and checkpoint prizes: design and build plan

## Purpose

Product's approach to the long 2027 donation window (2027-03-25, 12:00 AM to 2027-06-07, 12:00 PM, $10,000 goal) is to keep the dates and add small prizes for the dashboard leaders at the end of April and the end of May. This document designs the dashboard and the two checkpoints, reconciles them with the existing fundraiser Issues, and lists the build Issues in dependency order with the date each must land.

It is design only. It writes no code, creates no Issue, and changes nothing in Givebutter, Zapier, D1 or Production. Every choice marked **Decision** belongs to Product Authority; the recommended default is what the build should assume if Product accepts it.

## Current known truth

- **Calendar of record (#2093, revised 2026-10-12, #4565):** launch 2027-03-25 at 12:00 AM; daily leaderboard and progress on LGFC.com and social until 2027-06-07 at 12:00 PM; then closeout (winners, final report, social announcement, thank-you messages). Registration opens and the "coming soon" announcement is 2027-02-01. No time zone is recorded yet.
- **Early donations** are allowed, not advertised, and count toward the June 7 total (Product, #4573).
- **Announcements** are Product posting on social media. The repository is not involved.
- **What exists in the repository today:**
  - `data/fundraiser.json` is a hand-edited list of three MLB teams at zero with 2026 timestamps. `src/lib/fundraiser.ts` ranks them by `points = total_amount × donor_count` (`docs/reference/architecture/fundraiser-leaderboard-data-contract.md`).
  - The homepage campaign spotlight (`src/lib/campaignSpotlight.ts`, `CampaignSpotlightCard.tsx`) is disabled and still says "ALS Fundraiser 2026", "$25,000" and "Launch target: April 1". It shows a top-3 "Top Teams" list and renders published snapshots only (`docs/reference/architecture/temporary-campaign-spotlight-data-contract.md`).
  - The daily "Fundraiser Details" feed (`/fundraiser-details`, D1-backed, admin create/delete) exists for the 2027-02-01 to 2027-03-01 posts.
  - There is no Givebutter integration, no participant registration code, no snapshot store, and no checkpoint or winner tooling.
- **Hard data boundary (#4139, Product 2026-08-19):** LGFC retains zero donor or user information from Givebutter. No donor names, emails, per-donor amounts or messages are stored, logged or used as test data.
- **Open fundraiser-model decisions** (participants versus teams, ranking formula, winner rule, prizes) sit on #4415 (P-01) and are not yet recorded.

## 1. Dashboard

### What visitors and participants see

One public page, recommended path `/fundraiser`, plus the existing homepage spotlight as a summary that links to it.

| Element | Shows | Notes |
| --- | --- | --- |
| Goal progress | Total raised, the $10,000 goal, a progress bar and percentage | Campaign-level total from Givebutter; includes early donations |
| Supporters | Count of supporters (donations), no names | Count only |
| Time remaining | Days left to 2027-06-07, 12:00 PM, and the next checkpoint countdown | Uses the one recorded time zone |
| Participant leaderboard | Rank, participant display name, amount raised, supporter count, link to the participant's Givebutter page | Top 10 on `/fundraiser`; top 3 on the homepage spotlight. Participants are fundraisers who registered, not donors. |
| Team view | Team name, amount raised, member count | Only if Product adopts Givebutter teams (Decision D4); hidden otherwise |
| Checkpoint panel | Current period standings and, after each cutoff, the published checkpoint winner and prize | See section 2 |
| Last updated | Time of the snapshot shown | Always visible |
| Donate and join | Links to the 2027 Givebutter campaign and its participant sign-up | URLs come from #4430 |

Before 2027-02-01 the page is hidden. From 2027-02-01 to 2027-03-24 it may show the goal, the participant roster at $0 and "Donations open March 25" (Decision D3 covers whether early donations are mentioned). After 2027-06-07, 12:00 PM it shows the final standings until the closeout report (#4436) replaces it.

### Data source

Givebutter owns donations and payments; the website owns display only (#4430). Two ways to get standings:

| Option | How | Cost and access | Fit |
| --- | --- | --- | --- |
| A. Givebutter API pull (recommended) | A scheduled job reads campaign totals and participant (and team) totals from the Givebutter API, keeps aggregate fields only, validates them, and writes a snapshot | Free Givebutter API; needs one Givebutter API key stored as a secret (Product approval, Decision D11) | Hourly updates with no operator work during the 70+ day window |
| B. Manual snapshot (fallback) | An operator exports participant totals from the Givebutter dashboard and imports a sanitized file through an admin page | No credential | Works if A is refused or Givebutter is down; one operator action per update |

Either way, the import keeps only these fields: participant public display name, Givebutter participant page slug, amount raised, supporter count, team name (if teams are used), campaign total, campaign supporter count, and the capture time. Anything else in the source is dropped before storage. The exact Givebutter API fields are confirmed in build Issue B3; this design does not assume a field it has not seen.

Snapshots are stored as aggregate rows (recommended: a D1 table of snapshots plus a table of checkpoint records, both in a new migration under B3). The page and the spotlight render the latest **published** snapshot only, keeping the existing spotlight rule. This replaces `data/fundraiser.json` for 2027.

### Refresh cadence

- **Website:** a new snapshot every hour from 2027-02-01 to 2027-06-07, 12:00 PM, and every 15 minutes in the last 24 hours before each checkpoint and the close (Decision D10).
- **Daily social update:** Product posts from the 10:00 AM snapshot each day, matching the existing 10:00 AM website-then-social convention. The repository does not post.
- **Scheduler:** GitHub Actions schedule or a Cloudflare cron, whichever B3 finds cheaper; both are within free tiers at this rate.

### Failure behavior

Fail closed, never show a wrong number:

- A snapshot is published only if the fetch succeeded, totals are non-negative, the participant list validates, and no field outside the allowed list is present. This keeps the publish conditions in `docs/how-to/ops/als-fundraiser-snapshots-and-publishing.md`. A snapshot whose campaign total is lower than the previous one (for example after a refund) is held for operator review instead of published.
- If a refresh fails, the page keeps the last published snapshot with its "Last updated" time.
- If the newest published snapshot is older than 3 hours, the page shows "Standings are being updated" above the last good numbers.
- If there is no valid published snapshot, or the campaign state is not active, the leaderboard and progress are hidden and only the Donate link remains (the current fail-closed "not configured" state).
- Two consecutive failed refreshes open one Operations Issue through the existing escalation path, and the job is added to `OPS — Scheduled Job Health` (#4468).

## 2. Checkpoint prizes (April 30 and May 31)

### What is ranked

Recommended default (Decision D5): **amount raised during the period**, by participant.

- Period 1: everything raised up to the April 30 cutoff, including early donations made before March 25 (Decision D6).
- Period 2: raised after the April 30 cutoff up to the May 31 cutoff, computed as the participant's total at the May cutoff minus their total at the April cutoff.

Ranking by period keeps people who join in May in the running. The June 7 final standings stay cumulative, so the overall winner rule on #4415 is unaffected.

The alternative is cumulative totals at each cutoff. It is simpler, but the April leader is likely to lead in May as well.

### Tie-break

In order: more supporters during the period; then whoever reached the tied amount first (from the hourly snapshots); then a Product decision recorded on #2093.

### Freezing a leader at the cutoff

- The cutoff is a fixed instant (recommended 11:59:59 PM Eastern on April 30 and May 31, Decision D2).
- A scheduled job takes a checkpoint snapshot at the cutoff and stores it as an immutable checkpoint record. Later snapshots never change it.
- Donations after the cutoff count toward the next period and the June 7 total only.
- A refund or chargeback after the cutoff does not change a frozen result unless Product decides otherwise (recommended: results stand except for fraud).
- If the checkpoint job fails, the first good snapshot after the cutoff is not used. Operations re-runs the capture from Givebutter totals as of the cutoff, or Product decides from the Givebutter dashboard, and the record notes which.

### Prize record

One record per checkpoint, kept as aggregate data with no personal data:

| Field | Meaning |
| --- | --- |
| `checkpoint` | `2027-04-30` or `2027-05-31` |
| `captured_at` | Cutoff snapshot time |
| `ranking` | Top entries from the frozen snapshot: display name, period amount, period supporters |
| `winner_display_name` | Public label approved by Product (Decision D8) |
| `prize_description` | Item supplied by Product (Decision D7) |
| `approved_by`, `approved_at` | Product Authority approval |
| `published_at` | When the website shows it |

Prize fulfilment (contacting the winner, shipping) happens outside LGFC systems. No address, email or phone number is stored. Contact goes through Givebutter's participant messaging or Product directly.

### Publishing past winners

- After the cutoff, the checkpoint panel shows "April standings are final; winner to be announced" until Product approves the record.
- Once approved, the panel shows each past checkpoint: winner display name, period amount, prize, and the date.
- Product announces on social. The website shows the record from the moment Product approves it (recommended 10:00 AM the next day, to line up with the daily post).

### Reuse for the closeout

The June 7, 12:00 PM final standings use the same freeze mechanism, so #4436's closeout tooling reuses the checkpoint record instead of building a second one.

## 3. Reconciliation with existing Issues

| Issue | Relationship | Action needed |
| --- | --- | --- |
| #4415 (P-01 fundraiser model) | Decisions 3, 4 and 6 (leaderboard unit, winner rule, prizes) overlap D4 to D9 below | Record the D-decisions on #4415 or #2093 together |
| #4430 (P-17 Givebutter campaign) | The participant leaderboard needs a peer-to-peer campaign with participant pages, and teams if D4 is yes | Create the 2027 campaign as peer-to-peer; record the campaign and sign-up URLs |
| #4432 (P-19 leaderboard pipeline) | This design is the detailed design for P-19. Its body still says the window ends 2027-06-02 | Implement as build Issues B3 and B4; correct the end date to 2027-06-07, 12:00 PM |
| #4436 (P-23 closeout) | Reuses the checkpoint freeze for the final standings. Its title still says 2027-06-02, 9:00 PM | Correct to 2027-06-07, 12:00 PM; depend on B5 |
| #4139 (Givebutter E2E qualification) | The trigger ("a live Givebutter integration exists") is met when B3 lands | Add to its scope: stale-snapshot banner, hidden-when-no-snapshot, checkpoint freeze immutability, and the zero-donor-PII field allowlist |
| #4442 (P-30 stale fundraiser docs) | `fundraiser-leaderboard-data-contract.md` (MLB teams, amount × donors) and `temporary-campaign-spotlight-data-contract.md` (2026) describe the old model | Mark them superseded by this design once D4 and D5 are decided, then update them to as-built in B9 |
| #4468 (Day-2 monitoring) | Snapshot freshness is a new scheduled job to watch | Add the snapshot job to `OPS — Scheduled Job Health` in B6 |
| #4417 (P-03 freeze scope) | Checkpoint publishing and winner records happen after the 2026-12-31 freeze | Record checkpoint publishing as an approved scheduled-content activity under the freeze exception |

## 4. Build plan

Constraints: Product decisions are due at the 2026-10-24 review (#2093); the fundraiser draft review package for Product is due 2026-12-15 (P-25); the freeze starts 2026-12-31; registration and the "coming soon" announcement are 2027-02-01. Everything below must be built and rehearsed before the freeze, so the February announcement needs only content.

Each Issue is package-complete: allowed paths, acceptance, protected stops and rollback stated when it is opened. None is created until Product reviews this plan.

| Order | Proposed Issue | Depends on | Must land by | Protected stops |
| --- | --- | --- | --- | --- |
| B1 | Record decisions D1 to D12 (on #4415 / #2093) | This plan | 2026-10-24 | Product only |
| B2 | Configure the 2027 Givebutter peer-to-peer campaign in draft; decide on the API key (#4430) | B1 | 2026-11-06 | Vendor account and credential: Product |
| B3 | Snapshot store and ingest: migration for snapshot and checkpoint tables (aggregates only), Givebutter API pull (or manual import), validation, field allowlist, tests proving no donor data (implements #4432) | B1, B2 | 2026-11-20 | Migration and secret need review; Production apply needs Go |
| B4 | Dashboard page `/fundraiser` and homepage spotlight wiring: progress, leaderboard, team view (if D4), time remaining, stale banner, hidden states, 2027 copy | B3 | 2026-12-04 | Public copy: Product |
| B5 | Checkpoint freeze, prize record, admin approval and publish; reused for the June 7 final standings | B3, B4 | 2026-12-11 | Winner publication: Product |
| B6 | Monitoring: snapshot freshness and checkpoint capture added to Scheduled Job Health, with the Operations escalation | B3 | 2026-12-11 | Workflow change: independent review |
| B7 | Prize and rules page content (eligibility, ranking, cutoffs, tie-break, prizes) | B1, B5 | 2026-12-15 (in the P-25 package) | Rules wording: Product |
| B8 | Qualification: #4139 E2E plus a rehearsed checkpoint freeze on Development with synthetic data | B4, B5, B6 | 2026-12-18 | No real donor data |
| B9 | Documentation to as-built: data contracts, snapshot procedure, closeout coupling (#4442) | B3 to B8 | 2026-12-22 | None |

After the freeze, only scheduled operations run: snapshots, the two checkpoint captures, and Product's approvals and posts.

## 5. Open decisions for Product

| ID | Decision | Recommended default |
| --- | --- | --- |
| D1 | Time zone for every calendar row | Eastern (America/New_York) |
| D2 | Exact April 30 and May 31 cutoff times | 11:59:59 PM Eastern on each date |
| D3 | Whether the March 25 calendar row mentions early donations | No; early donations stay unadvertised and simply count |
| D4 | Leaderboard unit: individual participants, teams, or both | Individual participants; add teams only if Givebutter teams are used |
| D5 | Checkpoint ranking: amount raised in the period, or cumulative total | Amount raised in the period |
| D6 | Do early donations count toward the April checkpoint | Yes, in period 1 |
| D7 | Prize items for each checkpoint (Product's Gehrig items) | One item per checkpoint, named before 2027-02-01 |
| D8 | Winner's public label | The participant's own Givebutter display name, shown only with their consent; otherwise first name and last initial |
| D9 | Winners per checkpoint, and whether one person can win both | One winner per checkpoint; repeat winners allowed |
| D10 | Refresh cadence | Hourly, every 15 minutes in the last 24 hours before each cutoff and the close |
| D11 | Data source | Givebutter API with one stored API key; manual snapshot as the fallback |
| D12 | Disclosure and giveaway rules wording | A short rules page (eligibility, what is ranked, cutoffs, tie-break, prize, no cash value, how winners are contacted) written or approved by Product, with review by someone familiar with contest rules |

Also inherited from #4415: the June 7 overall winner rule, and whether to keep the "amount × donors" points formula for the final standings. This design recommends plain amount raised there too, for one consistent rule.

## Not in this slice

No code, migration, Givebutter, Zapier or D1 change. No Issue is created from section 4 until Product reviews this plan on #4573.
