---
Doc Type: Reference
Audience: Product Authority, Operations, PMO, editors, and implementation agents
Authority Level: Controlled
Owns: Durable 2027 launch-calendar taxonomy, Product-approved calendar of record, integrated source-program milestone matrix, and 2026-12-31 Go/No-Go evidence packet for parent #2093
Does Not Own: Inventing public dates; publishing this calendar on the public website events calendar; website or fundraiser launch; public announcements; Production mutation; paid services; credentials; replacing source-project acceptance on #1700, #2039, #2084, or #2782
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2093, #3861, #3862, #3863, #3864, #3865, #3866, #1700, #2039, #2084, #2782, #2089
Last Reviewed: 2026-09-24
---

# 2027 launch calendar operating contract

## Purpose

Define the durable milestone taxonomy and the Product-approved absolute calendar of record for the 2027 integrated launch calendar and Go/No-Go process (#2093). This contract does not authorize public launch, automatic posting, Production mutation, or publication of these rows on the Fan Club Events Calendar.

## Scope

In scope: milestone classes; owner roles; source-Issue families; required evidence; predecessor/successor relations; freeze and exception rules; the absolute calendar generated from Product 2026-09-20 anchors; the #3863 source-program integration matrix; the #3864 Go/No-Go evidence packet (pass / fail / waiver / not-ready only).

Out of scope: choosing new protected dates; seeding D1 `events` or the public Fan Club Events Calendar; launching the website or fundraiser; publishing announcements; Production writes; purchasing services; credentials.

## Current known truth

- Product recorded Project Graduation **GO** for parent #2093 on 2026-09-23. Implementation owner is Cursor Local.
- Child #3861 (PR #4348) delivered the taxonomy. Child #3862 (PR #4352) delivered the calendar of record. Child #3863 (PR #4354, `daf7d7f228fe16e6fd71985035add433fb9e9fd1`) delivered the integration matrix. Child #3864 adds the Go/No-Go evidence packet. The packet does not declare Go.
- Product 2026-09-23: **#2093 dates are administrative for PMO only. Do not publish them on the public Fan Club Events Calendar.**
- This calendar coordinates source programs. **No row in this contract grants Production Go or announcement Go.**
- 10:00 AM website-then-social auto-publish remains a #1700/#2039 mechanism flag, not this contract's runtime.
- #2089 remains OPEN as a Production-release evidence-model gap. It is not a date inventor and is not a silent calendar rewrite.

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

## Integrated source-program milestones (#3863)

Each row is PMO coordination only. A row that would grant Production or announcement Go is rejected. Fallback never invents a public date.

| Milestone | Owner | Source Issue | Depends on | Due window | Evidence | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| Website completion for 2027-01-01 live claim | Bill for Go; Operations for smoke | #2039 / #1685 | Freeze declared or Product waiver; #2782 deployment evidence | 2026-12-31 freeze through 2027-01-01 | Production-ready website evidence; smoke; no open protected stop | Slip visible on #2093; do not move the public live date |
| Fundraiser readiness for coming-soon and launch | Bill; Operations | #1700 | Website homepage-linked surfaces if used; Product copy | 2027-02-01 coming-soon; 2027-03-25 launch | Registration/launch packet; donation-window boundaries | Hold the PMO row; do not open donations early |
| Annual Lou Gehrig Day package | Bill for copy; Operations for checklist | #2084 | Fundraiser closeout coupling; June 2 public event remains #2084/#2859 | 2027-06-02 (day); 2027-06-02, 9:00 PM PMO closeout | Annual instance; rehearsal; rights/privacy | Keep June 2 public event; do not add PMO closeout to D1 `events` |
| Content freeze | Bill declares | #2093; #2039/#1700 content owners | Rehearsal complete or Product waiver | 2026-12-31 assuming Go | Freeze declaration; exception log | Missing freeze is a stop, not a guessed date |
| Communications / auto-publish flag | Bill authorizes; #1700/#2039 own mechanism | #1700; #2039 | Product announcement Go per window | 10:00 AM on each Product-authorized announcement day | Channel list; authorization record | Flag only; this child does not implement cron or Zapier |
| Rehearsal | Operations executes; PMO records | #2093 / #3865; #2084 pattern | Taxonomy + calendar of record | Before freeze declaration | Tabletop covering delay, No-Go, rollback, communications-hold | Failed rehearsal is a stop; no live sends |
| Deployment identity | Bill for Production Go; Operations execute | #2782 | Freeze; rehearsal; #2089 when Production Go is claimed | Before 2027-01-01 live claim | Deployment identity; smoke; rollback path | This matrix does not authorize Production |
| Rollback / cancellation | Operations execute; Bill decides | #2782; website takedown how-to; #2093 No-Go | Any class that reached public or Production state | As directed on No-Go | Restore evidence; communications-hold | Schedule rollback does not unwind completed technical work |
| Announcement authorization | Bill | #2093; channels via #1700/#2039 | Product Go for that window | Each calendar announcement row | Authorization on #2093 | No pre-Go public post |
| Day-2 monitoring | Operations; PMO records vocabulary | #2093 / #3866 | Deployment or announcement as applicable | 2027-01-01 onward as Go allows | blocked / at risk / ready / go / no-go / deployed / verified / monitoring | Absence of Go is a stop |
| #2089 evidence model | Engineering / #2089 owner | #2089 | Required before claiming Production Go | Before any Production Go claim | Evidence-ownership model | Do not rewrite calendar dates to paper over the gap |

Dependency order for PMO reporting: website and freeze before 2027-01-01 live claim; fundraiser before 2027-03-25 launch; #2084 before 2027-06-02 closeout; rehearsal before freeze; #2782 and #2089 before Production Go; announcement only after Product authorization.

## Go/No-Go evidence packet (#3864)

This packet is what Bill uses for the **2026-12-31** calendar Go/No-Go recorded on #2093. Rows are pass, fail, waiver, or not-ready. **This packet does not declare Go, No-Go, HOLD, or ADJUSTMENT.** It cannot publish, deploy, or mutate Production. A blank row is rejected. A waiver without authority, scope, expiry, and residual risk is rejected. Rehearsal evidence is owned by #3865; do not invent a rehearsal result here.

**Protected decision:** only Bill records GO, NO-GO, HOLD, or ADJUSTMENT on #2093. PMO/implementers may only update row status and evidence pointers.

### #2093 Go criteria → packet rows

Source: #2093 launch-package “Validation and acceptance” plus parent acceptance criteria. Every criterion has a row.

| Criterion (from #2093) | Packet row | Status 2026-09-24 | Evidence pointer | Waiver |
| --- | --- | --- | --- | --- |
| Date-driven launch calendar exists | Calendar of record | pass | Calendar of record section; Product 2026-09-20 table on #2093 | none |
| Dependencies listed with owners | Integration matrix | pass | Integrated source-program milestones (#3863) | none |
| Final Go/No-Go criteria are explicit | This packet | pass | This section | none |
| Content freeze window is defined | Freeze | pass | Calendar row 2026-12-31 defines the window. Freeze declaration itself is the Freeze named row below (not-ready). | none |
| Smoke-test window is defined | Website / Production | pass | 2027-01-01 live claim is the smoke window. Smoke result itself is the Website / Production named row below (not-ready). | none |
| Public announcement timing is controlled | Announcement authorization | pass | Calendar announcement rows define timing. Per-window authorization itself is the Announcement named row below (not-ready). | none |
| Every milestone has owner, source Issue, dependency, window, evidence, fallback | Integration matrix | pass | #3863 matrix | none |
| No date inferred from labels or chat | Calendar of record | pass | Publication rule; rejected-date rule | none |
| Calendar math is deterministic from approved anchors | Calendar of record | pass | Product 2026-09-20 anchors only | none |
| Dependency slips are visible without a new public date | Integration matrix fallbacks | pass | Fallbacks on #3863 rows; slips on #2093 | none |
| Go requires website/Production evidence | Website / Production | not-ready | Separate Production Go; #2782; #2039 | none |
| Go requires rollback evidence | Rollback | not-ready | Rollback class; #2782; website takedown how-to | none |
| Go requires content evidence | Content | not-ready | Freeze/exception log; source-program content owners | none |
| Go requires rights/privacy evidence | Rights / privacy | not-ready | Stop if unresolved; #2084 instance rights/privacy | none |
| Go requires communications evidence | Communications | not-ready | Channel list; #1700/#2039 flag only | none |
| Go requires Operations evidence | Operations | not-ready | Smoke, window health, Day-2 capture; #3866 vocabulary after handoff | none |
| Waivers name authority, scope, expiry, residual risk | Waiver register | pass | Waiver register below requires all four fields; no active waiver | none |
| No-Go preserves rollback and communications-hold | Rollback; communications hold | pass | Rollback class and announcement stop; no live rollback executed | none |
| Public announcement cannot precede Product authorization | Announcement authorization | pass | Announcement class forbids pre-Go public post | none |
| Daily reporting uses blocked / at risk / ready / go / no-go / deployed / verified / monitoring | Operations (Day-2 vocabulary) | not-ready | #3866 handoff | none |

### Required evidence classes (#3864 named rows)

| Packet row | Owner of evidence | Status 2026-09-24 | What “pass” requires | Fallback if not pass |
| --- | --- | --- | --- | --- |
| Website / Production | Bill for Production Go; Operations for smoke | not-ready | Production-ready website evidence; smoke; no open protected stop; #2089 model before claiming Production Go | Do not claim 2027-01-01 live; do not treat this packet as Production Go |
| Rollback | Operations execute; Bill decides cancel vs restore | not-ready | Rollback/cancellation window named; restore path; communications-hold | No-Go still preserves rollback; do not unwind completed technical work |
| Content | Bill freeze; editors stop unapproved change | not-ready | Freeze declaration on #2093 when Bill declares it; exception log | Missing freeze is a stop, not a guessed date |
| Rights / privacy | Product / #2084 instance | not-ready | Disposition recorded; no unresolved publication-rights stop | Stop; do not announce |
| Communications | Bill authorizes; #1700/#2039 own mechanism | not-ready | Authorization record; channel list; no pre-Go public post | 10:00 AM auto-publish remains a flag; this packet does not run it |
| Operations | Operations | not-ready | Window-health owner named; smoke owner named; incident/rollback owner named | Absence of Go is a stop |
| Freeze | Bill declares | not-ready | Declaration on #2093; emergency-change owner is Bill | Do not start freeze from this packet |
| Announcement authorization | Bill | not-ready | Per-window authorization on #2093 | No pre-Go public post |
| Rehearsal (#3865 input) | Operations executes; PMO records | not-ready | Tabletop covering delay, No-Go, rollback, communications-hold | Failed or missing rehearsal is a stop; do not fabricate |

### Waiver register

No active waiver. To add one, record all four fields on #2093 and copy them here:

| Waiver id | Authority | Scope | Expiry | Residual risk |
| --- | --- | --- | --- | --- |
| (none) | — | — | — | — |

### How Bill records the 2026-12-31 decision

On #2093 only, record exactly one of: GO, NO-GO, HOLD, ADJUSTMENT. That comment is the decision. This packet is supporting evidence, not the decision.

## Protected stops

Stop and escalate to Product when any of the following is true: missing or disputed Product date; invented public date; seeding this table into D1 `events`; unapproved announcement; unresolved rights or privacy; sponsor, donor, or fundraiser commitment beyond #2093; paid service or new credential; Production mutation from this package; failed rollback rehearsal; active numbered Operations interrupt; using a taxonomy row without owner or evidence as a public date; treating the #3864 packet as Production or calendar Go; a blank packet row; a waiver missing authority, scope, expiry, or residual risk; fabricating #3865 rehearsal evidence.
