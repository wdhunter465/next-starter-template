---
Doc Type: Reference
Audience: human project owner and AI agents
Authority Level: supporting
Owns: Content Collection production definition, editorial model, boundaries, success criteria
Does Not Own: implementation code, migrations, ingestion scripts, or operations runbooks
Canonical Reference: docs/reference/content-inventory-design-spec.md
Last Reviewed: 2026-10-10
---

# Content Collection Production Definition

## Purpose

The Content Collection system is the LGFC editorial archive and story inventory model.

## Core model

D1 owns story structure, metadata, search fields, placement rules, editorial state, and rotation logic. B2 owns media storage only.

## Editorial rules

- Every content record needs a tag.
- Every media reference needs attribution.
- One canonical record should exist per tag.
- Alternate perspectives are allowed.
- Automation performs objective triage only.
- Humans make editorial and factual decisions.
- Search collects the URL and provenance for everything it finds. The content evaluation process decides relevance and what is admitted to the B2 and D1 libraries; only content LGFC can host on its own site is admitted, and the site shows no link-only content.
- Every item records the same provenance set, whatever the source or search.
- Content is free use, free use with credit cited, or free use with permission given. LGFC pays for no content; fee-required items are recorded and flagged do-not-use.
- Detail: `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md` and `docs/reference/website/lou-gehrig-source-provenance-model.md`.

## Submission model

Submissions enter a queue for review. Automation may evaluate completeness, spam, duplicates, and technical validity but may not make final editorial decisions.

## Boundaries

The system does not own B2 configuration, UI implementation, admin implementation, or final moderation decisions.

## Success criteria

Story records can be created, reviewed, tagged, searched, rotated, and published while preserving source and credit metadata.