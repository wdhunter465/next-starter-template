---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: Snapshot publishing procedures for ALS fundraiser data
Does Not Own: Campaign data structure; homepage layout rules; the 2027 dates themselves (owned by the calendar of record)
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #4442, #4432, #4436, #4414, #4565
Last Reviewed: 2026-10-27
---

# Snapshot Publishing Procedure

Last Updated: 2026-10-27

## Status of this procedure

The first version (2026-03-08) described the **2026** campaign. The 2027 campaign has different dates. The dates below come from the Product-approved calendar of record in `docs/reference/operations/2027-launch-calendar-operating-contract.md`. This document does not set or change a date.

Recorded on #4415 (2026-10-27) and used below:

- Givebutter is the source of truth. Standings are individual participants and an overall total, ranked by plain totals raised. There is no points formula.
- The fundraiser closes 2027-06-07 at 12:00 PM Eastern. The auction closes the same day at 11:45 PM Eastern.

Two things stay open, and this procedure does not guess them:

- whether each daily snapshot is a manual export or an import, which stays on #4432;
- the time of day for the daily snapshot and the daily progress post format, which stay on #4432.

Bill has not chosen whether noon on 2027-06-07 publishes the fundraiser total only, with the auction total afterward, or whether the combined report waits until the morning of 2027-06-08. Winner publication still waits for his approval (#4436).

## 2027 snapshot window

From the calendar of record:

| Date or window | What happens |
| --- | --- |
| 2027-03-25, 12:00 AM | Fundraiser launches (donations open) |
| 2027-03-25 to 2027-06-07, 12:00 PM | One daily leaderboard and progress update toward the $10,000 total donation goal, on LGFC.com and on social |
| 2027-06-07, 12:00 PM (noon) | The fundraiser closes. Publish the fundraiser total and the leaderboard snapshot. Do not publish winners or the auction total at noon |
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
- no donor personal data is stored or published (LGFC keeps zero donor or user information from Givebutter; see #4139)

If validation fails → snapshot not published.

### Final lock

At noon on 2027-06-07:

1. Confirm the fundraiser is closed.
2. Generate the fundraiser snapshot from Givebutter plain totals.
3. Run the tie checks: more distinct donors, then the earlier time of reaching the total.
4. Publish the fundraiser total and the leaderboard snapshot.
5. Archive that snapshot for audit.

Do not publish winners or the auction total in that noon snapshot. The auction closes at 11:45 PM Eastern the same day. Winner publication and thank-you copy stay Product Authority decisions. The closeout tooling and rehearsal are tracked on #4436; rehearse without any public send.
