---
Doc Type: Reference
Audience: LGFC maintainers, editors, website implementers, and AI agents
Authority Level: Controlled
Owns: Editorial placement fields, allowed section values, rotation rules, and dynamic population invariants for content inventory
Does Not Own: Runtime query implementation, visual layout, component behavior, or editorial content approval
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related issues: #1256, #824, #819, #1137, #1689, #1685, #4263
Last Reviewed: 2026-09-23
---

# Editorial Placement and Rotation

## Purpose

This reference defines how approved content inventory records become eligible for
homepage, archive, search, milestone, discussion, Fan Club library, and
related-content surfaces.

It documents placement and rotation requirements only. It does not authorize
component, route, CSS, migration, workflow, or runtime changes.

## Scope

This reference covers:

- `allowed_sections` values;
- `priority` ordering;
- `story_type` presentation weight;
- date-aware rotation fields;
- related-content discovery;
- public search eligibility;
- exclusion rules for unpublished and rejected content.

## Current Known Truth

The production design standard locks the homepage section order and identifies
`content_inventory` as the active editorial archive and member-library content
authority. The project `#1256` requires placement controls that avoid per-section
true/false columns and support editorial rotation from D1 inventory data.

## Intended Final State

Website surfaces query published inventory records using shared placement
metadata. New surfaces are added by documenting new `allowed_sections` values,
not by creating one boolean column per surface.

## Placement Invariants

| Invariant | Requirement |
|---|---|
| Published-only public reads | Public surfaces only select `status = published`. |
| No rejected queue leakage | `submission_queue` records never populate public surfaces directly. |
| No per-section booleans | Section eligibility lives in `allowed_sections`. |
| Priority is scoped | `priority` orders records within an eligible surface; it is not global truth. |
| Canonical preference | Canonical rows are default public choices unless a surface explicitly includes alternate perspectives. |
| Manual editorial override | Editors can change allowed sections, priority, feature weight, and holds through approved workflows. |

## Allowed Section Registry

`allowed_sections` stores a JSON/text array of approved surface keys.

| Section key | Surface | Use |
|---|---|---|
| `homepage_spotlight` | Homepage spotlight slot | High-priority feature content when the slot is enabled. |
| `homepage_discussions` | Homepage discussions section | Story prompts or context suitable for discussion. |
| `homepage_milestones` | Homepage milestones section | Event/date/year-driven milestone content. |
| `library` | Fan Club library | Member-visible historical and archival stories. |
| `search` | Public search | Published content eligible for public search indexing. |
| `archive` | Public or member archive | Browsable historical inventory. |
| `club_home` | Authenticated Club Home (`/fanclub`) | Lead story, secondary rail, archive spotlight, and other Club Home modules fed from published inventory. |
| `related_content` | Related story modules | Story cards linked by tag, date, source, media, or rotation group. |

Additional values require a reference update before implementation.

## Club Home Slot Map (Task 005 handoff)

When `allowed_sections` includes `club_home`, editors may target these Club Home
module slots. Runtime selection rules are implementation-owned; this table defines
editorial placement intent only.

