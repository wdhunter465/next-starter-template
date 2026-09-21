---
Doc Type: Reference
Audience: Product Authority, editors, Operations, and implementation agents
Authority Level: Controlled
Owns: Reusable Lou Gehrig Day content, rights/credit, website spotlight, social/newsletter export, fundraiser-boundary, and partner/recognition packet for project #2084
Does Not Own: Public copy authorship; Product approval; automatic posting; new website routes; rights acquisition; partner or sponsor contracts
Canonical Reference: /docs/reference/operations/annual-lou-gehrig-day-operating-contract.md
Related Issues: #2084, #3856, #1700, #1256, #1738
Last Reviewed: 2026-09-21
---

# Annual Lou Gehrig Day content and channel package

## Purpose

Define the reusable content packet that every Lou Gehrig Day instance must complete before rehearsal. This packet is documentation and operator procedure. It does not publish anything.

## Scope

In scope: reusable content, rights/credit, website spotlight, social/newsletter export, fundraiser-boundary, and partner/recognition packet fields, plus package-level fallbacks.

Out of scope: public copy authorship; Product approval; automatic posting; new website routes; rights acquisition; partner or sponsor contracts.

## Current known truth

- Homepage and Club Home spotlight eligibility is already defined in `docs/reference/website/editorial-placement-and-rotation.md` (`homepage_spotlight`, `club_home`).
- Rights, privacy, and no-publish conditions are already defined in `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md`.
- Scheduled website publish plus Zapier social cross-post exists for pre-authored `content_blocks` (`docs/how-to/ops/run-scheduled-content-publish.md`). That path is **not** to be used for Lou Gehrig Day rehearsal and is not a substitute for Product publication Go.
- Fundraiser operations remain under #1700. This package may only *mention* fundraiser activity that Product has already approved.

## Intended final state

Every public Lou Gehrig Day item in an annual instance has source, rights/credit, owner, approver, channel, scheduled window, fallback, and rollback recorded before anyone asks for publication Go.

## Public-item row (required per item)

| Field | Allowed values |
| --- | --- |
| `item_id` | Stable slug for the year (`lgd-2027-spotlight`, and so on) |
| `channel` | `website-spotlight` / `club-home` / `social-export` / `newsletter-export` / `fundraiser-mention` / `partner-recognition` |
| `source` | Exact inventory id, URL, or "LGFC-owned original" |
| `rights_status` | Vocabulary from the rights-review model (`unknown` blocks public use) |
| `credit` | Required string or `not-applicable` with justification |
| `owner` | Editor or Operations named person |
| `approver` | Product Authority for public copy |
| `window` | June 2 and/or a Product-approved additional window; otherwise `not-authorized` |
| `fallback` | Manual hold, omit channel, or cancel instance |
| `rollback` | Unpublish/restore path from `docs/how-to/website/takedown-soft-delete-and-recovery.md` for website items; omit/cancel for exports that never posted |

## Channel contracts

### Website spotlight

- Placement keys: `homepage_spotlight` and, when Club Home is in scope, `club_home`.
- Public reads remain published-inventory only. This package does not add routes.
- Fallback: leave the existing homepage/Club Home content in place; do not ship an empty or unapproved spotlight.

### Social and newsletter exports

- Exports are operator-prepared copy decks, not automatic posts.
- Rehearsal must not call Zapier, scheduled-content publish, or any social API.
- Fallback: skip the channel and record `skipped` on the evidence report.

### Fundraiser mentions

- Allowed only for claims Product already approved for that year.
- Must not imply payment processing, prize guarantees, or partner funding that Product did not approve.
- Fallback: remove the mention; do not replace it with guessed copy.

### Partner / donor / recognition

- Touchpoints are named lists for Product review, not commitments.
- Unapproved names stay `not-authorized`.
- Fallback: omit the recognition block.

## Rights and credit review

1. Inventory each public item against the rights-review clearance states.
2. Block public use while status is `unknown`, `permission-needed`, `rejected`, or privacy-flagged `minors` / `sensitive` without Product disposition.
3. Record credit on the instance even for LGFC-owned originals.
4. Do not acquire new rights, paid licenses, or credentials from this package.

## Fallbacks (package-level)

| Failure | Fallback |
| --- | --- |
| Spotlight unpublished or inventory miss | Keep prior published homepage/Club Home; mark spotlight `skipped` |
| Social/newsletter tool unavailable | Manual export file only, or skip channel |
| Rights unresolved on freeze date | Drop the item; do not publish a redacted guess |
| Fundraiser or partner claim lacks Product approval | Omit the claim |
| Rollback rehearsal fails | Hold the instance; no publication Go |
