---
Doc Type: Reference
Audience: Product Authority, PMO, editors, and implementation agents
Authority Level: Controlled
Owns: AI-assisted tagging operating contract for #2292 — sequencing, field separation, fail-closed gates, and launch-packet boundaries
Does Not Own: D1 migrations, Workers, model/vendor selection, admin UI, bulk tagging runs, public publication, or SEO implementation
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related Issues: #2292, #2270, #2273, #1738, #2291, #2040, #2073
Last Reviewed: 2026-09-24
---

# AI-assisted tagging operating contract

## Purpose

Freeze the approved operating contract for AI-assisted tagging of LGFC digital content assets (#2292). This document is the Launch Packet for strategy-to-implementation sequencing. It does not authorize runtime tagging, D1 schema changes, Workers, paid model APIs, or admin UI.

## Scope

In scope: sequencing relative to content collection and SEO; digital-asset assumption; deterministic vs candidate vs approved metadata; minimum metadata categories; fail-closed public and SEO gates; identified later child tasks; validation and rollback for this documentation packet.

Out of scope: model/runtime tagging; D1 migrations; Workers; `/admin/*` UI; bulk tagging; automatic publication; AI-owned SEO copy; rights/copyright decisions by a model; vendor lock-in.

## Current known truth

- Product Authority 2026-09-24 placed #2292 Active at `pmo:priority:3` with Cursor as implementation owner (due 2026-10-15). Claude ownership is withdrawn.
- Design Ready evidence already lives on #2292. Sandbox Testing is not required for this documentation packet.
- Predecessor strategy #2270 is documented in `docs/ops/as-built/content-pipeline-strategy-2270-as-built.md`. Candidate field/state vocabulary is owned by `docs/reference/content/lgfc-content-candidate-model.md` (#2273). Storage boundary is `docs/reference/content/content-pipeline-storage-model.md` (#2312).
- This contract is additive to those authorities. It does not redefine `review_status`, `rights_status`, `privacy_review_status`, or `publication_status`.
- Successor #2291 (SEO) remains a later parent. Image/asset SEO fields (filename, alt text, caption, credit, tags) must resolve to the same approved metadata set before either parent ships runtime work that consumes those fields.
- Runtime tagging remains No-Go until Product records an explicit later Go on a file-allowlisted child Issue.

## Intended final state

Accepted collection items have durable D1 metadata. Deterministic fields exist before any model call. AI output is candidate-only. Human review is the only path to approved metadata. Public surfaces and SEO consume approved D1 fields, never raw object storage or unreviewed model output.

## Sequencing

| Order | Work | Owner Issue |
| --- | --- | --- |
| 1 | Content collection / pipeline strategy (intake of accepted items) | #2270 / #1738 lineage |
| 2 | AI-assisted tagging of accepted digital assets | #2292 (this contract) |
| 3 | SEO strategy implementation | #2291 |

SEO is driven by reviewed, structured, provenance-aware LGFC digital assets.

## Digital-asset assumption

Every item accepted through the Lou Gehrig content collection path becomes an LGFC digital asset with a durable metadata record. Raw B2/object storage alone is not an asset record.

Asset types include text articles, photographs, scanned documents, memorabilia images, media references, source excerpts, archive records, candidate story material, and publication-ready page copy after approval.

## Review pipeline

```text
Collected source item
→ raw asset storage (B2 / object storage only)
→ deterministic metadata extraction
→ D1 candidate asset record
→ AI-assisted tag/caption/source suggestions (candidate columns only)
→ confidence and risk scoring (candidate columns only)
→ human review / edit / approval
→ approved D1 asset metadata
→ downstream publication and SEO use
```

D1 is the operational source of truth for accepted assets and metadata. B2 remains raw-asset storage.

## Core rule

AI does not publish content, mark an item public-eligible, or set approved status.

AI may write only candidate enrichment: tags, caption, summary, people/entities, date/year, topic/story links, OCR/transcription, sensitivity flags, duplicate match, confidence score, and review notes.

Human/Admin review remains authoritative for source trust, factual accuracy, rights, privacy, credit, duplicate/canonical decision, and publication eligibility.

## Field separation

| Layer | Storage | Public / SEO use |
| --- | --- | --- |
| Deterministic | D1 asset record at intake | Internal only until review |
| AI candidate | Separate candidate columns or a candidate table | Never |
| Approved | D1 fields after human approval | Only when fail-closed gates pass |

Candidate and approved values are not the same columns. Promoting a candidate field copies a human-accepted value into the approved field; it does not alias the candidate column onto public pages.

## Deterministic metadata captured before any model call

file name; file extension/type; object key; content hash; duplicate hash match; upload/import date; source URL if known; source domain if known; dimensions/duration/page count where applicable; collector/import source; default review status; default public eligibility = false.

## Minimum metadata categories

Asset identity; storage; provenance; rights/status; review state; usage policy; content type; people/entities; topics; dates; location; sensitivity; quality; story relationship; SEO readiness.

Review, rights, privacy, and publication enums stay those in `docs/reference/content/lgfc-content-candidate-model.md`. This contract does not invent a parallel state machine.

SEO readiness values used by later #2291 work: `not_ready`, `candidate`, `reviewed`, `eligible`. `eligible` requires approved metadata plus the fail-closed gates below.

## Fail-closed gates

An item is not public-eligible and not SEO-eligible when any required control is missing:

- source/provenance
- rights/usage status
- review status
- required credit
- sensitivity review
- duplicate/canonical decision
- minimum metadata required by the target publication surface

Default for new assets: not public, `publication_status = not_ready`, SEO readiness `not_ready`.

## Cost and credentials

No paid tagging vendor, model API, or bulk run is authorized from #2292 until a later child names the cost class, secret class, and Product Go. Absence of those records is a stop.

## Identified later children (not opened by this packet)

| Slice | Work | Runtime |
| --- | --- | --- |
| #2292-001 | This operating contract (this PR) | No |
| #2292-002 | Map intake rows from #1738/#2270 onto the asset record using existing candidate tables | Docs then schema child |
| #2292-003 | Deterministic hash/duplicate capture at intake | Schema/runtime after Product Go |
| #2292-004 | Candidate-enrichment column design separate from approved columns | Docs/schema after Product Go |
| #2292-005 | Minimum admin review queue for tagging approval | Admin UI after Product Go |
| #2292-006 | Optional OCR as its own child before broader model tagging | After Product Go |

Do not start slices 002–006 without an exact file-touch allowlist on a live child Issue and Product Go for that slice.

## Validation

This packet is valid when:

- sequencing vs #2270/#1738 and #2291 matches the table above
- candidate vs approved separation is explicit
- fail-closed gates are explicit
- #2273 state vocabulary is cited, not forked
- no D1, Worker, workflow, or secret change is in the same PR as this packet

## Rollback

Revert the documentation commit. No runtime state is created by this packet.

## Operations handoff

Operators treat unreviewed model output as internal-only. Publication and SEO surfaces continue to use existing reviewed inventory helpers. There is no new on-call component from this packet.

## Project Go / No-Go

| Decision | Status |
| --- | --- |
| Documentation Launch Packet (this file) | Product 2026-09-24 Active assignment is the Go for this docs packet |
| Runtime tagging, migrations, Workers, admin UI, paid APIs | No-Go until a later child Issue records Product Go |

## Protected stops

Stop for: treating this file as runtime authorization; AI making a final rights, privacy, or publication decision; forking #2273 enums; shipping #2291 SEO from unreviewed tags; mixing schema/runtime into this docs-only PR.
