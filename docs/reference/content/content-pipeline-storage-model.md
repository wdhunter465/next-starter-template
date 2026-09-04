---
Doc Type: Reference
Audience: Bill, ChatGPT, Cursor, database implementers, and LGFC maintainers
Authority Level: Controlled
Owns: D1/B2 storage boundary design for LGFC content pipeline metadata and media
Does Not Own: Migration files, runtime code, bucket configuration, or merge approval
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related issues: #2273, #2278, #2274, #2275, #2312
Last Reviewed: 2026-09-04
---

# Content Pipeline Storage Model

## Purpose

Design durable storage for the LGFC content pipeline: D1 for metadata and review
state; B2 for media blobs. This reference prepares implementation without
authorizing migrations in Program #2273.

## Design principle

**D1 = index, state, relationships. B2 = binaries.**

Do not store large blobs in D1. Do not treat repo JSON as operational truth.

## Existing surface reuse

| Existing table | Reuse in pipeline | Notes |
| --- | --- | --- |
| `content_inventory` | **Keep** — publication destination | Post-conversion editorial stories |
| `submission_queue` | **Keep** — transition intake | Member submit until `member_submissions` exists |
| `photos` | **Keep** — approved photo catalog | Promotion after rights clearance |
| `media_assets` | **Extend reference** — B2 registry | Link via `media_asset_id` / `b2_key` |
| `content_inventory_media` | **Keep** — story-media joins | Post-conversion associations |
| `library_entries` | **Legacy read fallback** | No new writes |

## Recommended new D1 tables

| Table | Owns |
| --- | --- |
| `sources` | Domain/source trust, blocked sources |
| `submitters` | Member/operator submitter identity |
| `content_items` | Canonical candidate metadata (all streams) |
| `member_submissions` | Member extension fields + queue link |
| `content_item_tags` | Normalized tag mappings |
| `tags` | Tag dictionary |
| `moderation_events` | Append-only audit trail |
| `publication_candidates` | Publication prep staging (target, credit, eligibility) |
| `crawl_runs` | Future scheduled discovery runs |
| `maintenance_runs` | Stale link check, duplicate scan runs |

`content_items` maps 1:1 with candidate registry fields in canonical model.

## Entity relationships

```text
sources 1—* content_items
submitters 1—* member_submissions
content_items 1—1 member_submissions (optional)
content_items *—* tags (via content_item_tags)
content_items 1—* moderation_events
content_items 1—* publication_candidates
content_items 0—1 content_inventory (after conversion)
media_assets 0—* content_items (via media_asset_id)
photos 0—1 media_assets (promotion path)
```

## Media storage recommendation

**Recommendation: B2 (existing LGFC standard)**

| Factor | B2 | R2 |
| --- | --- | --- |
| Current LGFC use | Active `LouGehrigFanClub` bucket | Not deployed |
| D1 integration | `media_assets` + ingest scripts | Would require new integration |
| Member upload future | Extend admin-controlled upload path | Alternative if Cloudflare consolidation required |

R2 remains a documented alternative for a future platform decision issue.
Default implementation path: **B2**.

## Seed JSON promotion path

| Stage | Storage |
| --- | --- |
| Pilot | `data/research/lou-gehrig-content-candidates.json` |
| Import script (future) | Validates against schema → inserts `content_items` |
| Idempotency | Upsert on `candidate_id` |
| Cutover | JSON becomes export/backup only |

## Audit event storage

`moderation_events` columns (recommended):

| Column | Purpose |
| --- | --- |
| `id` | PK |
| `content_item_id` | FK |
| `event_type` | review, rights, privacy, publication, duplicate, promotion |
| `actor` | operator/admin id |
| `from_state` / `to_state` | JSON snapshot |
| `notes` | optional |
| `created_at` | timestamp |

## Retention and purge states

