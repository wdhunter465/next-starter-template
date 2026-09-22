---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #2443 UI component-system decision brief — current-state inventory, retain/standardize/migrate-later comparison, risk documentation, and Product-discussion recommendation
Does Not Own: Installing a component library, changing Tailwind configuration, editing `src/**` runtime components, or authorizing Production UI changes
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #2443, #2553, #4186, #4187, #4188, #4189
Last Reviewed: 2026-09-22
---

# UI Component-System Decision Brief (#2443)

## Purpose

Determine, from live-repository evidence rather than the original evaluation claim, whether LGFC's current UI foundation materially limits growth, and record a retain / internal-standardize / migrate-later recommendation for Product Authority discussion. No component library is installed and no `src/**` runtime file is edited by this brief.

#4186 owns this inventory section. #4187 owns the three-model comparison. #4188 owns the risk documentation. #4189 owns the closing recommendation.

## Scope

In scope: current-state UI/CSS inventory; validation of the original "no component library, styling from scratch" claim against live `main`; comparison of retain-custom, internal-standardize, and later-adopt-a-library approaches; accessibility/performance/migration/coexistence risk; a Product-discussion-ready recommendation.

Out of scope: `npm install` of any component library or CSS framework; Tailwind configuration (none present to configure); editing any file outside this brief's own path (this brief lives under `docs/ops/reports/**`; no `src/**` file is edited by this project); Production UI replacement; a follow-on implementation project (requires its own source Issue after Product decides).

## Current known truth

Observed 2026-09-22 on `origin/main`:

- **Evaluation claim status: REJECTED as stated, but the underlying gap it points at is real.** The original claim was "Tailwind is included, but no component library... is prebuilt." `package.json` has **no Tailwind dependency at all** — not "Tailwind without a component library," but no Tailwind. The repository's starter-template metadata (`.github/REPOSITORY_METADATA.md`) still advertises Tailwind as catalog copy; it does not reflect the installed toolchain. What *is* true: there is no prebuilt component library (`shadcn/ui`, `@radix-ui`, Headless UI) — the repo is a hand-built CSS-module + CSS-custom-property system.
- `package.json` UI-relevant dependencies: `next@^15.5.8`, `react@^19.0.0`, `react-dom@^19.0.0`, `yet-another-react-lightbox@^3.32.2`. No `tailwindcss`, `shadcn`, `@radix-ui/*`, or Headless UI package of any kind.
- `src/components/**`: **63** `.ts`/`.tsx` files (public, fanclub, admin, ai-review, calendar, and home areas) as of this branch's cut — 2 more than the 61 recorded when #2443 was packaged for Graduation on 2026-09-20; normal drift over two days, not a discrepancy.
- CSS Modules: **23** `*.module.css` files repo-wide, matching the Graduation-record count.
- **Token drift is real but narrower than "two live conflicting files."** Three files carry a `--lgfc-blue` custom property:
  - `src/app/globals.css` (imported by the Next.js root layout as global CSS): `--lgfc-blue: #0033cc`.
  - `styles/variables.css` (repo root): `--lgfc-blue: #002868` — **imported by `src/app/layout.tsx`** (`import "./../styles/variables.css";`), so this value is live in the shipped app alongside `globals.css`'s value. Two different blues are genuinely active in the same render tree at once.
  - `src/styles/variables.css`: also `--lgfc-blue: #002868`, but a full-repo grep of every `.ts`/`.tsx`/`.css`/`.mjs`/`.js` file found **zero imports of anything under `src/styles/**`** (`header.css`, `home.css`, `variables.css`, `weekly-preview.css`, `weekly.css`). This directory is dead code, not a second live source of drift — but it is still a maintenance hazard: a future editor who greps for `variables.css`, finds two same-named files with different values, and edits the wrong (dead) one would ship no change and not know why.
- Accessibility/regression coverage already present: `@axe-core/playwright@^4.12.1` and `@playwright/test@^1.56.1`, with existing e2e coverage including mobile navigation and homepage structure. This is automated *testing* coverage, not a component *library* — the two are independent axes and neither substitutes for the other.
- #2553 (cited in this Issue's own preparation record) is a prior normalization record for this same intake; it does not separately require action from this brief.

## Intended final state

This brief holds all four sections listed under Purpose. It is not phased beyond its four ordered children (#4186 → #4187 → #4188 → #4189) and has no planned revision beyond ordinary maintenance once #4189 publishes the closing recommendation.

## Inventory (#4186 / `#2443-004`)

| Check | Result |
| --- | --- |
| `tailwindcss` in `package.json` | Not present |
| `shadcn`/`@radix-ui`/Headless UI in `package.json` | Not present |
| `src/components/**` `.ts`/`.tsx` file count | 63 (61 at #2443's 2026-09-20 Graduation record; +2 drift) |
| CSS Module (`*.module.css`) count | 23 |
| `--lgfc-blue` value in `src/app/globals.css` | `#0033cc` (live, global CSS) |
| `--lgfc-blue` value in `styles/variables.css` | `#002868` (live — imported by `src/app/layout.tsx`) |
| `--lgfc-blue` value in `src/styles/variables.css` | `#002868` (present on disk, **zero imports found repo-wide** — dead code) |
| `@axe-core/playwright` / `@playwright/test` | Present (`^4.12.1` / `^1.56.1`) — accessibility/e2e test coverage, not a component library |
| Starter-template metadata (`.github/REPOSITORY_METADATA.md`) Tailwind claim | Catalog copy only; does not reflect the installed toolchain |

**Conclusion:** the original evaluation claim's literal premise (Tailwind present, no component library) does not match live `main` — there is no Tailwind at all. The claim's underlying concern (no prebuilt component library; styling built by hand) is accurate. Token drift is real and live between exactly two files (`src/app/globals.css` and `styles/variables.css`), both imported into the same page; the third file sharing the name and stale value (`src/styles/variables.css`) is orphaned, not a second live conflict.

---

_Sections below are added by later children in this same Issue chain (#4187, #4188, #4189) and do not exist until each child's own PR merges._
