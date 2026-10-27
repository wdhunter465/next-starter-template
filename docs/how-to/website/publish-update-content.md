---
Doc Type: How-To
Audience: LGFC editors, admins, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: Procedure for publishing or updating approved content inventory records
Does Not Own: Runtime deployment, schema migration, visual layout, or final human approval authority
Canonical Reference: /docs/reference/website/editorial-placement-and-rotation.md
Related Issues: #1256, #824, #819, #1137
Last Reviewed: 2026-06-07
---

# Publish or Update Content

## Purpose

Use this procedure when an approved story is ready to become public inventory or
when an existing published story needs an editorial update.

Publishing changes website eligibility. It must remain a manual editor/admin
decision.

## Scope

This how-to covers:

- final pre-publication checks;
- publishing a draft or approved queue item;
- updating a published story;
- changing placement and rotation fields;
- preserving source, credit, canonical, and media decisions.

## Steps

1. Confirm the story has completed manual editorial review.
2. Verify required story, source, URL/reference, and credit fields.
3. Verify canonical or alternate-perspective status.
4. Verify media associations and media-specific credits.
5. Verify placement and rotation settings.
6. Publish the story or save the update.
7. Confirm public eligibility surfaces match `allowed_sections`.
8. Record update notes for future review.

## Procedure

### 1. Confirm manual review

Before publishing, verify that an editor/admin has reviewed:

- factual claims;
- source fit;
- canonical or alternate-perspective decision;
- merge/update decision when applicable;
- media source and credit;
- placement eligibility;
- search and discovery eligibility.

Automation suggestions are not approval.

### 2. Verify required fields

Required for publication:

- `tag`;
- `title`;
- `text`;
- `story_type`;
- `canonical`;
- `allowed_sections`;
- `priority`;
- `source_name`;
- `credit_line`;
- `status`;
- `search_text` or equivalent generated index text.

Use `source_url` when an online source exists. Use `event_date` or `event_year`
when the story participates in date-aware rotation, milestone display, or year
browse.

### 3. Verify canonical status

If `canonical = true`, confirm no other canonical row exists for the same tag.

If the story is an alternate perspective, confirm:

- the canonical row remains intact;
- the alternate is labeled clearly enough for editors and future public display;
- attribution explains why the alternate is retained.

### 4. Verify media associations

For each linked media item, confirm:

- approved media/photo identifier;
- media role;
- display order;
- alt text for public images;
- caption when needed;
- media-specific source and credit when distinct from the story.

Do not publish a story that depends on missing or uncredited media unless the
surface can present the story without that media.

### 5. Verify placement and rotation

Check:

- `allowed_sections` contains only approved section keys;
- `priority` matches editorial intent;
- `story_type` matches presentation weight;
- `feature_weight` is appropriate;
- `rotation_group` is set when diversity or campaign grouping matters;
- `event_date` and `event_year` are correct when used.

Do not add new section keys during publication unless the reference registry has
already been updated.

### 6. Publish or update

For new publication:

- set `status = published`;
- set or verify `published_at`;
- preserve `created_at` and `updated_at`;
- convert the source queue item to `approved` or `merged` when applicable.

For updates:

- preserve the original source and credit lineage;
- update `updated_at`;
- record what changed;
- re-review canonical, media, and placement fields if the update affects public
  display.

### 7. Confirm eligibility

After publishing or updating, confirm the story is eligible only for the
intended surfaces:

- homepage spotlight or sections;
- discussions;
- milestones;
- Fan Club library;
- search;
- archive;
- related content.

Eligibility comes from `allowed_sections`, `status`, source/credit completeness,
editorial holds, and surface-specific rules.

### 8. Record notes

Record notes for:

- publication decision;
- source or credit exceptions;
- canonical changes;
- alternate-perspective rationale;
- media decisions;
- placement or rotation changes;
- queue conversion or merge target.

## Closeout Criteria

A publish/update action is complete when the story is published or saved with
accurate attribution, canonical status, media associations, placement controls,
rotation metadata, and review notes.
