---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-14
---

# FanClub Sub-Page Specifications — LGFC

Covers these FanClub pages:

- `/fanclub/photo`
- `/fanclub/library`
- `/fanclub/memorabilia`
- `/fanclub/myprofile`

Canonical auth reference: /docs/reference/design/auth-model.md

Canonical auth reference: /docs/reference/design/auth-model.md

All pages:

- Require login (`/fanclub/**` auth boundary)
- Unauthenticated access redirects to `/`
- Use the FanClub header
- Desktop only — mobile/tablet implementation is deferred

---

## Shared FanClub Page Layout

```
[FanClub Header]
[Page Container — 980px to 1100px max depending on the page, 20px padding]  (updated 2026-10-14 to the built widths, Product Authority, #4409, D-026)
  [Page Title — H1]
  [Keyword Search Bar]
  [Content Area]
[Global Footer]
```

---

# `/fanclub/photo` — Photo Gallery

**Purpose:** Thumbnail gallery of approved fan club photos. Tag-based and keyword searchable. Members can submit photos for admin approval.

**D1 source of truth:** `photos`

## Page Layout

```
[H1: "Photo Gallery"]
[Search Bar]
[Tag Filter Bar]
[Photo Grid]
[Submit a Photo CTA]
```

## Search Bar

- Placeholder: `"Search photos…"`
- Filters by tags and text stored against `photos`
- Executes on submit (Enter or button click)
- URL param: `?q=keyword`

## Tag Filter Bar

A horizontal row of pill buttons populated from tags stored on `photos`.

- Active tag highlighted with LGFC Blue background
- Multiple tags selectable simultaneously (AND filter)
- “All” pill resets to no tag filter

## Photo Grid

- Grid layout: 3 columns desktop
- Each cell: thumbnail image + caption below
- Thumbnail served from B2
- Caption uses title or description text from `photos`
- Clicking thumbnail opens a detail view (modal or dedicated route — implementation detail)

### Empty State

> “No photos match your search.”

## Submit a Photo

Below the grid:

> “Have a photo to share? [Submit a Photo →]”

Submission flow: member uploads a photo; admin approval/publishing workflow is implementation detail.

## Data

- `GET /api/fanclub/photos?q=keyword&tags=tag1,tag2&page=N`
- Permission: member session required
- Backed by D1 table: `photos`

---

# `/fanclub/library` — Library

**Purpose:** Written content related to Lou Gehrig, including stories, context, and supporting material tied to fan club photos and memorabilia.

**D1 source of truth:** `content_inventory` (published rows allowed in the library section)

**Legacy note:** `library_entries` remains Day 1 written-content history. New member-library reads use `content_inventory`; any migration off `library_entries` must follow the backfill/fallback rules in the canonical production design authority.

## Page Layout

```
[H1: "Gehrig Library"]
[Search Bar]
[Library Table / List]
```

## Search Bar

- Placeholder: `"Search library…"`
- Filters by title and written content
- URL param: `?q=keyword`

## Library List

Tabular or list-based view for written content.

- Title is the primary row label
- Entries support tags
- Entries should support linkage to related `photos`
- This written content is the story/context layer that pairs with photos and memorabilia

### Empty State

> “No library entries match your search.”

## Data

- `GET /api/fanclub/library?q=keyword&page=N`
- Permission: member session required
- Backed by D1 table: `content_inventory` (published library-section rows)
- `library_entries` may still exist for legacy written-content history but is not the active member-library read source after the T45 redesign
- Tagging and photo-linkage remain required parts of the design contract through `content_inventory` metadata and related `photos` linkage

---

# `/fanclub/memorabilia` — Memorabilia Archive

**Purpose:** Filtered memorabilia view built from tagged records in `photos`, with related written story/context coming from `library_entries`.

## Canonical Data Rule

Memorabilia is **not** a standalone D1 table.

Memorabilia is derived from:

- D1 table `photos`
- tags/filters that identify memorabilia items
- related written story/context from `library_entries`

## Page Layout

```
[H1: "Memorabilia Archive"]
[Search Bar]
[Tag Filter Bar]
[Memorabilia Grid]
```

## Search Bar

- Placeholder: `"Search memorabilia…"`
- Filters tagged memorabilia records from `photos`
- URL param: `?q=keyword`

## Memorabilia Grid

- Grid layout: 3 columns desktop
- Each item is a memorabilia-tagged photo record from `photos`
- Detail view may include:
  - larger image
  - full title / description
  - tags
  - related written story from `library_entries`

### Empty State

> “No memorabilia items match your search.”

## Data

- `GET /api/fanclub/memorabilia?q=keyword&tags=tag1,tag2&page=N`
- Permission: member session required
- Derived from D1 table: `photos`
- Related written content source: `library_entries`

---

# `/fanclub/myprofile` — My Profile

**Purpose:** Member profile view and edit page for the signed-in member. This page also displays the membership card instructions and the front/back card images.

## Canonical Data Rule

- MyProfile is a page per member in the `members` table
- The member table entry is created during the JOIN process
- Membership card is **not** a page
- Membership card content appears on `/fanclub/myprofile`

## Page Layout

```
[H1: "My Profile"]

[Profile Section]
  [Member fields — editable]
  [Save / Cancel buttons]

[Membership Card Section]
  [Instructions text]
  [Card front image]
  [Card back image]
```

## Profile Section

### Editable Fields

|Field|Type|Required|Notes|
|---|---|---|---|
|First name|text|Yes| |
|Last name|text|Yes| |
|Screen name|text|No|Display name used in club|
|Email address|email|Yes| |
|Email opt-in|checkbox|No|Opt in/out of communications|

### Save / Cancel

- **Save:** Persists editable member/profile data to the current member record
- **Cancel:** Discards unsaved changes and restores last saved state

## Membership Card Section

Displayed below the profile section.

### Content

- Instructions text
- Card front image
- Card back image

### Purpose

Provides members with instructions for obtaining and using their membership card. This content is displayed on the My Profile page and is not a standalone page.

## Data

- Member profile: `GET /api/fanclub/profile`
- Save: `POST /api/fanclub/profile`
- Membership card content: `GET /api/content/membercard`

---

## Day 1 Exclusions

The following are **not** Day 1 scope and must not appear in this design document as active requirements:

- profile-avatar system
- profile-avatar eligibility
- profile picture selector
- avatar-specific API requirements
