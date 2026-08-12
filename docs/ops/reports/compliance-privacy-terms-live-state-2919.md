---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, Grok, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: F1/F2 live-state evidence for `/privacy` and `/terms` composed rendering, per the #2919 approved Product Decision Record item 1 (updated with 2026-08-12 public Production probes under #2920)
Does Not Own: Legal conclusions, public-copy authorship beyond recorded observations, or Production D1 mutation
Canonical Reference: /docs/ops/reports/compliance-product-decision-register-2919.md
Related Issues: #2784, #2918, #2919, #2920
Last Reviewed: 2026-08-12
---

# `/privacy` and `/terms` Live State — Evidence (#2919 / #2920)

## Purpose

Record what is confirmed about the live, currently-rendered composition of `/privacy` and `/terms`, per Product Decision Record item 1 ("verify the live D1-composed `/privacy` and `/terms` state"). This is read-only evidence gathering; it makes no copy change and no legal conclusion.

## Scope

In scope: repository evidence about composition (seed migrations and rendering/fallback code) plus **public Production HTML probes** performed 2026-08-12. Out of scope: legal conclusions, D1 mutation, credential creation, and final public-copy publication decisions still owned by #2920 runtime increments.

## Current known truth

`/privacy` and `/terms` render per-section (`title`, `lead_html`, `body_html`) via `fetchPageContent()` (`src/lib/pageContent.ts`), each section falling back to hardcoded component copy independently when the corresponding D1 `page_content` row/section is absent. Migration `0009_page_content_seed.sql` seeds only `title` and `body_html` for both slugs — no `lead_html` row is seeded by any migration found in this repository.

### Public Production probe — 2026-08-12

Method: unauthenticated `curl -sL` of `https://www.lougehrigfanclub.com/privacy/` and `/terms/`; inspection of Next.js RSC payload strings (no Cloudflare API / `wrangler` auth used).

| Page | Live rendered composition | Notes |
| --- | --- | --- |
| `/privacy` | **Detailed fallback copy** matching current `main` `src/app/privacy/page.tsx` | Enumerates Join/Login fields (name, optional screen name, email, opt-in), Ask fields, member creation/welcome behavior, short-lived session cookie (explicitly not magic-link), library/photo submissions, technical logs, opt-in email rules, non-sale statement, removal via `admin@lougehrigfanclub.com` |
| `/terms` | **Safe component fallback** matching `src/app/terms/page.tsx` | Respectful use; user submissions; copyright/attribution; no warranties; contact. **No** live “zero-profit mission” or “ALS-related charitable giving” / proceeds claim |

### Seed vs live (F2)

Migration `0009` still contains seeded `/terms` `body_html` text claiming a zero-profit mission and ALS-related charitable proceeds. **That claim is not present in the 2026-08-12 live HTML.** Live behavior is therefore the safer fallback path, not the seeded claim. A future D1 write that restores the seed body without review would reintroduce the risk; #2920 copy work should treat the seed row as hazardous until softened/removed at the data layer if/when D1 rows are touched.

### Auth/member enumeration (Product Decision item 7)

Live `/privacy` already enumerates the specific member/authentication data classes listed in the Product Decision Record. Item 7 is **satisfied on Production/`main`**. The `component/compliance-readiness` branch still carries an older minimal privacy fallback and should be synced before any component-path promotion that relies on fallback copy.

### Analytics disclosure gap (cross-link F3)

Live `/privacy` does **not** disclose Google Analytics / cookies despite GA being active in Production (see `compliance-ga-production-state-2919.md`). That gap is owned by #2920 disclosure/consent work, not resolved by this evidence file.

## What remains unverified without D1 credential access

Exact Production `page_content` row presence (whether D1 rows exist and are empty vs absent) was not queried via `wrangler d1 execute --remote`. Public render observation is sufficient to classify the **user-visible** composition and to clear the prior “completely unconfirmed” stop for #2920 planning. Operator D1 inspection remains useful hygiene before any seed-row mutation.

## Intended final state

- Live composition for `/privacy` and `/terms` is recorded from Production observation (achieved 2026-08-12 for user-visible text).
- #2920 implements any remaining approved copy changes (GA disclosure/consent, accessibility publication, seed-row hygiene if D1 is edited) without relying on an unconfirmed-live assumption.
- No unsupported charitable/tax-status representation remains live (currently true for `/terms` HTML).

## Rollback

This document can be removed or revised without any other repository impact — it makes no code, schema, or public-copy change.
