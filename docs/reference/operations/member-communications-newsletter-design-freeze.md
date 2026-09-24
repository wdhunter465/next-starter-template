---
Doc Type: Reference
Audience: Product Authority, PMO, Operations, editors, and implementation agents
Authority Level: Controlled
Owns: Idea-stage design freeze for member communications and newsletter operations (#2074)
Does Not Own: ESP/vendor purchase, member-data import, send operations, privacy-terms mutation, public signup/archive UI, or campaign copy
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2074, #2093, #2084, #2039, #1700
Last Reviewed: 2026-09-24
---

# Member communications and newsletter — design freeze

## Purpose

Freeze the Idea-stage objective, scope, non-goals, owner, dependencies, and stage-exit deliverables for program candidate #2074. This is not a send-ready newsletter system and not a platform selection.

## Scope

In scope for this freeze: audience question list; consent/privacy boundaries that must be decided before Design; relationship to website, social, 2027 launch calendar (#2093), and Lou Gehrig Day (#2084); owner model; identified later design work units.

Out of scope: selecting or purchasing a delivery platform; importing member email lists; sending mail; creating ESP accounts; changing privacy or terms pages; implementing public signup or archive surfaces; treating #2093 freeze/announcement dates as newsletter Go.

## Current known truth

- Product Authority 2026-09-24 placed #2074 Active at `pmo:priority:5` with Cursor as implementation owner (due 2026-10-31). Claude ownership is withdrawn. The parent remains Idea-stage until this freeze and a later Design package exist.
- #2074 consolidates backlog items “Member communications / newsletter” and “LGFC newsletter”.
- Public website readiness is a timing gate on the Issue: do not launch member communications as a public campaign until website readiness is stable. That gate is not waived by this freeze.
- #2093 stays OPEN Active P1 for 2027 launch-calendar freeze and announcement class. This program does not invent announcement dates or seed D1 `events`.
- Runtime signup, archive, template, or admin surfaces remain No-Go until Product records an explicit later Go on a file-allowlisted child.

## Intended final state (program, not this PR)

A consent-safe member communications operation with approved cadence, editorial workflow, subscriber lifecycle, accessible templates, archive policy, and named operating ownership. Platform may be manual/zero-budget until Product selects otherwise.

## Frozen objective

Prepare a member communications and newsletter operations program package that can receive one project-level Go / No-Go after Design completes. Outcome is operational readiness, not a 2026 send.

## Frozen owner model

| Role | This program |
| --- | --- |
| Product Authority (Bill) | Audience (member-only, public, or dual); cadence; authorized sender/approver; lawful consent basis; budget/vendor; announcement relationship to #2093 |
| PMO | Stage evidence, sequencing vs #2093/#2084, independent closeout |
| Operations | Suppression/unsubscribe execution after a later Go; no send from this freeze |
| Cursor | Repo-backed signup, archive, template, or admin surface only after a later child Go |
| Editors | Draft copy inside later content packets; no unapproved send |

## Frozen non-goals

Platform purchase; member-data import; sending communications; creating vendor accounts; mutating privacy/terms from this Issue; public signup/archive UI; using unreviewed AI copy; treating `handoff:ready` as send Go.

## Product decisions still required (Design Needed inputs)

- Member-only, public newsletter, or both
- Purpose and cadence
- Authorized sender and approver
- Permitted data source and lawful consent basis
- Unsubscribe and suppression policy
- Archive visibility (member-only vs public)
- Content categories vs website/social/#2084 packets
- Branding relationship to the website and 2027 campaign
- Budget and acceptable vendors vs manual fallback

Absence of these decisions is a stop on Design-complete, not a default to send.

## Dependencies

| Dependency | Boundary |
| --- | --- |
| Public website stability | Timing gate on the Issue |
| #2093 launch calendar | Consumes Product-approved announcement windows; does not invent them |
| #2084 Lou Gehrig Day | May supply approved annual copy after Product Go; does not auto-mail |
| Privacy / unsubscribe | Later Design must cite live privacy policy; this freeze does not edit it |
| Member email as data | Fail-closed; no list export or ESP sync from this Issue |

## Identified later work units (not opened by this freeze)

1. Audience, purpose, success-measure, and editorial decision brief (Product).
2. Consent, privacy, data-flow, retention, and suppression model (Design).
3. Platform options including zero-budget/manual fallback (Design; no purchase).
4. Template accessibility and archive policy (Design).
5. Repo surfaces only if Product Go names exact paths.

## Validation

This freeze is valid when objective, scope, non-goals, owner, dependencies, and remaining Product decisions are explicit; no send, vendor, privacy-page, or UI change is in the same PR.

## Rollback

Revert the documentation commit. No subscriber or ESP state is created.

## Operations handoff

No mail component exists from this freeze. Operators do not send.

## Project Go / No-Go

| Decision | Status |
| --- | --- |
| Idea-stage design freeze (this file) | Product 2026-09-24 Active assignment is the Go for this freeze document |
| Design package complete | Not yet; waits on Product decisions listed above |
| Send, ESP, signup UI, privacy-page edits | No-Go |

## Protected stops

Stop for: treating this file as send authorization; importing member data; buying a vendor; announcing 2027 windows from #2093 without a separate Product Go; mixing runtime UI into this docs-only PR.
