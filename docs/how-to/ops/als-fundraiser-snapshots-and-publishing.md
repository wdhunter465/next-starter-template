---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Snapshot publishing procedures for ALS fundraiser data
Does Not Own: Campaign data structure; homepage layout rules; the 2027 dates themselves (owned by the calendar of record)
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #4442, #4432, #4436, #4414, #4565
Last Reviewed: 2026-10-27
---

# Snapshot Publishing Procedure

Last Updated: 2026-11-18

## Status of this procedure

The first version (2026-03-08) described the **2026** campaign. The 2027 campaign has different dates. The dates below come from the Product-approved calendar of record in `docs/reference/operations/2027-launch-calendar-operating-contract.md`. This document does not set or change a date.

Recorded on #4415 and #4432 and used below:

- The staged admin preview is sample-only until the LiveLikeLou/Givebutter access hold is released.
- Givebutter remains the future live source of truth, but this procedure does not call Givebutter, require an API key,
  create a Cloudflare variable, write D1, or write Production.
- Standings are individual participants plus an overall total. MLB-team placeholder rows are not used.
- Three boards are calculated from aggregate participant totals:
  - **Funding the Fight**: most funds raised.
  - **Raising Awareness**: most donors.
  - **Champion**: dollars raised plus donors.
- The counting window is donations dated 2027-03-25 through 2027-06-07, 11:59 PM Eastern
  (`America/New_York`).
- Tie-breaks are pending final Product confirmation on #4415. Until then, the dry run uses a deterministic placeholder:
  stable ordering by participant display name.

Two things stay open, and this procedure does not guess them:

- the live Givebutter access release and source configuration;
- the final daily progress post wording and social publishing mechanics.

Bill has not chosen whether noon on 2027-06-07 publishes the fundraiser total only, with the auction total afterward, or whether the combined report waits until the morning of 2027-06-08. Winner publication still waits for his approval (#4436).

## 2027 snapshot window

From the calendar of record:

| Date or window | What happens |
| --- | --- |
| 2027-03-25, 12:00 AM | Fundraiser launches (donations open) |
| 2027-03-25 to 2027-06-07, 11:59 PM Eastern | One daily leaderboard and progress update toward the $10,000 total donation goal, on LGFC.com and on social |
| 2027-06-07, 11:59 PM Eastern | The dry-run counting window ends. Freeze the fundraiser total and leaderboard snapshot for Product review |
| After 2027-06-07, 11:45 PM Eastern | The auction closes. Winners and any report that includes the auction total wait for Bill's choice of timing, then for his approval, before publication |

No snapshot is published before 2027-03-25. A date not in the calendar of record is not used until Product Authority records a replacement on #2093.

## 2026 cadence (historical, not the 2027 plan)

The 2026 campaign used these snapshot frequencies. They are kept for reference only.

- May 1 to May 25: every 12 hours
- May 26 to June 2: hourly
- June 3: final standings snapshot

## Procedure

### Publish conditions

Snapshots publish only if:

- data fetch successful
- standings calculation verified
- duplicate winner checks passed
- timestamp recorded
- no donor personal data is stored, logged, or published (LGFC keeps zero donor or user information from Givebutter;
  see #4139)

If validation fails → snapshot not published.

### Sample dry-run procedure

Until the Givebutter access hold is released, use only `src/lib/fundraiser-leaderboard.ts` sample data:

1. Build the aggregate participant standings for 2027-03-25 through 2027-06-07, 11:59 PM Eastern.
2. Exclude any aggregate row dated before 2027-03-25 or after 2027-06-07.
3. Calculate the overall total toward the $10,000 goal.
4. Calculate the three boards:
   - Funding the Fight: sort by dollars raised, descending.
   - Raising Awareness: sort by donor count, descending.
   - Champion: sort by `dollars raised + donors`, descending.
5. For tied values, use participant display name order only as a deterministic placeholder until #4415 records the final
   tie-breaks.
6. Confirm the output contains aggregate fields only: participant display name, dollars raised, donor count, Champion
   points, overall dollars, overall donor count, and capture/window metadata.
7. Do not store, log, display, or add sample donor names, emails, phone numbers, addresses, messages, or per-donor
   amounts.

### Final lock

At the end of the counting window on 2027-06-07:

1. Confirm the fundraiser counting window is closed.
2. Generate the fundraiser snapshot from the approved source. In the current sample-only stage, use the dry-run sample
   data only.
3. Run the tie checks. Until Product confirms the final rules on #4415, use display-name ordering as a deterministic
   placeholder for dry-run output only.
4. Publish the fundraiser total and the leaderboard snapshot only after the applicable Product/publication approval.
5. Archive that snapshot for audit.

Do not publish winners or the auction total in that noon snapshot. The auction closes at 11:45 PM Eastern the same day. Winner publication and thank-you copy stay Product Authority decisions. The closeout tooling and rehearsal are tracked on #4436; rehearse without any public send.
