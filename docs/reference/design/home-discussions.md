---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Homepage recent discussions teaser contract and behavior
Does Not Own: Full FanClub discussion feature set; moderation policy
Canonical Reference: /docs/reference/design/home.md
Last Reviewed: 2026-10-14
---

# Homepage Section Spec — Recent Discussions Teaser

## Purpose
Define the public-home teaser section that previews recent club discussions and drives members to authenticated discussion flows.

## Route / Path
- Host page: `/`
- Section anchor/id: `#recent-club-discussions`

## Section / Component Breakdown
- Component owner: `src/components/RecentDiscussionsTeaser.tsx`
- Included from `src/app/page.tsx`

## Data Dependencies
- Reads latest posted discussions through the teaser’s backing API/data adapter. For signed-in members only (the list endpoint returns 401 to visitors).
- Must show deterministic loading and failure-safe fallback copy.

## Auth / Access Expectations
- The public view shows a fixed notice only: "Member discussions are private. Join or log in to read recent club posts." Discussion posts are not publicly viewable. Product Authority decided on 2026-10-14 (#4409, D-039) that discussions stay private; this replaces the earlier "publicly viewable teaser content" rule.
- Member-authenticated creation/reply flows remain in FanClub routes.

## Key UX / Behavior Notes
- Keep teaser scoped (summary style), not full threaded discussion UI.
- Preserve clear visual hierarchy between this teaser and deeper FanClub discussion experiences.
