---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #3162 chronological storytelling timeline decision brief — live surface inventory (#4241)
Does Not Own: TimelineJS3 npm or iframe add; new Production timeline route; visual-system rewrite; vendoring TimelineJS internals; OpenAI-name sweep
Canonical Reference: /docs/reference/design/home-milestones.md
Related Issues: #3162, #4241, #4242, #4243, #4244, #2878
Last Reviewed: 2026-09-22
---

# Chronological Storytelling Timeline Decision Brief (#3162)

## Purpose

Record live-main chronological surfaces so later #3162 children can compare TimelineJS3 embed versus extending the custom timeline without adding a library from this parent.

## Scope

In scope for this revision (#4241): inventory of live timeline and milestones surfaces.

Out of scope: npm or iframe add; a new Production timeline route; restyling the homepage; embedding TimelineJS3.

## Current known truth

Observed 2026-09-22 on `origin/main` (`04e93cc5`):

- `src/components/fanclub/GehrigTimeline.tsx` loads `/api/milestones/list` (custom React, no TimelineJS).
- Homepage milestones authority is `docs/reference/design/home-milestones.md` (section `#milestones` on `/`, component `src/components/MilestonesSection.tsx`).
- `src/components/CalendarSection.tsx` is a dependency-free calendar (React plus `CalendarSection.module.css` only).
- Root `package.json` has no TimelineJS3 package. #2878 inspected a generic `Events.js` helper, not a timeline UI.

The idea-coherence claim that LGFC has no dedicated timeline is **partially stale**. A custom `GehrigTimeline` already exists. This parent decides whether to extend it or adopt a library.

## Intended final state

This file remains a decision brief. Later children record comparison, license notes, and the adopt-versus-extend recommendation. This revision does not authorize TimelineJS3.

## Live timeline and milestones surfaces (#4241)

| Surface | Live fact |
| --- | --- |
| Fan Club Gehrig timeline | `GehrigTimeline.tsx` + `/api/milestones/list` — custom list, not TimelineJS |
| Homepage milestones | `home-milestones.md` / `MilestonesSection.tsx` / `#milestones` |
| Calendar | `CalendarSection.tsx` — no external timeline library |
| npm | No TimelineJS3 in `package.json` |

## Protected stops

- Do not restyle the Production homepage.
- Do not embed an iframe timeline.
- Do not add TimelineJS3.