| State | Surface | Action |
| --- | --- | --- |
| Candidate rejected | `content_items.review_status = rejected` | retain metadata; no public use |
| Queue purged | `submission_queue.status = purged` | existing quarterly policy |
| Soft delete | future `deleted_at` on `content_items` | hide from review queues |
| Hard purge | eligibility worker (future) | preserve `moderation_events` summary |

Align with `submission_queue` purge fields from migration 0037.

## Admin review data requirements

Admin tools need read/write on:

- `sources`, `content_items`, `member_submissions`
- `moderation_events` (append)
- `publication_candidates` (staging)
- join views to `submission_queue`, `content_inventory`, `media_assets`

## Public safety

No admin or public API may expose raw candidate rows without review-state filters.
Public routes continue reading `content_inventory` via safe helper only.

## Free-tier, cost-risk, and storage exception policy (#2312)

Free storage is preferred but must never silently create risk to archive
integrity, recoverability, review workflow, or public-site functionality.

```text
Use free storage where it does not compromise data integrity, review
reliability, recovery confidence, automation clarity, or website
functionality.

If free-tier limits create risk, stop and surface a Bill/Atlas decision
before proceeding.
```

Multiple free B2 accounts/buckets under different email addresses may look
available, but that is an operational workaround/exception, never the
default architecture. Any paid capacity or additional-account proposal is a
protected Product/cost decision (Bill), not an automation decision.

A future implementation must fail closed rather than silently overflow: at
or above the free-tier capacity threshold, block further acquisition/writes
and create a tracked storage exception instead of continuing. The
deterministic decision contract for this (capacity thresholds, dedupe,
missing-object detection, retention/purge holds, recovery verification) is
implemented in `functions/_lib/content-storage-policy.ts` and proven by
`tests/content-storage-policy-2312.test.ts` — future runtime work should
call into this contract rather than re-deriving the rules.

## PDF/original retention policy (#2312)

PDF (and other retained media) binaries stay in B2 for as long as LGFC
keeps the item. Extracted/OCR text may be stored in D1 for search, tagging,
review, summarization, and publication preparation, but it never replaces
the original: derived text can lose source context, formatting, page
references, footnotes, image context, signatures, stamps, and authenticity
evidence that only the original object carries. Large extracted text is
chunked rather than stored as a single oversized field.

Rights/copyright controls govern whether full copied third-party text is
retained at all. Where rights are unresolved or limited, prefer source URL,
citation, summary, metadata, and allowed excerpts over full copied text.

## Publication-readiness and quality-review automation boundary (#2312)

Automation may check publish-readiness mechanics: duplicate detection,
required fields, source allowlist/blocklist, B2 object existence, file
hash, credit line, rights/privacy status, publication target, required
tags, PDF/OCR extraction status, link validity, stale-source detection, and
spelling/grammar/style/formatting readiness reports.

Automation, including AI-assisted quality review, tagging, formatting
suggestions, and draft cleanup, **must not** silently perform final human
judgments for rights clearance, privacy clearance, factual/historical truth
approval, or public website use approval. AI output is a suggestion/report
surfaced to a human reviewer, never an approval.

## Retention, purge, and recovery contract (#2312)

Purge eligibility requires **all** of: no legal hold, no rights hold, no
privacy restriction, and an explicit deletion approval. Any one of the
first three blocks purge outright, independent of whether deletion was
otherwise approved — automation cannot infer rights/privacy clearance from
an unrelated approval. A restore that was attempted but not verified is
treated as a recovery failure, the same as a restore that errored outright,
and raises a tracked exception rather than a silent partial success. See
`evaluatePurgeEligibility` / `evaluateRecoveryOutcome` in
`functions/_lib/content-storage-policy.ts` for the exact rules.

## Cross-references

- Implementation plan: `docs/ops/reports/content-pipeline-storage-implementation-plan.md`
- Canonical model: `docs/reference/content/lgfc-content-candidate-model.md`
- Platform B2: `docs/reference/platform/Backblaze_B2.md`
- Storage/free-tier policy contract: `functions/_lib/content-storage-policy.ts` (#2312)
