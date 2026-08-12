---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, Grok, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: F3 live-state evidence for Production Google Analytics presence, per the #2919 approved Product Decision Record item 2 (updated with 2026-08-12 public Production probes under #2920)
Does Not Own: Production environment-variable mutation, disclosure/consent-UI implementation completion claims, or legal conclusions about consent adequacy
Canonical Reference: /docs/ops/reports/compliance-product-decision-register-2919.md
Related Issues: #2784, #2918, #2919, #2920
Last Reviewed: 2026-08-12
---

# Production Analytics (`NEXT_PUBLIC_GA_ID` / gtag) State — Evidence (#2919 / #2920)

## Purpose

Record whether Google Analytics is active in Production, per Product Decision Record item 2 ("verify the Production `NEXT_PUBLIC_GA_ID` state… if GA is active, keep it disabled or disable it until the required disclosure and consent control are implemented and approved"). This is read-only evidence gathering relative to repository and public HTML; it does not mutate Production configuration.

## Scope

In scope: repository gating logic for `GoogleAnalytics.tsx` and **public Production HTML probes** (2026-08-12). Out of scope: Cloudflare Pages dashboard mutation, inventing a consent legal regime, and claiming #2920 disclosure/consent UI complete.

## Current known truth (repository)

`src/components/GoogleAnalytics.tsx` renders a no-op unless `process.env.NEXT_PUBLIC_GA_ID` is set. It is included from `src/app/layout.tsx`, so Production load depends entirely on the Cloudflare Pages build-time environment variable. No repository file commits a non-empty `NEXT_PUBLIC_GA_ID`. There is no consent gate and no `/privacy` analytics disclosure in current code paths regardless of whether the variable is set.

## Public Production probe — 2026-08-12

Method: unauthenticated `curl -sL` of `https://www.lougehrigfanclub.com/`, `/privacy/`, and `/terms/`.

| Observation | Result |
| --- | --- |
| Measurement ID present in HTML | **`G-BRV48J1VE`** |
| Loader | `https://www.googletagmanager.com/gtag/js?id=G-BRV48J1VE` preload + inline `gtag('config', 'G-BRV48J1VE')` |
| Scope | Present on homepage, `/privacy`, and `/terms` |
| Privacy disclosure of analytics | **Absent** on live `/privacy` text |

**Conclusion:** Google Analytics **is active** in Production. The prior “unconfirmed” protected stop for *whether* GA loads is **cleared** by public observation. (Cloudflare dashboard confirmation of the env var name remains optional hygiene; user-visible behavior is decisive.)

## Product Decision implications

Per approved item 2:

1. **Interim requirement while consent/disclosure incomplete:** GA should be kept disabled or disabled until disclosure **and** consent control are implemented and approved.
2. **Disabling Production** (unsetting `NEXT_PUBLIC_GA_ID` in Cloudflare Pages) is a **protected Production configuration action** — not performed by this document or by a docs-only PR.
3. **#2920 owns** the disclosure copy and any consent UI that would later allow re-enabling under an approved model.
4. **Consent model still needs Product direction** if disclosure-only is proposed as an interim without disable: the written decision pairs disclosure **and** consent, with disable as the safe default when active.

## Recommended next steps (operators / #2920)

1. Product/WORK: choose (a) disable Production GA env until full disclosure+consent ships, or (b) explicitly authorize a disclosure-only interim (would be a new Product note — not assumed here).
2. #2920: implement privacy analytics disclosure (and consent UI if authorized) on the component branch with an exact allowlist.
3. Operator with Cloudflare access: if (a) is selected, unset Production `NEXT_PUBLIC_GA_ID` through the authorized configuration path and record the change.

## Intended final state

- Production GA state is known (achieved: **active**, ID `G-BRV48J1VE`).
- Either GA is disabled pending controls, or approved disclosure+consent controls are live and Product-accepted.
- `/privacy` accurately describes analytics when active.

## Rollback

This document can be removed or revised without any other repository impact — it makes no code, schema, or Production configuration change.
