---
Doc Type: Specification
Audience: Human + AI
Authority Level: Supporting Design Specification
Owns: The single LGFC color standard: each approved color, its CSS token and permitted use, and the rules code follows to use color
Does Not Own: Typography, spacing, layout, or any decision to add, remove or change a color (Product Authority decides)
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #4626, #4627, #4409, #4420, #4608
Last Reviewed: 2026-10-14
---

# LGFC color standard

## Status

Written 2026-10-14 at Product Authority's direction: avoid variance in the color schema, and give all code and design changes one standard to refer to. It records the colors already approved in `docs/reference/design/style-guide.md` and already defined as CSS tokens in `src/app/globals.css`. It invents no color. Where code uses a color that is not approved here, it is listed under "Open items" for Product Authority to decide.

## Rules

1. **Use tokens, not hex.** Components, pages and inline styles take a color from a token below with `var(--token)`. A literal such as `#0033cc` in a component is a defect. A fallback inside `var(--lgfc-blue, #0033cc)` is allowed because it equals the token.
2. **Define each token once.** A color token is defined in `src/app/globals.css`, and only there. No other stylesheet redefines it. A second definition loaded later silently overrides the first; this is how the brand blue rendered navy (D-001, #4608).
3. **The tables below decide.** If code and this document disagree, the document is right and the code is the defect, until Product Authority changes the document. `tests/color-standard.test.ts` fails when a token's value in code differs from the table.
4. **Changing a color is a Product Authority decision.** Add, remove or change a row here in the same pull request as the code, and name the decision (an Issue or comment) in the PR. A new color token without a row here fails the test.
5. **Each PR that touches color cites this file**, and states which tokens it uses.

## Core palette

Source: `style-guide.md` (Color Palette) and `globals.css` (`:root`).

| Name | Token | Hex | Use |
| --- | --- | --- | --- |
| LGFC Blue | `--lgfc-blue` | `#0033cc` | Primary brand color: primary buttons, key headings, primary calls to action, important links |
| LGFC Blue, hover | `--lgfc-blue-hover` | `#0028a3` | Hover state for LGFC Blue (slightly darker) |
| Deep Navy | `--lgfc-navy` | `#001a66` | Optional darker shade for emphasis and dark accents |
| Body text | `--lgfc-text-main` | `#333333` | Paragraphs and content |
| Muted text | `--lgfc-text-muted` | `#666666` | Metadata, timestamps, captions, disclaimers |
| Light muted text | `--lgfc-text-light` | `#999999` | Subtle hints; lowest emphasis |
| Page background | `--lgfc-bg-page` | `#f5f7fb` | Main page background |
| Card background | `--lgfc-bg-card` | `#ffffff` | Cards, sections, elevated content |
| Subtle background | `--lgfc-bg-subtle` | `#f8f9ff` | Alternative card background; very light blue tint |
| Soft border | `--lgfc-border-soft` | `#dde3f5` | Primary border for cards and dividers |
| Light border | `--lgfc-border-light` | `#e8ecf5` | Lighter internal separations |

## Colors defined in code but not described in the style guide

These tokens exist today. They are kept as defined, and each needs its use confirmed by Product Authority (open item 1).

| Name | Token | Hex | Defined in |
| --- | --- | --- | --- |
| Dark | `--lgfc-dark` | `#222222` | `globals.css` |
| Light background | `--lgfc-bg-light` | `#f8f9fa` | `globals.css` |
| Border | `--lgfc-border` | `#e0e0e0` | `globals.css` |
| Brand blue (alias) | `--brand-blue` | `#0033cc` | `globals.css` (same value as `--lgfc-blue`) |
| Red | `--lgfc-red` | `#bf0a30` | `src/styles/variables.css` |
| Dark red | `--lgfc-red-dark` | `#941b1b` | `src/styles/variables.css` |
| Off-white | `--lgfc-offwhite` | `#f8f9fa` | `src/styles/variables.css` (same value as `--lgfc-bg-light`) |
| Charcoal | `--lgfc-charcoal` | `#212529` | `src/styles/variables.css` |
| Divider | `--lgfc-divider` | `#dee2e6` | `src/styles/variables.css` |

The five tokens in `variables.css` are defined outside `globals.css`, which rule 2 forbids once they are consolidated (open item 2).

## Open items for Product Authority

| # | Question | Recommended answer |
| --- | --- | --- |
| 1 | Confirm the use of the nine tokens in the second table, or retire them | Keep `--lgfc-bg-light` and `--lgfc-border`; retire the `--brand-blue` alias and `--lgfc-offwhite` (duplicates) once code stops using them |
| 2 | Move the five `variables.css` color tokens into `globals.css` (rule 2) | Yes, in the follow-up Issue #4627 |
| 3 | Name approved colors for error, warning and success messages. The code uses `#b00020`, `#7a4b00`, `#7c2d12` and others with no token | Product Authority picks; the author does not guess |
| 4 | The Club Home newspaper uses a cream and brown set (for example `#f5efe0`, `#d3c3a5`, `#4a4238`, `#8a3324`). Is that a second approved palette for the Club Home newspaper design? | Yes if it is the Club Home newspaper design, and then it gets its own rows and tokens |
| 5 | The code uses `#1e3a8a`, `#003366`, `#6b7280`, `#4b5563` and similar grays and blues with no token | Replace with the nearest core token, or approve as new rows |

## Follow-up work

Issue #4627 replaces hard-coded hex values in components with these tokens, theme by theme, and adds a test that stops new ones.

## Rollback

Revert the pull request that changes this file. No system state is created.
