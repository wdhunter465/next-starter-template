---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Homepage Friends section contract and integration expectations
Does Not Own: Partner onboarding process; third-party legal approvals
Canonical Reference: /docs/reference/design/home.md
Related issues: #4344, #2859
Last Reviewed: 2026-09-23
---

# Homepage Section Spec — Friends of the Fan Club

## Purpose
Define the Friends section on `/` that highlights partner/supporter entities.

## Route / Path
- Host page: `/`
- Section anchor/id: `#friends-of-the-club`

## Section / Component Breakdown
- Section container in home page: `src/app/page.tsx`
- Section component owner: `src/components/FriendsOfFanClub.tsx`
- Styling owner: `src/components/FriendsOfFanClub.module.css`

## Data Dependencies
- Reads posted `friends` rows from `GET /api/friends/list?surface=homepage`.
- Homepage surface omits LouGehrig.com and places The Lou Gehrig Society (`https://www.thelougehrigsociety.org/`) in that partner slot (#4344).
- Must render a deterministic loading and empty fallback state. Static fallback matches the homepage replacement (Society present; LouGehrig.com absent).

## Auth / Access Expectations
- Publicly visible.
- No member authentication required.

## Key UX / Behavior Notes
- Section title is fixed: “Friends of the Fan Club”.
- Cards/entries remain scannable and consistent with homepage spacing rhythm.
