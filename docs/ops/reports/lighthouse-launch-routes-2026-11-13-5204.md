---
Doc Type: Report
Audience: Human + AI
Authority Level: Supporting (evidence record; not a Go packet row)
Owns: Lighthouse scores, and the cited Playwright axe and 390px results, for the 2027 launch routes on Production on 2026-11-13, against the #4423 thresholds
Does Not Own: The thresholds (see docs/reference/pmo/2027-fundraiser-risk-debt-readiness.md), the Go decision, or any fix
Canonical Reference: /docs/reference/pmo/2027-fundraiser-risk-debt-readiness.md
Last Reviewed: 2026-11-13
Related Issues: #5204, #4421, #4423, #4426
---

# Lighthouse and Playwright evidence, launch routes, 2026-11-13

## Status

All eight routes meet the #4423 thresholds. This is a measurement of the live Production site on 2026-11-13, read only. It is not a Go.

## What was run

- **Lighthouse 12.6.1**, mobile profile (the default emulation and throttling), categories performance and accessibility, one run per route against `https://www.lougehrigfanclub.com`. Headless Chromium on a cloud runner.
- **Playwright** `tests/e2e/accessibility-scan.spec.ts` (axe, critical and serious) and `tests/e2e/mobile-navigation.spec.ts` (390px, tablet and desktop widths) against the same site. 14 of 14 passed.
- **Revision:** Production serves the commit last deployed by the Pages workflow. The deployed SHA marker is not readable from this runner, so the revision is recorded as the date of the run. `main` was at `4435031d` when the run was made.

## Lighthouse results

| Route | Accessibility | Performance | LCP | CLS | TBT | Performance floor applies |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 100 | 82 | 4.2 s | 0.075 | 190 ms | yes |
| `/search/` | 100 | 90 | 3.5 s | 0 | 110 ms | yes |
| `/join/` | 100 | 99 | 1.6 s | 0 | 130 ms | yes |
| `/ask/` | 100 | 90 | 2.0 s | 0.179 | 130 ms | yes |
| `/about/` | 100 | 99 | 2.0 s | 0 | 90 ms | yes |
| `/events/` | 100 | 99 | 2.0 s | 0 | 60 ms | no |
| `/fundraiser-details/` | 100 | 99 | 2.0 s | 0 | 50 ms | no |
| `/contact/` | 100 | 97 | 1.9 s | 0 | 190 ms | no |

Thresholds (#4423): accessibility at least 95 on all eight routes; performance at least 60, CLS at most 0.25 and TBT at most 600 ms on `/`, `/join/`, `/about/`, `/ask/` and `/search/`.

Every route passes every threshold. The weakest are the home page (performance 82, LCP 4.2 s) and `/ask/` (CLS 0.179, the closest to the 0.25 limit). The 2026-10 measured home score was 67 with LCP 5.7 s, so the home page has improved.

## Playwright results

- `accessibility-scan.spec.ts` scans `/`, `/search/`, `/join/`, `/ask/` and `/about/` with axe and asserts no critical or serious violations: 5 of 5 passed.
- `mobile-navigation.spec.ts` checks the phone layout at 390px (no horizontal overflow, hamburger navigation) and 768, 920 and 1280px for the public and member headers and the footer: 9 of 9 passed.
- The axe spec covers 5 of the 8 named routes. `/events/`, `/fundraiser-details/` and `/contact/` are covered by the Lighthouse accessibility score (100), which uses axe rules, and not by the Playwright axe spec.

## Limits

- One Lighthouse run per route. Scores vary a few points from run to run, and the home page is the one route near a noticeable drop.
- Mobile profile only; a desktop profile was not run.
- Authenticated pages were not measured.
- Visual validation is not part of this record.
