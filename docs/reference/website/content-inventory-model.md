---
Doc Type: Reference
Audience: LGFC maintainers, database implementers, admin/editor implementers, and AI agents
Authority Level: Controlled
Owns: Content inventory model, field definitions, submission queue requirements, media association requirements, and schema invariants for project #1256
Does Not Own: D1 migration files, runtime API implementation, UI copy, or editorial fact approval
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #1256, #824, #819, #1137, #1689, #1685, #2859, #2907
Last Reviewed: 2026-08-12
---

# Content Inventory Model

## Purpose

This reference defines the story-centric D1 content inventory model for LGFC
website implementation work under project `#1256`.

It is a requirements reference, not a migration file. Future implementation
tasks must compare these requirements against the existing D1 schema and create
forward-only migrations only when an approved child issue authorizes that work.

## Scope

This model covers:

- the approved `content_inventory` authority table;
- required story fields and invariants;
- canonical and alternate-perspective handling;
- source, URL, and credit-line requirements;
- media association requirements;
- `submission_queue` intake and review requirements;
- search/discovery fields;
- compatibility constraints for existing website data references.

This model does not replace the production design standard, create migrations,
or authorize runtime edits.

## Current Known Truth

The production design authority identifies:

- `content_inventory` as the active editorial archive and member-library content
  authority;
- `submission_queue` as the member-submission intake and review queue;
- `photos` as the canonical D1 table name for photo data;
- `library_entries` as a legacy Day 1 written-content table that must not be
  silently orphaned if reads move to `content_inventory`.

Future implementation work must reconcile current code and migrations against
this model before adding new tables or replacing existing reads.

## Intended Final State

The content system has one story-centric approved inventory model. Published
website content is read from approved inventory records and associated media,
while submissions are reviewed in a separate queue before publication.

No implementation agent should infer required fields, status values, or
placement behavior from issue comments after this document is approved.

## Model Invariants

| Invariant | Requirement |
|---|---|
| Story-first authority | `content_inventory` owns approved editorial story records. |
| One canonical row per tag | A tag may have multiple rows, but only one canonical row. |
| Alternate perspectives retained | Non-canonical rows under the same tag preserve attributed variants. |
| No per-section booleans | Placement uses `allowed_sections`, not columns such as `show_homepage` or `show_milestones`. |
| Credit line required for every row | Every inventory row must carry `credit_line`; source name and source URL/reference requirements are stricter at publication. |
| Queue before publish | New submissions enter `submission_queue` before inventory publication. |
| Automation advisory only | Automation may triage objective fields but not decide facts or publish. |
| Rejected queue isolation | Rejected submissions are excluded from public rendering and search. |

## `content_inventory` Requirements

`content_inventory` is the approved D1 story inventory table.

| Field | Required | Type expectation | Purpose |
|---|---:|---|---|
| `id` | yes | stable identifier | Primary story row identifier. |
| `tag` | yes | text slug | Groups canonical and alternate-perspective rows. |
| `title` | yes | text | Editorial headline/title. |
| `text` | yes | text | Story body or approved editorial narrative. |
| `summary` | no | text | Short teaser or archive summary when supported. |
| `story_type` | yes | enum-like text | Presentation weight such as `primary`, `secondary`, or `brief`. |
| `canonical` | yes | boolean/integer | Marks the canonical row for a tag. |
| `perspective_label` | no | text | Describes alternate perspective source or angle. |
| `allowed_sections` | yes | JSON/text array | Approved website surfaces for placement. |
| `priority` | yes | integer | Editorial ordering weight within eligible surfaces. |
| `search_text` | yes | text | Normalized searchable text generated or maintained from approved fields. |
| `source_name` | yes for publish | text | Publication, archive, contributor, collection, or source name. |
| `source_url` | when available | text | URL or durable source reference. |
| `credit_line` | yes | text | Human-readable credit or attribution line. |
| `event_date` | no | ISO date text | Specific historical date for anniversary rotation. |
| `event_year` | no | integer | Historical year when exact date is unknown or year browsing is needed. |
| `rotation_group` | no | text | Editorial group used to diversify rotation. |
| `last_featured` | no | timestamp text | Last public feature timestamp for repeat suppression. |
| `feature_weight` | yes | integer | Editorial boost for rotation selection. |
| `status` | yes | enum-like text | Current inventory publication state. |
| `created_at` | yes | timestamp text | Inventory creation timestamp. |
| `updated_at` | yes | timestamp text | Last editorial update timestamp. |
| `published_at` | when published | timestamp text | Publication timestamp. |

