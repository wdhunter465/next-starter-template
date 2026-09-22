---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #3160 deep-zoom archival viewer decision brief — live presentation inventory (#4233)
Does Not Own: npm add of OpenSeadragon; tile generation; B2 layout change; paid image CDN; Production viewer; rights-hold mutation; OpenAI-name sweep
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3160, #4233, #4234, #4235, #4236, #2860, #2878, #2857
Last Reviewed: 2026-09-22
---

# Deep-Zoom Archival Viewer Decision Brief (#3160)

## Purpose

Record live-main photo and media presentation facts so later #3160 children can compare tiling strategies, rights exposure, and an adopt-versus-defer recommendation without adding a viewer from this parent.

## Scope

In scope for this revision (#4233): inventory of live photo/media presentation versus deep-zoom needs.

Out of scope: adding `openseadragon`; generating DZI/IIIF tiles; changing B2 keys; a Production pan-and-zoom route; `/admin` or public route edits.

## Current known truth

Observed 2026-09-22 on `origin/main` (`cfa7eb1d`):

- Root `package.json` has no `openseadragon` dependency. No IIIF or DZI viewer package is declared there.
- Fan Club photo gallery `src/app/fanclub/photo/page.tsx` loads list/detail through Fan Club photo APIs and `PhotoDetailPanel`. Detail rendering uses a single `<img>` with `objectFit: contain`. Thumbnails in `src/components/fanclub/PhotoLightboxGrid.tsx` are also `<img>`. That is flat-image presentation, not a DZI or IIIF pyramid viewer.
- Shipped #2860 `content_inventory` / media-asset rows (`b2_key`, `media_uid`, admin media-assets listing) are the asset layer a later presentation feature would sit on. B2 currently stores flat originals/derivatives, not an image pyramid.
- #2878 inspected a vendored `Point.js` geometry helper on `component/historical-code-collection`. That file is not a usable OpenSeadragon viewer. Live `main` does not ship that helper as a gallery.

## Intended final state

This file remains a decision brief. A later child records tiling, rights, and the adopt-versus-defer recommendation. This revision does not authorize npm adoption or tile generation.

## Live presentation versus deep-zoom needs (#4233)

| Surface | Live fact | Deep-zoom gap |
| --- | --- | --- |
| npm | No `openseadragon` in `package.json` | Library not present to adopt |
| Fan Club photo list/detail | Flat `<img>` thumbnails and detail | No pan/zoom pyramid, no DZI/IIIF tile source |
| Media model | #2860 `content_inventory` + B2 `b2_key` | Flat objects, not tiled derivatives |
| Historical vendor sample | #2878 `Point.js` only | Not a viewer; do not treat as adoption evidence |

Deep-zoom would be presentation on top of existing media assets, not a new DAM. #2857-style photo-detail is the current integration shape; this parent does not extend that route.

## Protected stops

- No viewer implementation.
- No tile generation.
- No paid image-processing service.
- No leak of unreviewed originals (rights child #4235).
