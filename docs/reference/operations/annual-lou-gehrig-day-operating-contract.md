---
Doc Type: Reference
Audience: Product Authority, Operations, PMO, editors, and implementation agents
Authority Level: Controlled
Owns: Durable annual Lou Gehrig Day roles, decision rights, recurring checklist, inputs, outputs, and annual-instance schema for project #2084
Does Not Own: Year-specific copy or dates other than the June 2 anchor; website routes; automatic posting; Production mutation; fundraiser, partner, or recognition commitments
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2084, #3855, #2093, #1700, #2782
Last Reviewed: 2026-09-21
---

# Annual Lou Gehrig Day operating contract

## Purpose

Define the durable, year-independent operating contract for the Annual Lou Gehrig Day operations package (#2084). Year-specific dates and copy live in a separate annual instance record. This contract does not authorize public launch, automatic posting, new website routes, or Production mutation.

## Scope

In scope: durable annual roles, decision rights, recurring checklist, inputs, outputs, and the annual-instance schema.

Out of scope: year-specific copy; owning or approving public dates other than the June 2 anchor (the annual-instance schema still records Product-approved `additional_public_windows`); website routes; automatic posting; Production mutation; fundraiser, partner, or recognition commitments.

## Current known truth

- Product Graduation **GO** 2026-09-20 placed parent #2084 Active at `pmo:priority:3` with Cursor as implementation owner. Entry gate #2782 is closed complete.
- June 2 is the annual Lou Gehrig Day anchor. Every other public date, public copy, fundraiser claim, partner claim, and recognition claim requires Product Authority approval.
- #2093 owns the 2027 launch calendar. This package consumes approved dates from Product / #2093; it does not invent them.
- No Lou Gehrig Day runbook, instance schema, or operator handoff existed in-repo before this package.

## Intended final state

Operators can copy this contract into a new year, fill only the annual instance fields, and run checklist / freeze / smoke / rollback / evidence without rewriting policy.

## Roles and decision rights

| Role | Decision rights | Does not decide |
| --- | --- | --- |
| Product Authority (Bill) | Public dates other than June 2; public copy; fundraiser, partner, donor, and recognition claims; publication Go / No-Go / cancel | Repository merge, CI gates |
| Operations | Schedule health, smoke tests, incident classification, rollback/unpublish execution, evidence capture | Public copy, partner commitments, Production Go |
| PMO | Readiness recording, independent review of package completeness, project closeout preparation | Product Go, Production mutation |
| Editors | Draft content, rights/credit packets, and channel exports inside this contract | Publication without Product approval |
| Implementers | Bounded package/tool remediation named on a source Issue | Scope expansion, credentials, paid tools |

One human may hold more than one role. Builder/reviewer separation still applies: the implementer of a change does not independently approve that change.

## Recurring annual checklist (durable)

Every year, in order, without assuming extra public dates:

1. Confirm the June 2 anchor and record any Product-approved additional windows in that year's instance.
2. Freeze durable RACI (this document) and open a new annual instance from the schema below.
3. Assemble the content/rights/channel packet (`docs/reference/operations/annual-lou-gehrig-day-content-package.md`).
4. Apply freeze/change windows, readiness gates, and smoke tests (`docs/how-to/ops/run-annual-lou-gehrig-day.md`).
5. Rehearse without public posting or Production mutation.
6. Seek Product publication Go only when rehearsal evidence is complete. Absence of Go is a stop, not a default publish.
7. If Go is recorded, execute only the approved instance items; capture evidence (`docs/how-to/ops/complete-annual-lou-gehrig-day-evidence-report.md`).
8. After the window, close evidence, unpublish or restore as directed, and archive the instance.

## Inputs

| Input | Source | Required before rehearsal |
| --- | --- | --- |
| June 2 date for the target year | Calendar (always) | Yes |
| Additional public dates | Product Authority / #2093 | No; remain Product-gated when absent |
| Public copy and credits | Editors + Product | Yes for any public item |
| Rights/privacy disposition | `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md` | Yes for any public item |
| Fundraiser boundaries | #1700 lineage + Product | Yes if any fundraiser mention is in scope |
| Website spotlight contract | `docs/reference/website/editorial-placement-and-rotation.md` | Yes if homepage/Club Home spotlight is in scope |
| Rollback path | `docs/how-to/website/takedown-soft-delete-and-recovery.md` | Yes |

## Outputs

| Output | Destination |
| --- | --- |
| Annual instance record | `docs/ops/as-built/lou-gehrig-day-YYYY-instance.md` |
| Rehearsal record | `docs/ops/as-built/lou-gehrig-day-YYYY-rehearsal.md` |
| Evidence report | Completed template from `docs/how-to/ops/complete-annual-lou-gehrig-day-evidence-report.md` |
| Operator handoff | Same how-to plus the instance record |

## Annual-instance schema

Each year's instance must populate every field. Use `not-authorized` for items Product has not approved. Do not invent dates or copy to fill a field.

```text
year: <calendar year>
lou_gehrig_day_date: <YYYY-06-02>
additional_public_windows: <list of Product-approved windows, or not-authorized>
product_owner: Bill
operations_owner: <name>
editor_owner: <name>
public_copy_status: draft | product-approved | not-authorized
rights_status_summary: <per public item, using the rights-review vocabulary>
website_spotlight: planned | not-authorized
social_export: planned | not-authorized
newsletter_export: planned | not-authorized
fundraiser_mentions: planned | not-authorized
partner_recognition: planned | not-authorized
freeze_starts_at: <datetime or not-authorized>
publication_go: recorded | not-authorized
rollback_owner: Operations
evidence_report_path: <path or not-started>
```

## Protected stops

Stop and escalate to Product when any of the following is true: unapproved public date or copy; unresolved rights or privacy; sponsor, donor, or fundraiser commitment; paid service or new credential; unsafe Production change; failed rollback rehearsal; or an active numbered Operations interrupt.
