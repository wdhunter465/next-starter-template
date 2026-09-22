---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #3161 map-storytelling decision brief — current-state inventory, approach comparison, place-record field proposal, and adopt-versus-defer recommendation
Does Not Own: Implementing a map feature, adding a map dependency, migrating `content_inventory`, or authorizing Production map traffic
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #3161, #2878, #4237, #4238, #4239, #4240
Last Reviewed: 2026-09-22
---

# Map-Based Historical Storytelling — Decision Brief (#3161)

## Purpose

Record an evidence-backed decision brief for a possible future map feature ("Lou Gehrig places and events"), so Product can choose adopt-versus-defer without any code, dependency, or schema being implemented by this brief itself.

#4237 owns this inventory section. #4238 owns the approach-comparison section. #4239 owns the place-record field proposal section. #4240 owns the closing recommendation. No child implements a map, adds a dependency, or migrates `content_inventory`.

## Scope

In scope: current-state inventory of the live map/location stack; comparison of a Leaflet-plus-tile-provider approach against a static illustrated map with clickable hotspots; the design-only place-authority-record field proposal; a closing adopt-versus-defer recommendation.

Out of scope: `npm install` of any mapping library; tile-provider API keys or accounts; `content_inventory` schema/migration changes; a Production map route; authorizing #4135's role-name-replacement sweep (unrelated project).

## Current known truth

Observed 2026-09-22 on `origin/main` (branch cut at `425b29d`):

- `package.json` has no `leaflet` dependency and no other map-tile client library.
- `src/app/**` has no map route. The only path matching the substring "map" is `src/app/sitemap.ts`, which is the Next.js sitemap generator — unrelated to a map feature.
- `content_inventory`'s location handling (`data/research/lou-gehrig-content-candidates.schema.json`, `location_tags` field, line 264) is a free-text `string[]` — no stable identity, no coordinates, no dedup, and no way to query "everything tied to this place." No place-authority-record entity exists in the content model.
- #2878 is the Issue that first surfaced this idea, not a structural parent: `get_sub_issues` on #2878 returns zero sub-issues, and `get_parent` on #3161 returns none. #3161 is, and has been since creation, a standalone Project.

## Intended final state

