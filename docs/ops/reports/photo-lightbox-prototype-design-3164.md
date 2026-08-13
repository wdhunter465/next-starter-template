---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Design Record
Owns: Design, accessibility rationale, and bundle-size/test evidence for the #3164 lightbox prototype
Does Not Own: #2857 photo-intake route/API implementation, moderation workflow, or Production promotion authority
Canonical Reference: /docs/ops/pmo/pmo-backlog.md
Related Issues: #3164, #2857, #2878
Last Reviewed: 2026-08-08
---

# Photo-detail lightbox prototype — design and evidence (#3164)

## Status

**Non-production, feeds #2857.** `src/components/fanclub/PhotoLightboxGrid.tsx` is a prototype component. It is not imported by any page/route/layout — building the site produces the exact same output with or without this file present (confirmed below). It exists so #2857's photo-detail work unit has a tested, ready-to-adapt building block once #2857's entry gate (#2860 completed and accepted) clears.

## Objective

Evaluate `yet-another-react-lightbox` (MIT) against the real gap in `src/app/fanclub/photo/page.tsx`: the current gallery renders a plain grid of `<img>` tags with no click-to-enlarge, zoom, or keyboard-navigable detail view at all. Confirm the library covers that gap correctly (keyboard nav, focus management, accessible markup) using LGFC's actual photo-item data shape, and get a real measured bundle-size number rather than a guess.

## What was built

- `src/components/fanclub/PhotoLightboxGrid.tsx` — a thin wrapper: renders a grid of focusable thumbnail `<button>`s (mirroring the real gallery's card pattern) and opens `yet-another-react-lightbox`'s core `<Lightbox>` on click. Alt-text/title fallback logic (`photoDisplayText`) intentionally matches the real gallery page's existing `title || description || 'Photo #{id}'` pattern exactly, so the mapping is a known quantity when #2857 wires this in.
- Manages focus itself: records which thumbnail opened the lightbox and returns focus to it on close (both via the library's own Close button and via Escape), rather than assuming the library does this — verified by test, not assumed.
- `tests/photo-lightbox-grid-prototype.test.tsx` — 11 tests, all passing, using `@testing-library/react` + `@testing-library/user-event` against the real rendered DOM (not mocks).

## Design decision: enhancement, not replacement

Per #2857's accepted decision, a linkable, keyboard-accessible static detail route is required regardless of any modal/lightbox enhancement — the lightbox may not be the only way to reach a photo's detail view. This prototype only covers the modal/enhancement layer (click a thumbnail → view large, navigate, close). The static detail route itself (e.g., `/fanclub/photo?id=123`) is untouched, unbuilt, and out of scope here — it belongs to #2857's own route work, not this evaluation.

## What the tests actually verify (not just "it renders")

- Clicking a specific thumbnail opens the lightbox on the *correct* slide (index correctness verified, not assumed — an early test run caught a real test-authoring bug here, see below).
- Escape closes it, **and focus returns to the exact thumbnail that opened it** (not just "focus goes somewhere") — this is the accessibility requirement that's easiest to get wrong and easiest to miss without a real assertion.
- Clicking the library's own "Close" button does the same.
- "Next"/"Previous" buttons and ArrowRight/ArrowLeft keys both navigate slides correctly.
- Correct thumbnail-source fallback (`thumbnail_url` → `url` → "unavailable" placeholder) and the shared alt-text/title-fallback logic, matching the real gallery page's existing rules.
- Empty item list renders no thumbnails and nothing to open.

### A real bug caught during this build (worth recording)

The first test run failed with `Found multiple elements with the alt text: "Team photo, 1927"` — because the thumbnail `<img>` and the lightbox's own slide `<img>` legitimately share the same alt text by design (both describe the same photo). This wasn't a bug in the component; it was an under-specified test querying the whole document instead of scoping to the open dialog (`within(screen.getByRole('dialog'))`). Recorded here because it's exactly the kind of thing that's easy to gloss over as "flaky" rather than fix properly — the fix is in the merged test file, not worked around.

## Bundle-size evidence (measured, not estimated)

Measured via a temporary, uncommitted probe route built with `next build` (Next's reported page sizes are its standard production, minified, gzip-compressed figures) and removed immediately after measurement — no probe route exists in the diff.

| Probe | Route-specific size | First Load JS |
|---|---|---|
| Baseline (no lightbox import) | 260 B | 102 kB |
| With `PhotoLightboxGrid` (library + wrapper) | 11.4 kB | 114 kB |

**Net addition: ≈11.1 kB route-specific / ≈12 kB First Load JS**, gzip-compressed, for the core library with no optional plugins (no Zoom, Counter, Thumbnails, Captions, Slideshow, Share, Download, or Fullscreen plugins — none were imported). This is a genuinely light addition for a fully accessible, keyboard/touch-aware modal viewer; a hand-rolled equivalent with correct focus-trap and keyboard handling would not obviously be smaller once written and tested to the same bar.

For reference, `next build`'s per-route output also confirms that Next.js App Router excludes any route segment folder prefixed with `_` from routing entirely (e.g., `src/app/_anything/page.tsx` produces no route) — useful to know for any future throwaway prototyping that must guarantee zero production surface even before a PR review catches it.

## Explicitly out of scope for this prototype

- The static, linkable `/fanclub/photo` detail route itself (URL-addressable single-photo view) — #2857's own work, not a library concern.
- Any B2/D1/moderation/upload logic — this prototype only renders client-supplied data.
- Optional `yet-another-react-lightbox` plugins (Zoom, Captions, Counter, Thumbnails, etc.) — not evaluated; if #2857 wants any of them, each should be measured individually since they add to the bundle-size figure above.
- Actual wiring into `src/app/fanclub/photo/page.tsx` — left untouched; this stays a prototype until #2857's entry gate clears.

## Test evidence

```
npx vitest run tests/photo-lightbox-grid-prototype.test.tsx
✓ 11 tests passed

npx vitest run   (full suite)
✓ 985 tests passed, 94 test files, 0 regressions (974/93 baseline + 11/1 new)

npx tsc --noEmit
✓ clean

npx eslint src/components/fanclub/PhotoLightboxGrid.tsx tests/photo-lightbox-grid-prototype.test.tsx
✓ clean (1 pre-existing-pattern warning: no-img-element, identical to the warning already present on
  src/app/fanclub/photo/page.tsx today, expected because next.config.ts sets images.unoptimized:true
  for Cloudflare Pages static export — next/image would not help here)
```

## Review checklist for the promotion decision

- [ ] Bundle-size addition (~11-12 kB gzip) accepted as reasonable for the accessibility/UX gain, or a lighter alternative requested.
- [ ] Focus-management approach (component-owned, tested) accepted, or requested to rely on library defaults instead.
- [ ] Confirm this stays unwired until #2857's entry gate (#2860) clears — no route currently imports it.
- [ ] Decision (Adopt as-is / Adopt with follow-up / Revise) recorded back in #3164 and #2878.
