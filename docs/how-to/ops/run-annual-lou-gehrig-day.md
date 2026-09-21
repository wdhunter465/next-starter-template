---
Doc Type: How-To
Audience: Operations, editors, PMO, and implementation agents
Authority Level: Operational Authority
Owns: Operator procedure for Lou Gehrig Day T-minus/T-plus calendar interfaces, freeze/change rules, readiness gates, smoke tests, rollback/unpublish, incident routing, and evidence retention
Does Not Own: Product publication Go; public copy; automatic posting; new website routes; Production mutation
Canonical Reference: /docs/reference/operations/annual-lou-gehrig-day-operating-contract.md
Related Issues: #2084, #3857, #2093
Last Reviewed: 2026-09-21
---

# Run the annual Lou Gehrig Day operations package

## Purpose

Walk operators through one annual cycle using the durable contract and that year's instance. Rehearsal and live execution both use this procedure. Rehearsal must not post or mutate Production.

## Current known truth

- Durable contract: `docs/reference/operations/annual-lou-gehrig-day-operating-contract.md`
- Content packet: `docs/reference/operations/annual-lou-gehrig-day-content-package.md`
- Website unpublish/restore: `docs/how-to/website/takedown-soft-delete-and-recovery.md`
- Scheduled social publish exists for other programs and is out of scope for rehearsal

## Intended final state

A named operator can freeze an instance, run smoke tests, hold or roll back, and file evidence without asking for a new program design.

## Calendar interfaces (T-minus / T-plus)

Relative to Lou Gehrig Day (June 2 of the instance year). These are internal operating marks, not public event dates.

| Mark | Operator action |
| --- | --- |
| T-56 | Open the annual instance file. Copy schema fields. Do not invent extra public dates. |
| T-28 | Content/rights packet complete or items marked `not-authorized`. |
| T-14 | Freeze starts unless Product records a later freeze. After freeze, only Product-approved deltas. |
| T-7 | Readiness gates and smoke tests. Rollback rehearsal on a non-production path (documentation plus admin restore drill using already-published unrelated content only if Product already authorized that drill). |
| T-1 | Confirm publication Go is recorded, or remain in hold. |
| T-0 | Execute only Go-approved instance rows. |
| T+1 | Evidence closeout; unpublish/restore as Product directed. |
| T+7 | Archive instance, rehearsal, and evidence paths. |

## Freeze and change rules

- After freeze, public copy, credits, windows, and channel lists are locked.
- Changes require a Product note on the instance Issue or parent #2084 naming the exact field.
- Missing Product approval means the change does not ship.

## Readiness gates (all must pass before asking for Go)

1. Instance schema fully populated (`not-authorized` counts as populated).
2. Every public item has a complete content-packet row.
3. No `unknown` or blocking rights/privacy states on items still marked planned.
4. Smoke tests passed (below).
5. Rollback path named and rehearsal recorded.
6. No active numbered Operations interrupt.

## Smoke tests

Run these as document and read-only checks unless a separate Issue authorizes a Production write:

1. Each planned website item resolves to a real `content_inventory` id or an explicit `not-authorized`.
2. Spotlight keys are only `homepage_spotlight` and/or `club_home`.
3. Social/newsletter exports exist as files or are `not-authorized`.
4. Fundraiser and partner rows are `not-authorized` or quote an existing Product approval.
5. Rollback owner and procedure path are filled.
6. Accessibility/link/attribution: every public item has alt/credit/source or is dropped.

Do not call scheduled-content publish, Zapier, or D1 apply during this how-to.

## Rollback and unpublish

- Before any publication: cancel or replace the instance; leave Production unchanged.
- After authorized publication: use `docs/how-to/website/takedown-soft-delete-and-recovery.md` for website items; for social/newsletter, follow the channel's native delete/unpublish and keep screenshots or export logs in the evidence report.
- Revert component-branch documentation without altering accepted website state.

## Incident routing

| Class | Route |
| --- | --- |
| Wrong date or unapproved copy live | Operations interrupt; unpublish; Product |
| Rights/privacy complaint | Takedown how-to; Product |
| Channel tool failure | Skip channel; record `failed` on evidence |
| Numbered Operations Issue | Stop this package until that Issue clears |

## Evidence retention

Keep the instance, rehearsal, and evidence report in `docs/ops/as-built/` and the how-to template. Do not put secrets, donor personal data, or unapproved partner terms in those files.

## Steps (live year)

1. Open or copy the year instance under `docs/ops/as-built/`.
2. Complete the content packet rows.
3. Hit freeze at T-14 or the Product-recorded freeze.
4. Run smoke tests and rollback rehearsal.
5. Stop for Product publication Go.
6. If Go is recorded, execute approved rows only.
7. File the evidence report, including skipped, failed, and rolled-back items.
