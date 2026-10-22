---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Weekly vote results route intent, visibility, and expected result presentation
Does Not Own: Voting algorithm internals; moderation policy; image storage details
Canonical Reference: /docs/reference/design/fanclub.md
Last Reviewed: 2026-07-04
---

# `/weeklyvote` — Weekly Vote Results Specification

## Purpose
Define the hidden weekly vote results experience shown after a user casts a vote in the public Weekly Photo Matchup flow.

## Route / Path
- Canonical route: `/weeklyvote`
- Visibility: non-primary (linked from vote completion flow, not persistent header nav)

## Section / Component Breakdown
- Results page shell (`src/app/weeklyvote/page.tsx`) — **planned component/route**
- Winning image/card block — **planned**
- Vote share/percent summary — **planned**
- Return CTA back to home weekly section — **planned**

## Data Dependencies
- Weekly matchup result payload for current cycle (winner, total votes, percentages).
- Optional user-vote context used to show confirmation state.

## As-built note (2026-07-04)

Results are currently revealed **inline on the homepage** in `WeeklyMatchup.tsx` after a vote (`GET /api/matchup/results`). Vote rows live in D1 `weekly_votes`; winner is computed at read time (no persisted winner column). The standalone `/weeklyvote` route below remains planned extraction, not required for the live voting flow.

## Auth / Access Expectations
- Public-accessible route.
- If no current weekly result exists, route should show a deterministic empty/unavailable state.

## Key UX / Behavior Notes
- Route stays intentionally low-visibility; it should not be added as a persistent top-level nav item.
- Any deep-link should still render a stable read-only results experience.
- Copy and visuals should align with the public homepage Weekly Matchup tone.
