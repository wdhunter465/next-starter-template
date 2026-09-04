---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, database implementers, and LGFC maintainers
Authority Level: Controlled
Owns: Migration sequencing and implementation plan for content pipeline storage
Does Not Own: SQL migration files, runtime deployment, or merge approval
Canonical Reference: /docs/reference/content/content-pipeline-storage-model.md
Related issues: #2273, #2278, #2274, #2275, #2277, #2312
Last Reviewed: 2026-09-04
---

# Content Pipeline Storage Implementation Plan

## Purpose

Sequence D1 and media storage implementation for Program #2273 successors without
creating migrations in this program.

## Preconditions

- Task-001 (#2274): no blocking source-of-truth conflict — confirmed
- Task-002 (#2275): canonical model and JSON Schema — complete
- Task-004 (#2277): member submission model — complete

## Implementation phases

### Phase A — Core candidate metadata (first migration issue)

Create tables:

1. `content_items`
2. `tags`, `content_item_tags`
3. `moderation_events`

Deliverables:

- `migrations/00xx_content_pipeline_core.sql`
- import script: seed JSON → D1
- tests: schema constraints, idempotent import

### Phase B — Source and submitter dimensions

Create tables:

1. `sources`
2. `submitters`
3. `member_submissions`

Wire:

- `POST /api/library/submit` → dual write queue + `member_submissions` (future issue)

### Phase C — Publication prep staging

Create:

1. `publication_candidates`

Link to `content_inventory` conversion workflow.

### Phase D — Media linkage hardening

Extend:

- `media_assets` metadata columns if needed (mime, candidate link)
- B2 upload path for member media (separate authorized issue)

### Phase E — Automation tables (deferred)

Create when scheduled discovery authorized:

- `crawl_runs`, `maintenance_runs`

## Migration sequencing rules

- Forward-only migrations in `migrations/`
- No changes to `content_inventory` status enum without compatibility issue
- Reuse `submission_queue` during transition; do not drop until dual-write proven
- Seed import must be idempotent on `candidate_id`

## Existing table touch policy

| Table | Phase A–C |
| --- | --- |
| `content_inventory` | read-only reference; conversion writes only via existing editorial APIs |
| `submission_queue` | no schema change in first migration |
| `photos` | no schema change |
| `media_assets` | optional additive columns in Phase D |

## B2 vs R2 decision

**Implement with B2** per storage model. Revisit R2 only if Bill/ChatGPT authorize
platform consolidation.

## Seed promotion workflow (target)

```bash
# Future authorized script (not implemented in #2273)
node scripts/content-pipeline/import-seed-candidates.mjs \
  --file data/research/lou-gehrig-content-candidates.json \
  --database lgfc_lite
```

Validation: JSON Schema + dry-run mode.

## Recommended child issues (post-program)

| Issue title | Scope |
| --- | --- |
| Content pipeline D1 core migration | Phase A |
| Member submission dual-write | Phase B |
| Publication candidates staging | Phase C |
| Member media B2 upload | Phase D |
| Scheduled discovery runs | Phase E |

## Risk register

| Risk | Mitigation |
| --- | --- |
| Parallel candidate + inventory truth | Candidate upstream; inventory only after conversion |
| JSON drift from D1 | Schema validation; import idempotency |
| Queue/candidate duplication | Link `submission_queue_id`; deprecate dual storage later |

## Storage exception and capacity-threshold rollout (#2312)

A future authorized phase must wire `functions/_lib/content-storage-policy.ts`
(the #2312 decision contract) into real acquisition/write paths rather than
re-deriving free-tier, dedupe, or purge rules at call sites:

| Rollout point | Contract call | Effect |
| --- | --- | --- |
| Before any B2 write | `evaluateStorageCapacity` | Block the write and raise a tracked exception at/above threshold instead of writing past it |
| Before persisting a new candidate | `classifyDedupe` | Route `duplicate` results to the existing candidate instead of creating a second row |
| Publication-prep / periodic audit | `evaluateObjectAvailability` | Flag any `content_items`/`media_assets` row whose B2 key has no live object as an orphan exception |
| Purge/delete request handling | `evaluatePurgeEligibility` | Refuse the request unless legal/rights/privacy holds are all clear and deletion was explicitly approved |
| Backup/restore verification | `evaluateRecoveryOutcome` | Treat an unverified restore the same as a failed one |

This table is planning input for a successor implementation issue; it does
not itself authorize migrations, B2 bucket changes, or Production writes.

## Acceptance

- [x] Metadata vs media separation explicit
- [x] Reuse vs new tables identified
- [x] B2 recommendation explicit
- [x] Seed promotion path defined
- [x] Audit/retention addressed
- [x] Free-tier/cost-risk and storage-exception decision contract addressed (#2312)
