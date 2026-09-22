---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #3160 deep-zoom archival viewer decision brief — live presentation inventory (#4233) and tiling comparison (#4234)
Does Not Own: npm add of OpenSeadragon; tile generation; B2 layout change; paid image CDN; Production viewer; rights-hold mutation; OpenAI-name sweep
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3160, #4233, #4234, #4235, #4236, #2860, #2878, #2857
Last Reviewed: 2026-09-22
---

# Deep-Zoom Archival Viewer Decision Brief (#3160)

## Purpose

Record live-main photo and media presentation facts so later #3160 children can compare tiling strategies, rights exposure, and an adopt-versus-defer recommendation without adding a viewer from this parent.

## Scope

In scope for this revision (#4234): three-way tiling comparison under zero recurring cost, on top of the #4233 inventory.

Out of scope: adding `openseadragon`; generating DZI/IIIF tiles; changing B2 keys; a Production pan-and-zoom route; `/admin` or public route edits.

## Current known truth

Observed 2026-09-22 on `origin/main` (`cfa7eb1d`):

- Root `package.json` has no `openseadragon` dependency. No IIIF or DZI viewer package is declared there.
- Fan Club photo gallery `src/app/fanclub/photo/page.tsx` loads list/detail through Fan Club photo APIs and `PhotoDetailPanel`. Detail rendering uses a single `<img>` with `objectFit: contain`. Thumbnails in `src/components/fanclub/PhotoLightboxGrid.tsx` are also `<img>`. That is flat-image presentation, not a DZI or IIIF pyramid viewer.
- Shipped #2860 `content_inventory` / media-asset rows (`b2_key`, `media_uid`, admin media-assets listing) are the asset layer a later presentation feature would sit on. B2 currently stores flat originals/derivatives, not an image pyramid.
- #2878 inspected a vendored `Point.js` geometry helper on `component/historical-code-collection`. That file is not a usable OpenSeadragon viewer. Live `main` does not ship that helper as a gallery.

## Intended final state

This file remains a decision brief. OpenSeadragon npm adoption waits on a chosen tiling path. This revision does not generate tiles or authorize a live processing service.

## Live presentation versus deep-zoom needs (#4233)

| Surface | Live fact | Deep-zoom gap |
| --- | --- | --- |
| npm | No `openseadragon` in `package.json` | Library not present to adopt |
| Fan Club photo list/detail | Flat `<img>` thumbnails and detail | No pan/zoom pyramid, no DZI/IIIF tile source |
| Media model | #2860 `content_inventory` + B2 `b2_key` | Flat objects, not tiled derivatives |
| Historical vendor sample | #2878 `Point.js` only | Not a viewer; do not treat as adoption evidence |

Deep-zoom would be presentation on top of existing media assets, not a new DAM. #2857-style photo-detail is the current integration shape; this parent does not extend that route.

## Tiling strategies under zero recurring cost (#4234)

OpenSeadragon needs a DZI or IIIF-style pyramid, not a single JPEG. Live B2 objects are flat. The three strategies:

| Strategy | What it does | Recurring cost | Fit |
| --- | --- | --- | --- |
| Upload-time tiling | Generate pyramid when media is ingested | Pipeline always-on compute unless strictly one-shot and operator-run | Reject as a Day-1 always-on ingest service |
| On-demand tiling | Generate tiles when a visitor zooms | Live image-processing service | Reject under zero-recurring-cost |
| Hand-picked / manual or build-time DZI | Curated archival set, tiles produced once (operator machine or a later authorized build step) | Storage of static tiles only; no live processor | Prefer for any later implementation Issue |

Pending-brief recommendation: **hand-picked archival items with one-time/manual or build-time DZI**. Do not invent a Product vendor spend or paid image CDN. OpenSeadragon adoption waits on that tiling choice plus a named, rights-cleared set (rights and recommendation children).

This comparison is design only. No tiles are generated here.

## Protected stops

- No viewer implementation.
- No tile generation in this parent.
- No paid image-processing service or paid CDN.
- No leak of unreviewed originals (rights child #4235).
