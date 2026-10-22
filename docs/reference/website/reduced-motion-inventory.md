---
Doc Type: Reference
Audience: LGFC maintainers, website implementers, and AI agents
Authority Level: Controlled
Owns: The inventory of animations, transitions and smooth scrolling on the public and member site, and how each honors prefers-reduced-motion
Does Not Own: Visual design of the animations, accessibility policy, or the end-to-end qualification check for catalog row 63
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #4624, #4467, #3633
Last Reviewed: 2026-10-18
---

# Reduced-motion inventory

## Purpose

Catalog row 63 (reduced motion where applicable) requires that every animation
and transition stops or shortens when the visitor's system asks for reduced
motion. This lists what moves and how each item is covered (#4624).

## How it is covered

- **CSS:** one rule in `src/app/globals.css` under
  `@media (prefers-reduced-motion: reduce)` sets animation and transition
  durations to near zero and turns off CSS smooth scrolling for every element.
  It covers all rows marked CSS below, including any added later.
- **Script:** `motionSafeScrollBehavior()` in `src/lib/motionPreference.ts`
  returns `auto` under reduced motion. Script-driven smooth scrolling must use it.
- **Test:** `tests/reduced-motion-4624.test.ts` fails if the global rule is
  removed, or if a smooth scroll is added without the helper.

## What moves

| Item | File | Kind | Covered by |
| --- | --- | --- | --- |
| Hero fade-in (`fadeIn`) | `src/app/page.module.css` | CSS animation | global rule |
| Home link and button fades | `src/app/page.module.css` | CSS transition | global rule |
| Charity (campaign) spotlight hover | `src/components/CharitySpotlight.module.css` | CSS transition | global rule |
| Join call to action | `src/components/JoinCTA.module.css` | CSS transition | global rule |
| Friends of the Fan Club cards and buttons | `src/components/FriendsOfFanClub.module.css` | CSS transition | global rule |
| Header and fan club header buttons | `src/components/Header.module.css`, `src/components/FanClubHeader.module.css` | CSS transition | global rule |
| Events banner | `src/components/EventsBanner.module.css` | CSS transition | global rule |
| Calendar section | `src/components/CalendarSection.module.css` | CSS transition | global rule |
| Shared button hover | `src/app/globals.css` | CSS transition | global rule |
| Weekly preview | `src/styles/weekly-preview.css` | CSS transition | global rule |
| Error page retry link | `src/app/error.tsx` | Tailwind transition class | global rule |
| Back to top | `src/components/Footer.tsx` | script smooth scroll | helper |
| Jump to membership card | `src/app/fanclub/myprofile/page.tsx` | script smooth scroll | helper |

## Checked and not motion

The carousel or rotation text in Club Home components is placeholder copy only.
The admin staging rotation preview (`ClubStagingRotationPreview.tsx`) swaps
content on a timer for staff and is not on the public or member pages. Timers
in `FaqBrowse`, `FAQSection`, `WeeklyMatchup` and `SocialWall` are polling or
debounce timers and move nothing on screen.
