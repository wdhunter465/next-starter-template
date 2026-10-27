---
Doc Type: How-To
Audience: Operator + AI
Authority Level: Procedure
Owns: Manual Lou Gehrig content intake and staging workflow
Does Not Own: Automated scraping, OCR, enrichment, monitoring, or publication
Canonical Reference: /docs/reference/website/lou-gehrig-content-metadata-schema.md
Related issues: #1738, #1743, #1742
Last Reviewed: 2026-07-04
---

# Lou Gehrig Content Intake Procedure

## Purpose

This procedure captures Lou Gehrig content leads safely before any automation
or publication occurs.

## Intake rule

Capture leads and metadata. Do not copy wholesale copyrighted works into the
repository. Do not publish intake material directly to public routes.

## Steps

1. Discover source lead through an approved intake channel.
2. Create candidate record with `candidate_id`.
3. Capture source title, URL/citation, owner, access date, and acquisition method.
4. Classify content type and source category.
5. Assign rights status and privacy flag.
6. Assign provenance and factual confidence.
7. Assign review status (`candidate` default).
8. Route to research queue for triage.
9. Complete provenance and rights review.
10. Decide one of: reject; defer; approve for reference; approve for public-copy drafting.
11. Retain evidence for #2040 automation review.

## Manual workflow stages

1. **Source discovered** — lead identified through approved channel.
2. **Source captured as lead** — metadata recorded; no wholesale copy.
3. **Metadata created** — populate schema fields per metadata reference.
4. **Rights/factual review completed** — provenance how-to completed.
5. **Editorial candidate created** — approved-for-public-copy or reference tier.
6. **Staging decision recorded** — club staging or editorial draft state.
7. **Publication candidate or rejection recorded** — final disposition.
8. **Evidence retained** — for #2040 automation review.

## Staging and editorial handoff

When `review_status` is `approved-for-public-copy`:

1. Draft website-safe text or media reference (operator words or licensed excerpt).
2. Map content type to website surface (biography, timeline, gallery, library, article).
3. Record staging preview intent for `/admin/clubstaging` (sample rotation only until authorized).
4. Require human editor approval before any `content_inventory` publication.
5. Hand off placement fields per unified content workflow.

Staged content states:

| Stage | Description |
| --- | --- |
| `draft-editorial` | Operator draft from approved candidate |
| `staging-preview` | Reviewed in club staging sample context only |
| `publication-ready` | Approved for inventory publication path |
| `published` | In `content_inventory` (outside #1738 scope) |

## Candidate intake table

| candidate_id | title | content_type | source_title | source_url/citation | rights_status | review_status | reviewer | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | candidate |  |  |

## Disallowed intake

- scraped social media content;
- paywalled full-text copies;
- images without source/credit state;
- AI-generated claims without primary/secondary source support;
- content involving private individuals without privacy review;
- content that cannot be traced to a source.

## Minimum evidence before #2040

Before automation begins, the manual workflow must produce enough records to show:

- common source categories;
- common rejection reasons;
- required metadata fields;
- safe review states;
- operator pain points;
- what should remain human-controlled.

## Content rotation candidate criteria

Items may be flagged as club-home rotation candidates when:

- `review_status` is `approved-for-public-copy`;
- rights and privacy review complete;
- headline and credit line fit club-home layout constraints;
- editorial reviewer approves rotation eligibility separately from publication.

Rotation preview uses staging samples only; no live route publication from #1738.

## Handoff fields for club staging and #2040

| Field | Purpose |
| --- | --- |
| `title`, headline draft | Staging preview display |
| `credit_line`, `source_owner` | Attribution preview |
| `editorial_use_candidate` | Surface eligibility |
| `review_status`, `reviewer` | Approval audit |
| queue and staging notes | Automation boundary evidence |
