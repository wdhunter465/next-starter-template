---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Operator steps for the days around the 2027 fundraiser close (2027-06-02 to 2027-06-07) and the after-event work through 2027-06-30: the Lou Gehrig Day week, the evidence and archive record, the retrospective, and the rollover to a 2028 instance
Does Not Own: The closeout tooling itself (#4436), the Lou Gehrig Day annual contract and instance schema (`docs/reference/operations/annual-lou-gehrig-day-operating-contract.md`), public copy and announcements, donor data retention policy and the privacy review (#4428), the freeze lift decision (Product Authority on #2093)
Canonical Reference: /docs/reference/operations/annual-lou-gehrig-day-operating-contract.md
Related Issues: #4764, #4436, #4438, #4573, #4428, #4763, #2093, #2084, #4415
Last Reviewed: 2026-10-22
---

# Close the 2027 fundraiser and roll over

## Purpose

The 2027 fundraiser runs 2027-03-25 12:00 AM to 2027-06-07 11:59 PM (Product Authority correction recorded on #4436, 2026-11-12). Lou Gehrig Day, 2027-06-02, falls five days before the close. This procedure covers that overlap, the close, and the after-event work. It declares no Go and publishes nothing; copy and announcements are Product Authority's. Closeout tooling (final snapshot, winners, final report, thank-you messages) is built under #4436 and is not repeated here.

All times are Eastern (America/New_York).

## The overlap rule: Lou Gehrig Day items versus fundraiser items

`docs/how-to/ops/run-annual-lou-gehrig-day.md` schedules evidence closeout and unpublish/restore at T+1 and archive at T+7, counted from the Lou Gehrig Day anchor. In 2027 that would unpublish on 2027-06-03 and archive on 2027-06-09, while donations are open until 2027-06-07.

For 2027:

1. T+1 (2027-06-03) applies to Lou Gehrig Day items only (day-specific posts, spotlight, partner recognition). Fundraiser surfaces (donate link, leaderboard, progress, Fundraiser Details history) stay up until the close.
2. Archive of the Lou Gehrig Day instance and evidence moves to after the fundraiser close, no earlier than 2027-06-08.
3. Product Authority confirms this reading on #2093 before 2027-06-02. If Product Authority prefers a different split, that decision replaces this section.

The how-to's wording is not changed by this procedure. Reconciling it with the revised calendar is a follow-up on #4764.

## Procedure: sequence

| When                 | Step                                                                                                                                       | Owner                                             | Evidence                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------- |
| 2027-06-02           | Lou Gehrig Day per the instance checklist; fundraiser stays open                                                                           | Operations, Product Authority                     | Instance record; status word on #2093 |
| 2027-06-03           | Unpublish or restore Lou Gehrig Day items only, as Product Authority directs                                                               | Operations                                        | Evidence report rows for those items  |
| 2027-06-03 to 06-06  | Daily snapshot checks continue (see `run-the-2027-freeze-period.md`); every 15 minutes in the last 24 hours before the close               | Operations                                        | Snapshot freshness                    |
| 2027-06-07, 11:59 PM | Fundraiser closes; closeout per #4436 (final snapshot frozen, winners, final report, social announcement, thank-you messages)              | Product Authority authorizes; Operations executes | Closeout record from #4436            |
| 2027-06-07 to 06-08  | Verify the frozen final standings against the Givebutter dashboard; Product Authority approves the winner record                           | Operations; Product Authority                     | Approved record                       |
| 2027-06-08           | Take down donation surfaces as Product Authority directs (donate link becomes a thank-you state); confirm nothing still invites a donation | Operations                                        | Page checks; screenshot               |
| 2027-06-08 to 06-14  | Thank-you follow-up status checked: which of donors, participants, partners and sponsors were thanked, through which channel               | PMO Admin; Product Authority                      | Checklist below                       |
| by 2027-06-14        | Final report published on LGFC.com and its location recorded                                                                               | Product Authority; editors                        | URL in the archive record             |
| by 2027-06-21        | Archive record written (next section)                                                                                                      | PMO Admin                                         | `docs/ops/as-built/` record           |
| by 2027-06-30        | Retrospective held; rollover decisions recorded; freeze lift decided                                                                       | Product Authority                                 | Comment on #2093                      |

Dates after the close are proposed working targets; Product Authority changes them on #2093.

## Closeout rehearsal on sample data

The first #4436 rehearsal slice uses only `SAMPLE_FUNDRAISER_PARTICIPANTS` and closeout data computed in `src/lib/fundraiser-closeout.ts`. It does not call Givebutter, D1, social platforms, email, SMS, or any public publishing path.

1. Confirm the working branch contains only the #4436 allowlist for this slice:
   - `src/lib/fundraiser-closeout.ts`
   - `tests/fundraiser-closeout-4436.test.ts`
   - `docs/how-to/ops/close-the-2027-fundraiser-and-roll-over.md`
2. Run the rehearsal tests:

   ```bash
   npx vitest run tests/fundraiser-closeout-4436.test.ts tests/fundraiser-leaderboard-4432.test.ts
   ```

3. Read the test output as rehearsal evidence. Passing output means the sample-data closeout computation can determine the three sample award winners, reject donor personal fields, and enforce the 2027-03-25 through 2027-06-07 11:59 PM Eastern sample cutoff.
4. Confirm no public send occurred: no page was published, no announcement was posted, no thank-you message was sent, no Givebutter request was made, and no D1 write occurred.
5. Record the command output with the #4436 PR evidence. Do not publish the winners from sample data.

The award tie-break rule used by this rehearsal is provisional Product Authority draft guidance from #4415 on 2026-11-12: Funding the Fight ties use most donors, then earliest registration; Raising Awareness ties use most funds, then earliest registration; Champion ties use earliest registration. The open question about whether one participant may win more than one award remains a Product Authority decision; the tooling reports duplicate winners for human disposition.

## Archive record

PMO Admin writes one record in `docs/ops/as-built/` (for example `2027-fundraiser-closeout.md`) that freezes the 2027 campaign as history. It lists, with a link or identifier for each:

- the Fundraiser Details posts (29) and the `/fundraiser-details` page as published;
- the final snapshot and the two checkpoint records (2027-04-30, 2027-05-31), with the approved winners as published (display names only);
- the final report URL and the closeout record from #4436;
- the Lou Gehrig Day instance record, rehearsal record and evidence report;
- the Go/No-Go packet and exception log as they stood on the last day;
- the Givebutter campaign and participant-page identifiers (public ones only);
- what was removed or restored and when.

The record holds no donor or participant personal data. Content rows (`content_blocks` and revisions) and snapshot and checkpoint rows stay in the database as the record; nothing is deleted to save space.

## Data handling and retention

What the design already fixes (#4573): snapshots and checkpoint records hold aggregates and public display names only; no donor name, email, phone or address is stored on LGFC systems; prize fulfilment happens outside LGFC systems through Givebutter or Product Authority.

Not yet decided, and needed before 2027-06-07:

| Question                                                                                        | Why it matters                                 | Decided by                                         |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| How long are participant registration records (#4429) kept after the close, and what is deleted | Registration may hold more than a display name | Product Authority, with the privacy review (#4428) |
| How long does the club keep Givebutter exports it downloads                                     | They contain donor data                        | Product Authority                                  |
| May the 2027 participant list be reused to invite 2028 participants                             | Consent and the privacy policy                 | Product Authority                                  |

Until these are decided, Operations downloads no donor export and nobody copies donor data into the repository or an Issue.

## Pending closeout decisions

These decisions remain outside the sample-data rehearsal slice and must be resolved before public closeout:

- Product Authority approval of the final winner record and whether one participant may receive more than one award.
- Product Authority approval of final report copy, thank-you copy, and announcement copy.
- LiveLikeLou / Givebutter access for final totals, refunds, pending gifts, and any final-dashboard reconciliation.
- Whether any auction-related total or winner dependency exists after the fundraiser cutoff.
- Donor and participant data retention from #4428 and #4429.

## Retrospective

Product Authority holds it by 2027-06-30. PMO Admin prepares the facts; Product Authority writes the conclusions. Sections:

1. Calendar: each milestone on time, late or missed, and why (from the weekly status comments on #2093).
2. Money: total raised against the $10,000 goal, number of participants and supporters (aggregate), checkpoint prizes awarded.
3. Operations: incidents, rollbacks, freeze exceptions and their causes; daily checks that were missed or done by hand.
4. Content: posts published on time; corrections after publication.
5. Cost and time: vendor costs and the hours the work took.
6. Decisions to repeat, change or drop for 2028.

The result is recorded as a comment on #2093 and linked from the archive record.

## Rollover to 2028

1. Open a new Lou Gehrig Day annual instance from the schema in the annual contract (`docs/ops/as-built/lou-gehrig-day-2028-instance.md`); the date is 2028-06-02 and any other window stays `not-authorized` until Product Authority approves it.
2. Copy only what is reusable: the instance schema, the checklists, the how-tos and the dashboard and checkpoint tooling. Do not copy dates, prize descriptions, copy, participant lists or any public text.
3. Product Authority re-decides or reaffirms the fundraiser decisions recorded on #4415 and #4573 (model, leaderboard unit, winner rule, checkpoint dates and cutoff, prizes, time zone). Nothing carries over by default.
4. Open the 2028 calendar and Go/No-Go work as a new parent; the 2027 parent (#2093) closes under the PMO closeout protocol after the archive record is merged.

## Freeze lift

Product Authority lifts the freeze in writing on #2093, after the close and the archive record, and names what resumes (for example the post-launch Pipeline programs). The freeze scope and exception log stay as history.

## Stop conditions

Stop and escalate to Product Authority for: an unexplained difference between the frozen final standings and Givebutter; any request to publish winners before approval; any use of donor or participant data not covered above; a donation surface still live after Product Authority's take-down direction; or a request to change a recorded 2027 date.

## Rollback

This is a documentation procedure. Revert the pull request that changed it.

If a final report page is published early or with unapproved data, use the unpublish path from `docs/how-to/website/takedown-soft-delete-and-recovery.md`: remove the public route or switch it to the approved unpublished state, deploy the rollback, verify the URL no longer exposes the report, and record screenshot evidence on the source Issue. Keep donation, leaderboard, and thank-you surfaces in their last approved states unless Product Authority directs a separate rollback.

Restoring a taken-down page also follows `docs/how-to/website/takedown-soft-delete-and-recovery.md` and requires Product Authority approval when the restored page includes winners, final totals, thank-you copy, or announcement text.
