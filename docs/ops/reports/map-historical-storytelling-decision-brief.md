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

---

_Sections below are added by later children in this same Issue chain (#4238, #4239, #4240) and do not exist until each child's own PR merges._
