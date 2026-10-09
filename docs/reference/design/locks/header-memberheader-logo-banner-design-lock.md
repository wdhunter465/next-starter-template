---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-02-20
---

# Header + MemberHeader + Logo + Banner Design Lock (DO NOT REGRESS)

**Purpose:** This is the authoritative design and implementation spec for the LGFC header system.  
If any future change breaks these invariants, it is a **regression** and must be fixed immediately.  
This file exists so we never re-debug the same header/logo/banner problems again.

---

## 0) Non-Negotiable Design Invariants

### 0.1 Visual Identity (“Classic Look”)
- The site has a historical/classic character.
- Header buttons should look like proper UI buttons (bordered, padded, rounded, readable).
- The logo must be **large enough to read the text** on it at normal desktop viewing distance.

### 0.2 Layout Intent (Desktop)
At the very top of the page:
1) A **large logo** sits at the **top-left**, visually “its own object.”
2) The sticky header bar and hero/banner content run behind/under that logo visually.
3) Primary navigation buttons + hamburger are **grouped together** and **page-centered**.
4) The hamburger menu dropdown opens **anchored under the hamburger**, not offset to the page edge.

### 0.3 Scroll Behavior
- The **header bar is sticky** (remains visible on scroll).
- The **large logo is non-sticky** (it should not remain floating as you scroll down the page).
  - Implementation may hide/remove it on scroll so it behaves “non-sticky.”
  - The logo should be visible at page top and then disappear once you start scrolling.
- Result: when scrolled down, you see the sticky header with navigation, but not the big logo.

### 0.4 Clickability / Hitbox Rules (Critical)
- The logo must never create a giant invisible hitbox that blocks header buttons.
- The logo container must not intercept clicks outside the logo itself.
- Buttons must always be clickable.

---

## 1) Implementation Architecture (Canonical)

### 1.1 Components
The canonical structure for header system:

- `src/components/SiteHeader.tsx`
  - Chooses between `Header` (public) and `MemberHeader` (member/admin contexts)
  - Mounts the one floating big logo for every route and tells both headers to hide their small logo and reserve the logo's footprint (Product Authority 2026-10-08, #4489)
- `src/components/Header.tsx`
  - Public header with centered nav + grouped hamburger
- `src/components/MemberHeader.tsx`
  - Member header with centered nav + grouped hamburger
- `src/components/FloatingLogo.tsx`
  - The large “separate object” logo shown only at top-of-page, non-sticky behavior via auto-hide on scroll
- CSS Modules:
  - `src/components/Header.module.css`
  - `src/components/MemberHeader.module.css`
  - `src/components/FloatingLogo.module.css`

### 1.2 Why FloatingLogo Exists
We repeatedly observed that putting a “big” logo inside the sticky header causes:
- click hitbox regressions,
- awkward layout constraints,
- repeated conflicts between sticky positioning and hero overlap.

Therefore:
- The large logo is implemented as a **separate fixed overlay at page top** that **auto-hides on scroll**.
- The sticky header remains clean and stable.

This gives us:
- large top-of-page logo presence
- no sticky logo during scroll
- stable sticky header for nav
- minimal regression surface area

---

## 2) Canonical CSS Rules (Sticky Header)

### 2.1 Header container
- `position: sticky; top: 0; z-index: 50;`
- Background + border to remain readable over content.

### 2.2 Inner layout
- `max-width: 1120px; margin: 0 auto;`
- Header height: either 64px or 72px, but must remain consistent across public + member headers.