### Canonical tag constraint

The implementation must preserve the rule that only one canonical row can exist
for a tag. D1-compatible implementations may enforce this with a partial unique
index, application-level validation, or both, depending on the current schema
capabilities approved in the implementation child issue.

### `story_type` values

Approved story type values:

- `primary`
- `secondary`
- `brief`

Additional values require a reference doc update before implementation.

### `status` values

Current approved inventory status values:

- `draft`
- `published`
- `archived`

Only `published` inventory is eligible for public dynamic population. Future
child issues may add states such as under-review or editorial hold only through
an approved compatibility migration and matching API updates.

## Source, URL, and Credit Requirements

Published inventory must preserve attribution in structured fields.

| Field | Rule |
|---|---|
| `source_name` | Required for publication; names the publication, archive, collection, contributor, or source body. |
| `source_url` | Required when an online source exists; optional when the source is offline or private. |
| `credit_line` | Required for every inventory row; shown or retained as the editorial credit. |

If an item is historically useful but lacks a public URL, editors may publish it
only when `source_name` and `credit_line` preserve a durable attribution trail.

## Canonical and Alternate-Perspective Rows

Rows with the same `tag` belong to the same story group.

| Row type | Requirements |
|---|---|
| Canonical row | `canonical` is true; default row for public story presentation and related-content grouping. |
| Alternate-perspective row | `canonical` is false; shares the tag; preserves attributed context, source-specific framing, member perspective, or conflicting account. |

Alternate-perspective rows must not overwrite the canonical row. Merging,
canonical promotion, or retirement requires manual editorial review.

## Media Association Model

Media remains associated with stories but does not replace the story inventory.

Approved implementation requirements:

- media binary objects and derivatives remain outside `content_inventory`;
- story-media links are represented in D1, either through an existing approved
  media table such as `photos` or an approved association table;
- each linked media item identifies its role, display order, caption or alt text,
  and source/credit data when distinct from the story source;
- memorabilia remains a tagged/filtered view of `photos`, not a separate
  standalone memorabilia table.

### Story-media association fields

If the current implementation does not already provide equivalent story-media
linkage, a future child issue should add or reconcile an association model with
these requirements:

| Field | Required | Purpose |
|---|---:|---|
| `story_id` | yes | References `content_inventory.id`. |
| `media_id` | yes | References the approved media/photo record. |
| `media_role` | yes | Primary image, gallery image, OCR source, newspaper source, memorabilia reference, or supporting image. |
| `display_order` | yes | Stable ordering for story presentation. |
| `caption` | no | Editorial caption. |
| `alt_text` | yes for public images | Accessibility text. |
| `source_name` | when distinct | Media-specific source attribution. |
| `source_url` | when available | Media-specific source URL or reference. |
| `credit_line` | when distinct | Media-specific credit line. |

## `submission_queue` Requirements

`submission_queue` stores member/editor intake before approved publication.

