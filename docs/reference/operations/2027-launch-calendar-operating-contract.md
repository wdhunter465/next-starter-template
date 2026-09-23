---
Doc Type: Reference
Audience: Product Authority, Operations, PMO, editors, and implementation agents
Authority Level: Controlled
Owns: Durable 2027 launch-calendar milestone taxonomy and the Product-approved absolute calendar of record for parent #2093
Does Not Own: Inventing public dates; publishing this calendar on the public website events calendar; website or fundraiser launch; public announcements; Production mutation; paid services; credentials; replacing source-project acceptance on #1700, #2039, #2084, or #2782
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2093, #3861, #3862, #3863, #3864, #3865, #3866, #1700, #2039, #2084, #2782, #2089
Last Reviewed: 2026-09-23
---

# 2027 launch calendar operating contract

## Purpose

Define the durable milestone taxonomy and the Product-approved absolute calendar of record for the 2027 integrated launch calendar and Go/No-Go process (#2093). This contract does not authorize public launch, automatic posting, Production mutation, or publication of these rows on the Fan Club Events Calendar.

## Scope

In scope: milestone classes for website, fundraiser, Lou Gehrig Day, freeze, rehearsal, deployment, rollback, announcement, and Day-2 monitoring; owner roles; source-Issue families; required evidence; predecessor/successor relations; freeze and exception rules; the absolute calendar generated from Product 2026-09-20 anchors.

Out of scope: choosing new protected dates; seeding D1 `events` or the public Fan Club Events Calendar; launching the website or fundraiser; publishing announcements; Production writes; purchasing services; credentials.

## Current known truth

- Product recorded Project Graduation **GO** for parent #2093 on 2026-09-23. Implementation owner is Cursor Local.
- Child #3861 (PR #4348) delivered the taxonomy. Child #3862 records the absolute calendar from Product 2026-09-20 anchors only.
- Product 2026-09-23: **#2093 dates are administrative for PMO only. Do not publish them on the public Fan Club Events Calendar.**
- This calendar coordinates source programs. It does not grant their implementation or Production Go.
- #2089 remains OPEN as a Production-release evidence-model gap. It is not a date inventor.

## Intended final state

Every 2027 PMO launch-window row is classified against the taxonomy and listed in the calendar of record below. Those rows are not public website events.

## Roles and decision rights

| Role | Decision rights | Does not decide |
| --- | --- | --- |
| Product Authority (Bill) | Public dates; Go/No-Go; freeze declaration; emergency-change approval; public announcements; fundraiser commitments | Repository merge; CI gates |
| Operations | Launch-window health; smoke tests; incident classification; rollback/unpublish execution; Day-2 evidence capture | Public copy; partner commitments; Production Go |
| PMO | Readiness recording; Graduation/closeout preparation; daily launch-window reporting after #3866 handoff | Product Go; Production mutation |
| Editors | Draft content and channel exports inside approved windows | Publication without Product approval |
| Implementers | Bounded calendar/docs/tooling named on a source Issue | Scope expansion; credentials; paid tools |

Builder/reviewer separation still applies. The implementer of a change does not independently approve that change.

## Milestone taxonomy

A row without an owner role or required evidence class is rejected and must not be used as a public date.

| Class | Owner role | Source Issue family | Required evidence | Predecessor | Successor | Freeze / exception rule |
| --- | --- | --- | --- | --- | --- | --- |
| Website completion | Product Authority for Go; Operations for smoke; implementers for named Issues | #2039 / #1685 lineage | Production-ready website evidence; smoke result; no open protected stop | Freeze class recorded or waived by Product | Announcement class; Day-2 class | No public website-live claim until Product Go. Emergency website change during freeze requires Bill approval. |
| Fundraiser readiness | Product Authority for dates and commitments; Operations for window health | #1700 lineage | Registration/launch readiness packet; donation-window boundaries; no unapproved sponsor claim | Website class if homepage-linked fundraiser surfaces are in scope | Lou Gehrig Day class for 2027 closeout coupling | No fundraiser public date or dollar-goal claim except Product-approved #2093 anchors. |
| Lou Gehrig Day | Product Authority for public copy and extra windows; Operations for checklist | #2084 lineage | Annual instance; rehearsal record; rights/privacy disposition | Fundraiser class for coupled 2027 closeout | Rollback class if unpublish is required | June 2 is the #2084 public anchor. Other LGD public dates come only from Product / #2093. |
| Content freeze | Product Authority declares freeze; editors stop unapproved change | #2093 freeze decision; #2039/#1700 content owners | Freeze declaration on #2093; exception log | Rehearsal class complete or Product waiver | Deployment class | Freeze begins only when Bill declares it. Emergency edits require Bill. A missing freeze date is a stop, not a guessed date. |
| Rehearsal | Operations executes; PMO records | #2093 / #3865; #2084 rehearsal pattern | Tabletop record covering delay, No-Go, rollback, and communications-hold | Taxonomy and calendar of record exist | Go/No-Go evidence packet | Rehearsal must not send live announcements or mutate Production. Failed rehearsal is a stop. |
| Deployment | Product Authority for Production Go; Operations for execute/verify | #2782 lineage; website/fundraiser Issues as named | Deployment identity; smoke; rollback path ready | Freeze class; rehearsal class; #2089 evidence model when Production Go is claimed | Announcement class; Day-2 class | This calendar does not itself authorize Production. #2782 remains the deployment evidence owner. |
| Rollback | Operations executes; Product Authority decides cancel vs restore | #2782 / website takedown how-to; #2093 No-Go | Rollback/cancellation window; restore evidence; communications-hold | Any class that reached a public or Production state | Day-2 class or cancelled-calendar state | Schedule rollback never rolls back completed technical work. It changes only authorized timing and preserves the audit trail. |
| Announcement | Product Authority authorizes; editors/ops execute approved channels | #1700 / #2039 automation dependency; #2093 announcement timing | Authorization record; channel list; no pre-Go public post | Product Go for that window | Day-2 class | Public announcement cannot precede Product authorization. Auto-publish at 10:00 AM is a #1700/#2039 mechanism flag, not this contract's runtime. |
| Day-2 monitoring | Operations owns health; PMO records status vocabulary | #2093 / #3866; Day-2 Operations role | Daily status using blocked / at risk / ready / go / no-go / deployed / verified / monitoring | Deployment or announcement class as applicable | Closeout or rollback class | Day-2 command is not granted by this taxonomy. Absence of Go is a stop. |

## Sequence (class order, not dates)

Use this predecessor chain unless Product records a waiver with authority, scope, expiry, and residual risk:

1. Taxonomy (this document / #3861)
2. Absolute calendar from Product anchors (#3862)
3. Integrated source-program milestones (#3863)
4. Go/No-Go evidence packet (#3864)
5. Tabletop rehearsal (#3865)
6. Freeze and launch-window reporting handoff (#3866)
7. Website, fundraiser, Lou Gehrig Day, deployment, announcement, and Day-2 classes only when their source programs and Product Go allow

A later class must not silently authorize an earlier class. A dependency slip is visible on #2093; it does not create a new public date.

## Change and exception rules

- Date, Go/No-Go, freeze declaration, and emergency-change authority: Bill, on #2093.
- No date is inferred from priority labels, Pipeline/Active numbers, or chat.
- Calendar math in later children must be deterministic from Product-approved anchors already recorded on #2093 as of 2026-09-20, unless Product records a replacement revision.
- Waivers name owning authority, scope, expiry, and residual risk.
- A No-Go preserves rollback/cancellation and communications-hold behavior.
- Stop for missing Product dates, unresolved source-project readiness, failed rehearsal, rights/privacy uncertainty, fundraiser commitment, paid service, credential need, active Operations interrupt, or treating this calendar as Production Go.

## Calendar of record (#3862)

Source: Product-specified table on #2093 dated 2026-09-20. No date below is inferred from labels or chat. Derived windows use only those anchors.

**Publication:** PMO / Issue / this contract only. Not D1 `events`. Not `/api/events/*`. Not the Fan Club Events Calendar.

| Date / window | Event | Taxonomy class | Owner | Evidence class |
| --- | --- | --- | --- | --- |
| 2026-12-31 | Final Go/No-Go decision | Deployment / Day-2 (decision gate) | Bill | Recorded GO, NO-GO, HOLD, or ADJUSTMENT on #2093 |
| 2026-12-31 | Repository and website change freeze begins, assuming Go | Content freeze | Bill declares; Bill approves emergency changes | Freeze declaration on #2093; exception log |
| 2027-01-01 | Website LIVE in Production; launch announcements on social platforms | Website completion; Announcement | Bill for Go; Operations for smoke; #2039/#1700 for announcement mechanism | Separate Production Go and announcement authorization; this row is not itself that Go |
| 2027-02-01 | Fundraiser “coming soon” announcement; participant registration opens | Fundraiser readiness; Announcement | Bill; #1700 | Product-approved copy and channel list |
| 2027-02-01 → 2027-03-01 | Daily “Fundraiser Details” posts (homepage-linked page, newest first); each day’s post also to every LGFC social platform | Fundraiser readiness; Announcement | Bill; #1700/#2039 | 10:00 AM website-then-social auto-publish remains a #1700/#2039 flag, not this contract’s runtime |
| 2027-02-15 | Repeat call-to-action: join the fundraiser as a participant | Announcement | Bill; #1700 | Authorization record |
| 2027-03-01 | Repeat call-to-action: join as a participant (also last day of daily Fundraiser Details posts) | Announcement | Bill; #1700 | Authorization record |
| 2027-03-25 | Fundraiser launches (donations open); coincides with MLB Opening Day | Fundraiser readiness | Bill; #1700 | Donation-window boundaries; no unapproved sponsor claim |
| 2027-03-25 → 2027-06-02 | Daily leaderboard and progress toward $10,000 total donation goal on LGFC.com and social | Fundraiser readiness; Day-2 monitoring | Bill; Operations; #1700 | Daily status vocabulary after #3866 handoff |
| 2027-06-02, 9:00 PM | Lou Gehrig Day evening closeout: close fundraiser → determine winners → publish final report on LGFC.com → announce on social with URL → thank-you messages | Lou Gehrig Day; Announcement | Bill; #2084; #1700 | Annual instance and rehearsal; this PMO closeout time is not a new public `events` row |

The public Fan Club Events Calendar may independently show **Lou Gehrig Day 2027-06-02** from the #2084/#2859 seed. That posted event is not publication of this PMO table.

A date not in this table is rejected until Product records a replacement revision on #2093.

## Protected stops

Stop and escalate to Product when any of the following is true: missing or disputed Product date; invented public date; seeding this table into D1 `events`; unapproved announcement; unresolved rights or privacy; sponsor, donor, or fundraiser commitment beyond #2093; paid service or new credential; Production mutation from this package; failed rollback rehearsal; active numbered Operations interrupt; using a taxonomy row without owner or evidence as a public date.
