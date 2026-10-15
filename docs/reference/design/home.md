---
Doc Type: Design Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Homepage section layout and component mapping
Does Not Own: Component implementation; global navigation standards
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-14
---

# Homepage Layout

The homepage uses a fixed canonical section order.

Design-sensitive homepage work must also read `/docs/explanation/lgfc-design-evolution.md` for historical rationale and end-state intent. That explanation document does not override canonical design authority; it prevents agents from filling documentation gaps with invented product direction.

---

# Homepage Canonical Section Order

1. HEADER
2. BANNER
3. SPOTLIGHT (hidden by default)
4. WEEKLY MATCHUP
5. JOIN
6. ABOUT
7. SOCIAL
8. DISCUSSIONS
9. FRIENDS
10. MILESTONES
11. CALENDAR
12. FAQ/ASK
13. FOOTER

When spotlight is inactive, position #3 remains a hidden slot; the locked sequence still governs the page contract.

A hidden Fundraiser Details teaser (`#fundraiser-daily-details`) sits directly above the spotlight slot. It is not part of the numbered order (accepted 2026-10-14, Product Authority, #4409, D-038).

---

# Homepage Section → Component Mapping

| Homepage section | Ownership status | Component / file mapping |
|---|---|---|
| Floating logo (homepage-only behavior) | Implemented | `src/components/FloatingLogo.tsx` (invoked in `src/app/page.tsx`) |
| Hero Banner | Implemented (inline in page) | `src/app/page.tsx` hero `<header id="banner">` block |
| Campaign Spotlight slot | Implemented | `src/components/home/CampaignSpotlightSlot.tsx` |
| Weekly Photo Matchup | Implemented | `src/components/WeeklyMatchup.tsx` |
| Join CTA | Implemented | `src/components/JoinCTA.tsx` |
| About Lou Gehrig | Implemented (inline in page) | `src/app/page.tsx` `<section id="about-lou-gehrig">` block |
| Social Wall | Implemented | `src/components/SocialWall.tsx` |
| Recent Discussions teaser | Implemented | `src/components/RecentDiscussionsTeaser.tsx` |
| Friends of the Fan Club | Implemented | `src/components/FriendsOfFanClub.tsx` |
| Milestones | Implemented | `src/components/MilestonesSection.tsx` |
| Calendar | Implemented | `src/components/CalendarSection.tsx` |
| FAQ | Implemented | `src/components/FAQSection.tsx` |

## Planned Extraction Mapping (non-blocking)

The following sections are currently implemented inline in `src/app/page.tsx` and may be extracted later for consistency; this is planning guidance, not a statement that files already exist.

- Hero Banner → planned `src/components/home/HeroBanner.tsx`
- About Lou Gehrig → planned `src/components/home/AboutLouGehrigSection.tsx`

---

## Related Specs

- `/docs/reference/design/home-discussions.md`
- `/docs/reference/design/home-friends.md`
- `/docs/reference/design/home-milestones.md`
- `/docs/reference/design/home-calendar.md`
- `/docs/explanation/lgfc-design-evolution.md`
