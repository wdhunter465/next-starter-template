---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Design Record
Owns: Design, baseline evidence, and CI-impact measurement for the #3182 Lighthouse CI prototype
Does Not Own: Remediation of any performance/accessibility findings, #2858/#2859 acceptance criteria, or Production promotion authority
Canonical Reference: /docs/ops/pmo/pmo-backlog.md
Related Issues: #3182, #3165, #3172, #2858, #2859, #2878
Last Reviewed: 2026-08-08
---

# Lighthouse CI baseline prototype — design and evidence (#3182)

## Status

**Non-production, advisory-only, feeds #2858/#2859 evidence.** `@lhci/cli` is a dev-only dependency. `npm run lighthouse:baseline` is a manually-run local command, not wired into any CI workflow at all (not even the non-required ones #3165 documented) — this evaluation deliberately stops short of any CI wiring per this issue's own scope ("no CI gate fails based on Lighthouse scores").

## Objective

Evaluate `@lhci/cli` as the advisory performance/accessibility/best-practices/SEO baseline tool recommended in #2878's 2026-08-07 reuse scan, using the same small representative public route set as #3165 (`/`, `/search`, `/join`, `/faq`, `/about`) so the two tools' evidence is directly comparable.

## What was built

- Added `@lhci/cli` (Apache-2.0) as a dev dependency only.
- `npm run lighthouse:baseline` — runs `lhci collect --staticDistDir=out` against the same 5 routes as #3165, one run per route (`--numberOfRuns=1`, see "Why 1 run, not 3" below), producing local JSON/HTML reports under `.lighthouseci/` (gitignored, not committed — this is a report-generation tool, not a pass/fail gate).
- `.lighthouseci/` added to `.gitignore`.

### Why staticDistDir instead of a manually-started server

`lhci collect --staticDistDir=out` starts and stops its own static file server automatically, which is simpler and more reliable for CI than manually managing a `serve` process (the approach #3165's design doc used for its own local measurement). No behavior difference for the app itself — same `next build` static export either way.

### Why 1 run per route, not the default 3

LHCI defaults to 3 runs per URL and reports the median, to smooth out run-to-run variance. For this evaluation (establishing that the tool works and getting a first baseline), 1 run keeps the evaluation fast; the CI-time figure below should be read as a lower bound — a real 3-run baseline would take roughly 3x as long per route.

## Baseline results (measured, single run per route, default Lighthouse mobile-throttled preset)

| Route | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` (home) | 77 | 92 | 96 | 100 |
| `/search` | 77 | 100 | 96 | 100 |
| `/join` | 91 | 100 | 96 | 100 |
| `/faq` | 96 | 100 | 96 | 100 |
| `/about` | 100 | 100 | 96 | 100 |

### Important caveat: default Lighthouse throttling

Lighthouse's default configuration simulates a throttled mobile network and a 4x-slowed CPU. The numbers above (especially the home page's 5.6s simulated Largest Contentful Paint) reflect that synthetic worst-case, **not** what a real visitor on typical broadband/WiFi experiences. They're useful as a **relative baseline** — comparing routes to each other and tracking change over time — not as literal user-facing load times. Treat "home is the slowest of the 5 scanned routes" as the finding; treat "5.6s" as a synthetic number, not a claim about real production latency.

### Cross-confirmation with #3165/#3172

The home page's accessibility score (92, the only route below 100) is driven by the exact same two `serious` findings #3165 (`@axe-core/playwright`) already found and #3172 already filed: `color-contrast` and `link-in-text-block`, both scoring 0 in this tool's audit as well. Two independent tools agreeing is good corroborating evidence — not filing this as a new/separate issue, since #3172 already has it with more detail (selectors, ratios).

### Performance finding not filed as a defect (informational only)

The home page's Largest Contentful Paint element is the page's `<h1>` (text, not an image), with two render-blocking stylesheets (~470ms combined) identified as a contributing factor. Given the throttling caveat above and that this was a single run (no 3-run median for stability), this is recorded here as a baseline data point for #2859/#2858 evidence, not filed as a confirmed performance defect. If launch-readiness work wants to act on it, re-running with `--numberOfRuns=3` for a stable median first is recommended.

## CI run-time impact (measured)

```
5 routes, 1 run each: ~59s wall time (real 0m58.8s)
```

For comparison, #3165's axe-core scan of the same 5 routes took ~10.8s. Lighthouse is meaningfully heavier — full page audits with simulated network/CPU throttling per route, versus a single DOM accessibility pass. This is direct evidence for the "advisory only, not a required gate" posture recommended in #2878's original scan: at ~1 minute for a 1-run/5-route pass (and ~3 minutes for a proper 3-run median), this is not something to run on every PR without real budget consideration.

## Test evidence

```
npx vitest run   (full suite — unaffected by this change)
✓ 985 tests passed, 94 files, 0 regressions

npx tsc --noEmit
✓ clean

npx eslint
✓ clean (no application source changed)
```

No new automated test suite was added — this is a report-generation tool, not a library with testable logic. The "test" here is the successful, reproducible baseline run documented above.

## Explicitly out of scope for this prototype

- Any CI wiring at all, required or advisory — deliberately more conservative than #3165, per this issue's own "no CI gate fails" scope.
- Fixing the color-contrast/link-in-text-block findings (#3172 already owns those) or the LCP finding (not filed, see above).
- A 3-run stable-median baseline — only a 1-run fast baseline was captured here.
- Scanning authenticated Fan Club routes, admin routes, or the full route manifest.

## Review checklist for the promotion decision

- [ ] Baseline numbers accepted as a useful starting point for #2858/#2859 evidence, or is a 3-run stable baseline wanted before treating any number as reliable?
- [ ] Confirm the LCP/throttling finding stays informational-only (no defect issue filed) unless a 3-run re-check confirms it's stable and worth acting on.
- [ ] Whether/how this should be run going forward (manual, ad-hoc `npm run lighthouse:baseline`, or something more structured) — not decided here.
- [ ] Decision (Adopt as-is / Adopt with follow-up / Revise) — Product Authority's call, not self-declared here.
