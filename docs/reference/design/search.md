---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-14
---

# Search Page Specification — LGFC

**Route:** `/search`
**Access:** Public (visitor and member)
**Header state:** Visitor header (public) or FanClub header (if logged in on `/fanclub/**`)
**Desktop only.** Mobile/tablet implementation is deferred.

-----

## Purpose

`/search` serves two audiences with a single unified page:

- **Visitor:** Keyword search of all public site content
- **Member (logged in):** Keyword search of public content plus member-only
  content (photos, library, memorabilia, discussions)

Results are permission-filtered server-side based on session state. The page
layout is identical for both audiences; members simply see more results.

Full spec for /search as both a visitor search page and a member content browsing utility. 
Covers the search bar, result cards with type badges, permission-filtered scope (visitor vs member), ranking rules, pagination, and the URL ?q= pattern.
-----

## Page Layout

```
[Global Header]
[Page Container — 980px max, 20px padding]  (updated 2026-10-14 to the built width, Product Authority, #4409, D-045 and D-026)
  [Page Title — H1: "Search"]
  [Search Bar]
  [Results Area]
    [Result Count / Status line]
    [Result List]
    [Pagination — if needed]
[Global Footer]
```

-----

## Search Bar

A single prominent keyword input spanning the full content width.

- Input type: `text`
- Placeholder: `"Search the Lou Gehrig Fan Club…"`
- Submit: on Enter keypress or Search button click
- Button label: `"Search"`
- Button style: Primary button (LGFC Blue `#0033cc`, white text)
- Input height: `48px`
- Input border: `1px solid #dde3f5`, border-radius `12px`
- Focus ring: `2px solid #0033cc`, `outline-offset: 2px`
- Minimum query length: 2 characters (submit disabled below this)

URL pattern: `/search?q=keyword` — query is reflected in the URL so results
are shareable and browser-navigable.

-----

## Results Area

### Before Search (empty state)

No results list shown. Below the search bar:

> “Enter a keyword to search the fan club.”

-----

### After Search — Result Count Line

Displayed above the result list:

- `"X results for "keyword""` — when results exist
- `"No results for "keyword""` — when empty

Font size: `14px`, color: `#666666`

-----

### Result List

Each result renders as a card:

```
[Card]
  [Content Type Badge]   e.g. "FAQ" / "Event" / "Photo" / "Library"
  [Result Title — H3]
  [Excerpt / Description snippet — 1–2 lines]
  [Link → destination page or section]
```

Card styles (from style guide):

- Background: `#ffffff`
- Border: `1px solid #dde3f5`
- Border radius: `14px`
- Padding: `20px`
- Box shadow: `0 2px 8px rgba(0,0,0,0.08)`
- Gap between cards: `16px`

Content type badge:

- Small pill label, uppercase, `12px`, muted background (`#f8f9ff`), LGFC Blue
  text (`#0033cc`), border-radius `999px`

Result title:

- `18px`, font weight `600`, color `#333333`
- Rendered as a link to the content destination

Excerpt:

- `14px`, color `#666666`, line height `1.5`
- Truncated at ~120 characters if longer

-----

### Pagination

If results exceed 20 items, paginate.

- Show: Previous / page numbers / Next
- Current page highlighted with LGFC Blue background
- Simple numeric pagination; no infinite scroll

-----

## Search Scope

### Visitor (not logged in)

Searches public content only:

- FAQ entries (approved, answered)
- Events (published)
- Milestones
- About / static page content (if indexed)
- Friends of the Club entries

### Member (logged in)

All visitor content plus:

- Photo gallery (approved)
- Library entries
- Memorabilia entries
- Member discussion posts

### Admin

All content with no exclusions (handled via admin-specific interface, not this page).

-----

## Ranking

Results ranked by:

1. Closest textual match (title match ranks above body/description match)
1. Most-used / most-accessed (view count where available)

-----

## API / Data

- Endpoint: `GET /api/search?q=keyword&page=N`
- Server applies permission filter based on session state
- Response: `{ results: [...], total: N, page: N, pages: N }`
- Each result includes: `type`, `title`, `excerpt`, `url`

-----

## Empty Search Redirect

If user arrives at `/search` with no `q` parameter, show the empty state
(search bar only, with the prompt text). Do not redirect.

-----

## Implementation Notes

- Client component (`'use client'`) to handle input state and URL updates
- Use `useRouter` / `useSearchParams` to read and write `?q=` param
- Debounce not required — search executes on explicit submit only
- No autocomplete or typeahead in current phase
