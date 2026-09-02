---
Doc Type: AS-BUILT
Audience: Human + AI
Authority Level: Operational Implementation Record
Owns: What the allowlisted Gehrig content-collection/discovery and rights-evidence pipeline actually does today, as merged to `main` — sources, safety rule, schema, admin API surface, and known operational gaps
Does Not Own: Product/legal decisions about the allowlist or rights policy (owned by #3551); column-by-column schema definitions (owned by /docs/reference/content-pipeline-rights-data-dictionary.md); curator-UI implementation (not yet built — see #3827)
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related Issues: #3551, #3552, #3657, #3658, #3748, #3826, #3827, #2073
Last Reviewed: 2026-09-02
---

# Gehrig content-collection / rights-evidence pipeline — as-built

## Purpose

This records what the #3551-designed allowlisted content-collection and rights-evidence pipeline actually is in the code on `main` today — not the design intent (that's #3551 itself) and not the column-level schema reference (that's the data dictionary). It exists so a Day-2 operator or auditor can answer "how does this actually run, and what's still unfinished" without reconstructing it from a dozen issue threads.

## Scope

Covers: the six-source allowlist and which sources have working discovery code; the core safety rule and where it's enforced; the D1 schema surface (`sources`, `content_search_runs`, `content_items`, `rights_evidence`, `media_assets`); the admin API surface operators call; and the known operational gaps as of this writing.

Does not cover: Product/legal authorization for the broader Phase 2 acquisition program (#2073 — active, no hold, per its 2026-09-02 current-authority update; out of scope for *this* pipeline's own allowlist regardless — see #2073's own work-package items 2+ and `/docs/reference/content/content-rights-runtime-as-built-2073.md`).

## Current known truth

### The six-source allowlist

Seeded into the `sources` table by migration `0055_rights_evidence_and_search_runs.sql`. Every discovery/rights-evidence write path validates `source_domain` against this table (`SELECT id FROM sources WHERE source_domain = ?`) and rejects anything else with an HTTP 400 — see `functions/api/admin/content-pipeline/search-runs/index.ts` and `functions/api/admin/content-pipeline/rights-evidence/index.ts`. `ingest.ts` further restricts B2 writes to rows with `source_trust_status = 'trusted'`.

| Source | Domain | Discovery adapter | Notes |
| --- | --- | --- | --- |
| Openverse | `openverse.org` | `scripts/content-pipeline/collect-gehrig-external-sources.mjs` (`collectOpenverse`) | Runs by default |
| Library of Congress | `loc.gov` | same file (`collectLibraryOfCongress`) | Runs by default |
| Wikimedia Commons | `commons.wikimedia.org` | same file (`collectWikimediaCommons`) | Runs by default |
| DPLA | `dp.la` | `functions/_lib/content-pipeline-dpla-adapter.ts` + `collectDpla` in the same script | **Added by #3826.** Opt-in only (`--sources dpla`), requires `DPLA_API_KEY` env var, fails fast (not silently skipped) if absent |
| U.S. Copyright Office | `copyright.gov` | none — by design | #3551 treats USCO as human-run verification research, not an automatable discovery source |
| CMG Worldwide | `cmgworldwide.com` | none — by design | Relationship-based (estate permission), not a bulk discovery source |

None of the discovery code downloads or stores media bytes. Every discovered candidate is written with `rights_status: 'unknown'`, `review_status: 'pending_review'`, `publication_status: 'not_ready'` — discovery never sets a rights conclusion.

### Core safety rule and where it's enforced

**Search and metadata capture may be automated. Rights conclusions and publish approval may not.**

- `rights_evidence.conclusion` (the three-value vocabulary: `public_domain_confirmed` / `permission_granted` / `lgfc_member_owned_item_photo`) stays `NULL` until either a human writer sets it directly, or the Wikimedia Commons batch-approval path (`functions/_lib/content-pipeline-batch-rights-approval.ts` + `content-pipeline-license-conclusion-mapping.ts`) writes it via a fixed, human-reviewed mapping from a *recognized* license template to its corresponding conclusion. No code path invents a conclusion for an *unrecognized* license — that path throws (or, via #3748's non-throwing resolver, writes `usage_decision: 'hold'` with `conclusion: null` instead) rather than guessing. `rights_evidence.evidence_text`/`evidence_url` capture the source's own claim verbatim, kept separate from LGFC's conclusion (migration 0055).
- Publication gating (`functions/_lib/content-pipeline-publication-prep.ts`, `PREP_ACCEPTABLE_RIGHTS_STATUSES`) excludes `unknown` — unknown ownership blocks publication by construction, not by convention.
- Approved bytes transfer directly from the official source URL to B2 (`functions/api/admin/content-pipeline/ingest.ts` — `fetch(sourceFetchUrl)` → `putB2Object`); the repository/GitHub never holds media bytes, no Actions artifacts, Releases, or LFS in the path.

### Rights-evidence channel and usage-decision model (#3657, #3748)

- Every governed rights conclusion is **channel-scoped** (`website` / `social_media` / `newsletter_email` / `fundraiser_campaign` / `internal_archive_only`) — a clearance for one channel does not authorize another. Enforced at the repository write layer per #3657 (reopened once after an initial gap was found, then fixed and re-verified — see #3657 for that history).
- Every `rights_evidence` row also carries a per-photo triage flag, `usage_decision` (`permit` / `deny` / `hold`, default `hold`), plus `source_filename` and `tagging_requirements` (migration `0061_rights_evidence_usage_decision.sql`, #3748). An unrecognized Commons license template now writes a `hold` row instead of aborting an entire batch-approval run. `rights_evidence` stays append-only: resolving a `hold` means writing a *new* row, never mutating the held one.

### Schema map

| Table | Role |
| --- | --- |
| `sources` | The allowlist itself; domain, trust status, adapter coverage |
| `content_search_runs` | One row per discovery attempt; seven terminal states + `running`, lease/heartbeat expiry so a run can't stay `running` forever |
| `content_items` | The candidate/content record (existing table from migration 0042; `input_stream = 'scheduled_discovery'` reserved for this pipeline) |
| `rights_evidence` | Per-item evidence + channel-scoped conclusion + usage_decision triage, append-only |
| `media_assets` | B2 key, checksum, byte metadata for ingested media |

### Admin API surface

- `POST /api/admin/content-pipeline/search-runs` (+ `/complete`) — start/complete a search-run record; the audit trail for a discovery attempt regardless of whether anything gets imported.
- `POST /api/admin/content-pipeline/rights-evidence` — record a rights-evidence row (channel required for governed conclusions).
- `POST /api/admin/content-pipeline/ingest` — approved-only transfer from source URL to B2 plus the D1 commit.
- Batch approval: `functions/_lib/content-pipeline-batch-rights-approval.ts` + its CLI script, used for the Wikimedia Commons approved-batch workflow (`.github/workflows/gehrig-wikimedia-batch-approval.yml`).

**Update, 2026-09-02:** a dedicated curator-facing UI for the `usage_decision = 'hold'` queue now exists — `src/app/admin/rights-review` (#3827), backed by a new read-only `GET /api/admin/content-pipeline/rights-evidence/queue` endpoint. It resolves items via the existing `POST /api/admin/content-pipeline/rights-evidence` (append-only, held row never mutated). See `/docs/reference/content/content-rights-runtime-as-built-2073.md` for the full admin-surface inventory.

## Known gaps

- **DPLA collector is code-complete but not live-verified.** #3826 added `functions/_lib/content-pipeline-dpla-adapter.ts` and wired it into the discovery script, with unit tests against a hand-built fixture response. It has not been run against the real DPLA API in any environment that produced this doc — no `DPLA_API_KEY` was available, and this sandbox's network egress already blocks the other three source domains outright. Verify the response-shape assumptions on first live run.
- **Production rollout of migrations 0059/0061 is unconfirmed.** Both are merged to `main`, but this and prior sessions working this lineage have had no Cloudflare credentials to confirm they've actually been applied against the Production D1 database (`lgfc_lite`). #3748 flagged the same gap for its own migration. Whoever holds Production credentials should confirm `wrangler d1 migrations list --env production` (or equivalent) shows both applied before relying on channel-scoping/usage_decision behavior in Production.

**Resolved since this doc was first written** (kept here for history, not as open gaps):
- ~~A failed D1 commit after a successful B2 write leaves an orphaned object.~~ Fixed by #3837/PR #3838 (merged): `commitIngestedMedia` now throws a typed, recoverable `MediaContentItemLinkError` and a retry of the same request completes the link — see #3551's 2026-09-01 12:27 UTC comment for the verification evidence.
- ~~Curator/rights-review admin UI does not exist.~~ Built 2026-09-02, see the Update note above and #3827.
- ~~#3551's own acceptance checklist has 4 of 15 items still open.~~ All 15 of 15 have direct evidence or an explicit recorded scope decision as of #3551's 2026-09-01 14:29 UTC comment. #3551, #3552, #3826, #3837, and #3827 are all closed/complete as of 2026-09-02.

## Non-goals

This document does not authorize new implementation, change the #3551 allowlist, or grant Production access. It is a snapshot of what is actually merged, current as of the "Last Reviewed" date above — re-verify against `main` before relying on it for anything time-sensitive.
