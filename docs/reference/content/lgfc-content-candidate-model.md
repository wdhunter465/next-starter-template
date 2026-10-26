---
Doc Type: Reference
Audience: Bill, Governance, Cursor, LGFC maintainers, editors, and implementation agents
Authority Level: Controlled
Owns: Canonical LGFC content candidate registry field, state, and promotion model for Program #2273
Does Not Own: D1 migrations, runtime APIs, admin UI, crawler automation, or public publication
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related issues: #2273, #2275, #2270, #2274
Last Reviewed: 2026-10-26
---

# LGFC Content Candidate Model

## Purpose

Define the canonical upstream candidate registry model for the LGFC content
pipeline. This model covers public research, member submissions, admin seed
records, and future scheduled discovery before editorial conversion into
operational D1 surfaces.

Predecessor: `#2274` reconciliation audit (`docs/ops/reports/lgfc-content-pipeline-reconciliation-audit.md`).

## Authority boundaries

| Layer | Role | Source of truth |
| --- | --- | --- |
| Candidate registry | Collect, tag, review candidates | Seed JSON (transitional) → future D1 candidate tables |
| `submission_queue` | Operational member/editor intake staging | D1 (today) |
| `content_inventory` | Published editorial stories | D1 (today) |
| Public surfaces | Safe published content only | `content-inventory-public` helper + inventory filters |

**JSON registry classification:** seed / fixture / transitional only. Not operational
source of truth. See `data/research/lou-gehrig-content-candidates.schema.json`.

**Operational published content** remains `content_inventory` / `submission_queue`
until promoted through the approved editorial workflow.

## Input streams

Every candidate record must set `input_stream`:

| Value | Description |
| --- | --- |
| `public_research` | Archive, museum, newspaper, public-domain lead, timeline fact, etc. |
| `member_submission` | Fan Club member story, photo lead, correction, identification, source lead |
| `admin_seed` | Operator manual record from trusted LGFC knowledge or research |
| `scheduled_discovery` | Reserved for future Worker-based discovery (not used in seed pilot) |

Member submissions are a **first-class** input stream with required extension fields.

## Core candidate fields

| Field | Required | Type | Description |
| --- | ---: | --- | --- |
| `candidate_id` | yes | string | Stable ID; convention `lgfc-gehrig-{year}-{seq}` |
| `input_stream` | yes | enum | See input streams |
| `title` | yes | string | Short working title |
| `source_url` | when applicable | string | Public URL or catalog link |
| `source_name` | yes | string | Archive, website, collection, or submitter label |
| `source_owner` | recommended | string | Rights holder / institution when distinct from `source_name` |
| `source_domain` | when public URL | string | Hostname for public internet sources |
| `source_type` | yes | enum | See source types |
| `content_type` | yes | enum | See content types |
| `summary` | yes | string | Short factual description |
| `date_or_period` | recommended | string | ISO date, year, or approximate period |
| `people_tags` | recommended | string[] | People entities |
| `topic_tags` | recommended | string[] | Topic entities |
| `location_tags` | recommended | string[] | Place entities |
| `provenance_notes` | recommended | string | Source/origin notes |
| `rights_status` | yes | enum | See rights states |
| `source_trust_status` | yes | enum | See source trust states |
| `relevance_status` | yes | enum | `pending`, `relevant`, `not_relevant`, `uncertain` |
| `review_status` | yes | enum | See review states |
| `publication_status` | yes | enum | See publication states |
| `privacy_flag` | yes | enum | See privacy category flags |
| `privacy_review_status` | yes | enum | See privacy review states |
| `credit_line` | when public use possible | string | Required before public publication |
| `media_asset_id` | when media exists | string | Reference to B2/R2/`media_assets` key |
| `duplicate_of` | when duplicate | string | Another `candidate_id` |
| `review_priority` | yes | enum | `low`, `normal`, `high` |
| `admin_notes` | optional | string | Operator review notes |
| `submission_queue_id` | when linked | integer | Operational queue row during transition |
| `content_inventory_id` | after conversion | integer | Published inventory row if promoted |
| `created_at` | yes | string | ISO 8601 UTC |
| `updated_at` | yes | string | ISO 8601 UTC |

