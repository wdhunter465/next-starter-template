---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Controlled
Owns: `events` → `content_inventory` field map, source identity, duplicate/conflict rules, publication-state handling for the Development proving path, privacy-safe count model, and exact requirements for the Development-only proving write/verification authorized under #2859
Does Not Own: Migration execution, backfill tooling, schema changes, D1/B2 mutation, Production access, Production promotion, or the protected calendar/events navigation (IA) decision
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related Issues: #2859, #2907, #2860, #2910
Last Reviewed: 2026-08-12
---

# Events-public → content inventory mapping (#2859)

## Purpose

Define the field mapping from the existing `events` table into canonical
`content_inventory` so the Development-only proving write authorized in the
[2026-08-12 Product Authority decision](https://github.com/wdhunter465/next-starter-template/issues/2859#issuecomment-5268547844)
can proceed without inventing mapping rules — a second, independent source
domain following the same discipline as the `library_entries` map (#2910).

This report is documentation only. It does not migrate, mutate, or retire any
rows, and it does not change any live `/api/events/*` or `/api/search` read
path.

## Authorization basis

Product Authority (2026-08-12, issue comment 5268547844) authorized the next
#2859 increment on these terms:

- `events-public` may proceed as the first canonical `content_inventory`
  mapping/design increment.
- Calendar event records used for this proving path are **pseudo/synthetic
  data intended to populate and exercise the calendar**, not final editorial
  launch content.
- The field mapping must be **defined and reviewed before any write**.
- The mapping is exercised first **only** against isolated Development D1
  (`lgfc-litedev`).
- The proving write/verification must validate record counts, canonical
  identity/provenance, publication state, idempotency, search/navigation/
  calendar behavior, and rollback evidence before any later Production
  population decision.
- This decision does **not** authorize Production D1 writes for #2859.
- The separate protected boundary for Library/content classes requiring
  substantive content selection is unaffected: Library population still
  requires rights clearance and editorial selection/approval.

This report satisfies the "define/review" step. The bounded Development-only
proving write is a successor action, gated on this map being accepted.

## Evidence baseline

| Surface | Path / identity | Role |
| --- | --- | --- |
| Starting SHA | `535cbb0233...` (tip after PR #3401) | `component/production-content-readiness` |
| Component branch | `component/production-content-readiness` | Model B PR target for #2859 children |
| Legacy schema | `migrations/0014_events.sql` | `id`, `title`, `start_date`, `end_date`, `location`, `host`, `fees`, `description`, `external_url`, `status` (`posted`\|`hidden`), `created_at`, `updated_at` |
| Seed data | `migrations/0028_seed_events_next10.sql` | Synthetic placeholder events; only seeds when zero posted future events exist |
| Canonical schema | `migrations/0035_editorial_archive.sql` + `0036_content_inventory_schema_delta.sql` | `content_inventory` + `summary`/`perspective_label`/`event_year` |
| Model authority | `docs/reference/website/content-inventory-model.md` | Field and publication invariants |
| Sourcing register | `docs/ops/reports/production-content-evidence-reconciliation-2907.md` §4.2/§6 | `events-public` batch class: "Calendar rows; do not change nav without Product decision" |
| Live calendar reads (unchanged by this map) | `functions/api/events/month.ts`, `functions/api/events/next.ts`, `functions/api/admin/events/*.ts` | Read `events` directly; no `content_inventory` dual-read exists for calendar today |
| Global search (unchanged by this map) | `functions/api/search.ts` | Queries `events` directly for `type: 'Event'` results **and** separately queries `content_inventory` with `sectionKey: SEARCH_SECTION` (`'search'`) for `type: 'Archive'` results |
| Dev D1 live evidence | [#2859 preflight, 2026-08-12](https://github.com/wdhunter465/next-starter-template/issues/2859#issuecomment-5265431661) | `lgfc-litedev`: `events` = 21 rows, `content_inventory` = 0 rows |

Production D1 row counts were **not** queried for this map (no Production
access authorized).

## Boundary: no runtime or navigation change

Unlike the library dual-read (#2910), there is currently no inventory-first
fallback wired for any calendar surface, and none is authorized by this
document. `/api/events/month`, `/api/events/next`, and the admin events
endpoints continue to read the `events` table exclusively.

This map introduces `allowed_sections` value `calendar` — a section key not
consumed by any runtime code today. Populating `content_inventory` rows with
`allowed_sections = ["calendar"]` therefore changes **no** live response.

**`search` must not be included in `allowed_sections` for this proving path.**
`functions/api/search.ts` calls `fetchSearchInventoryResults` with
`sectionKey: SEARCH_SECTION` (`'search'`) unconditionally whenever
`content_inventory` exists, and would otherwise surface migrated calendar rows
as mislabeled `type: 'Archive'` results pointing at `/fanclub/library` —
duplicating and misrepresenting the existing direct `events` query results.
Wiring events into global search is future work (§6 of the sourcing register:
"Search index ... derived after domain batches") and requires its own
reviewed child after the calendar/IA decision (P-16/P-26) is resolved.

Wiring `content_inventory` into any public calendar surface, or changing
`/events` navigation, remains a separate protected decision (P-16/P-26,
Bill/ChatGPT) and is out of scope for this map and its proving write.

## Field-by-field map

### Deterministic source identity

```text
source_identity = legacy:events:{id}
tag             = legacy-events-{id}
```

Rules:

- `tag` is the durable story group key and must be unique for the migrated
  canonical row (`canonical = 1`).
- Re-running the proving write with the same `source_identity` / `tag` is
  idempotent: update in place; do not create a second canonical row.
- `events` carries no PII columns; no field is excluded from mapping on
  privacy grounds. `location`/`host`/`fees` are already public calendar copy.

### Column mapping

| `events` | `content_inventory` | Rule |
| --- | --- | --- |
| `id` | identity via `tag` / source identity | Never overwrite an unrelated inventory `id`; new inserts receive a new inventory `id`. |
| `title` | `title` | Required. Empty/whitespace title → **fail closed** (exclude from migration). |
| `description` | `text` | Required (schema `NOT NULL`). Empty/whitespace description → **fail closed** (exclude from migration); do not substitute `title` to satisfy the constraint. |
| `start_date` | `event_date`; also seed `event_year` (year slice) | Copy verbatim (`YYYY-MM-DD`). |
| `end_date` | folded into `text`/`summary` composition | No dedicated column; when present and different from `start_date`, append a "through {end_date}" note to the composed text. |
| `location` | folded into `text`/`summary` composition | No dedicated column; included in composed narrative and `search_text`. |
| `host` | `source_name` | Use `host` when non-empty; default `LGFC Fan Club Calendar` when blank. |
| `fees` | folded into `text`/`summary` composition | No dedicated column. |
| `external_url` | `source_url` | Copy verbatim when present; else null. |
| `status` (`posted`\|`hidden`) | `status` | See publication-state handling below. |
| `created_at` | `created_at` | Preserve original timestamp string when present; otherwise use migration clock. |
| `updated_at` | `updated_at` | Preserve original timestamp string when present; otherwise use migration clock. |
| (none) | `credit_line` | Required column (`NOT NULL`, no default in schema — unlike `source_name`, this must be set on every insert regardless of publish state). Default `LGFC Fan Club (event calendar)`. |
| (none) | `story_type` | Default `brief` (matches sourcing register P-10 "Calendar teaser"). |
| (none) | `allowed_sections` | `["calendar"]` only. Do **not** add `search`, `library`, `related_content`, or `club_home` in this proving path (see Boundary section). |
| (none) | `canonical` | `1` for the migrated primary row. |
| (none) | `priority` | `0`. |
| (none) | `feature_weight` | `1`. |
| (none) | `rotation_group` | `events`. |
| (none) | `search_text` | Derived from `title`, composed `text`, `location`, `host`, and `tag` only. |
| (none) | `summary` | Composed teaser (`title` + `start_date` + `location`), truncated to ≤160 chars. |
| (none) | `media` | `[]`. No media association in this proving path. |

### Publication-state handling

| Condition | Resulting `content_inventory.status` | Notes |
| --- | --- | --- |
| `events.status = 'posted'` and non-empty `title`/`description` | `published` | **Development proving only.** No live surface reads the `calendar` section, so this does not create public exposure; it exists to let the proving write exercise the same publish-attribution triggers (`0036`) and publication-state evidence Product Authority asked to validate. |
| `events.status = 'hidden'` | `archived` | Mirrors legacy hidden intent; excluded from any future calendar-consuming query by both `status` and `allowed_sections` filters. |
| Empty/whitespace `title` or `description`, or missing `start_date` | **excluded from migration** | Fail closed; list in dry-run exception report, do not insert a partial row. |

`credit_line` and `source_name` are populated unconditionally (see column
mapping), so the `0036` publish-attribution triggers never block a
`published` row created by this map.

## Duplicate and conflict rules

| Case | Detection | Disposition |
| --- | --- | --- |
| Re-run same legacy id | `tag = legacy-events-{id}` already present | Idempotent upsert of mapped fields; keep inventory `id`. |
| Inventory tag collision with a non-events tag | Existing `content_inventory.tag` equals the proposed tag but the row is not this migration's source | **Fail closed** — stop that row; escalate rather than overwrite. |
| Two `events` rows with identical normalized title+start_date | Same fingerprint, different ids (e.g. duplicate placeholder seeds) | Migrate both as separate tags (`legacy-events-{id}`); do not auto-merge. |
| `events` row deleted after a prior proving run | Inventory row with matching `legacy-events-{id}` tag has no current `events.id` match | Leave the inventory row as-is (`archived`/`published`); do not auto-delete. Retirement is a later, explicitly reviewed step, consistent with the library map's no-destructive-default rule. |

Default mode for the proving write is **stop batch on first unresolved
conflict class**, matching the #2910 precedent, unless the runbook for the
successor child records otherwise.

## Privacy-safe row-class count model

`events` carries no PII columns (no email/name fields), but the same
aggregate-only discipline applies — no row content in evidence, only class
counts.

| Class ID | Definition | Note |
| --- | --- | --- |
| `EV_TOTAL` | `COUNT(*)` from `events` | Aggregate only |
| `EV_POSTED` | rows with `status = 'posted'` | Aggregate only |
| `EV_HIDDEN` | rows with `status = 'hidden'` | Aggregate only |
| `EV_INVALID_EMPTY` | empty/whitespace `title` or `description`, or missing `start_date` | Aggregate only |
| `CI_CALENDAR_TAG` | inventory rows whose `tag` LIKE `legacy-events-%` | Aggregate only |
| `CI_CALENDAR_PUBLISHED` | subset of `CI_CALENDAR_TAG` with `status = 'published'` | Aggregate only |
| `GAP_UNMIGRATED` | `EV_POSTED - CI_CALENDAR_TAG` (matched by id) | Computed after dry-run |

Live Development fills of this table are the required evidence for the
successor proving-write child. This document approves the class taxonomy and
the no-PII-in-evidence rule; there is no Production count requirement since
Production writes remain unauthorized.

## Exact implementation requirements for the successor (Development-only proving write)

- Implement a read-only idempotent dry-run against `lgfc-litedev` before any
  write, using this map.
- Enforce source identity `tag = legacy-events-{id}`.
- Set `allowed_sections = ["calendar"]` only — never `search`, `library`,
  `related_content`, or `club_home` in this proving path.
- Emit privacy-safe class counts (§ above) + per-row exception codes; no
  event-content payloads in evidence beyond what is already public calendar
  copy.
- Prove idempotency: a second run against the same `lgfc-litedev` state
  produces zero net-new tags.
- Prove rollback: deleting/reverting rows by `tag LIKE 'legacy-events-%'`
  removes exactly the migrated set and nothing else.
- Confirm `/api/events/*`, `/api/search`, and admin events surfaces are
  behaviorally unchanged after the write (same responses as before, since no
  runtime path yet reads the `calendar` section or includes these rows in
  `search`).
- Scope strictly to `lgfc-litedev`. No Production D1 write, no Production B2
  write, no navigation/IA change, no wiring of `content_inventory` into any
  public or member-facing calendar rendering.

## Acceptance checklist (this map)

- [x] Every `events` column is mapped or its omission explained.
- [x] Deterministic source identity defined.
- [x] Duplicate/conflict rules fail closed.
- [x] Publication-state handling defined and reconciled against the `0036`
      attribution triggers.
- [x] Confirmed no live runtime or navigation change results from populating
      `content_inventory` under this map (explicit `search`-section
      exclusion).
- [x] Privacy-safe row-class count model defined.
- [x] Exact requirements recorded for the successor proving-write child.

## Rollback

Revert the documentation PR that introduces this report and the paired model
reference update. No data rollback is required for this mapping document
itself, since it performs no migration or write.
