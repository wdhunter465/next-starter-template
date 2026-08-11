---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: #3167 Lighthouse CI evaluation evidence, overlap analysis, and Adopt/Adapt/Reject recommendation
Does Not Own: CI gate enablement, Production mutation, defect remediation, or #2878 project scope changes
Canonical Reference: /docs/reference/ci/lighthouse-ci-evaluation-3167.md
Related Issues: #3167, #3182, #3165, #3172, #2453, #2858, #2878
Last Reviewed: 2026-08-11
---

# Lighthouse CI evaluation (#3167)

## Purpose

Record the bounded non-Production evaluation of `@lhci/cli` for LGFC launch-readiness evidence, including repeatability, overlap with existing checks, and an Adopt/Adapt/Reject recommendation. Prior prototype design context lives in `docs/ops/reports/lighthouse-ci-baseline-prototype-design-3182.md` (#3182).

## Scope

Evaluation against representative public static routes from a fresh `main` build. No blocking thresholds. No Production mutation. No paid hosted Lighthouse service.

## Environment

| Item | Value |
| --- | --- |
| Base | `origin/main` @ evaluation start |
| Tool | `@lhci/cli` ^0.15.1 (already in `package.json`) |
| Command | `npm run lighthouse:baseline` → `lhci collect --staticDistDir=out` for `/`, `/search/`, `/join/`, `/faq/`, `/about/` (`--numberOfRuns=1`) |
| Browser | Playwright Chromium via `CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1194/chrome-linux/chrome` (required on this host; without it LHCI fails immediately) |
| Artifacts | `.lighthouseci/` (gitignored); not committed |

## Current known truth

Baselines captured 2026-08-11 (two consecutive collects).

### Run 1 (~94s wall)

| Final URL | Perf | A11y | Best Practices | SEO |
| --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 100 | 100 |
| `/search/` | 100 | 100 | 100 | 100 |
| `/join/` | 100 | 100 | 100 | 100 |
| `/ask/` (from `/faq/` redirect) | 100 | 100 | 100 | 100 |
| `/about/` | 100 | 100 | 100 | 100 |

### Run 2 (~85s wall)

| Final URL | Perf | A11y | Best Practices | SEO |
| --- | --- | --- | --- | --- |
| `/` | **0** | 100 | 100 | 100 |
| `/search/` | 100 | 100 | 100 | 100 |
| `/join/` | 100 | 100 | 100 | 100 |
| `/ask/` | 100 | 100 | 100 | 100 |
| `/about/` | 100 | 100 | 100 | 100 |

### Repeatability

- Accessibility / Best Practices / SEO: stable across both runs on this host.
- Performance: **not stable** — home page swung 100 → 0 between consecutive identical collects. Treating Performance category scores as advisory-only; unsuitable for required PR gates without median-of-N + flake quarantine.
- Prior #3182 baseline (2026-08-08) showed lower Performance (77–100) under default mobile throttling narrative; today’s runs differ materially. Do not treat absolute Performance numbers as durable launch SLOs without a fixed runner image + multi-run medians.

## Overlap with existing checks

| Evidence type | Existing LGFC coverage | Lighthouse incremental value |
| --- | --- | --- |
| Accessibility (critical/serious) | Playwright + `@axe-core/playwright` (`tests/e2e/accessibility-scan.spec.ts`, #3165/#3172) | Partial overlap; LH a11y category is coarser. Prefer axe for defect filing. |
| SEO basics | Static `robots.txt` / `sitemap.xml`, meta in app; quality gates | Some unique SEO audits; mostly informational if robots/sitemap already enforced. |
| Best practices | Limited direct analogue | Mild incremental signal. |
| Performance / CWV-style | No required Lighthouse gate today | Unique category; high flake risk; useful for launch-readiness **evidence packs**, not merge blockers. |

## Cost / hosting

- Zero paid Lighthouse SaaS.
- Uses existing GitHub + local/CI Chrome (Playwright browser cache or system Chrome).
- Artifact retention: keep `.lighthouseci/` gitignored; attach summary tables to Issues/PRs or upload Actions artifacts on an **advisory** workflow if adopted later.

## Recommendation: **Adapt**

| Decision | Rationale |
| --- | --- |
| **Adapt** (not Adopt-as-required-gate; not Reject) | Tooling already present and runnable; adds performance/SEO/best-practices evidence beyond axe. Performance instability and ~1.5 min / 5-route cost make it a poor required PR check. |

### Exact PMO / Engineering consumers

- `#2453` launch-readiness framework — advisory evidence pack only
- `#2858` responsive/quality qualification — optional baseline attachment
- `#3165` / `#3172` — do not duplicate a11y defects via Lighthouse when axe already owns them
- `#3182` design record remains valid; this Issue refreshes evidence after #3305/#3324 window

### Proposed operating mode (if Product Authority agrees)

1. Keep `npm run lighthouse:baseline` as **manual / on-demand** (document `CHROME_PATH` for Chromebook/CI images).
2. Optional later: non-required workflow_dispatch or nightly advisory job with artifact upload — **separate Issue** after Adapt acceptance.
3. Do **not** add required branch-protection checks based on Lighthouse scores.
4. Prefer `--numberOfRuns=3` + median when capturing launch-readiness evidence; treat single-run Performance as informational.

## Stop conditions honored

- No Production changes
- No blocking thresholds
- No paid hosted dependency
- Did not wire a new CI gate in this evaluation