This brief holds all four sections listed under Purpose. It is not phased beyond its four ordered children (#4237 → #4238 → #4239 → #4240) and has no planned revision beyond ordinary maintenance once #4240 publishes the closing recommendation.

## Inventory (#4237 / `#3161-004`)

| Check | Result |
| --- | --- |
| `leaflet` (or any map-tile client library) in `package.json` | Not present |
| Map route under `src/app/**` | Not present (`sitemap.ts` is the Next.js sitemap generator, not a map feature) |
| Place-authority-record entity in the content model | Not present — `content_inventory` candidates carry `location_tags` as free-text `string[]` only (`data/research/lou-gehrig-content-candidates.schema.json:264`) |
| #2878 relationship to #3161 | Source-of-idea only; not a structural parent (`get_sub_issues`/`get_parent` both confirm no formal linkage) |

**Conclusion:** the repository currently has zero map-stack footprint and no place-record entity. Any future implementation starts from nothing already committed — this inventory does not find partial/abandoned work to reconcile against.

## Approach comparison (#4238 / `#3161-005`)

Two candidate approaches for a future map feature, compared under LGFC's zero-recurring-cost constraint:

### Option A — Leaflet plus a tile provider

A slippy (pan/zoom) map using the Leaflet client library over a raster or vector tile source.

- **Tile-source risk is the deciding factor, not the client library.** Leaflet itself is a thin, free, permissively-licensed rendering layer — it is not the cost or policy concern. Every tile source behind it is. OpenStreetMap's own public tile servers (`tile.openstreetmap.org`) publish a usage policy that is explicitly not meant for arbitrary Production traffic: it requires a valid HTTP `User-Agent`, prohibits bulk/automated downloading, and reserves the right to rate-limit or block traffic that doesn't fit a small-scale/development use pattern — it is not a CDN a Production site can depend on for guaranteed uptime.
- Commercial tile providers with a free tier (e.g., MapTiler, Stadia Maps, Thunderforest) exist, but every free tier LGFC could evaluate comes with a request-volume ceiling, requires an account and an API key (a credential to manage), and converts to a paid tier past that ceiling — which conflicts with the zero-recurring-cost constraint unless traffic is bounded and monitored indefinitely.
- Bundle/dependency cost: adds a runtime dependency (`leaflet` plus its CSS) and, on a static-export/Cloudflare Pages deployment, a client-side-only rendering path (Leaflet requires a DOM and `window`, so it cannot render at build time the way the rest of this mostly-static site does).
- Capability: true pan/zoom/geolocation-style interaction, standard for a general map product; overkill for a short, fixed location list.

### Option B — Static illustrated map with clickable hotspots

A single static image (illustrated or a simplified geographic graphic) with absolutely positioned, clickable regions over named locations — no tile server, no pan/zoom.

- **Zero-recurring-cost-compatible by construction.** The image is a static asset served from the same origin as the rest of the site (or the existing B2/Cloudflare asset pipeline already used elsewhere in this repository) — no third-party tile requests, no API key, no usage policy to stay under, no account to manage.
- No new runtime dependency: implementable with plain HTML/CSS (an image plus absolutely-positioned `<button>`/`<a>` hotspots) or a small amount of first-party React — no client library addition.
- Fully compatible with static export: it's just an image and DOM elements, no client-only rendering escape hatch required.
- Capability ceiling: works well for a small, fixed, curated location list (ballparks, hometown, landmarks — the scope #3161 itself describes); does not scale to an open-ended or user-contributed location set, and offers no real-world geographic accuracy (a stylized map, not a true-to-scale one) — acceptable for a storytelling feature, not for a general-purpose GIS need.

### Comparison summary

| Dimension | Leaflet + tile provider | Static hotspot map |
| --- | --- | --- |
| Zero-recurring-cost compatible | Conditional — only while traffic stays under a compliant free tier's volume cap, monitored indefinitely; OSM's own public tiles are not Production-compliant at any volume | Yes, unconditionally — no third-party request at all |
| New runtime dependency | Yes (`leaflet` + CSS) | No |
| Static-export compatible | Requires a client-only rendering path | Yes, natively |
| Credential/account management | Yes, if using a compliant provider (API key) | No |
| Scales to open-ended/growing location set | Yes | No — fixed, curated list only |
| True geographic pan/zoom | Yes | No |
| Fit for #3161's stated scope (short Lou Gehrig location list) | Over-provisioned for the stated scope | Matches the stated scope |

**Recommendation carried into #4240:** prefer the static-hotspot approach for #3161's stated scope. Leaflet remains a later option only if Product later names a specific, policy-compliant, zero-cost-compatible tile source and the location list grows beyond what a static hotspot map can reasonably serve — that would be a new source Issue's decision, not this brief's.

## Place-authority fields (#4239 / `#3161-006`)

This section records the place-authority-record field proposal already drafted on #3161 so Product can accept or amend the fields in review. It does **not** migrate D1, edit `data/research/lou-gehrig-content-candidates.schema.json`, or add a place table. Schema merge and any `content_inventory` migration require a **later source Issue after Product accepts these fields**.

The inventory (#4237) established that `location_tags` is a free-text `string[]` with no stable identity. A map (or any later location-aware surface, including timeline #3162 or archive filters) needs a place *entity*. The table below follows the existing candidate-schema conventions in `data/research/lou-gehrig-content-candidates.schema.json`.

| Field | Type | Purpose |
| --- | --- | --- |
| `place_id` | string | Stable internal ID (mirrors the `candidate_id` convention) |
| `canonical_name` | string | Display name, for example "Yankee Stadium (original, 1923–2008)" |
| `aliases` | string[] | Alternate names a source might use |
| `place_type` | enum | `ballpark`, `hometown`, `landmark`, `institution`, `event_venue`, `other` |
| `era_note` | string (optional) | Disambiguation for places that moved, were demolished, or were renamed |
| `coordinates` | `{ lat: number, lng: number }` or null | Nullable so the registry can exist before coordinates are confirmed; required only if a later Issue chooses a tile-provider approach |
| `description` | string | Short factual description, same tone/length convention as candidate `summary` |
| `source_url` / `provenance_notes` | string (optional) | Same provenance pattern as the candidate schema |
| `related_candidate_ids` | string[] | Links back to `content_inventory` candidates tied to this place |
| `review_status` | enum | Reuse the candidate schema values (`pending_review`, `approved_internal_reference`, `approved_public_candidate`, `approved_citation_reference_only`, `deferred_source_verification`, `deferred_rights_review`, `deferred_privacy_review`, `rejected`, `private_internal_only`) |
| `created_at` / `updated_at` | string (date-time) | Same as the candidate schema |

Design choices left for Product review rather than decided here:

- `coordinates` is nullable so the registry can be populated before the slippy-map versus static-hotspot implementation choice.
- `review_status` reuses the candidate enum; this brief does not invent a parallel state machine.
- Coordinates stay optional on a static-hotspot path; they become required only if a later Issue adopts a tile provider.

**Protected stop:** this child does not alter the runtime `content_inventory` schema.

---

_The closing recommendation is added by #4240 and does not exist until that child's own PR merges._
