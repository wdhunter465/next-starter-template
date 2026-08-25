---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Column-by-column definitions and provenance for content_items, rights_evidence,
  media_assets, and the proposed rights_translation_rules table (#3551/#3552/#3658
  content-pipeline rights lineage)
Does Not Own: Publication-prep gating logic (content-pipeline-publication-prep.ts);
  legacy photos/media_assets quarantine remediation (#3658 itself)
Canonical Reference: /docs/reference/lgfc-content-schema-reference.md
Last Reviewed: 2026-08-25
---

# Content Pipeline Rights Data Dictionary

Status: **DRAFT — design reference.** Sections marked PROPOSED describe schema
that does not exist in D1 yet. This document is the audit trail for what each
column means, where its value comes from, and why it exists — written so that
if LGFC is ever asked in a copyright-infringement audit "how do you know this
photo was cleared, and where did it come from," the answer is a column lookup
here, not a reconstruction from memory or code archaeology.

## Maintenance requirement

**This document must be reviewed and updated as part of any pull request that
adds, removes, or redefines the use of a column in `content_items`,
`rights_evidence`, `media_assets`, or `rights_translation_rules` (once built).**
A migration PR touching any of these tables is not complete until this file
reflects the change. This is a process requirement, not a suggestion — treat
it the same as updating a test for changed behavior.

**If a table is added to, removed from, or renamed within this photo-library
pipeline**, also
review `scripts/B2_D1_SYNC_README.md` — the daily B2 → D1
deletion-reconciliation job (`scripts/b2_d1_deletion_reconcile.sh`) covers
both the legacy `photos` table and, as of #3718 phase 2b, `content_items`/
`media_assets` (soft-delete via `content_items.deleted_at`, not the `photos`
`is_matchup_eligible` flag). It needs to be extended (or a parallel
reconciliation added) any time the set of B2-backed photo tables changes,
so orphaned/missing-object rows keep getting caught in every table that
needs it. The *additive insert* side of the sync
(`scripts/b2_d1_incremental_sync.sh`) still only writes to `photos` — new
`content_items`/`media_assets` rows are created by the content-pipeline
ingest paths instead.

Every column below is tagged with its provenance:

- **Source-derived** — the value comes from the external platform (Wikimedia
  Commons, Library of Congress, etc.) as found at discovery time. LGFC does
  not edit these after they're written; they are the evidentiary record of
  what the source actually said.
- **LGFC-derived** — LGFC's own determination, decision, or annotation.
  Never presented as if it came from the source.
- **System** — infrastructure bookkeeping (timestamps, IDs, foreign keys) with
  no evidentiary or decision content of its own.

No fact is stored in more than one column. Where a human-readable summary is
useful (e.g. a credit line combining source attribution with an LGFC note),
it is assembled at display/report time from its constituent columns, never
stored as a separate duplicate column. See "Attribution model" below.

## Identifier model

Three distinct identifiers exist across this pipeline. None is derived from
either of the others, and only one is safe to treat as permanent.

| Identifier | Where it lives | Stable? | Purpose |
|---|---|---|---|
| `candidate_id` (e.g. `lgfc-gehrig-2026-513`) | `content_items.candidate_id` | **No** | A discovery-run ordinal, assigned sequentially by the discovery script at search time. Two different search runs can assign the same number to two different files (confirmed: `513` pointed to different photos in the 2026-08-17 approved batch vs. a 2026-08-25 re-run). Its only legitimate use is tracing a row back to the specific search run's raw output artifact for audit purposes — it is never a filename component and never a B2 key component. |
| `content_items.id` | `content_items.id` (D1 autoincrement primary key) | **Yes** | Assigned by D1 the moment the candidate row is written, before any B2 upload happens. Safe to use as the uniqueness anchor for anything written after that point. |
| `media_uid` (`sha256_<hash40>`) | `media_assets.media_uid` | Yes (derived from file bytes) | A content hash computed at ingest time, used only for duplicate-file detection (`SELECT ... WHERE media_uid = ?` before uploading). Not the B2 key; not a human-facing name. |

### Order of operations (confirmed against current code)

1. **Search result** → discovery script assigns a `candidate_id` (ordinal, not stable).
2. **D1** → `content_items` row is INSERTed; D1 assigns the real, stable `id`.
3. **B2** → file is fetched, hashed (`media_uid`), and uploaded under a key built
   from step 2's `id` plus the source's own filename (see B2 key convention below).
4. **D1** → `media_assets` row is INSERTed (`media_uid`, `b2_key`, `size`, ...) and
   `content_items.media_asset_id` is updated to point at it.

### Source-URL dedupe guard on `content_items` (implemented)

A photo rediscovered by a later search gets a fresh, unrelated `candidate_id`
(see above — the ordinal is not stable across runs). Without a guard, that
would create a second `content_items` row for the same real-world photo,
and if both were ever published the same photo would appear on the site
more than once. `content-pipeline-candidate-import.ts`'s
`buildContentItemUpsert` prevents this: the `INSERT INTO content_items`
statement only inserts a new row when no *other* row (different
`candidate_id`) already has the same `source_url`:

```sql
INSERT INTO content_items (...)
SELECT ...
WHERE NOT EXISTS (
  SELECT 1 FROM content_items existing
  WHERE existing.source_url = <this candidate's source_url>
    AND existing.candidate_id != <this candidate's candidate_id>
)
ON CONFLICT(candidate_id) DO UPDATE SET ...;
```

- A genuine re-import of the *same* `candidate_id` is unaffected — the
  `candidate_id != ...` exclusion means it never blocks itself, and the
  existing `ON CONFLICT(candidate_id) DO UPDATE` still applies.
- A candidate with no `source_url` is never deduped (SQL NULL comparison
  semantics make the guard a no-op) — there is nothing to compare against.
- A skipped candidate simply never gets a `content_items` row at all — it
  is not an error. `scripts/content-pipeline/import-seed-candidates.mjs`
  runs a read-only follow-up query after each import and prints which
  candidate_ids from that batch were skipped, so a dedupe is visible
  rather than silent.
- This is scoped to `source_url` exact match only — deliberately narrower
  than a fuzzy/perceptual match. Cross-source duplicates (the same photo
  found on two different platforms, therefore two different URLs) are not
  caught by this guard; that is the separate, larger perceptual-hash
  dedupe work (see the phased plan this document was built alongside).

### B2 key convention (PROPOSED)

```
LGFC_<content_items.id>_<sanitized-source-filename>.<ext>
```

Example: `LGFC_42_GehrigCU.jpg`.

- Uniqueness is guaranteed by `content_items.id` (a real D1 autoincrement), not
  by any locally-computed sequence number — so two files can never collide or
  silently overwrite each other in B2, even if their `candidate_id`s happen to
  match.
- The source filename stays human-legible in a bucket listing, so an auditor
  looking directly at B2 can see what a file's original name was without
  cross-referencing a hash.
- `media_uid` (the SHA-256 hash) continues to exist as a separate column purely
  for duplicate-upload detection — it is not the B2 key and this change does
  not remove that safety check.

## `content_items` (migration 0042, widened 0057/0059)

| Column | Provenance | Definition |
|---|---|---|
| `id` | System | D1 primary key. The stable identifier — see above. |
| `candidate_id` | System | Discovery-run ordinal. Not stable across runs — see Identifier model. |
| `input_stream` | System | Which pipeline path created this row (`scheduled_discovery`, `member_submission`, etc.). |
| `title` | Source-derived | The file's real name/title as given by the source platform, verbatim (e.g. `File:GehrigCU.jpg`). |
| `source_url` | Source-derived | The exact page the item was found at. Also the dedupe key at import time — see "Source-URL dedupe guard" above. |
| `source_name` | Source-derived | Human-readable source name (e.g. "Wikimedia Commons"). |
| `source_owner` | Source-derived | Owning institution/org if the source states one. |
| `source_domain` | Source-derived | Domain the item was found on. |
| `source_type` | System | Fixed category of the source (`archive`, `library`, etc.) — set once when the source itself was allowlisted. |
| `content_type` | System | LGFC's classification of the media type (`photo`, `article`, ...). |
| `summary` | Source-derived (best-effort) | Caption/description text as found. Explicitly not a rights statement. |
| `date_or_period` | Source-derived (best-effort) | Date/period as stated or inferred from source text. |
| `provenance_notes` | LGFC-derived | Free text for anything about acquisition context that doesn't fit another column. |
| `rights_status` | LGFC-derived | LGFC's rights-pipeline state for this item, mapped from `rights_evidence.conclusion`. |
| `curator_decision` | LGFC-derived | LGFC's front-line triage decision (`pending`/`approved`/`disapproved`/`delete`), separate from the deeper rights state machine. |
| `curator_decision_by` / `_at` / `_notes` | LGFC-derived | Who made the triage call, when, and why. |
| `credit_line` | LGFC-derived (assembled) | The attribution string actually used on publication. See Attribution model. |
| `media_asset_id` | System | Link to the `media_assets` row once ingested. |
| `source_metadata` | Source-derived (raw) | Constrained JSON blob (`source_record_id`, `date_accessed`, `source_citation`) — narrow by design; anything richer belongs in `provenance_notes`, not here. |

*(Review/publication/privacy-state columns omitted here — unchanged by this
proposal; see `lgfc-content-schema-reference.md` for the full existing set.)*

## `rights_evidence` (migration 0055, widened 0059)

| Column | Provenance | Definition |
|---|---|---|
| `id` | System | Primary key. |
| `content_item_id` | System | FK to the `content_items` row this evidence is about. |
| `evidence_type` | LGFC-derived | Fixed vocabulary describing what kind of evidence this is (`commons_license`, `loc_statement`, ...). |
| `evidence_url` | Source-derived | Link to the specific page/API response the evidence came from. |
| `evidence_text` | Source-derived (raw) | The source's own rights/license text, preserved as found. **Not** a paraphrase or synthesized sentence — raw field values only (see Maintenance note below). |
| `evidence_metadata` | Source-derived (raw) | Full raw scraped object (license fields, restrictions, usage terms) not already broken into their own columns. |
| `rights_holder` | Source-derived | The asserted creator/rights holder (e.g. "New York Daily News"). Currently defined in schema but unpopulated by the batch-approval writer — to be fixed. |
| `repository_or_collection` | Source-derived | Which platform/collection this came from (e.g. "Wikimedia Commons"). Same current gap as `rights_holder`. |
| `conclusion` | LGFC-derived | LGFC's classification of the evidence into `public_domain_confirmed` / `permission_granted` / `lgfc_member_owned_item_photo`. NULL until a human (or an applied translation rule, see below) sets it — nothing sets this automatically today. |
| `conclusion_rationale` | LGFC-derived | Plain-English explanation of what the conclusion means for LGFC's use of the item. |
| `reviewer` | LGFC-derived | Who is responsible for the conclusion (a person, or the translation-rule reference once PROPOSED table exists). |
| `channel` | LGFC-derived | Which use case this conclusion covers (website, social, newsletter, ...) — a conclusion for one channel never authorizes another. |

**Fix needed (not a schema change):** the current batch-approval writer leaves
`rights_holder` and `repository_or_collection` NULL even though the source
data it already has (the license note's `artist`/source fields) is sufficient
to populate them. `evidence_text` should store the source's raw license
string directly rather than a synthesized sentence built from
`evidence_metadata` — same fact, one place.

## `media_assets` (migration 0010)

| Column | Provenance | Definition |
|---|---|---|
| `id` | System | Primary key. |
| `media_uid` | System (derived) | SHA-256 content hash, used only for duplicate-upload detection. |
| `b2_key` | System | The actual B2 object key — see B2 key convention above. |
| `b2_file_id` | System | B2's own file identifier. |
| `size` | System | Byte size, from B2. |
| `etag` | System | B2's etag. |
| `ingested_at` | System | When this row was written. |

This table deliberately carries no source/rights/filename information of its
own — that all lives on `content_items`/`rights_evidence`, keyed via
`content_items.media_asset_id`. Keeping it minimal avoids the exact
one-fact-two-places problem this document is meant to prevent.

## `rights_translation_rules` (PROPOSED — not yet in D1)

Formalizes the "resolve a hold once, apply to every matching row" workflow.
Today, mapping a source's license text to a permit/deny conclusion is
hardcoded in `content-pipeline-license-conclusion-mapping.ts` and *throws an
error* on anything unrecognized rather than queuing it for review. This table
replaces that hardcoded mapping with admin-editable, audited data.

| Column | Provenance | Definition |
|---|---|---|
| `id` | System | Primary key. |
| `source_platform` | LGFC-derived (keying) | Which source this rule applies to (e.g. `commons.wikimedia.org`). Rules are always scoped per platform — the same wording from two different sources is tracked as two independent rules, since identical phrasing may carry different actual verification weight. |
| `source_text_raw` | Source-derived | The literal text as first seen from the source (e.g. `"CC BY 1.0"`). |
| `source_text_normalized` | System (derived) | `source_text_raw`, lowercased and with spaces/hyphens/underscores collapsed, used as the actual match key. Exact-match only against this normalized form — no fuzzy/similarity matching. `"public_domain"`, `"public domain"`, and `"public-domain"` collapse to the same rule; `"CC BY"` and `"CC BY-NC"` do not. |
| `decision` | LGFC-derived | `permit` / `deny` / `hold` (unresolved — the default for any newly-seen `source_text_normalized`). |
| `decided_by` | LGFC-derived | Who ruled on this text. |
| `decided_at` | LGFC-derived | When. |
| `decision_rationale` | LGFC-derived | Why — what this wording means for LGFC's use. |

**Propagation behavior:** when a `hold` row is updated to `permit`/`deny`,
every `rights_evidence` row whose evidence was recorded against that same
`(source_platform, source_text_normalized)` pair is updated to match, stamped
with the same reviewer/timestamp. This is what lets an admin rule on a piece
of source wording once instead of once per photo.

**Known limitation:** this only helps sources with a small, repeating license
vocabulary (Wikimedia-style). Library of Congress advisory text is close to
unique per item — there's rarely a second row to match against — so LOC items
will likely still need one-at-a-time human review regardless of this table.

## Attribution model

Two columns, never a third merged one:

- **Source attribution (immutable)** — PROPOSED as its own column on
  `rights_evidence` (or reuse `rights_holder` once populated), written once
  from the source's own artist/credit data at discovery/ingest time, never
  edited afterward. This is the legal source-of-record.
- **LGFC supplemental note (freeform)** — `content_items.provenance_notes` or
  a new dedicated column, editable, for gap-filling the source omitted (a
  year, a location, a person identified after the fact).

The displayed/reported credit line (`content_items.credit_line`) is *computed*
from these two at render/report time via one shared function used by both the
public website and any future audit export — never stored as a third
independent value, so the two can never drift apart from what's shown.

## Open items (not blocking, tracked for follow-up)

- `content_items.candidate_id`'s generator computes the next sequence number
  from a local file, not from live Production D1. The B2-key fix above closes
  the dangerous consequence (silent file collision); a real duplicate
  `candidate_id` would now only cause a loud, caught `INSERT` failure. Worth
  hardening later, not urgent.
