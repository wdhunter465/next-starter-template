---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical
Owns: Content inventory data model boundaries and layout control rules
Does Not Own: Operational worklists; implementation code; content moderation procedures
Canonical Reference: /docs/reference/content-inventory-design-spec.md
Last Reviewed: 2026-04-28
---
# Content Inventory Design

D1 = story system (text, metadata, structure)
B2 = media storage only

## Core fields
- tag, title, text, media
- story_type, allowed_sections, priority
- search_text, canonical
- source_name, source_url, credit_line
- event_date, rotation_group, feature_weight, last_featured

## Rules
- story-first model (no media-first ingestion)
- one canonical record per tag
- alternate perspectives allowed (canonical=false)
- no media without attribution
- no content without tag

## Layout control
- story_type = size
- allowed_sections = placement
- priority = order

## Rotation
- event_date drives seasonal relevance
- last_featured prevents repetition
- feature_weight controls prominence

## Submission model
- submissions go to queue
- automation = triage only
- manual review = all decisions
- rejected items purged quarterly
