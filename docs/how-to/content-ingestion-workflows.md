---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Content ingestion and editorial workflow procedures
Does Not Own: Runtime architecture or UI implementation
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-05-14
---

# Content Ingestion Workflows

## Overview

This document defines the approved operational workflows for ingesting Lou Gehrig historical content into the LGFC archive.

## Procedure

### Manual Ingestion Workflow

1. Collect source material.
2. Verify source attribution.
3. Upload media to B2.
4. Create or update the canonical `content_inventory` record.
5. Link media relationships.
6. Apply tags.
7. Submit for editorial review.
8. Approve for publication.

### Member Submission Workflow

1. Member submits content.
2. Submission enters submission_queue.
3. Automation performs objective triage.
4. Editorial review evaluates historical relevance.
5. Approved content becomes archive material.
6. Rejected content is retained until quarterly purge.

### OCR Workflow

OCR processing may include:

- newspaper scans
- scorecards
- programs
- letters
- memorabilia text

Rules:

- preserve original scans
- store OCR confidence metadata
- preserve attribution
- do not overwrite source imagery

## Metadata Enrichment

Automation may suggest:

- dates
- names
- Yankees references
- ALS references
- Hall of Fame references
- topic tags

Human review remains authoritative.

## Duplicate Detection

Automation may identify:

- duplicate scans
- duplicate stories
- duplicate OCR extraction
- probable canonical relationships

Duplicate detection is advisory only.

## Editorial Review

Editorial review determines:

- publication approval
- canonical vs alternate status
- archive placement
- homepage eligibility
- attribution completeness

## Media Linking

Media assets are linked through relationship identifiers.

Supported relationships:

- primary image
- gallery image
- OCR source
- memorabilia reference
- newspaper source

## Rejection Handling

Rejected submissions:

- remain quarantined
- are excluded from search
- are excluded from homepage rotation
- remain reviewable until purge cycle

## Quarterly Purge Process

Quarterly purge process:

1. Review rejected queue.
2. Preserve records requiring legal or moderation retention.
3. Delete remaining rejected intake records.
4. Preserve operational audit logging.

## Automation Boundaries

Automation may:

- enrich metadata
- classify stories
- identify duplicates
- suggest tags
- score relevance

Automation must not:

- publish autonomously
- rewrite history
- remove attribution
- delete historical material without governance approval

## Fact Verification

Fact verification priorities:

- newspaper references
- Hall of Fame references
- MLB references
- ALS organization references
- direct historical sourcing

Conflicting historical perspectives may coexist when attributed.

## Attribution Requirements

Required attribution when available:

- publication name
- archive source
- contributor
- photographer
- newspaper title
- collection source
- URL or reference identifier