### Source types (`source_type`)

`archive`, `museum`, `newspaper`, `library`, `member`, `social`, `auction`,
`institution`, `operator`, `other`

### Content types (`content_type`)

`photo`, `article`, `record`, `story`, `video`, `audio`, `artifact`, `quote`,
`timeline_fact`, `biography_note`, `source_lead`, `correction`, `identification`,
`other`

## Member submission extension

Required when `input_stream = member_submission`:

| Field | Required | Type | Description |
| --- | ---: | --- | --- |
| `submitter_id` | when known | string | Internal member ID |
| `submitter_name` | yes | string | Display name |
| `submitter_contact` | yes | string | Private contact reference (not public) |
| `submission_type` | yes | enum | See submission types |
| `ownership_statement` | yes | string | Submitter ownership/source claim |
| `permission_statement` | yes | string | LGFC use permission claim |
| `credit_preference` | yes | enum | `public_credit`, `anonymous`, `private`, `custom` |
| `privacy_notes` | optional | string | Restrictions or private context |
| `uploaded_media_reference` | when upload exists | string | B2/R2 object key or reference string |
| `related_candidate_id` | optional | string | Existing candidate this relates to |
| `consent_status` | yes | enum | `pending`, `granted`, `restricted`, `denied` |
| `admin_followup_required` | yes | boolean | Operator follow-up flag |

### Submission types (`submission_type`)

`story`, `photo`, `memorabilia`, `correction`, `identification`, `source_lead`,
`historical_note`

Member content defaults to `review_status = pending_review` and
`publication_status = not_ready`. Never public until fully reviewed.

## Source metadata (public research / admin seed)

Optional nested object `source_metadata` for domain-level review:

| Field | Type | Description |
| --- | --- | --- |
| `source_record_id` | string | Future D1 `sources.id` reference |
| `source_trust_status` | enum | Duplicated at top level for query convenience |
| `date_accessed` | string | ISO date operator reviewed source |
| `source_citation` | string | Human-readable citation when URL insufficient |

Source trust does **not** imply rights approval.

## State dimensions (orthogonal)

Candidate review uses **separate** state columns. Do not collapse into
`content_inventory.status`.

### Review states (`review_status`)

| State | Meaning |
| --- | --- |
| `pending_review` | New; not reviewed |
| `approved_internal_reference` | OK for internal research/citation |
| `approved_public_candidate` | OK as publication candidate pending prep |
| `approved_citation_reference_only` | Link/citation only; no reproduction |
| `deferred_source_verification` | Source incomplete |
| `deferred_rights_review` | Rights unresolved |
| `deferred_privacy_review` | Privacy unresolved |
| `rejected` | Must not use |
| `private_internal_only` | Retain internally; never public |

### Rights states (`rights_status`)

`unknown`, `public_domain_candidate`, `permission_needed`, `permission_requested`,
`permission_granted`, `copyright_restricted`, `blocked`

Use `public_domain_candidate` until human confirmation (maps from #1738
`public-domain-candidate`).

### Privacy category flags (`privacy_flag`)

`none`, `living_person`, `donor_member`, `minors`, `sensitive`, `other`

### Privacy review states (`privacy_review_status`)

`not_applicable`, `pending_review`, `approved`, `restricted`, `blocked`

### Source trust states (`source_trust_status`)

`pending`, `trusted`, `questionable`, `blocked`, `deleted`

### Publication states (`publication_status`)

| State | Meaning |
| --- | --- |
| `not_ready` | Not eligible for publication prep |
| `draft_candidate` | Eligible for editorial drafting |
| `staged` | Staged for operator preview |
| `approved_for_publish` | Human approved for specific target |
| `published` | Linked to live inventory/public surface |
| `unpublished` | Was public; withdrawn |
| `archived` | Retained but inactive |

Publication targets (when `approved_for_publish`): `biography`, `timeline`,
`gallery`, `library`, `memorabilia`, `article`, `homepage_feature`,
`lou_gehrig_day`, `newsletter`, `social`, `internal_reference_only`

## Tags and tag categories

Tags are string arrays on the candidate record:

