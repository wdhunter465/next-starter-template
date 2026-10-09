---
Doc Type: Operations
Audience: Product Authority, Engineering, PMO Admin, LGFC maintainers, implementation agents, and reviewers
Authority Level: Operational Authority
Owns: Priority #2 PMO readiness decision, fundraiser program candidate scope, child-project boundaries, campaign operations design/readiness state, implementer launch preconditions
Does Not Own: Runtime implementation, issue creation, merge authority, production secrets, vendor configuration, Givebutter account configuration, fundraiser execution launch
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #1696, #1379, #1255, #1259, #1685, #1686, #1694, #4414, #4442
Last Reviewed: 2026-10-09
---

# Fundraiser / Charity Campaign Operations Buildout Readiness

> **Status update (2026-10-09, #4442).** This document was written in June 2026, before the 2027 calendar decisions. Dates, launch decisions and build tasks for the 2027 fundraiser now live in the 2027 launch calendar operating contract (`docs/reference/operations/2027-launch-calendar-operating-contract.md`) and the go-live program (#4414). Where this document's "blocked until launch" wording or its preconditions conflict with those, they control. This document remains the reference for the website/vendor ownership boundary, the privacy and donor-recognition rules, and the fail-closed campaign-surface rules below. It authorizes no implementation: each build task needs its own Issue, allowlist and Product Authority Go.

> Original June 2026 wording, kept for history: the program was BLOCKED from execution until Product Authority explicitly launched it.

## Purpose

This document converts PMO Backlog Priority #2 into a PMO July 2026 future-program readiness package.

Priority #2 is the **Fundraiser / Charity Campaign Operations Buildout** group. The group contains the future work required to run repeatable LGFC fundraiser campaigns with clear external-vendor boundaries, website campaign surfaces, leaderboard/winner rules, donor/sponsor recognition controls, and pre-launch verification.

## Scope

This readiness package covers these Priority #2 projects:

1. Fundraiser / Charity Campaign Operations Buildout
2. Fundraiser operations playbook
3. Givebutter integration model
4. Leaderboard / winner system
5. Homepage spotlight / campaign surface
6. Sponsor / donor recognition
7. Testing package

This document owns the PMO readiness decision, project boundaries, source-of-truth map, missing-decision register, implementation-readiness classification, donor privacy guardrails, and pre-launch requirements for the implementing role.

This document does not launch implementation, create child issues, authorize implementation, change runtime behavior, update workflow YAML, configure Givebutter, configure Cloudflare, configure B2, define fundraiser accounting, or supersede canonical production design authority.

## Current known truth

- PMO Backlog Priority #2 is a future program candidate, not an executable queue by itself.
- Program #1255 and child #1259 remain ahead of this program unless Product Authority explicitly reprioritizes.
- Priority #1 Website Completion / Fan Club Product Buildout is parked as #1685 with child issues #1686 through #1694.
- Givebutter is the likely external campaign platform boundary, but account/vendor configuration is out of scope for this documentation package.
- The LGFC website should own only internal display, routing, campaign spotlight, deterministic website-side state, privacy-safe recognition, and pre-launch verification rules.
- Donor/sponsor recognition must not expose public PII by default.
- Campaign surfaces must fail closed when campaign configuration is missing, disabled, invalid, stale, or unpublished.
- Implementation is done by the Engineering role holder (`docs/governance/AGENT-TEAM.md`) after explicit Product Authority authorization on the task Issue.

## Intended final state

After this readiness package is approved, Priority #2 should be usable as a future program-of-work planning package for assignment to the Engineering role once Product Authority authorizes it.

The intended final state before implementation launch is:

- one PMO July 2026 program candidate with a clear launch-state control statement;
- child-project boundaries for operations, Givebutter integration, leaderboard/winner calculation, homepage campaign surface, donor/sponsor recognition, and launch testing;
- an implementation plan that defines task order, file areas, validation, and closeout expectations;
- explicit separation between external campaign ownership and internal website/data ownership;
- explicit donor/sponsor privacy controls;
- no requirement for an implementer to infer fundraiser behavior from chat history, historical ideas issues, or stale PMO v2 language.

## Priority #2 program candidate

| Field | Value |
| --- | --- |
| Candidate program name | Fundraiser / Charity Campaign Operations Buildout |
| PMO source | PMO Backlog Priority #2 |
| Source issue | #1696 |
| Implementation owner | Engineering role holder per `docs/governance/AGENT-TEAM.md` |
| Current readiness | Planning-ready; no implementation until Product Authority authorizes it (see the status update) |
| Primary implementation plan | `docs/ops/implementation-plans/fundraiser-charity-campaign-operations-buildout.md` |
| Primary operations authority | This readiness document plus the future fundraiser operations playbook task output |
| Product surface | Fundraiser campaign operations, campaign spotlight, leaderboard/winner display, recognition, and pre-launch verification |
| Explicit non-goal | Implementing fundraiser runtime work before Program #1255/#1259 and parked Priority #1 are resolved or explicitly reprioritized |

## Child-project readiness inventory

| Priority item | project name | Current state | Design authority | Implementation plan state | Readiness decision |
| --- | --- | --- | --- | --- | --- |
| 2 | Fundraiser / Charity Campaign Operations Buildout | PMO July 2026 program candidate | This readiness doc plus PMO backlog row | `fundraiser-charity-campaign-operations-buildout.md` | Ready for Product Authority planning review; no launch without authorization |
| 2a | Fundraiser operations playbook | Draft concept | This readiness doc; future Task 001 output | Covered by Tasks 001, 007, 008 | Needs documentation before build |
| 2b | Givebutter integration model | Draft concept | This readiness doc; future Task 002 output | Covered by Tasks 002, 004, 006, 007 | Needs external/internal boundary confirmation |
| 2c | Leaderboard / winner system | Draft concept | This readiness doc; future Tasks 002 and 003 outputs | Covered by Tasks 003, 006, 007 | Needs scoring and snapshot rules |
| 2d | Homepage spotlight / campaign surface | Draft concept tied to website production behavior | Production design standards plus future Task 004 output | Covered by Tasks 004, 006, 007 | Must stay fail-closed |
| 2e | Sponsor / donor recognition | Draft concept with duplicate backlog overlap | This readiness doc; privacy rules in Task 005 | Covered by Tasks 005, 006, 007 | Merge with rank 15 recognition scope for this program |
| 2f | Testing package | Draft concept | PMO closeout practice plus future Task 007 output | Covered by Tasks 007 and 008 | Required before launch |

## External/internal ownership model

| Surface | Owner | LGFC website responsibility | Out of scope for LGFC website implementation |
| --- | --- | --- | --- |
| Givebutter campaign setup | Human operator / Givebutter | Store approved public URL/config reference only if needed | Creating or configuring the Givebutter campaign/account |
| Donations and payment processing | Givebutter | Link or embed only through approved campaign surface | Payment handling, card data, refunds, tax receipting |
| Auction or raffle mechanics | Givebutter / human operator | Display approved public links or summaries only | Legal/rules administration, payment settlement, fulfillment disputes |
| Leaderboard snapshots | LGFC only after approved boundary | Display deterministic snapshot state if imported/approved | Scraping donor PII or treating live vendor state as authoritative without rules |
| Winner announcement | LGFC after operator approval | Publish privacy-safe winner label/state | Publishing private donor identity without consent |
| Sponsor/donor recognition | LGFC after consent/privacy review | Display approved public name, tier, logo, or anonymized entry | Public PII exposure, unapproved donor lists, raw transaction exports |

## Privacy and donor recognition rules

- Default public display is anonymous, aggregated, tiered, or consent-based.
- Do not publish donor email, phone, address, payment details, raw transaction ID, internal notes, or private account metadata.
- Sponsor logos or names require approved public-use status before display.
- Winner publication must use a privacy-safe display label and must not reveal unapproved donor details.
- Internal review artifacts may reference private source material only if stored in an appropriate private/admin-only location; public website surfaces must not expose it.
- Any implementation task touching recognition display must include a privacy validation checklist.

## Campaign surface rules

- Campaign spotlight surfaces must fail closed when disabled, missing, invalid, stale, or unpublished.
- Public campaign links must be operator-approved.
- Campaign status must distinguish draft, preview, active, paused, ended, and archived states.
- Homepage campaign promotion must not block core website navigation when no active campaign exists.
- Campaign display must not assume live vendor connectivity.
- Preview/review gates are required before public launch.

## Missing-decision register

| Decision | Needed before | Current default |
| --- | --- | --- |
| Givebutter account/campaign owner | Task 002 implementation | External operator-owned; website stores only approved references |
| Campaign public URL/embed approach | Task 004 | Link-first; embed only if validated and explicitly approved |
| Leaderboard source of truth | Task 003 | Snapshot/import model; no raw live donor feed assumption |
| Winner calculation rule | Task 003 | Deterministic snapshot + documented tiebreaker required |
| Sponsor/donor recognition consent model | Task 005 | No public PII; display only approved public recognition fields |
| Campaign archive policy | Task 001 / Task 008 | Archive public summary only after operator review |
| Pre-launch acceptance gate | Task 007 | Full checklist required before launch |

## Launch preconditions

Before an implementer receives an assignment for this program (June 2026 preconditions; the 2027 go-live program #4414 and each task Issue now govern, see the status update above):

1. Program #1255/#1259 status must be resolved, or Product Authority must explicitly reprioritize.
2. Parked Priority #1 status (#1685–#1694) must be resolved, deferred, or explicitly superseded.
3. A current program issue must explicitly launch Priority #2 (for 2027, #4414 and its task Issues).
4. Child task issues must be created from the implementation plan only after launch approval.
5. An implementer receives one task issue at a time unless Product Authority explicitly approves parallel execution.
6. Givebutter/vendor configuration decisions must be recorded outside implementation code tasks.
7. Donor privacy rules must be accepted before any public recognition task starts.

## Readiness conclusion

Priority #2 is now documented as a future PMO July 2026 program candidate.

It is **planning-ready**, not executable. It becomes implementation-ready only after Product Authority explicitly authorizes it and child task issue creation from `docs/ops/implementation-plans/fundraiser-charity-campaign-operations-buildout.md`.
