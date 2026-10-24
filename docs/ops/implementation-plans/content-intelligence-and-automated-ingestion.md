---
Doc Type: Implementation Plan
Audience: Bill, Claude Code, Cursor, LGFC maintainers, and reviewers
Authority Level: Operational Plan
Owns: The design draft, phasing, controls, draft data model, risks and open decisions for a future Content Intelligence & Automated Ingestion program (approved-source ingestion, OCR and AI enrichment, duplicate detection, source monitoring)
Does Not Own: Authorization to build any part of it, the deferred-work register status, the live archive discovery issues, rights and permission decisions, D1 migrations, workflows, application code, or merge authority
Status: design draft, not authorized
Source Issue: 4834
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related Issues: #4834, #4794, #4787, #4788, #4789, #4790, #4791, #4816, #4368, #4527, #1736, #1738
Last Reviewed: 2026-10-23
---

# Content Intelligence & Automated Ingestion — Design Draft

## Purpose

Define a controlled system for discovering, processing, deduplicating, enriching and preparing Lou Gehrig-related material for review and possible publication or archival use. This document moves Bill's external design notes into the repository. It is a planning document. It does not authorize implementation.

## Status

| Item | State |
| --- | --- |
| This document | Design draft. Nothing here is approved, scheduled or built. |
| Authorization | None. Each phase needs its own source Issue, an allowlist and a Go from Product Authority. |
| Deferral record | `docs/ops/implementation-plans/content-collection/support/deferred-work-register.md` (D-001 live AI tagging, D-002 OCR, D-003 crawler and source monitoring, D-004 automatic publication, D-005 paid storage and API). This document does not change those rows. |
| Related plan | `docs/ops/implementation-plans/lou-gehrig-content-collection-expansion.md` (#1736, #1738). |

## Relationship to work already in flight

The original notes defer all automated ingestion. The repository has since moved on, so read the notes' "future" scope against the live work below.

| Live work | Overlaps with | Divergence from this design |
| --- | --- | --- |
| #4787 hourly Gehrig discovery with a rotating query plan | Section 5 ingestion, Section 8 monitoring | This design starts with manual seed intake and low-volume polling. Hourly rotating discovery is already beyond that. |
| #4788 Library of Congress Chronicling America discovery | Section 5 approved sources | Matches the "public archive" source type. Confirm each source is in the registry with robots, terms and rights notes recorded. |
| #4789 Internet Archive discovery for books, magazines, newsreels, photographs | Section 5 | Same as above. |
| #4790 assess further collection sources | Section 5.2 candidate source types | Natural home for the source shortlist and the pilot choice (Section 20). |
| #4794 archive vertical slice, 10 pre-1931 public-domain items; #4816 best-quality copy, exclude watermarked sources | Sections 5, 13 | Narrow, public-domain, human-reviewed. Compatible with the pilot. |
| #4791 move confirmed pre-1931 public-domain candidates into the archive automatically | Sections 3.1, 4.1 human review before publication | Automatic movement of confirmed candidates needs reconciling with "all items enter the review queue". Decide where the confirmation happens. |
| #4707 duplicate-photo sweep, #4708 duplicate-photo removal tool | Section 7 duplicate detection | Photo-only and deterministic today. Section 7 covers text, near-duplicate and semantic cases. |
| #4592 URL normalization for dedupe and do-not-use check, #4593 permission conditions, #4526 permission correspondence archive, #4527 gap register | Sections 7.3, 13 | These deliver parts of URL canonicalization and rights handling. Reuse them, do not rebuild. |
| #4368 copyright permission requests project | Section 13 | Owns the rights workflow this design depends on. |

Before any phase here starts, a source Issue should reconcile this table with the live design: which parts of Phases 1 and 2 already exist, and which controls in Section 14 (budget caps, kill switch, default-disabled sources) the live discovery work already enforces.

## 1. Executive Summary

The capabilities below are large, infrastructure-heavy enhancements and are treated as a separate program of work:

- Large-scale automated web ingestion
- Advanced OCR and enrichment
- AI duplicate detection
- External source monitoring at scale

They support long-term acquisition, metadata enrichment, deduplication and source monitoring. They add complexity in crawling policy, storage volume, copyright handling, provenance, AI cost, moderation, queue management and operational monitoring.

### 1.1 Program boundary decision

Treat large-scale automated ingestion, OCR and enrichment, AI deduplication and external source monitoring as a later enhancement program, separate from the core website, FanClub pages, admin workflows, CMS-backed sections and production route, header and footer behavior. (The original notes call the core program "Program 2". The repository's current program names were not checked when this document was written; read it as the core website program.)

Rationale: the capabilities involve automated interaction with third-party sources, large volumes, long-running background processing, AI inference cost, queue orchestration, duplicate logic, OCR pipelines, source trust scoring, provenance and attribution, possible copyright and terms-of-service restrictions, and administrative review workflows.

### 1.2 Core-program exclusions

| Capability | Core program | This program |
| --- | --- | --- |
| Automated web crawling | Excluded | Included |
| Scheduled source monitoring | Excluded | Included |
| OCR of external documents and images | Excluded | Included |
| AI-generated metadata enrichment | Excluded | Included |
| AI duplicate detection | Excluded | Included |
| Source trust scoring | Excluded | Included |
| Automated import queues | Excluded | Included |
| Human review queue for ingested content | Excluded unless minimal admin review already exists | Included |
| Bulk ingestion dashboards | Excluded | Included |
| Cost telemetry for AI and content processing | Excluded except general platform constraints | Included |

## 2. Objectives

1. Discover relevant external content from approved sources.
2. Ingest source metadata and content snapshots where legally and technically permitted.
3. Run OCR on images and PDFs when text is not already machine-readable.
4. Enrich content with structured metadata: people, dates, teams, locations, source type, topic tags and confidence scores.
5. Detect duplicates and near-duplicates before creating new LGFC records.
6. Route candidate content to human review before publication.
7. Maintain provenance for every imported or referenced item.
8. Control cost and execution volume before scale increases.

### 2.1 Non-objectives

The program must not:

- publish external content automatically without human review;
- ignore robots.txt, website terms, copyright status or source restrictions;
- store donor or member PII as part of ingestion;
- run unbounded AI calls without budget controls;
- replace editorial judgment;
- rewrite the public site architecture unless separately approved;
- become a general internet crawler unrelated to Lou Gehrig and Fan Club purposes.

## 3. Guiding principles

### 3.1 Human review before publication

All externally discovered or AI-enriched material enters an admin review queue before publication or long-term archival classification.

### 3.2 Provenance is mandatory

Every candidate retains: source URL, source name, retrieval timestamp, license and copyright notes when known, access method, content hash, extracted-text hash, processing history and reviewer decisions.

### 3.3 Cost controls are mandatory

Hard limits are in place before any AI enrichment, OCR, image analysis or source monitoring runs at scale: daily job limits, per-source crawl limits, AI token and cost ceilings, OCR page and image limits, queue depth limits, admin-visible processing counts and failure quarantine.

### 3.4 Minimal initial automation

Start with a small allowlist of approved sources and low-volume polling. Do not begin with broad web crawling.

### 3.5 Preserve production stability

Ingestion and enrichment run behind admin controls, queue boundaries and feature flags, so they cannot destabilize the public site.

## 4. Architecture

### 4.1 Pipeline

```text
Approved Source Registry
        |
        v
Source Monitor / Fetch Scheduler
        |
        v
Raw Candidate Store
        |
        v
Extraction Pipeline
  - HTML extraction
  - PDF text extraction
  - OCR fallback
  - Image metadata extraction
        |
        v
Normalization + Metadata Enrichment
        |
        v
Duplicate Detection
        |
        v
Human Review Queue
        |
        v
Approved LGFC Content Records
        |
        v
Public Site / FanClub / Admin CMS
```

### 4.2 Layers

| Layer | Responsibility |
| --- | --- |
| Source Registry | Approved sources, source type, polling cadence, legal notes, trust classification. |
| Fetch Scheduler | Controlled checks against approved sources only. |
| Raw Store | Fetched metadata, source references, hashes and permitted content snapshots. |
| Extraction Pipeline | Converts fetched material into normalized text and media metadata. |
| OCR Pipeline | Text from scanned PDFs and images when needed. |
| Enrichment Pipeline | Tags, entities, dates, summaries, source classifications and confidence scores. |
| Deduplication Engine | Exact duplicates, near-duplicates and probable repeats. |
| Review Queue | Admin interface for approve, reject, merge and defer decisions. |
| Publication Bridge | Creates or links approved content into existing CMS structures. |
| Audit Trail | All processing decisions, versions and reviewer activity. |

## 5. Feature area 1 — Automated web ingestion

### 5.1 Purpose

Collect metadata about Lou Gehrig-related content from approved external sources.

### 5.2 Candidate source types

Baseball history websites; museum and public archive pages; newspaper archive references; library catalog records; auction listings and memorabilia references; public-domain media collections; university archive finding aids; baseball statistics and history resources; official MLB and Yankees historical pages; public APIs where available.

### 5.3 Source registry fields

| Field | Description |
| --- | --- |
| source_id | Stable internal identifier. |
| display_name | Human-readable name. |
| base_url | Root URL or API base. |
| source_type | Website, API, archive, catalog, auction, RSS, manual seed. |
| allowed_paths | Approved paths and patterns. |
| blocked_paths | Explicit exclusions. |
| polling_cadence | Manual, daily, weekly, monthly, one-time. |
| robots_policy_checked | Boolean. |
| tos_notes | Terms-of-service restrictions. |
| copyright_notes | Known restrictions or public-domain status. |
| trust_level | High, medium, low, unknown. |
| enabled | Feature flag. |
| max_items_per_run | Safety limit. |
| max_bytes_per_run | Safety limit. |
| requires_manual_seed | Boolean. |

### 5.4 Ingestion rules

1. Process approved sources only.
2. Respect source-specific rate limits.
3. Store source metadata even when full content cannot be stored.
4. Capture content hashes for deduplication.
5. Quarantine sources that fail repeatedly.
6. Log every fetch attempt.
7. Never publish automatically.

### 5.5 Initial strategy: manual seed intake

1. Admin enters a source URL.
2. The system fetches metadata and a limited preview.
3. The system extracts available text.
4. The system computes hashes.
5. The system checks duplicates.
6. The system sends the item to the review queue.
7. Admin approves, rejects, merges or defers.

## 6. Feature area 2 — OCR and enrichment

### 6.1 Purpose

Extract text and useful metadata from images, scanned PDFs, archive scans, newspaper clippings, memorabilia photos and other non-machine-readable sources.

### 6.2 Input types

Scanned newspaper clippings; archive PDFs; baseball cards; programs; scorecards; letters; photographs with captions; auction listing images; museum collection scans.

### 6.3 OCR requirements

1. Accept only approved candidate items.
2. Store original asset metadata.
3. Produce extracted text with confidence scores.
4. Preserve page and image boundaries.
5. Store OCR engine and version.
6. Allow manual correction by admin reviewers.
7. Re-run when the engine or settings change.
8. Never overwrite original source material.

### 6.4 Enrichment targets

Title suggestion; short and long summary; people, teams, dates and locations mentioned; artifact type; topic tags; era; source type; rights and copyright warning; relevance score; confidence score; suggested publication destination; suggested merge target when a duplicate is suspected.

### 6.5 Guardrails

AI-generated enrichment is advisory.

- Admin-visible confidence score.
- Clear AI-generated label.
- Human approval before publication.
- No unsourced factual assertions in public content.
- No automatic rewriting of copyrighted source text for publication.
- No private or personally sensitive enrichment without a clear project purpose.

This is consistent with `docs/reference/ai/lou-gehrig-research-ai-guardrails.md` and `docs/reference/operations/ai-assisted-tagging-operating-contract.md`, which control if they differ.

## 7. Feature area 3 — Duplicate detection

### 7.1 Purpose

Reduce repeated entries by detecting exact duplicates, near-duplicates and semantically similar records before publication.

### 7.2 Duplicate classes

| Class | Description | Example |
| --- | --- | --- |
| Exact URL duplicate | Same URL already ingested. | Repeated source link. |
| Exact content duplicate | Same normalized text hash. | Syndicated article copy. |
| Asset duplicate | Same image or file hash. | Same scan uploaded twice. |
| Near-text duplicate | Similar text with minor edits. | Reposted article excerpt. |
| Semantic duplicate | Different wording, same underlying item or event. | Multiple archive records for one photo. |
| Entity/date duplicate | Same person, date and event tuple. | Several records for one speech. |

### 7.3 Methods (layered)

1. Deterministic: URL canonicalization, file hash, normalized text hash, source ID plus external item ID.
2. Near-duplicate: shingling, SimHash or MinHash, token overlap, title/date/entity matching.
3. Semantic: embedding similarity, entity-date-event clustering, AI-assisted review explanation.

### 7.4 Outcomes

| Outcome | Meaning |
| --- | --- |
| New candidate | No meaningful duplicate found. |
| Exact duplicate | An existing record already covers the item. |
| Probable duplicate | High similarity; needs human confirmation. |
| Possible duplicate | Medium similarity; show related candidates. |
| Related but distinct | Similar topic, likely a different item. |
| Merge recommended | Candidate should enrich an existing record. |

### 7.5 Review UI

Show the candidate, matched existing items, similarity score and reason, matching fields and a side-by-side comparison, with merge, reject, approve-as-new and defer actions.

## 8. Feature area 4 — Source monitoring at scale

### 8.1 Purpose

Monitor approved sources for new Lou Gehrig-related content without repeated manual searches.

### 8.2 Monitoring types

RSS and feed monitoring; sitemap monitoring; API polling; search query monitoring where permitted; archive collection update monitoring; auction and listing monitoring; manual source recheck.

### 8.3 Default cadences

| Source type | Default cadence |
| --- | --- |
| Static archive collection | Monthly |
| Library catalog | Monthly |
| Museum collection | Monthly |
| Auction listing source | Daily or weekly during active campaign windows |
| News or history site | Weekly |
| Official source | Weekly or monthly |
| Manual seed source | Manual only |

### 8.4 Scale controls

Per-source run limits; global daily run limits; retry backoff; dead-letter queue; admin pause and resume; failure-rate alerts; source disable switch; cost dashboard; queue depth dashboard.

## 9. Draft data model

Exact table names may change during engineering design. This is a draft only. It is not a migration and must not be applied without a source Issue.

### 9.1 `content_sources`

```sql
CREATE TABLE content_sources (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  trust_level TEXT NOT NULL DEFAULT 'unknown',
  polling_cadence TEXT NOT NULL DEFAULT 'manual',
  robots_policy_checked INTEGER NOT NULL DEFAULT 0,
  tos_notes TEXT,
  copyright_notes TEXT,
  allowed_paths_json TEXT,
  blocked_paths_json TEXT,
  max_items_per_run INTEGER NOT NULL DEFAULT 25,
  max_bytes_per_run INTEGER NOT NULL DEFAULT 5000000,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 9.2 `ingestion_runs`

```sql
CREATE TABLE ingestion_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_created INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  cost_estimate_cents INTEGER NOT NULL DEFAULT 0,
  log_summary TEXT,
  FOREIGN KEY (source_id) REFERENCES content_sources(id)
);
```

### 9.3 `content_candidates`

```sql
CREATE TABLE content_candidates (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  ingestion_run_id TEXT,
  source_url TEXT NOT NULL,
  canonical_url TEXT,
  external_item_id TEXT,
  title TEXT,
  source_published_at TEXT,
  retrieved_at TEXT NOT NULL,
  candidate_status TEXT NOT NULL DEFAULT 'pending_review',
  raw_content_hash TEXT,
  normalized_text_hash TEXT,
  asset_hash TEXT,
  extracted_text TEXT,
  extracted_text_confidence REAL,
  metadata_json TEXT,
  enrichment_json TEXT,
  rights_notes TEXT,
  reviewer_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES content_sources(id),
  FOREIGN KEY (ingestion_run_id) REFERENCES ingestion_runs(id)
);
```

### 9.4 `duplicate_matches`

```sql
CREATE TABLE duplicate_matches (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  matched_record_type TEXT NOT NULL,
  matched_record_id TEXT NOT NULL,
  match_class TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  match_reason TEXT NOT NULL,
  match_details_json TEXT,
  reviewer_decision TEXT,
  reviewer_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES content_candidates(id)
);
```

### 9.5 `ocr_jobs`

```sql
CREATE TABLE ocr_jobs (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  asset_ref TEXT NOT NULL,
  job_status TEXT NOT NULL,
  ocr_engine TEXT NOT NULL,
  ocr_engine_version TEXT,
  started_at TEXT,
  finished_at TEXT,
  extracted_text TEXT,
  confidence_score REAL,
  page_count INTEGER,
  error_message TEXT,
  cost_estimate_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES content_candidates(id)
);
```

### 9.6 `review_decisions`

```sql
CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  reviewer_id TEXT,
  decision TEXT NOT NULL,
  target_record_type TEXT,
  target_record_id TEXT,
  notes TEXT,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES content_candidates(id)
);
```

Reconcile with `docs/reference/content/lgfc-content-candidate-model.md` and `docs/reference/content/content-pipeline-storage-model.md`, which already define a candidate registry and storage model. Prefer extending those over adding parallel tables.

## 10. Admin UI

### 10.1 Pages

| Route | Purpose |
| --- | --- |
| `/admin/content-sources` | Manage the approved source registry. |
| `/admin/ingestion-runs` | View ingestion execution history. |
| `/admin/content-candidates` | Review discovered items. |
| `/admin/duplicate-review` | Resolve duplicate and merge decisions. |
| `/admin/ocr-jobs` | Review OCR status and extracted text. |
| `/admin/content-intelligence-settings` | Configure limits, feature flags and processing settings. |

### 10.2 Review queue actions

Approve as new content record; reject; mark as duplicate; merge into an existing record; request manual follow-up; re-run extraction, OCR or enrichment; edit extracted metadata; add a rights or copyright note; disable the source.

### 10.3 Safety indicators

AI-generated field labels; confidence scores; rights warnings; source trust level; duplicate warnings; processing cost estimate; last successful source check; repeated failure count.

## 11. Backend functions

The site uses static export constraints, so browser and static pages are separate from backend execution. Backend execution may need Cloudflare Pages Functions, Workers, queues or another explicitly approved layer. Names are indicative.

| Function | Purpose |
| --- | --- |
| `listContentSources`, `createContentSource`, `updateContentSource`, `disableContentSource` | Manage the source registry. |
| `runManualIngestion` | Ingest one source or URL manually. |
| `listIngestionRuns` | Run history. |
| `listContentCandidates`, `getContentCandidate` | Review queue and detail. |
| `runDuplicateDetection` | Evaluate a candidate against existing records. |
| `runOcrJob`, `runEnrichmentJob` | OCR and enrichment. |
| `submitReviewDecision` | Approve, reject, merge or defer. |
| `publishApprovedCandidate` | Create a production CMS or public record after approval. |

### 11.1 Authentication

All ingestion, enrichment, OCR and review operations are admin-gated: no public write endpoints, no unauthenticated ingestion triggers, the existing admin access model respected unless superseded by an approved auth redesign, and every mutation auditable.

## 12. Storage

| Type | Examples |
| --- | --- |
| Database metadata | Source records, candidates, decisions, hashes, status. |
| Object storage | Images, PDFs, OCR artifacts, permitted source snapshots. |
| Derived text | Extracted text, normalized text, OCR output. |
| AI outputs | Summaries, tags, entities, duplicate explanations. |
| Logs | Ingestion runs, errors, cost estimates. |

Rules: do not duplicate large assets unnecessarily; prefer source references when full storage is not permitted; store hashes for dedupe even when content storage is limited; keep AI output separate from source text; keep reviewer-edited content distinct from raw AI suggestions. Existing D1 and B2 patterns apply if still approved at implementation time.

## 13. Legal, rights and compliance

Required review areas: robots.txt; website terms of service; copyright status; fair use; public-domain verification; attribution; API usage limits; archive and library reuse rules; auction listing content restrictions; newspaper archive licensing.

Discovered content is not republished automatically. The system supports linking to the source, storing metadata only, short admin notes, public-domain material where confirmed, original LGFC-authored commentary, and flagging rights uncertainty for human review. The rights workflow is owned by #4368 and its children.

## 14. Cost control

Cost drivers: AI text enrichment, embeddings, OCR, image analysis, external API calls, object storage, queue execution, scheduled worker execution and logging volume.

| Control | Requirement |
| --- | --- |
| Daily AI budget | Hard cap. |
| Per-source run cap | Hard cap. |
| Per-job OCR page cap | Hard cap. |
| Embedding generation limit | Hard cap. |
| Manual approval for high-volume source | Required. |
| Admin cost dashboard | Required before scale. |
| Kill switch | Required. |
| Default disabled state | Required for new sources. |

All expensive processing is disabled by default and runs only after explicit admin action or approved scheduled settings. Non-free-tier dependencies remain deferred item D-005 and need Product Authority approval.

## 15. Security

Threats: malicious source content; prompt injection in ingested text; unsafe HTML extraction; stored XSS through imported metadata; unbounded crawl loops; SSRF-like fetch abuse; admin endpoint misuse; excessive AI or API cost; poisoned duplicate or enrichment results.

Mitigations: strict source allowlist; URL validation and canonicalization; block private and internal network fetches; strip HTML before display; escape all extracted content in the admin UI; treat ingested text as untrusted input; never let ingested text directly control AI or system prompts; rate and queue limits; admin-only mutation endpoints; audit logs.

## 16. Phasing

| Phase | Deliverables | Exit criteria |
| --- | --- | --- |
| 0 Research and governance | Approved source policy; rights and copyright policy; cost policy; AI usage policy; source registry schema; admin review workflow design; backend execution architecture decision. | Written approval of scope, risks and cost controls. Nothing is built before cost and legal guardrails exist. |
| 1 Manual candidate intake | Admin manual URL intake; source registry MVP; candidate creation; basic metadata extraction; hashing; review queue MVP. | Admin submits a URL, a candidate is created and can be approved, rejected or deferred. No scheduled crawling. |
| 2 Deterministic duplicate detection | URL canonicalization; text hash and asset hash detection; comparison with existing CMS records; duplicate review UI. | Exact duplicates are detected before approval. Admin can merge, reject or approve as distinct. |
| 3 OCR MVP | OCR job table; manual OCR trigger; OCR output review; confidence score; manual correction. | Admin runs OCR on approved candidate assets. Output is reviewable and never published automatically. |
| 4 AI metadata enrichment MVP | Enrichment job; tag, entity and date extraction; summary suggestions; confidence display; cost tracking. | Output is advisory. Admin can edit, accept or reject. Cost limits are enforced. |
| 5 Near-duplicate and semantic detection | Near-duplicate algorithm; embedding similarity if approved; similarity explanations; candidate clustering. | Probable duplicates are surfaced with useful explanations. A human stays the final authority. |
| 6 Scheduled monitoring | Scheduled fetch jobs; per-source cadence; backoff and retry; dead-letter queue; monitoring dashboard; source disable switch. | Approved sources are monitored at low volume, failures are contained, and cost and volume limits are visible. |
| 7 Scale hardening | Observability dashboard; queue depth controls; source health scoring; bulk review tools; reprocessing workflows; export and reporting. | The system runs safely across many approved sources. Admins can diagnose failures and control volume. |

## 17. Acceptance criteria

### 17.1 Program level

The program is acceptable only when:

1. All ingestion is restricted to approved sources.
2. New sources are disabled by default.
3. All publication decisions require human review.
4. Every candidate has provenance metadata.
5. Duplicate detection runs before publication.
6. OCR and AI output are labeled as generated or extracted.
7. Cost limits are enforced technically, not only documented.
8. Admin can pause all processing.
9. Admin can disable any source.
10. Rights and copyright uncertainty is visible before approval.

### 17.2 Non-acceptance conditions

The program is not accepted if it:

- crawls arbitrary websites;
- publishes AI-enriched material automatically;
- lacks cost caps;
- stores external copyrighted content without review;
- lacks source provenance;
- permits unauthenticated ingestion triggers;
- can run unbounded background jobs;
- mixes raw source text, AI output and human-edited final content without distinction.

## 18. Issue breakdown

To be converted into GitHub Issues only on Product Authority's Go. One Issue per item, one PR per Issue.

| Epic | Items |
| --- | --- |
| 1 Program governance | Ingestion source policy; rights and copyright review policy; AI and OCR cost control policy; admin review decision taxonomy; backend execution architecture decision. |
| 2 Source registry | `content_sources` schema; registry admin page; enable and disable controls; path, cadence and limit fields; audit history. |
| 3 Manual candidate intake | Manual URL form; candidate from URL; metadata preview; source, canonical URL and hash data; candidate detail page. |
| 4 Review queue | Candidate list; detail and review screen; approve, reject, defer and merge actions; reviewer notes; audit log. |
| 5 Duplicate detection | URL canonicalization; normalized text hash; asset hash comparison; duplicate match table; duplicate review UI. |
| 6 OCR MVP | OCR job schema; manual trigger; output and confidence storage; review and edit screen; cost and limit controls. |
| 7 AI enrichment MVP | Output schema; manual trigger; entity, date, tag and summary extraction; confidence and generated labels; accept, edit and reject controls; cost tracking. |
| 8 Source monitoring | Scheduled polling; run history; retry and backoff; dead-letter handling; global pause. |
| 9 Observability and scale | Processing dashboard; queue depth metrics; cost dashboard; source health status; failure quarantine. |

## 19. Open architecture decisions

Answer before implementation:

1. What backend execution layer runs scheduled ingestion and OCR and enrichment jobs?
2. What hard daily budget applies to AI and OCR processing?
3. Which external sources are approved for the first pilot?
4. What content can be stored versus referenced only?
5. What admin role model controls review and publication?
6. What object storage location holds permitted assets and derived artifacts?
7. Which OCR provider or local engine is approved?
8. Which AI provider and model class is approved for enrichment and embeddings?
9. How will duplicate detection compare against existing CMS records?
10. How do candidates become public content after approval?

Added when reconciling with live work:

11. Where does confirmation of a public-domain candidate happen before #4791 moves it into the archive automatically, and does that count as the human review step?
12. Which Section 14 controls already exist in the live discovery workflows (#4787 to #4789)?

## 20. Pilot scope

The safest pilot is narrow.

- **Include:** 3 to 5 approved sources; manual URL intake only; no scheduled crawling; basic metadata extraction; exact duplicate detection; admin review queue; manual approval before record creation.
- **Exclude:** broad web crawling; semantic AI duplicate detection; scheduled monitoring; automated publication; bulk OCR; bulk AI enrichment; large object storage migration.
- **Success:** admin processes 25 to 50 manually seeded candidates; duplicate detection prevents repeated records; the review flow is understandable; provenance is complete; no source, cost or legal risk blocks expansion.

The live pre-1931 public-domain vertical slice (#4794, 10 items) is a candidate to serve as, or feed, this pilot.

## 21. Relationship to existing architecture

Integration points: admin pages under `/admin/**`; existing CMS and data tables where approved records are published; the existing media asset model; existing D1 and B2 patterns if still approved; the existing access model unless superseded; static export constraints, with backend work in a compatible execution layer.

This document does not alter: homepage canonical section order; the public route model; the FanClub route model; header and footer behavior; Join and Login architecture; core-program implementation priorities.

## 22. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Copyright misuse | High | Metadata-first storage, rights notes, human review. |
| Terms-of-service violation | High | Approved source registry and pre-checks. |
| AI or OCR cost overrun | High | Hard caps, admin dashboard, kill switch. |
| Website instability | High | Isolate ingestion from public rendering. |
| Accidental broad crawling | High | Allowlist only, per-source caps, sources disabled by default. |
| Prompt injection through source text | Medium/High | Treat source text as untrusted; sanitize AI prompts. |
| Duplicate false positives | Medium | Human review and explanation display. |
| Duplicate false negatives | Medium | Layered deterministic and semantic detection. |
| Poor OCR quality | Medium | Confidence scores and manual correction. |
| Reviewer workload overload | Medium | Pilot small, add queue filters, batch tools later. |
| Data bloat | Medium | Store references where full storage is unnecessary or restricted. |
| Live discovery outpacing the controls in this design | High | Reconcile per the table near the top of this document before expanding live discovery. |

## 23. Recommendation

Keep content intelligence and automated ingestion a separate program from the core website. Start with governance and manual candidate intake, then duplicate detection, OCR, enrichment and finally scheduled monitoring. Enable broad automation only after provenance, legal review, cost controls, admin review and kill switches are implemented. Because discovery work (#4787 to #4790, #4794) is already live, the first action is the reconciliation described near the top of this document, not new build work.
