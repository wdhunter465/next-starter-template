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

## Three-model comparison (#4187 / `#2443-005`)

Three future-state models, compared against the live inventory. No library is installed by this child.

### Model 1 — Retain current custom CSS

Keep CSS modules plus CSS custom properties as they are, including the two live `--lgfc-blue` values and the unused `src/styles/**` copies.

- **Velocity:** highest near-term velocity because there is no migration. Later-feature velocity is lowest because new public, Fan Club, and admin screens keep copying module patterns instead of sharing primitives.
- **Accessibility:** existing `@axe-core/playwright` and Playwright coverage stay the safety net. There is no shared primitive for dialogs, forms, or tables, so keyboard and focus behavior is rebuilt per screen.
- **Bundle / maintenance:** no new npm surface. Maintenance cost is duplication: 63 `src/components/**` files and 23 CSS modules with no token single-source. Catalog copy in `.github/REPOSITORY_METADATA.md` still advertises Tailwind, which continues to mislead contributors.
- **Surfaces:** public, Fan Club (member), and admin already share the same hand-built stack. Fundraising/store experiences are not a separate component system on `main`; they would inherit the same drift if added later.

### Model 2 — Internal-standardize on existing tokens and components

Keep first-party React and CSS modules. Collapse live tokens to one imported source, delete or quarantine dead `src/styles/**`, and extract a small set of repo-native primitives (buttons, forms, navigation, feedback) used by public, Fan Club, and admin. Still no Tailwind and no shadcn/Radix/Headless UI.

- **Velocity:** one-time cleanup plus documentation of primitives, then faster later screens because new UI starts from named tokens and shared components instead of copying a nearby module.
- **Accessibility:** primitives can carry the keyboard/focus conventions that axe/Playwright already test at the page level. Does not replace those tests.
- **Bundle / maintenance:** still zero new UI library. Shrinks token-file conflict and CSS-module duplication. Fits static export: no client-only library shell.
- **Surfaces:** public, Fan Club, and admin stay one visual language without wrapping an external kit. Matches the Graduation pending-brief direction.

### Model 3 — Adopt an external library later

A later Product-authorized Issue would add something such as shadcn/ui, Radix primitives, or Headless UI (almost always with Tailwind). This project does not perform that add.

- **Velocity:** lowest near-term velocity during coexistence (wrap or replace 63 existing components). Highest later-feature velocity after cutover, if Product later accepts a kit.
- **Accessibility:** Radix/Headless-class primitives typically ship keyboard behavior; LGFC would still need axe/Playwright against the wrapped public, Fan Club, and admin routes, plus visual-regression coverage the kit does not provide.
- **Bundle / maintenance:** new dependency, upgrade, and customization cost. Tailwind configuration would have to be introduced from nothing (inventory: Tailwind is absent, not "present without a component library"). Conflicts with zero-recurring-cost only if a paid design-system vendor is chosen; open-source kits are license-cost-free but not maintenance-free.
- **Surfaces:** a kit helps most on dense admin tables/dialogs and least on the already-shipped public storytelling pages unless those pages are rewritten to the kit.

### Comparison summary

| Dimension | Retain-custom | Internal-standardize | Later-adopt a library |
| --- | --- | --- | --- |
| Velocity (near term) | Highest (no migration) | Medium (token/primitive cleanup) | Lowest (coexistence + Tailwind introduction) |
| Velocity (later features) | Lowest (copy-paste modules) | Highest among first-party options | High after cutover, if the kit is accepted |
| Accessibility | Page-level tests only | Shared primitives plus existing tests | Kit primitives plus required LGFC tests |
| Bundle / npm | No new UI library | No new UI library | New UI library; Tailwind would be new |
| Token drift (`--lgfc-blue`) | Unchanged, still live | Directly addressed | Addressed only if the kit becomes the token source |
| Public / Fan Club / admin | Same stack, more drift | Same stack, one token/primitive set | Kit wrap or rewrite |
| Fit for #2443 | Leaves the documented gap in place | Matches pending-brief direction | Requires a new source Issue after Product chooses it |

**Carried into #4188 / #4189:** prefer internal-standardize. Retain-custom is acceptable only as a temporary holding pattern. Later-adopt is not authorized from this parent.

## Risks (#4188 / `#2443-006`)

Risks for each compared model. No runtime, workflow, or `src/**` file is edited here.

### Accessibility

Existing coverage is `@axe-core/playwright` plus Playwright e2e (mobile nav, homepage structure). That is page-level testing, not a component library.

- **Retain-custom:** every new dialog, form, or table re-implements keyboard and focus. Axe catches regressions only on routes already in the test set.
- **Internal-standardize:** shared primitives can carry the conventions those tests already enforce; the tests stay required. Does not replace axe/Playwright.
- **Later-adopt:** Radix/Headless-class kits usually ship keyboard behavior, but wrapped public, Fan Club, and admin routes still need the same axe/Playwright (and visual-regression) coverage. A kit is not a substitute for LGFC tests.

