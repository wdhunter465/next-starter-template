---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: FanClub routes, navigation invariants, UI/UX contracts, and page content contracts as a supporting specification
Does Not Own: Product and Design Domain Policy; how-to procedures; operational runbooks
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #2687
Last Reviewed: 2026-07-21
---

# LGFC — FanClub Area Specification

Status: LOCKED — supporting production specification  
Effective Date: 2026-01-21

This document defines the **FanClub** (authenticated) experience and routes under the Product and Design Domain Policy and the production design standards hub.

It is not a Domain Policy co-owner. Conflicts with higher Product and Design authority resolve through `docs/governance/PRODUCT-AND-DESIGN.md`.

Canonical auth reference: /docs/reference/design/auth-model.md

---

## Runtime Platform Context

FanClub behavior runs on **Cloudflare Pages + Cloudflare Pages Functions**.
Auth/session, join/login, and member data flows rely on runtime APIs under `functions/api/**`.

---

## Canonical Route

- **FanClub Home (Club Home)**: `/fanclub`
- Auth boundary: `/fanclub` and all `/fanclub/**` routes require login.
- Unauthenticated access to `/fanclub` and `/fanclub/**` must **redirect to** `/` (public home).
- Failed authentication/session-validation recovery target is `/`.

---

## FanClub Header (single variant)

The FanClub header has **one** variant because unauthenticated traffic is redirected away.

Desktop/Tablet buttons (in this exact order):
1. Club Home → `/fanclub`
2. My Profile → `/fanclub/myprofile`
3. Search → `/search`
4. Store → external Bonfire link (no `/store` route)
5. Logout → `/logout`

Global logo behavior:
- The logo always links to **public home** `/` across the entire site (public, fanclub, admin).

---

## FanClub Pages

FanClub-only subpages (canonical):
- `/fanclub/photo`
- `/fanclub/library`
- `/fanclub/memorabilia`
- `/fanclub/myprofile`

Notes:
- The public routes `/photo`, `/photos`, `/library`, `/memorabilia` must not exist (fanclub only).

---

## FanClub Home Page (Club Home) — section order

The FanClub home must present the following sections in this order:

1. Header (rendered by the global header system)
2. Welcome Section
3. Archives Tiles (Photo, Memorabilia, Library) — links to the FanClub subpages
4. Post Creation / Work Area
5. Member Discussion Feed
6. Gehrig Timeline
7. Admin Dashboard Link (conditional; admins only)

The profile and member card are separate pages (linked), not inline sections.

---

## Weekly Photo Matchup Interaction (explicit design note)

- The current Weekly Photo Matchup (Photo A vs Photo B) is displayed as an inline section on the **public home page**.
- Pairs rotate weekly via D1 auto-rotation (`/docs/reference/weekly-matchup-auto-rotation.md`).
- Photo club-use tagging uses `photos.is_matchup_eligible` (`0` / `1` / `-1`); curation UI is planned for `/admin/d1-test/` (PMO program).
- After voting, results are revealed inline on the homepage today. The hidden `/weeklyvote` route remains a planned extraction (`/docs/reference/design/weeklyvote-results.md`).
