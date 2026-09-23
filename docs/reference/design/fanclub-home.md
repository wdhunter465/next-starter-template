---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: FanClub home route purpose, section contracts, data dependencies
Does Not Own: FanClub subpage specs; API schema details; implementation internals
Canonical Reference: /docs/reference/design/fanclub.md
Related issues: #1685, #1688, #1690, #1962, #4263, #4344
Last Reviewed: 2026-09-23
---

# `/fanclub` — FanClub Home Page Specification

## Purpose

Define the authenticated FanClub member home experience and locked newspaper-style section sequence per Program #1685 and `docs/ops/pmo/program-3-club-home-page-design.md`.

## Route / Path

- Canonical route: `/fanclub`
- Access boundary: authenticated members only (`/fanclub/**`)
- Unauthenticated behavior: redirect to `/`

## Section / Component Breakdown

Newspaper-style order (fail-closed static fallbacks when inventory is empty):

| Order | Section | Component |
| --- | --- | --- |
| 1 | Masthead / hero | `ClubHomeMasthead` |
| 2 | Lead story | `ClubHomeStaticStory` |
| 3 | Secondary story rail | `ClubHomeStoryRail` |
| 4 | Feature link cards | `ArchivesTiles` |
| 5 | Photo / memorabilia feature | `ClubHomeMediaFeature` |
| 6 | Member prompt | `ClubHomeMemberPrompt` (links to `/fanclub/chat`) |
| 7 | Archive spotlight | `ClubHomeArchiveSpotlight` |
| 8–10 | Campaign / events / recognition | `ClubHomeEventsModule`, `ClubHomeRecognitionModule`, `ClubHomeDeferredModule` (campaign fail-closed) |
| 11 | Lou Gehrig box score (left margin, bottom) | `ClubHomeGehrigBoxScore` |
| 12 | AL standings as of that game (right margin, bottom) | `ClubHomeAlStandings` |
| 13 | Submission CTA | `ClubHomeSubmissionCta` (links to `/fanclub/submit`) |
| 14 | Admin link (conditional) | `AdminLink` |

Page shell: `src/app/fanclub/page.tsx`

## Removed from Club Home (audit #1962)

The following legacy dashboard modules are **not** part of the newspaper Club Home contract. Their capabilities remain on dedicated routes:

- Inline discussion posting (`PostCreation`) → `/fanclub/chat`
- Discussion feed (`DiscussionFeed`) → `/fanclub/chat`
- Gehrig timeline (`GehrigTimeline`) → deferred; not a Club Home section

## Data Dependencies

- Member session state from `useMemberSession`
- Dynamic Club Home inventory: `GET /api/fanclub/home` (`club_home` section in `content_inventory`)
- Random Gehrig box score + AL standings: `GET /api/fanclub/gehrig-box-score` (member session; one random `retrosheet_gehrig_games` row plus batting lines and standings snapshot; fail-closed empty copy when ingest tables are empty)
- Recognition & Partners: `GET /api/friends/list?surface=club-home` (posted partners; The Lou Gehrig Society is second, immediately below ALS Cure Project; LouGehrig.com remains; no partner is dropped for a four-item cap)
- Feature-link card targets: `/fanclub/photo`, `/fanclub/library`, `/fanclub/memorabilia`
- Discussion workflows: `/fanclub/chat` and discussion APIs
- Editorial submission intake: `/fanclub/submit` → `submission_queue`

## Auth / Access Expectations

- Route is member-only.
- Session/role checks are required before rendering member content.
- Admin-only affordances are conditional UI, not a global route override.

## Key UX / Behavior Notes

- This page is distinct from public home (`/`).
- Section order is locked per Program #1685 newspaper model.
- Floating logo remains present and links to `/`.
- Dynamic modules fail closed to static copy when `club_home` inventory is empty.
