---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Design Record
Owns: Design, evidence, and CI-impact measurement for the #3165 accessibility-scan prototype
Does Not Own: Remediation of any accessibility findings (routed separately), #2858 acceptance criteria, or Production promotion authority
Canonical Reference: /docs/ops/pmo/pmo-backlog.md
Related Issues: #3165, #3172, #2858, #2878
Last Reviewed: 2026-08-08
---

# Automated accessibility scan prototype — design and evidence (#3165)

## Status

**Non-production, feeds #2858/#2859 launch-readiness evidence.** `@axe-core/playwright` is a dev-only dependency. `tests/e2e/accessibility-scan.spec.ts` is not wired into any currently-active required CI gate (see "CI wiring" below) — it exists as a runnable, evidenced building block, per the same build → test → vet → review pattern as #3163/#3164.

## Objective

Evaluate `@axe-core/playwright` against the repository's existing Playwright infrastructure (`playwright.config.ts`, `tests/e2e/**`) rather than building a bespoke accessibility crawler, per the #2878 research recommendation. Scan a small representative set of public routes and produce real, measured evidence — not a synthetic pass.

## What was built

- Added `@axe-core/playwright` (MPL-2.0) as a dev dependency only.
- `tests/e2e/accessibility-scan.spec.ts` — scans `/`, `/search`, `/join`, `/faq`, `/about` (the routes named in #3165's own scope). Asserts zero `critical`/`serious` violations per route; `moderate`/`minor` findings are captured as an attached JSON evidence artifact rather than asserted against, so the spec doesn't start failing on cosmetic findings outside what #3165 scoped.

## Real result: the scan found real, pre-existing findings — not fixed here

Running the spec against a local static-export build surfaced genuine `serious` violations on `/` (home). Per #3165's own acceptance criteria ("Findings... reported back... as evidence, not silently fixed inside this tooling issue"), these were **not** fixed as part of this build. They're filed as **#3172** with full detail (selectors, contrast ratios, WCAG references):

1. `color-contrast` (serious) — 6 muted calendar-day elements at 2.1:1 contrast, below the required 4.5:1.
2. `link-in-text-block` (serious) — the homepage's "Join or log in" link at 2.43:1 contrast with no non-color distinguishing style, below the required 3:1.

`/search`, `/join`, `/faq`, and `/about` currently pass with zero critical/serious violations.

Also observed on `/` at `moderate` impact (not blocking, logged in #3172 for completeness rather than opened as separate issues): no `<main>` landmark on the page at all, a duplicate/ambiguous banner landmark, and a large number of homepage sections not contained in any landmark region.

### One finding not filed as a defect — flagged as an open question instead

The homepage's Milestones section rendered `Unable to load milestones...` fallback text during this scan. This exact residue was the subject of an unresolved investigation in #3074 ("not yet proven defective from repository text search... may originate from D1-managed content or a production-data/content surface"). The scan environment used here is a bare static file server (`serve` over `next build`'s static export) with **no Cloudflare Pages Functions runtime behind it** — so a client-side fetch to a D1-backed API would be expected to fail in this specific setup regardless of real production health. This is likely why #3074's static source-text search never found the literal string: it's a runtime fetch-error fallback, not markup in the source. Flagging this as a plausible answer to #3074's open question rather than filing it as a confirmed production defect, since confirming it against real production (which does have the Functions runtime and D1 binding) would require different evidence than this prototype can produce.

## CI wiring (deliberately not changed)

Two existing workflows already run the full `tests/e2e/**` directory with `npx playwright test` (no path filter), so this new spec is automatically included in both once merged:

- `.github/workflows/preview-invariants.yml` — currently `workflow_dispatch`-only ("TEMP DISABLED... not production-configured and is currently disruptive/noisy" per its own header comment). Does not run automatically on PRs today.
- `.github/workflows/production-audit.yml` — runs on a twice-daily cron against live production, plus manual dispatch, plus push-to-`main` scoped to changes under `docs/ops/scan-trigger.md` only. This workflow has `issues: write` permission. Merging this spec means it will be picked up by the next scheduled production run and may itself surface (or auto-file evidence about) the same or different real findings against production — this is expected, and arguably desirable given the tool's purpose, but worth knowing about explicitly rather than discovering it as a surprise.

No currently-required PR gate (`quality`, `pr-hygiene`, `check`, etc.) runs Playwright at all, so this addition does not introduce a new blocking check on this or future PRs.

## CI run-time impact (measured)

Local run, single worker, against the static export via `serve`:

```
5 tests, 1 failed (real finding, not flaky) / 4 passed
Total wall time: ~10.8s
```

For reference, this is comparable to or faster than the existing `tests/e2e/mobile-navigation.spec.ts`/`launch-readiness-*.spec.ts` specs already in the suite; adding it to a future required e2e gate would not be a meaningfully larger addition than what's already there.

## Test evidence

```
npx vitest run   (full suite — unaffected by this change)
✓ 985 tests passed, 94 files, 0 regressions

npx tsc --noEmit
✓ clean

npx eslint tests/e2e/accessibility-scan.spec.ts
✓ clean

npx playwright test tests/e2e/accessibility-scan.spec.ts (against local static export)
4 passed / 1 failed — real finding, filed as #3172, not a flaky/tooling failure
```

## Explicitly out of scope for this prototype

- Fixing any of the findings (#3172, filed separately).
- Wiring this spec into a currently-required/blocking CI gate — that's a separate decision, not made here.
- Scanning authenticated Fan Club routes, admin routes, or the full route manifest — only the small representative public set named in #3165's scope was evaluated.
- Lighthouse CI or other advisory tooling — a separate, lower-priority worklist item per #2878.

## Review checklist for the promotion decision

- [ ] #3172's two real findings — accepted as routed evidence (no action needed here), or want anything different?
- [ ] The #3074 milestones-fallback observation — worth a note to whoever owns #3074 follow-up, or treat as informational only?
- [ ] Whether/when to wire this spec into a required CI gate is a separate decision — confirm it stays unwired for now, or say otherwise.
- [ ] Decision (Adopt as-is / Adopt with follow-up / Revise) — Product Authority's call, not self-declared here.