| Club Home module | Primary data authority | Placement notes |
| --- | --- | --- |
| Masthead / static copy | `page_content` (slug sections) | Operator copy; not a substitute for lead story inventory |
| Lead story | `content_inventory` | `story_type = primary`; high `priority` within `club_home` |
| Secondary story rail | `content_inventory` | `story_type = secondary` or `brief` |
| Photo / memorabilia feature | `photos` + `content_inventory_media` | Catalog or inventory-linked feature; static fallback when empty |
| Archive spotlight | `content_inventory` | Tag/anniversary-driven; `club_home` + optional `archive` |
| Feature links (Gallery / Library / Memorabilia) | routes + counts optional | Navigation cards; not inventory rows |
| Campaign / events / recognition | `page_content`, `events`, future config | Fail-closed until display rules exist |
| Lou Gehrig box score | `retrosheet_gehrig_games` + `retrosheet_box_score_lines` | Left-margin bottom; one hashed-random game per America/New_York calendar day (#4263) |
| AL standings as of game date | `retrosheet_al_standings_snapshots` | Right-margin bottom; same daily game as the box score (#4263) |
| Submission CTA | route `/fanclub/submit` | Intake only; see unified workflow reference |

See `docs/reference/website/unified-content-workflow.md` for lane boundaries between
`page_content`, `content_inventory`, and `photos`.

## Priority Rules

`priority` is an integer editorial ordering weight.

| Priority pattern | Meaning |
|---|---|
| Higher number | Stronger editorial preference within the same eligible surface. |
| Equal priority | Secondary ordering may use rotation score, event proximity, update time, or deterministic title/date ordering. |
| Negative priority | Allowed only when implementation explicitly supports deprioritization without hiding the record. |

Priority must not publish a record, override editorial holds, bypass canonical
rules, or make a story eligible for a section not present in `allowed_sections`.

## Story Type Rules

| `story_type` | Placement meaning |
|---|---|
| `primary` | Anchor story or large feature treatment. |
| `secondary` | Supporting story or medium card treatment. |
| `brief` | Short item, list item, or compact card treatment. |

Visual treatment remains owned by component/layout implementation. This
reference only defines the content meaning of the value.

## Rotation Fields

| Field | Purpose |
|---|---|
| `event_date` | Specific anniversary or historical date. |
| `event_year` | Historical year for year-based browse and milestone relevance. |
| `rotation_group` | Diversifies repeated features by theme or campaign. |
| `last_featured` | Suppresses recently featured content. |
| `feature_weight` | Editorial boost for rotation ranking. |

## Rotation Eligibility

A story is eligible for editorial rotation only when all conditions are true:

- the record is published;
- the target section appears in `allowed_sections`;
- the story is not under editorial hold;
- required source and credit data are present;
- linked media required by the target surface is available or the surface allows
  text-only stories;
- the story satisfies any surface-specific canonical or alternate-perspective
  rule.

## Rotation Scoring Model

Implementation may vary the exact arithmetic, but it must preserve these inputs:

| Input | Effect |
|---|---|
| Event proximity | Boosts stories near `event_date` anniversaries or relevant `event_year` milestones. |
| `feature_weight` | Adds editor-controlled prominence. |
| `priority` | Adds surface-specific editorial ordering. |
| Recent-feature penalty | Reduces stories with recent `last_featured`. |
| Rotation group diversity | Reduces repeated use of the same `rotation_group` when alternatives exist. |
| Canonical preference | Prefers canonical rows unless the surface asks for alternate perspectives. |

The rotation engine must be deterministic enough for debugging and review.
Random selection without logged or reproducible inputs is not sufficient for
editorial operations.

## Date-Aware Rotation

Date-aware rotation supports:

- Lou Gehrig Day;
- Yankees milestones;
- Hall of Fame and retirement anniversaries;
- ALS awareness moments;
- historical publication anniversaries;
- member/community features tied to an event year.

`event_date` should be used when the exact month/day matters. `event_year`
should be used when only the year is known or when archive browsing groups by
year.

## Canonical and Alternate-Perspective Placement

| Surface | Default canonical behavior |
|---|---|
| Homepage feature surfaces | Prefer canonical rows. Alternates may appear only when explicitly selected or when the surface is designed to show perspective sets. |
| Search | Include canonical and alternate rows when both are published and search-eligible. |
| Archive | Include canonical and alternate rows with clear labels. |
| Related content | Link alternates under the same tag and related stories by shared metadata. |
| Fan Club library | Include alternates when attribution and editorial labeling are clear. |

Alternate rows must not silently replace the canonical row.

## Search and Discovery

Public search eligibility requires:

- `status = published`;
- `search` in `allowed_sections`;
- populated `search_text` or equivalent indexable fields;
- source and credit data sufficient for public display or retained metadata;
- no editorial hold.

Discovery may group results by:

- tag;
- canonical/alternate relationship;
- event year;
- source;
- media association;
- rotation group;
- story type.

## Related Content Rules

Related content can be derived from:

- shared `tag`;
- canonical/alternate relationship;
- matching `event_year`;
- close `event_date`;
- shared source or source collection;
- shared media association;
- shared `rotation_group`;
- editorial tags captured in `search_text` or future approved metadata.

Related-content modules must exclude unpublished, rejected, purged, or
editorial-hold content.

## Public Surface Exclusions

Public dynamic population must exclude:

- `submission_queue` records;
- rejected submissions;
- purged submissions;
- draft inventory;
- under-review inventory;
- editorial-hold inventory;
- archived records not explicitly approved for archive display;
- records missing required publication attribution.

## Admin/Editor Surface Visibility

Admin/editor surfaces may show drafts, submissions, rejected records awaiting
purge, duplicate candidates, and editorial-hold records when the route is
properly authorized. Those records remain excluded from public rendering until a
manual publication decision changes their status.