### 2.3 Left area (small header logo)
This is the “small” logo that shows ONLY when FloatingLogo is not present. Since 2026-10-08 (#4489) the floating logo is always present, so both headers render an empty placeholder here that reserves the logo's footprint (`--floating-logo-footprint`).

Rules:
- Hard constrained width (example: 72px).
- Container MUST NOT intercept clicks:
  - container uses `pointer-events: none`
  - actual `<Link>` uses `pointer-events: auto`
- If implemented, also clamp hitbox using:
  - `overflow: hidden`
  - explicit width + max-width
- Do NOT use inline styles to override size (these tend to reintroduce drift and conflict).

### 2.4 Center nav group (buttons + hamburger)
- Centered with absolute positioning:
  - `left: 50%; top: 50%; transform: translate(-50%, -50%);`
- Buttons grouped and centered.
- Hamburger is part of the same group:
  - the hamburger wrapper uses `.right` but is inline in the centered nav.

### 2.5 Hamburger dropdown anchoring
The hamburger wrapper must be `position: relative` so the dropdown anchors to it, not the viewport edge.

This lock owns hamburger layout, grouping, and anchoring only. Hamburger drawer item membership is owned by `/docs/reference/design/LGFC-Production-Design-and-Standards.md`.

---

## 3) Canonical FloatingLogo Behavior (Large Logo)

### 3.1 Placement
- `position: fixed; left: 16px; top: 6px; z-index: 80;`
- Above the sticky header (header z-index 50).

### 3.2 Size (Desktop)
- `height: clamp(129px, 15vw, 147px)` (about 138px; 50% larger than the earlier 86–98px range, Product Authority 2026-10-08, #4481)
- `max-width: 240px`
- Must be visually readable (logo text must be legible).

### 3.3 Click hitbox
- Container: `pointer-events: none`
- Link: `pointer-events: auto`

### 3.4 Non-sticky effect
Because `position: fixed` is inherently sticky, we enforce “non-sticky” behavior by hiding it on scroll:

- If `scrollY < ~12px`: show logo
- If scrolled beyond threshold: hide logo

This matches the intent:
- logo is present at top of page
- once user scrolls, logo disappears, leaving the sticky header alone

---

## 4) Banner / Hero Interaction

### 4.1 No overlap (changed 2026-10-08, #4489)
At page top the floating logo must not cover hero, banner or page text. The earlier rule that it should overlap the banner slightly is withdrawn.
- The space under the header (`.topWhitespace`, `calc(var(--floating-logo-height) - 83px)` from 768px up) keeps page content below the logo.
- On phones (under 768px) the logo is 72px and sits inside the 80px header, so no extra space is added.

### 4.2 Spacing
- The header buttons should remain comfortably spaced from the banner.
- If hero content sits behind sticky header, ensure readability with padding/margins inside hero.

---

## 5) “Do Not Do This Again” (Regression Traps)

### 5.1 Do not reintroduce giant logo hitbox
Avoid:
- removing `pointer-events: none` from logo container
- removing `overflow: hidden` on constrained containers
- increasing container width beyond the intended hitbox

### 5.2 Do not “half-move” hamburger with scripts
We saw a Python patch attempt fail due to JSX `{}` inside f-strings and produce messy nav structure.

Rule:
- For JSX restructuring, write full files using heredocs or do manual edits.
- Do not generate JSX via f-strings.

### 5.3 Do not rely on build-output greps as deploy proof
A missing marker string in `out/.next` does not mean deployment failed.
Deployment proof is:
- commit present on `main`
- Cloudflare build completes
- visual verification on production

### 5.4 Do not assume `rg` exists
If you need it, install it or use `grep -R`.

---

## 6) Acceptance Criteria (Header “Done” Definition)

Header is considered DONE when:

1) **Top of page**
   - Large readable logo visible at top-left
   - Logo overlaps hero/banner slightly
   - Buttons + hamburger grouped, centered, clickable

2) **Hamburger**
   - Dropdown opens directly under hamburger (anchored correctly)
   - Works on both public and member headers

3) **Scroll**
   - Header remains sticky
   - Large logo disappears once the user scrolls down

4) **No click blocking**
   - Buttons always clickable
   - No invisible overlay blocks nav

5) **Stability**
   - Implementation is captured in these specific files and remains stable across future changes:
     - `SiteHeader.tsx`, `Header.tsx`, `MemberHeader.tsx`, `FloatingLogo.tsx`
     - associated CSS modules

---

## 7) Implementation Checklist (When Editing Header Later)

Before any future header work is merged:

- [ ] Confirm no inline sizing overrides exist for logo in Header/MemberHeader
- [ ] Confirm the floating logo appears on every route, mounted once in `SiteHeader.tsx`, and covers no content at 390px, 768px, 1280px and 1920px
- [ ] Confirm scroll hide behavior works
- [ ] Confirm hamburger dropdown anchoring
- [ ] Confirm no hitbox regression
- [ ] Confirm CSS Modules match the canonical structure in this file
- [ ] Confirm production visually matches the acceptance criteria