| Array | Category | Examples |
| --- | --- | --- |
| `people_tags` | people | Lou Gehrig, Eleanor Gehrig, Miller Huggins |
| `topic_tags` | topics | ALS, Farewell Speech, Yankees, Columbia |
| `location_tags` | places | Yankee Stadium, New York, Cooperstown |

Future D1 normalization may introduce `tags` + `content_item_tags` tables (#2278).

## Media asset references

| Field | Use |
| --- | --- |
| `media_asset_id` | Canonical reference: `media_assets.media_uid` or planned object key |
| `uploaded_media_reference` | Member upload key (member stream) |

Binary storage: B2 (current LGFC standard). D1 holds metadata only.

Promotion to `photos` / `content_inventory_media` requires rights clearance and
admin action — not automatic from candidate inclusion.

## Duplicate references

| Field | Rule |
| --- | --- |
| `duplicate_of` | Points to canonical `candidate_id` when this row is a duplicate |
| Exact match | Same `source_url` + `content_type`, or operator-defined fingerprint |
| Near match | Flag in `admin_notes`; human confirms |

Operational `submission_queue.duplicate_candidate` maps to proposed tag or
candidate id during transition.

## Audit and event references

Candidate records do not embed full audit history. Future `moderation_events`
table stores:

| Event type | Examples |
| --- | --- |
| `review_state_change` | review_status transition |
| `rights_update` | rights_status change |
| `privacy_update` | privacy_review_status change |
| `publication_prep` | publication_status / target change |
| `duplicate_flagged` | duplicate detection |
| `promotion` | candidate → inventory conversion |

Seed JSON may include optional `last_event_at` for operator convenience only.

## Promotion path to durable surfaces

```text
Candidate registry (seed JSON → future D1 content_items)
  → source/submitter + item + rights + privacy review
  → publication preparation (publication_status, credit_line, target)
  → editorial conversion → content_inventory (+ content_inventory_media → photos)
  → public surfaces (published + attributed inventory only)
```

### Field mapping to `content_inventory`

| Candidate field | Inventory field |
| --- | --- |
| `title` | `title` |
| `summary` + body text from conversion | `text`, `summary` |
| `source_name` | `source_name` |
| `source_url` | `source_url` |
| `credit_line` | `credit_line` |
| `date_or_period` | `event_date` / `event_year` |
| `topic_tags` | contributes to `search_text`, `tag` slug |
| `publication_status = published` | `status = published` (after admin publish) |

Editorial-only fields (`story_type`, `allowed_sections`, `priority`, `canonical`)
are set during conversion, not on the candidate registry.

### Field mapping to `submission_queue` (transition)

Member candidates may link `submission_queue_id` while operational intake uses
the existing queue API. Queue `payload` should mirror member extension fields
until D1 candidate tables exist.

## Public route safety

Public routes must **never** query raw candidate registry records.

Public eligibility requires operational `content_inventory` with:

- `status = published`
- non-empty `source_name` and `credit_line`
- matching `allowed_sections`
- no blocked rights/privacy state at conversion time

See `functions/_lib/content-inventory-public.ts`.

## JSON schema

Machine validation: `data/research/lou-gehrig-content-candidates.schema.json`

Registry file shape:

```json
{
  "schema_version": "1",
  "registry_class": "seed_transitional",
  "candidates": [ /* candidate objects */ ]
}
```

## Legacy mapping (#1738 reference)

| #1738 field | Canonical field |
| --- | --- |
| `source_title` | `source_name` (display) |
| `source_owner` | `source_owner` |
| `source_citation` | `source_metadata.source_citation` |
| `acquisition_method` | maps to `input_stream` |
| `provenance_confidence` | `admin_notes` or future column |
| `factual_confidence` | `admin_notes` or future column |
| `editorial_use_candidate` | maps to `review_status` + `publication_status` |
| `review_status` (1738) | see reconciliation audit Section 2 |

## Acceptance checklist

- [x] All four input streams defined
- [x] Orthogonal review, rights, privacy, trust, publication states
- [x] Member extension fields defined
- [x] JSON classified seed/transitional
- [x] Promotion path to D1 and inventory documented
- [x] Public safety boundary explicit
