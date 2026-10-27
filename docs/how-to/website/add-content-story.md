---
Doc Type: How-To
Audience: LGFC editors, admins, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: Procedure for adding a story to the content inventory model
Does Not Own: Final factual approval, D1 migration implementation, runtime UI implementation, or media upload tooling
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related Issues: #1256, #824, #819, #1137
Last Reviewed: 2026-06-07
---

# Add a Content Story

## Purpose

Use this procedure when adding a new editorial story to the LGFC content
inventory after the approved admin/editor tooling exists.

This procedure describes the required editorial decisions and fields. It does
not create runtime behavior or bypass manual review.

## Scope

This how-to covers:

- creating a story-centric inventory record;
- choosing or reusing a tag;
- assigning canonical or alternate-perspective status;
- setting source, URL, and credit fields;
- setting placement and rotation metadata.

## Steps

1. Identify the story subject.
2. Search existing inventory for the proposed tag, title, source, and event
   year.
3. Decide whether the story is a new canonical story, an alternate perspective,
   or an update to an existing story.
4. Draft the title and story text.
5. Assign required attribution fields.
6. Assign story classification and placement fields.
7. Add event and rotation metadata when relevant.
8. Attach or queue media according to the media procedure.
9. Save the story as draft or under review.
10. Submit the story for manual editorial review before publication.

## Procedure

### 1. Identify the story subject

Record the historical subject, event, person, source, or member contribution the
story covers.

Useful identifying details include:

- Lou Gehrig-related event or theme;
- source publication or collection;
- event date or event year;
- related Yankees, ALS, Hall of Fame, or Fan Club context;
- whether media is needed for the story to make sense.

### 2. Search for existing inventory

Before creating a row, search for:

- same or similar `tag`;
- same title or source;
- matching event date or year;
- likely duplicate media;
- existing canonical row for the same story group.

If a matching tag exists, do not create a competing canonical row. Decide whether
the new material updates the canonical row or becomes an alternate perspective.

### 3. Choose the tag

Use a stable, readable tag that can group related records over time.

Good tags are:

- historically meaningful;
- short enough for review;
- reusable across canonical and alternate rows;
- not tied to a temporary homepage section.

### 4. Decide canonical status

Use `canonical = true` only when the row is the default editorial version for
the tag.

Use `canonical = false` when the row preserves:

- a member-submitted perspective;
- a conflicting or source-specific account;
- a shorter brief based on the same event;
- a source transcript or OCR-derived variant;
- context that should remain visible without replacing the canonical row.

Only manual editors decide canonical status.

### 5. Enter story fields

Populate at least:

- `tag`;
- `title`;
- `text`;
- `story_type`;
- `canonical`;
- `allowed_sections`;
- `priority`;
- `source_name`;
- `credit_line`;
- `status`.

Add `source_url` when available.

### 6. Set placement controls

Choose `allowed_sections` from the approved registry in
`docs/reference/website/editorial-placement-and-rotation.md`.

Do not create section-specific booleans. If a needed section is missing from the
registry, stop and update the reference design before implementation.

### 7. Set rotation metadata

Add:

- `event_date` when an exact anniversary date is known;
- `event_year` when only the historical year is known or year browsing matters;
- `rotation_group` when the story belongs to a recurring theme;
- `feature_weight` when editors want to boost or reduce feature likelihood.

Leave `last_featured` to the rotation/publication system unless an approved
editorial workflow allows manual correction.

### 8. Add media references

If the story has supporting media, follow
`docs/how-to/website/add-content-media.md`.

Do not publish media without credit/source review.

### 9. Save as draft or under review

New manual story entries should remain `draft` until reviewed.

Do not set `status = published` until the publish/update procedure has been
completed.

### 10. Submit for editorial review

Manual review must verify:

- factual claims and source fit;
- canonical or alternate-perspective decision;
- attribution completeness;
- media credit/source completeness;
- placement eligibility;
- search/discovery text;
- publication status.

## Closeout Criteria

A story is ready for publication review when required fields are populated,
source and credit are present, media decisions are documented, and no duplicate
canonical row is being created for the same tag.
