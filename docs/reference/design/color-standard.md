---
Doc Type: Reference
Audience: Human + AI
Authority Level: Supporting Design Specification
Owns: The single LGFC color standard: each approved color, its CSS token and permitted use, and the rules code follows to use color
Does Not Own: Typography, spacing, layout, or any decision to add, remove or change a color (Product Authority decides)
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #4626, #4627, #4409, #4420, #4608
Last Reviewed: 2026-10-19
---

# LGFC color standard

## Status

Written 2026-10-14 at Product Authority's direction: avoid variance in the color schema, and give all code and design changes one standard to refer to. It records the colors already approved in `docs/reference/design/style-guide.md` and already defined as CSS tokens in `src/app/globals.css`. It invents no color. Where code uses a color that is not approved here, Product Authority decides (see "Decisions recorded").

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

## Message colors

Accepted by Product Authority on 2026-10-19 (proposal on #4626). Every value is already in the code, so accepting them changes nothing visible; #4627 moves components onto the tokens. All three text colors pass WCAG AA and AAA on white (contrast 7.3, 7.4 and 10.0).

| Name | Token | Hex | Use |
| --- | --- | --- | --- |
| Error text | `--lgfc-error` | `#b00020` | Error messages and failed-action text |
| Error panel background | `--lgfc-error-bg` | `#fff7f7` | Background of an error panel |
| Error panel border | `--lgfc-error-border` | `#e7b8b8` | Border of an error panel |
| Warning text | `--lgfc-warning` | `#7a4b00` | Warnings and cautions; no panel colors are approved |
| Success text | `--lgfc-success` | `#184d12` | Success confirmations |
| Success panel background | `--lgfc-success-bg` | `#f6fff6` | Background of a success panel |
| Success panel border | `--lgfc-success-border` | `#cde4cf` | Border of a success panel |

`#7c2d12` (the Club Staging admin notice) is a near-duplicate of the warning color and maps to `--lgfc-warning`.

## Colors defined in code but not described in the style guide

These tokens exist today. They are kept as defined; Product Authority's decision on each is recorded under "Decisions recorded" (decision 1).

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

The five tokens in `variables.css` are defined outside `globals.css`, which rule 2 forbids once they are consolidated (decision 2).

## Decisions recorded

Product Authority agreed to the recommended answers on 2026-10-16 ("4627 I agree with your assessment") and accepted the message colors on 2026-10-19. Both are recorded on #4626.

| # | Question | Decision |
| --- | --- | --- |
| 1 | Use of the nine tokens in the second table | Keep `--lgfc-bg-light` and `--lgfc-border`; retire the `--brand-blue` alias and `--lgfc-offwhite` (duplicates) once code stops using them |
| 2 | Move the five `variables.css` color tokens into `globals.css` | Yes, in #4627 |
| 3 | Colors for error, warning and success messages | Accepted 2026-10-19; see "Message colors" above |
| 4 | The Club Home newspaper cream and brown set (for example `#f5efe0`, `#d3c3a5`, `#4a4238`, `#8a3324`) | A second approved palette for the Club Home newspaper design, with its own rows and tokens, to be added in #4627 |
| 5 | Stray colors (`#1e3a8a`, `#003366`, `#6b7280`, `#4b5563` and similar) | Map to the nearest core token, or approve as new rows |

## Follow-up work

Issue #4627 replaces hard-coded hex values in components with these tokens, theme by theme, and adds a test that stops new ones.

## Rollback

Revert the pull request that changes this file. No system state is created.
