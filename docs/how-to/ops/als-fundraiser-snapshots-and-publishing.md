---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: Snapshot publishing procedures for ALS fundraiser data
Does Not Own: Campaign data structure; homepage layout rules; the 2027 dates themselves (owned by the calendar of record)
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #4442, #4432, #4436, #4414
Last Reviewed: 2026-10-09
---

# Snapshot Publishing Procedure

Last Updated: 2026-10-09

## Status of this procedure

The first version (2026-03-08) described the **2026** campaign. The 2027 campaign has different dates. The dates below come from the Product-approved calendar of record in `docs/reference/operations/2027-launch-calendar-operating-contract.md`. This document does not set or change a date.

Two things are not decided yet, and this procedure does not guess them:

- how the standings data is produced (manual snapshot or import), which is decision P-01 under #4414;
- the time of day for the daily snapshot and the daily progress post format, which are settled in the leaderboard task #4432.

Until those are recorded on their Issues, treat the publish conditions and the final lock below as the rules to keep, and treat the 2027 snapshot time and data source as pending.

## 2027 snapshot window

From the calendar of record:

| Date or window | What happens |
| --- | --- |
| 2027-03-25 | Fundraiser launches (donations open) |
| 2027-03-25 to 2027-06-02 | One daily leaderboard and progress update toward the $10,000 total donation goal, on LGFC.com and on social |
| 2027-06-02, 9:00 PM | Closeout: close the fundraiser, determine winners, publish the final report on LGFC.com, announce on social with the URL, send thank-you messages |

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

At the closeout on 2027-06-02 (9:00 PM):

1. Confirm fundraiser closed
2. Generate final snapshot
3. Run tie checks
4. Publish final standings
5. Archive snapshot for audit

Winner publication and thank-you copy are Product Authority decisions. The closeout tooling and rehearsal are tracked on #4436; rehearse without any public send.
