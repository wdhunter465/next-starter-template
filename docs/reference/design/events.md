---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: `/events` page contract, its data sources and its states
Does Not Own: Homepage calendar preview; back-office event editing; full events-domain schema
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #4824, #4822
Last Reviewed: 2026-10-23
---

# Page Spec — Events (`/events`)

## Purpose
Public page listing posted Fan Club events as a month view and a next-ten list. The homepage previews the same data in `home-calendar.md`.

## Route / Path
- Route: `/events` (trailing-slash canonical path `/events/`)
- Page: `src/app/events/page.tsx`
- Metadata: `src/app/events/layout.tsx` (title "Events", description "Upcoming Lou Gehrig Fan Club events and calendar preview.")

## Section / Component Breakdown
- Shell: `src/components/PageShell.tsx`, title "Upcoming Events", subtitle "Lou Gehrig Fan Club events and calendar previews while launch content is finalized"
- Month view: `src/components/calendar/EventsMonth.tsx`
- Next ten: `src/components/calendar/EventsNextTen.tsx`

## Data Dependencies
- `GET /api/events/month?month=YYYY-MM` (`functions/api/events/month.ts`). Reads `events` rows with `status='posted'` whose `start_date` is in that month, ordered by `start_date`, then `id`. An invalid or missing month falls back to the current month.
- `GET /api/events/next?limit=10` (`functions/api/events/next.ts`). Reads `events` rows with `status='posted'` and `start_date` on or after today (UTC), ordered the same way. The limit is clamped to 1 to 50.
- Event fields used: `id`, `title`, `start_date`, `end_date`, `location`, `host`, `fees`, `description`, `external_url`.
- Both components fetch with `cache: 'no-store'`.

## Auth / Access Expectations
- Publicly visible. No member authentication required.

## States
- Loading: "Loading events…"
- Empty month: "No events posted for this month."
- Empty next ten: "No upcoming events posted yet."
- Fetch failure: "Error loading events."

## Key UX / Behavior Notes
- Only events with `status='posted'` appear. Drafts and other statuses never render.
- The page is not in the locked homepage order; it is a standalone public route.