| Field | Required | Purpose |
|---|---:|---|
| `submission_id` | yes | Queue record identifier. |
| `submitted_by` | when known | Member/editor/source identifier. |
| `payload` | yes | Raw submitted text and metadata snapshot. |
| `title` | when supplied | Proposed title. |
| `description` | when supplied | Submitter description or body. |
| `proposed_tag` | when supplied | Suggested story tag. |
| `source_name` | when supplied | Proposed source name. |
| `source_url` | when supplied | Proposed source URL. |
| `credit_line` | when supplied | Proposed credit. |
| `media_reference` | when supplied | Uploaded media or external media reference. |
| `status` | yes | Queue review state. |
| `triage_flags` | no | Objective automation flags. |
| `duplicate_candidate` | no | Candidate existing tag or story. |
| `review_notes` | no | Human review notes. |
| `decision_by` | when decided | Editor/admin who made the decision. |
| `decision_at` | when decided | Decision timestamp. |
| `rejected_at` | when rejected | Rejection timestamp. |
| `purge_eligible_at` | when rejected | Quarterly purge eligibility timestamp. |
| `retention_reason` | when retained | Reason rejected item remains beyond purge cycle. |
| `created_at` | yes | Submission timestamp. |
| `updated_at` | yes | Last queue update timestamp. |

### Submission status values

Approved queue status values:

- `pending`
- `triaged`
- `under_review`
- `approved`
- `rejected`
- `merged`
- `purged`

`approved` means the submission is approved for inventory conversion. `merged`
means useful content was merged into an existing inventory record. `purged`
means the rejected queue record has been removed or reduced according to the
approved purge model while preserving any required audit trail.

## Workflow Integration (Priority #1)

End-to-end intake, review, publication, and placement for Fan Club and public
surfaces are documented in
`docs/reference/website/unified-content-workflow.md`.

Member intake uses `POST /api/library/submit` (text fields and optional media
reference strings). Binary photo upload is deferred; see Task 004 reconciliation
report `docs/ops/reports/website-content-workflow-reconciliation.md`.

Legacy `photos` catalog rows remain operator-managed approved content without a
`photos.status` column. New visual content should flow through
`submission_queue` → editorial publish → inventory and optional
`content_inventory_media` associations.

## Automation Triage Fields

Automation may populate objective and advisory fields only.

Allowed examples:

- missing required source fields;
- unsupported file type;
- malformed URL;
- duplicate candidate tag;
- OCR confidence;
- proposed keywords;
- spam/risk flags based on objective criteria.

Automation-generated triage must not be treated as factual rejection,
publication approval, canonical assignment, or merge approval.

## Search and Discovery Requirements

Published inventory search should include:

- `title`;
- `text`;
- `summary`;
- `tag`;
- `search_text`;
- `source_name`;
- `credit_line`;
- approved media captions and OCR text when available;
- alternate-perspective relationships under the same tag;
- event year and date metadata.

Search must exclude `submission_queue` records unless an admin/editor review
surface explicitly scopes queue search. Public search must exclude rejected,
draft, under-review, archived-hidden, and editorial-hold records.

## Compatibility Requirements

Future implementation tasks must verify:

- existing `content_inventory` columns against this reference;
- existing `submission_queue` columns against this reference;
- existing reads from `library_entries` and whether backfill, fallback, or a
  documented migration path is required;
- existing media/photo records before adding a new media table;
- existing admin/editor flows before creating duplicate tooling.

New build issues should fill documented gaps only.

## Legacy `events` / calendar mapping authority (#2859)

The reviewed mapping from legacy `events` to `content_inventory` lives in
`docs/ops/reports/events-public-content-inventory-mapping-2859.md`.

Standing rules from that map (do not re-derive ad hoc in later children):

- Deterministic source identity: `tag = legacy-events-{id}` for legacy
  primary key `id`.
- `allowed_sections` for migrated rows is `["calendar"]` only; `search`,
  `library`, `related_content`, and `club_home` must not be added until a
  separately reviewed child follows the calendar/navigation (IA) decision.
- `events` rows used for this proving path are pseudo/synthetic Development
  data (Product Authority, 2026-08-12), not final editorial launch content.
- The proving write is scoped to isolated Development D1 (`lgfc-litedev`)
  only; Production writes remain separately authorized.
- Duplicate/conflict handling and the privacy-safe row-class count model are
  fail-closed per the map; the successor proving-write child implements
  tooling against that contract only.
