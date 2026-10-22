---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Homepage calendar section contract and interaction expectations
Does Not Own: Full events-domain schema; back-office event editing workflows
Canonical Reference: /docs/reference/design/home.md
Last Reviewed: 2026-03-27
---

# Homepage Section Spec — Calendar

## Purpose
Define the homepage calendar section that previews near-term Fan Club events.

## Route / Path
- Host page: `/`
- Section anchor/id: `#calendar`

## Section / Component Breakdown
- Section wrapper in `src/app/page.tsx`
- Component owner: `src/components/CalendarSection.tsx`
- Styles owner: `src/components/CalendarSection.module.css`

## Data Dependencies
- Event data via calendar/event APIs consumed by `CalendarSection`.
- Renders an empty calendar with a status notice when live data is unavailable.

## Auth / Access Expectations
- Publicly visible section.
- No sign-in required for read access.

## Key UX / Behavior Notes
- Calendar grid + detail panel behavior must remain stable on desktop/mobile.
- Section communicates loading/error/empty states without collapsing layout.
