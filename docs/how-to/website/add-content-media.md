---
Doc Type: How-To
Audience: LGFC editors, media admins, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: Procedure for associating media with content inventory stories
Does Not Own: B2 bucket configuration, D1 migrations, media upload implementation, or final rights/legal approval
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related Issues: #1256, #824, #819, #1137
Last Reviewed: 2026-06-07
---

# Add Content Media

## Purpose

Use this procedure when adding or associating photos, newspaper scans,
memorabilia images, OCR source images, or other approved media with a
`content_inventory` story.

The story remains the editorial authority. Media supports the story; media does
not create a separate content strategy.

## Scope

This how-to covers:

- verifying media source and credit;
- linking media to a story;
- selecting a media role;
- preserving captions, alt text, and OCR/source context;
- keeping memorabilia within the approved photo/media model.

## Steps

1. Identify the story that the media supports.
2. Verify that the media source, URL/reference, and credit line are known or
   documented as unavailable.
3. Confirm the media object exists in the approved media/photo storage model or
   queue it for approved upload.
4. Choose the media role.
5. Add caption, alt text, display order, and media-specific attribution.
6. Link the media to the story through the approved D1 association model.
7. Submit the media association for editorial review when publication is
   affected.

## Procedure

### 1. Identify the story

Locate the `content_inventory` story row by tag, title, or identifier.

If no story exists yet, create the story draft first using
`docs/how-to/website/add-content-story.md`. Do not create media-only editorial
inventory as a substitute for a story.

### 2. Verify source and credit

For each media item, record:

- media source name;
- source URL or durable reference when available;
- credit line;
- collection or contributor;
- known rights or usage notes when available.

If the media shares the same source and credit as the story, the association may
reference that attribution. If media has distinct attribution, preserve the
media-specific values.

### 3. Confirm approved storage

Media binary files and derivatives belong in the approved media storage path,
not inside the story body.

For D1 references, use the approved media/photo record. The production design
standard identifies `photos` as the D1 table name for photo data, and
memorabilia must remain a tagged/filtered view of `photos` rather than a
standalone memorabilia table.

### 4. Choose media role

Use one of these roles unless the reference model is updated:

- primary image;
- gallery image;
- OCR source;
- newspaper source;
- memorabilia reference;
- supporting image.

### 5. Add presentation metadata

Populate:

- display order;
- caption when useful;
- alt text for public images;
- OCR text or OCR confidence when available and approved;
- media-specific source and credit fields when distinct from the story.

### 6. Link media to the story

Use the approved D1 association model to connect:

- story identifier;
- media/photo identifier;
- media role;
- display order;
- caption or alt text;
- media-specific source and credit data when needed.

Do not duplicate the entire story record to attach media.

### 7. Review publication impact

Manual review is required when media affects:

- public publication status;
- story canonical status;
- homepage or archive eligibility;
- source/credit display;
- factual interpretation of the story;
- member-submitted content decisions.

## Closeout Criteria

The media association is ready when the story remains the editorial authority,
the media source/credit trail is documented, the media role is clear, and public
presentation metadata is complete enough for the target surface.
