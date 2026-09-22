---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #3162 chronological storytelling timeline decision brief — inventory (#4241), comparison (#4242), and TimelineJS3 license/release/accessibility notes (#4243)
Does Not Own: TimelineJS3 npm or iframe add; new Production timeline route; visual-system rewrite; vendoring TimelineJS internals; OpenAI-name sweep
Canonical Reference: /docs/reference/design/home-milestones.md
Related Issues: #3162, #4241, #4242, #4243, #4244, #2878
Last Reviewed: 2026-09-22
---

# Chronological Storytelling Timeline Decision Brief (#3162)

## Purpose

Record live-main chronological surfaces so later #3162 children can compare TimelineJS3 embed versus extending the custom timeline without adding a library from this parent.

## Scope

In scope for this revision (#4243): TimelineJS3 license, release, and accessibility verification notes, on top of inventory and comparison.

Out of scope: npm or iframe add; a new Production timeline route; restyling the homepage; embedding TimelineJS3.

## Current known truth

Observed 2026-09-22 on `origin/main` (`04e93cc5`):

- `src/components/fanclub/GehrigTimeline.tsx` loads `/api/milestones/list` (custom React, no TimelineJS).
- Homepage milestones authority is `docs/reference/design/home-milestones.md` (section `#milestones` on `/`, component `src/components/MilestonesSection.tsx`).
- `src/components/CalendarSection.tsx` is a dependency-free calendar (React plus `CalendarSection.module.css` only).
- Root `package.json` has no TimelineJS3 package. #2878 inspected a generic `Events.js` helper, not a timeline UI.

The idea-coherence claim that LGFC has no dedicated timeline is **partially stale**. A custom `GehrigTimeline` already exists. This parent decides whether to extend it or adopt a library.

## Intended final state

This file remains a decision brief. TimelineJS3 stays a documented non-chosen library unless a later source Issue re-opens adopt. This revision does not add npm or iframe chrome.

## Live timeline and milestones surfaces (#4241)

| Surface | Live fact |
| --- | --- |
| Fan Club Gehrig timeline | `GehrigTimeline.tsx` + `/api/milestones/list` — custom list, not TimelineJS |
| Homepage milestones | `home-milestones.md` / `MilestonesSection.tsx` / `#milestones` |
| Calendar | `CalendarSection.tsx` — no external timeline library |
| npm | No TimelineJS3 in `package.json` |

## TimelineJS3 embed versus extending the custom timeline (#4242)

| Approach | Visual language | Cost against the style guide |
| --- | --- | --- |
| Embed TimelineJS3 (iframe / library shell) | Knight Lab chrome, not LGFC | Significant CSS override; iframe isolation fights `docs/reference/design/style-guide.md` |
| Extend `GehrigTimeline` / milestones / CalendarSection precedent | Already matches LGFC components | Stays in existing React/CSS modules; no MPL embed chrome |

Pending-brief preference: **extend the custom component** rather than add MPL-licensed embed chrome. TimelineJS3 UX ideas (dated navigation, media pairing) may inform a later custom extension. This comparison does not add the npm or iframe dependency and does not rewrite the visual system.

## TimelineJS3 license, release, and accessibility (#4243)

TimelineJS3 (`NUKnightLab/TimelineJS3`) is **MPL-2.0**. File-level copyleft applies to modified MPL-licensed files. Using the unmodified library as a dependency does not copyleft the rest of the LGFC app. The archived predecessor `TimelineJS` repo is **not** a candidate.

#2878 left current-release cadence, dependency footprint, and accessibility unverified (collection log 2026-07-25). A later implementation Issue that re-opens adopt must re-verify the current TimelineJS3 release and accessibility before any add. This child does not vendor TimelineJS3 source.

## Protected stops

- Do not restyle the Production homepage.
- Do not embed an iframe timeline.
- Do not add TimelineJS3.
- Do not copy TimelineJS3 source into the repo.
