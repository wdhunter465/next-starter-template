---
Doc Type: Specification
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Homepage milestones section purpose, layout contract, and behavior
Does Not Own: Historical content curation governance; admin CMS workflows
Canonical Reference: /docs/reference/design/home.md
Related Issues: #3161
Last Reviewed: 2026-09-25
---

# Homepage Section Spec — Milestones

## Purpose
Define the homepage milestones section that surfaces notable Lou Gehrig / club timeline highlights.

## Route / Path
- Host page: `/`
- Section anchor/id: `#milestones`

## Section / Component Breakdown
- Section wrapper in `src/app/page.tsx`
- Component owner: `src/components/MilestonesSection.tsx`

## Data Dependencies
- Reads milestone records via `GET /api/milestones/list` (`milestones` table), filtered to `visibility='public'` — headline life/career events only.
- Provides loading and no-data fallback messaging.
- The full researched life timeline (marriage, school, public appearances, finer-grained career detail, and narrative `detail_body`/`source_url`) is member-only: see `GehrigTimeline` on FanClub Club Home, served by `GET /api/fanclub/timeline` (`docs/reference/design/fanclub-home.md`). This section must never surface member-tier rows or the `detail_body`/`source_url` fields to public visitors.

## Auth / Access Expectations
- Publicly visible.
- No auth gate.

## Key UX / Behavior Notes
- Section order is locked relative to Friends and Calendar.
- Content must remain legible with concise date/event presentation.
