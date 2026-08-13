---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Production behavior, routing rules, and navigation invariants as the primary supporting specification
Does Not Own: Product and Design Domain Policy; implementation details inside components
Canonical Reference: /docs/governance/PRODUCT-AND-DESIGN.md
Related Issues: #2687, #3074, #3148
Last Reviewed: 2026-08-08
---

# LGFC Production Design and Standards

This document is the **primary supporting production-behavior specification** for the Lou Gehrig Fan Club website under the Product and Design Domain Policy (`docs/governance/PRODUCT-AND-DESIGN.md`).

All implementations must conform to this document for locked production behavior facts.

This file is **not** a Domain Policy co-owner. Conflicts with domain policy, Product Authority decisions, or other supporting specs resolve through `docs/governance/PRODUCT-AND-DESIGN.md`.

---

# Runtime Platform Model (LOCKED)

Production runtime is **Cloudflare Pages + Cloudflare Pages Functions**.

- Static assets/routes are built by Next.js and served from Pages.
- Runtime read/write APIs are served from `functions/api/**`.
- The site is **not** pure static-only when validating auth, join/login, CMS reads, footer quote, or member flows.

---

# Navigation Model

Navigation is divided into four logical areas:

Public  
FanClub  
Admin  
Store

---

# Canonical Routes

Public active routes:
/, /about, /contact, /terms, /privacy, /search, /join, /logout, /ask, /health

Public legacy compatibility routes:
/login, /auth, /faq

FanClub (auth required):
/fanclub, /fanclub/myprofile, /fanclub/photo, /fanclub/library, /fanclub/memorabilia

