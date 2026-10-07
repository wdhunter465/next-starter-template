---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Homepage milestones section purpose, layout contract, and behavior
Does Not Own: Historical content curation governance; admin CMS workflows
Canonical Reference: /docs/reference/design/home.md
Related Issues: #3161
Last Reviewed: 2026-10-07
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
- Reads milestone records via `GET /api/milestones/list` from the single `milestones` table. Homepage rows are baseball milestones: `event_type='career'` and `visibility='public'`.
- Provides loading and no-data fallback messaging.
- The same table holds the full life record. Club Home `GehrigTimeline` (`GET /api/fanclub/timeline`) uses every posted row, including birth, school, marriage, public appearances, and death, with `detail_body` and `source_url`. This homepage section must not show those life events or the narrative fields.

## Auth / Access Expectations
- Publicly visible.
- No auth gate.

## Key UX / Behavior Notes
- Section order is locked relative to Friends and Calendar.
- Content must remain legible with concise date/event presentation.
