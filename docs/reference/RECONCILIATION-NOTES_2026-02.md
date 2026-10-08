---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-08
---

# Design Documentation Reconciliation — 2026-02-17

## Purpose

This document records conflicts found between existing design documents and
resolves them in favor of `master_design.md` as the route/structure authority.
These resolutions must be applied to the affected documents in subsequent PRs.

Documents the 6 conflicts found and resolves each one. 
Includes a table of which existing docs need to be updated (the four docs that contradict master_design.md).

-----

## Resolved Conflicts

### 1. Public Header — Logged-In State

**Conflict:** Two models exist.

- `LGFC-Production-Design-and-Standards.md` (Jan 20 addendum): 6 buttons —
  Join, Search, Store, Login, Club Home, Logout
- `master_design.md`: 4 buttons — Club Home, Search, Store, Logout
  (Join replaced by Club Home; Login replaced by Logout)

**Resolution:** `master_design.md` wins. The logged-in public header is:

1. Club Home → `/fanclub`
1. Search → `/search`
1. Store → external Bonfire link
1. Logout → `/logout`

`LGFC-Production-Design-and-Standards.md` must be updated to remove the 6-button model.

-----


-----


**Conflict:**

  canonical FanClub subpage.
- `master_design.md` removes this route; membership card content is
  consolidated into `/fanclub/myprofile` (bottom section of that page).

and card images live at the bottom of `/fanclub/myprofile`.
`NAVIGATION-INVARIANTS.md` and `fanclub.md` must be updated.

-----

### 4. Footer Link Order

**Conflict:**

- `NAVIGATION-INVARIANTS.md`: Contact, Contact, Terms, Privacy
- `LGFC-Production-Design-and-Standards.md` (Jan 20 addendum): Privacy, Terms,
  Contact, Contact (with Admin conditional)

**Resolution:** The Jan 20 addendum in `LGFC-Production-Design-and-Standards.md`
is more recent and includes the Admin conditional link. Canonical footer link
order (right side):

1. Privacy → `/privacy`
1. Terms → `/terms`
1. Contact → `/contact`
1. Contact → mailto link
1. Admin → `/admin` (visible to admin users only)

`NAVIGATION-INVARIANTS.md` must be updated to match.

-----

### 5. Homepage — “About Lou Gehrig” Section

**Conflict:**

- `home.md` canonical section order has 9 sections; no “About Lou Gehrig”
  section.
- `master_design.md` lists it as section 5 between Join Prompt and Social Wall.

**Resolution:** `master_design.md` wins. `home.md` must be updated to add
“About Lou Gehrig” as section 5, shifting subsequent sections.

Updated canonical homepage section order:

1. Hero / Banner
1. Weekly Matchup
1. Join Prompt
1. About Lou Gehrig
1. Social Wall / Community Signal
1. Discussions Entry (teaser)
1. Friends / Partners Tiles
1. Calendar Preview
1. Milestones
1. FAQ Section
1. Footer

-----

### 6. Mobile / Tablet Implementation Status

Per `docs/reference/DOCS_CLEANUP_RECORD_2026-02-17.md`:

> Mobile + tablet implementation is HALTED until further notice.
> Desktop implementation remains the only active UX target.

All design specs in this set are desktop-only. Any prior mobile/tablet
layout rules in existing docs are DEFERRED and should not be implemented.

-----

## Document Update Queue

The following documents require updates to reflect these resolutions:

|Document                                 |Required Change                                                                |
|-----------------------------------------|-------------------------------------------------------------------------------|
|`LGFC-Production-Design-and-Standards.md`|Remove 6-button logged-in header model; update footer link order               |
|`home.md`                                |Add “About Lou Gehrig” as section 4 (renumber subsequent sections)             |

-----

## Supersession Note — Footer Model (2026-03-25)

The five-link footer model described in earlier entries of this file
(Privacy → Terms → Contact → mailto Contact → Admin conditional) is **no longer current**.

The production public footer was reconciled during T19 (footer invariants reopen, PR #623)
and the docs were further aligned in the T19 documentation reconciliation task.

**Current canonical footer** (right column, locked):

- Row 1: Privacy (`/privacy`), Terms (`/terms`)
- Row 2: Contact (`/contact`)
- No `mailto:` footer link
- No Admin link in the public footer

Authority: `/docs/reference/design/LGFC-Production-Design-and-Standards.md`
