---
Doc Type: Reference
Audience: Product Authority, Operations, PMO, editors, and implementation agents
Authority Level: Controlled
Owns: Durable 2027 launch-calendar milestone taxonomy, owners, evidence types, sequence, and freeze/exception rules for parent #2093
Does Not Own: Inventing public dates; website or fundraiser launch; public announcements; Production mutation; paid services; credentials; replacing source-project acceptance on #1700, #2039, #2084, or #2782
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2093, #3861, #3862, #3863, #3864, #3865, #3866, #1700, #2039, #2084, #2782, #2089
Last Reviewed: 2026-09-23
---

# 2027 launch calendar operating contract

## Purpose

Define the durable milestone taxonomy for the 2027 integrated launch calendar and Go/No-Go process (#2093). This contract names classes, owners, evidence, sequence, and change rules. It does not authorize public launch, automatic posting, or Production mutation.

## Scope

In scope: milestone classes for website, fundraiser, Lou Gehrig Day, freeze, rehearsal, deployment, rollback, announcement, and Day-2 monitoring; owner roles; source-Issue families; required evidence; predecessor/successor relations; freeze and exception rules.

Out of scope: choosing protected dates (Product Authority on #2093); generating the absolute calendar table (#3862); launching the website or fundraiser; publishing announcements; Production writes; purchasing services; credentials.

## Current known truth

- Product recorded Project Graduation **GO** for parent #2093 on 2026-09-23. Implementation owner is Cursor Local. First executable child is #3861.
- Product-approved 2026-09-20 anchors already exist on #2093. This child does not add, move, or infer dates. Absolute calendar generation is #3862.
- This calendar coordinates source programs. It does not grant their implementation or Production Go.
- #2089 remains OPEN as a Production-release evidence-model gap. It is not a date inventor and is not a blocker for taxonomy.

## Intended final state

Every 2027 launch-window row can be classified against this taxonomy with an owner, source-Issue family, evidence requirement, predecessor/successor, and freeze/exception rule before it is treated as a public date.

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

## Calendar of record

The Product-specified 2026-09-20 table on #2093 is the date source. This taxonomy does not copy or alter those dates. #3862 generates the operator-facing absolute calendar from that table.

## Protected stops

Stop and escalate to Product when any of the following is true: missing or disputed Product date; invented public date; unapproved announcement; unresolved rights or privacy; sponsor, donor, or fundraiser commitment beyond #2093; paid service or new credential; Production mutation from this package; failed rollback rehearsal; active numbered Operations interrupt; using a taxonomy row without owner or evidence as a public date.