Admin:
/admin/**

Store:
external Bonfire link (no /store route)

---

# Canonical Redirect Policy

- Protected FanClub routes (`/fanclub` and `/fanclub/**`) are auth-gated.
- If a user is unauthenticated, redirect to `/` (public home).
- If authentication/session validation fails, redirect to `/` (public home).
- `/login` is a legacy compatibility route and must redirect to `/`.
- `/auth` is a legacy compatibility route and must redirect to `/join`.
- `/faq` is a legacy compatibility route and must redirect to `/ask/` (query string preserved). Ask and FAQ are consolidated; `/ask` is the canonical public FAQ browse + Ask workflow (see `docs/reference/design/faq-and-ask.md`).

---

# Public Header (not logged in)

Desktop/tablet top menu buttons:

Join  
Search  
Store (external)  
Login

Store is a visible top menu/header button on desktop/tablet wherever the public logged-out header appears.

Mobile has no visible top menu. Mobile logged-out navigation is handled by the hamburger drawer.

---

# Public Header (logged in)

Desktop/tablet top menu buttons:

Club Home  
Search  
Store (external)  
Logout  

(4 total — Club Home replaces Join, Logout replaces Login)

Store is a visible top menu/header button on desktop/tablet wherever the public logged-in header appears.

Mobile has no visible top menu. Mobile logged-in navigation is handled by the hamburger drawer.

---

# Header Button Mapping

Join → /join  
Login → /join?mode=login  
Club Home → /fanclub  
Search → /search  
Store → external Bonfire link  
Logout → /logout  

---

# FanClub Header

Desktop/tablet top menu buttons:

Club Home  
My Profile  
Search  
Store (external)  
Logout

Store is a visible top menu/header button on desktop/tablet wherever the FanClub header appears.

Mobile has no visible top menu. Mobile FanClub navigation is handled by the hamburger drawer.

---

# Hamburger Menu Behavior

Mobile has no visible top menu/header button row. Mobile uses one hamburger drawer containing the relevant navigation buttons plus About and Contact.

Mobile public logged-out hamburger:
1. Join → /join
2. Search → /search
3. Store → external Bonfire link
4. Login → /join?mode=login
5. About → /about
6. Contact → /contact

Mobile public logged-in hamburger:
1. Club Home → /fanclub
2. Search → /search
3. Store → external Bonfire link
4. Logout → /logout
5. About → /about
6. Contact → /contact

Mobile FanClub hamburger:
1. Club Home → /fanclub
2. My Profile → /fanclub/myprofile
3. Search → /search
4. Store → external Bonfire link
5. Logout → /logout
6. About → /about
7. Contact → /contact

Store is included in the mobile hamburger because mobile has no visible top menu. Store remains an external Bonfire link only; no `/store` route exists.

Support is consolidated into Contact and must not appear as a hamburger drawer item.

Admin access must not be exposed as a hamburger drawer item.

Members must not appear as a separate hamburger drawer item.

Home must not appear as a separate hamburger drawer label when Club Home is already present.

---

# Footer

Right column — two-row layout:

Row 1: Privacy → `/privacy`, Terms → `/terms`  
Row 2: Contact → `/contact`

Left: D1-backed rotating quote + dynamic-year copyright  
Center: LG logo — scroll-to-top affordance (not route navigation)

Constraints:
- No `mailto:` footer link
- No Admin link in the public footer
- Contact/support email belongs on `/contact`, not in footer navigation
- No extra footer links beyond the locked set

---

## Data Model (Cloudflare D1)

The LGFC platform uses **Cloudflare D1** as its primary relational datastore.

Canonical Day 1 data references:

- `members`
- `member_sessions`
- `join_requests`
- `photos`
- `library_entries`
- `content_inventory`
- `submission_queue`
- `membership_card_content`

Canonical rules:

- `photos` is the D1 table name and must be used consistently in design documentation when referring to the photo data store.
- Memorabilia is **not** a standalone table. It is a tagged/filtered view of `photos`.
- `content_inventory` is the active editorial archive and member-library content authority introduced by the T45 redesign.
- `submission_queue` is the member-submission intake and review queue introduced by the T45 redesign.
- `library_entries` is a legacy Day 1 written-content table and must not be silently orphaned; implementations that move reads to `content_inventory` must provide an explicit backfill, fallback, or documented migration path.
- `/fanclub/myprofile` is a page per member in `members`.
- The member row is created during the JOIN process.
- Membership card is **not** a page. It is instructions text plus front/back card images shown on `/fanclub/myprofile`.

Implementation-level schema definitions and migrations are maintained separately from the design authority.

---

## Authentication Model (Canonical Day 1 Reference)

Canonical auth reference: /docs/reference/design/auth-model.md

Day 1 auth/session and redirect behavior is defined in the canonical auth document.

- `/join` remains the canonical Join/Login page.
- `/login` is legacy compatibility and redirects to `/`.
- `/auth` is legacy compatibility and redirects to `/join`.
- Login tab access is `/join?mode=login`.
- Day 1 auth uses the canonical cookie-backed session model (`lgfc_session` + D1 `member_sessions`).
- Protected FanClub routes (`/fanclub` and `/fanclub/**`) enforce auth and redirect unauthenticated users to `/`.
- Any failed auth/session validation path redirects to `/`.

---

## Homepage Canonical Section Order

Homepage sections are locked to this order:

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

---

## Weekly Photo Matchup (Homepage Section)

- Location: Homepage section #4, after the Spotlight slot
- Function: A/B image voting (Photo A vs Photo B)
- UI Elements:
  - Two images labeled Photo A and Photo B
  - Buttons: "Vote A" and "Vote B"
  - Current Voting anchor/label
  - Results panel revealed after the current user votes
- Behavior:
  - User selects one option
  - Vote submitted via API
  - Current-week totals display after the user has voted
  - Last closed week totals and winner may display after the user has voted when last-week data is available
  - Content rotates weekly via D1 auto-rotation on first public read each week (`/docs/as-built/weekly-matchup-auto-rotation.md`)

---

## Feature Mapping (Design → Implementation)

- WeeklyMatchup (design term)
  = Weekly Photo Matchup (as-built UI label)
  = Homepage section (not a dedicated route)
  = Component: WeeklyMatchup.tsx

---

## Verification Rule

Feature validation must be based on rendered UI and behavior, not file names or assumed routes.

---

## Floating Logo (Homepage + FanClub Only)

### Scope
- Appears ONLY on:
  - /
  - /fanclub
- MUST NOT appear on any other routes
- All other pages use the standard header logo

### Positioning
- position: fixed
- top: 0
- left: 0
- padding: 8px

### Size (LOCKED)
- height: clamp(120px, 28vw, 180px)
- width: auto
- max-width: none
- object-fit: contain
- border-radius: 12px

### Layering
- z-index: 60

### Behavior
- Visible on initial load
- Hidden after ~320px scroll
- Reappears when scrolling to top

### Interaction
- Click routes to /

### Separation of Concerns
- Floating logo is NOT part of header
- Header logo remains persistent across all pages

### Governance Rule
- Any change to FloatingLogo.tsx or FloatingLogo.module.css MUST:
  1. Update this section
  2. Reference change in PR
  3. Validate on / and /fanclub
