---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Metadata fields required for Lou Gehrig content candidates
Does Not Own: Publication automation, scraping, OCR, AI enrichment, or public routing
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related issues: #1738, #1741, #1739, #1740
Last Reviewed: 2026-10-10
---

# Lou Gehrig Content Metadata Schema

## Purpose

Every Lou Gehrig content candidate must carry enough metadata for provenance,
rights, editorial review, and future publication-safety automation.

## Required fields

| Field | Required | Description |
| --- | --- | --- |
| `candidate_id` | yes | Stable internal identifier. |
| `title` | yes | Working title for the content candidate. |
| `content_type` | yes | article, quote, photo, artifact, timeline item, event, biography note, source lead, other. |
| `source_title` | yes | Source title or collection name. |
| `source_url` | when available | URL to source or catalog entry. |
| `source_citation` | yes | Human-readable citation if URL is absent or insufficient. |
| `source_owner` | yes | Publisher, archive, institution, person, or platform. |
| `acquisition_method` | yes | manual lead, public archive, owned media, user submission, operator research, other. |
| `date_accessed` | yes | Date the source was reviewed. |
| `original_publication_date` | if known | Original publication date or date range. |
| `rights_status` | yes | unknown, public-domain-candidate, permission-needed, permission-granted, owned, fee-required, rejected. (`link-only` retired 2026-10-10: not admitted to the libraries; see rights review model.) |
| `credit_line` | yes | Required attribution or internal note explaining why no public credit line applies. |
| `provenance_confidence` | yes | high, medium, low. |
| `factual_confidence` | yes | high, medium, low. |
| `privacy_flag` | yes | none, living-person, donor/member, minors, sensitive, other. |
| `editorial_use_candidate` | yes | public copy, admin reference, research-only, archive-only, reject. |
| `review_status` | yes | candidate, needs-source, needs-rights-review, approved-for-reference, approved-for-public-copy, rejected, deferred. |
| `reviewer` | yes | Human/operator reviewer. |
| `reviewed_at` | when reviewed | Review date. |
| `rejection_reason` | if rejected | Required when review_status is rejected. |
| `notes` | optional | Operator notes. |

## Review status rules

- `candidate`: newly captured lead; not approved for public use.
- `needs-source`: source is incomplete or unverifiable.
- `needs-rights-review`: source exists but publication rights/credit are unresolved.
- `approved-for-reference`: may be used internally for research or citations.
- `approved-for-public-copy`: may be transformed into website copy with human approval.
- `rejected`: must not be used; rejection reason required.
- `deferred`: retained for future review but not current work.

## Automation boundary

Future automation may validate metadata completeness and state transitions.
Automation must not decide source truth, rights approval, or final publication
approval without a human authority rule.

## Compatibility with content inventory model

When a candidate converts to website-ready content, fields map to
`content_inventory` requirements per
`docs/reference/website/content-inventory-model.md`:

| Candidate field | Inventory field |
| --- | --- |
| `title` | story title |
| `credit_line` | `credit_line` (required) |
| `source_citation` / `source_url` | source URL/reference |
| `source_owner` | source name |
| `reviewer`, `reviewed_at` | editorial audit context |

Conversion rules are defined in Task 005 (#1743).
