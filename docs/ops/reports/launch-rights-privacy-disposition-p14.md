---
Doc Type: Report
Audience: Human + AI
Authority Level: Supporting (audit evidence and proposal for Product Authority decision; not a Go packet row)
Owns: The launch publication rule as recorded, the 2026-10-19 audit of what is public against it (counts only), the items that need a decision, and the draft Rights / privacy attestation for go-live task P-14 (#4427)
Does Not Own: Any rights or privacy decision (Product Authority decides), legal advice, the Go packet, or any change to Production data
Canonical Reference: /docs/reference/website/lou-gehrig-rights-privacy-publication-review.md
Last Reviewed: 2026-10-19
Related Issues: #4427, #4414, #4368, #4374, #3576, #4569, #4593, #4428
---

# Launch rights and privacy disposition (go-live P-14)

## Purpose

The Go packet's Rights / privacy row is not ready, and an unresolved rights stop blocks announcements. This report records the rule the launch publishes under, audits what is public against it, and lists what Product Authority must decide before the row can pass. It makes no rights decision and is not legal advice.

## The launch publication rule, as recorded

From Product Authority's direction of 2026-10-14 (recorded on #4593) and the publishing gate on #4569:

- LGFC uses only free content, or free content with a citation credit. LGFC pays for nothing.
- Any condition on a permission (territory, duration, usage limits or similar) counts as a denial, because of the risk of billing.
- Where text is free and the pictures or video carry a fee, LGFC uses the text only.
- Credit or attribution wording is not a condition.
- Only an item with final permission status `permitted` on a current record is shown on the website.

Product Authority confirms or changes this wording; until then it is the rule used below.

## What was checked, and its limits

A read-only audit of Production D1 on 2026-10-19: aggregate counts, plus the ten titles in the public story inventory (public content). No member, session, join, ask or correspondence data was read. No row was changed. Not checked: the Backblaze B2 bucket itself (the audit lists what D1 records about B2 files, not the bucket contents), the licence terms of each named source, and whether any recorded grant carries a condition (the conditions field from #4593 is not applied yet).

## Audit results

| Area | Count | Status |
| --- | --- | --- |
| Discovery candidates (`content_items`) | 30 | All 30 have final status `not_permitted` and publication status `not_ready`. None is public. None links to the story inventory. |
| Permission requests sent | 0 | No permission exchange exists yet. |
| Rights evidence rows | 30 | 10 recorded as permit, 0 as deny, the rest undecided. |
| Public story inventory (`content_inventory`) | 10 | All 10 are `published`. All 10 have **no rights status recorded** and all 10 carry media. |
| Photos | 31 | 10 `permission_granted`, 4 `public_domain_candidate`, 17 `unreviewed`. |
| Photos shown | 14 | The 10 granted and the 4 candidates are publication-eligible. The 17 unreviewed are on rights hold. No photo in the matchup pool lacks a cleared status. |
| Media assets | 10 | None on rights hold. |

The 17 held photos are working as intended. The open findings are the stories and the four candidate photos.

### The ten published stories

| IDs | What they are | Credit shown |
| --- | --- | --- |
| 1 to 6 | Book entries: Eig (Simon & Schuster), Kashatus (Bloomsbury), Adler (Houghton Mifflin Harcourt), Gallico (Open Road), Robinson (W. W. Norton), Gehrig and Gaff (Simon & Schuster) | The book's author, publisher and year |
| 9401, 9402 | Stories "compiled from SABR archives" | LGFC Editorial Desk |
| 9403 | Story "compiled from MLB.com historical coverage" | LGFC Editorial Desk |
| 9404 | Story "compiled from Columbia University Athletics archives" | LGFC Editorial Desk |

None has a recorded rights status or rights evidence, and none passes through the permission pipeline that #4569 gates on. Under that gate all ten would be hidden.

## Findings

1. **Ten published stories have no rights status.** The six book entries carry publisher and author credit; I could not tell from the database whether their media is a publisher cover image. The four "compiled from" stories draw on third-party sources whose licence terms are not recorded. Under the rule, none of the ten is shown with evidence today.
2. **Four photos are only "candidates".** `public_domain_candidate` is not a confirmed status. The evidence fields for US publication and the URAA are the check.
3. **Ten photos are marked `permission_granted`.** Whether any grant carries a condition cannot be checked until #4593 (the conditions field) is applied. A conditional grant counts as a denial.
4. **Zero permission requests have been sent.** Nothing is awaiting a reply.
5. **The 2027 Lou Gehrig Day public-item register has no authorized items** (from the #4427 description; not re-checked here).

## Decisions for Product Authority

| # | Question | Recommended answer |
| --- | --- | --- |
| 1 | Confirm the launch publication rule as worded above | Yes |
| 2 | Book entries 1 to 6: keep the bibliographic text, and hide any publisher cover image unless it is free with a credit | Keep the text, hide the media until each is cleared |
| 3 | Stories 9401 to 9404: hide until each source's licence is recorded, or rewrite as original LGFC text with a link to the source | Hide until the licence is recorded; rewrite where a licence has a condition |
| 4 | The four public-domain candidate photos | Hold until the US publication and URAA fields are confirmed |
| 5 | The ten granted photos | Keep, and re-check each grant for conditions when #4593 is applied |
| 6 | Unreviewed photos (17) | Keep on hold; seek permission or remove after launch |
| 7 | Send permission requests for items worth keeping (#4368) | Product Authority chooses which, in priority order |

None of these changes Production by itself. Hiding or removing an item is a Production write and needs its own source Issue, pull request and an explicit Go.

## Draft Rights / privacy attestation

This is the text Product Authority records on #2093 when the row can pass. It is not attestable today: findings 1 and 2 are open.

> Rights / privacy, as of [date]: every item public on the website is `permitted` under the launch publication rule or has been hidden or removed. No grant carries a condition. No item has an unresolved publication-rights stop. Evidence: the audit in `launch-rights-privacy-disposition-p14.md`, re-run on [date] with these counts: [public items, items hidden, items removed]. Decided by Product Authority.

The re-run is the same read-only counts, repeated on the launch candidate.

## Privacy

This audit looked at publication rights, not member privacy. Member-data handling, the privacy policy, terms and cookie notice are P-15 (#4428) and are not covered here. No member data was read.

## Rollback

Revert this documentation commit. No system state is created.