### CSS-module duplication and token-file conflict

Inventory: 23 CSS modules; 63 `src/components/**` files; two live `--lgfc-blue` values (`src/app/globals.css` `#0033cc` and `styles/variables.css` `#002868`, both imported); `src/styles/variables.css` is unused dead copy.

- **Retain-custom:** leaves duplication and the live token conflict in place. Contributors can keep editing the wrong `variables.css`.
- **Internal-standardize:** this is the model that directly shrinks both risks (one imported token source; drop or quarantine dead `src/styles/**`; fewer one-off modules).
- **Later-adopt:** token conflict is resolved only if the kit becomes the token source. Until cutover, duplication and the two live blues remain.

### Static export / Cloudflare Pages

The site is a static export on Cloudflare Pages. Leaflet-class client-only shells are out of scope for this UI project, but the same constraint applies to a component kit: anything that requires `window` at build time, a Node CSS pipeline LGFC does not have, or a paid design-system vendor fails the current deploy model or the zero-recurring-cost constraint.

- **Retain-custom and internal-standardize:** already static-export compatible (CSS modules and custom properties, no Tailwind).
- **Later-adopt:** introducing Tailwind from nothing is a new build-time toolchain. Coexistence with 63 hand-built components during a spike must keep the static export green; a failed Pages build is a stop, not a Production UI change.

### Coexistence and rollback if a later library spike is authorized

A later Product-authorized Sandbox Issue (not this parent) would add a kit next to the current stack.

- Keep first-party CSS modules as the default for public storytelling pages during any spike.
- Limit kit usage to a bounded admin or form island so a revert is `git revert` of that Issue's PR plus uninstall of the added packages.
- Do not mix Tailwind utilities into existing CSS modules in the same file; that makes rollback a visual rewrite instead of a package removal.
- Rollback of *this* brief is revert of the documentation PR only. No runtime rollback is required for #2443 itself.

### Risk summary

| Risk | Retain-custom | Internal-standardize | Later-adopt |
| --- | --- | --- | --- |
| Accessibility | Page tests only; rebuilt per screen | Primitives plus existing tests | Kit primitives plus required LGFC tests |
| CSS-module duplication | Unchanged | Reduced | Unchanged until cutover |
| Token-file conflict | Unchanged (two live blues) | Directly addressed | Addressed only if the kit owns tokens |
| Static export / Pages | Compatible | Compatible | New toolchain; spike must stay export-green |
| Coexistence / rollback | No migration to roll back | Docs-and-token cleanup; revert those PRs | Revert spike PR and uninstall packages; do not mix utilities into modules |

**Carried into #4189:** these risks support internal-standardize as the Product-discussion recommendation. Later-adopt remains a new source Issue after Product decides.

## Recommendation (#4189 / `#2443-007`)

**Recommendation for Product discussion: internal-standardize.** Do not install shadcn/ui, Radix, Headless UI, or Tailwind from #2443. Do not authorize a Production UI replacement. A follow-on implementation project requires a new source Issue after Product decides.

The original evaluation claim ("Tailwind is included, but no component library is prebuilt") is **rejected as stated**. Live `main` has no Tailwind. The underlying gap is real: 63 first-party components, 23 CSS modules, and two live `--lgfc-blue` values.

Answers to the five parent deliverable questions:

1. **Does the current UI foundation materially limit growth?** Yes, as a maintenance and consistency limit, not as a missing Tailwind kit. Feature velocity stays copy-paste of CSS modules; token drift is already live.
2. **Which capabilities are most affected?** Shared controls (dialogs, forms, tables, navigation, feedback) across public, Fan Club, and admin. Dense admin surfaces pay the highest duplication cost. Public storytelling pages already match the hand-built stack.
3. **Retain, internal-standardize, or later-adopt?** Internal-standardize. Retain-custom leaves the documented gap. Later-adopt is a new Issue after Product chooses a kit and accepts Tailwind-from-nothing plus coexistence risk.
4. **Migration scope, sequencing, and risk?** Sequence: one imported token source; quarantine dead `src/styles/**`; extract a small primitive set; keep axe/Playwright. Risk is bounded (docs and CSS, no npm). A later kit spike, if authorized, stays a Sandbox island with `git revert` plus uninstall as rollback.
5. **Trigger conditions for future adoption?** Product names a kit and a Sandbox source Issue **and** either (a) admin/form density outgrows first-party primitives, or (b) a policy-compatible, zero-recurring-cost kit is accepted after a green static-export spike. Neither trigger is met by this brief.

This brief does not authorize that later Issue. Independent review of this recommendation is the GitHub PR review on the #4189 change.

## Protected stops

- Do not `npm install` a component library or Tailwind.
- Do not edit `src/**` or replace Production UI from this parent.
- Do not treat this recommendation as website Go.
