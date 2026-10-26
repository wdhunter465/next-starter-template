---
Doc Type: How-To
Audience: Operator + AI
Authority Level: Operational Procedure
Owns: Provenance, rights, credit, factual, and privacy review procedure for Lou Gehrig content
Does Not Own: Automated scraping, OCR, enrichment, monitoring, or publication
Canonical Reference: /docs/reference/website/lou-gehrig-source-provenance-model.md
Related issues: #1738, #1742, #1741
Last Reviewed: 2026-10-26
---

# Lou Gehrig Source Provenance Review

## Purpose

Every Lou Gehrig content candidate must be reviewed for provenance, rights,
credit, factual accuracy, and privacy before it becomes public-copy material.

## Review decision

Every candidate must be reviewed before it becomes public-copy material.

## Steps

1. Open the candidate record and confirm minimum metadata is present.
2. Run provenance checks.
3. Run rights and credit checks.
4. Run factual checks.
5. Run privacy checks.
6. Assign or update `review_status` and `credit_line`.
7. Record `reviewer`, `reviewed_at`, and notes.
8. Escalate ambiguous cases; do not publish until resolved.

## Procedure

### Provenance checks

- Can the source be identified?
- Is the owner/publisher known?
- Is the citation sufficient for a future reviewer?
- Is the content traceable without relying on AI output?
- Is the source likely durable enough to cite?

### Rights and credit checks

- Is the material owned by LGFC?
- Is it public-domain-candidate only, or confirmed public domain?
- Is permission required?
- Is permission granted and documented?
- Is the content safer as link-only/reference-only?
- What credit line is required?

### Factual checks

- Is the fact supported by a reliable source?
- Does another reliable source corroborate it?
- Is the item interpretive rather than factual?
- Is uncertainty stated clearly?

### Privacy checks

- Does the content name or show living people?
- Does it involve donors, members, minors, or private submissions?
- Does it require consent or redaction?

## Review states

| Status | Meaning | Next action |
| --- | --- | --- |
| `candidate` | New lead | Begin provenance checks |
| `needs-source` | Source incomplete | Return to intake |
| `needs-rights-review` | Rights unresolved | Complete rights section below |
| `approved-for-reference` | Internal use only | Archive or cite internally |
| `approved-for-public-copy` | May draft website copy | Proceed to editorial conversion |
| `rejected` | Must not use | Record `rejection_reason` |
| `deferred` | Not current work | Re-queue later |

## Required rejection reasons

When rejecting, select or document one or more:

- untraceable source;
- disallowed source category;
- copyright/rights risk unacceptable;
- privacy risk unmitigable;
- duplicate without new value;
- unsupported factual claim;
- institution denied reproduction;
- operator discretion (document in notes).

## Credit-line rules

- Every approved item must have a `credit_line` before public-copy promotion.
- Link-only items credit the source URL and owner.
- LGFC-owned items credit LGFC with acquisition note.
- Permission-granted items credit per license terms.

## Fact-check confidence rules

| Level | Criteria |
| --- | --- |
| high | Primary or multiple corroborating reputable sources |
| medium | Single reputable secondary source |
| low | Conflicting sources, interpretive content, or single weak source |

Low factual confidence blocks `approved-for-public-copy` unless Product Authority approves with stated uncertainty.

## AI-assistance boundary

AI may summarize or extract metadata for operator review. AI output is not
source authority. Facts require primary or secondary source verification by a
human reviewer.

## Escalation path

If rights, factual confidence, or privacy is unclear:

1. Set status to `needs-rights-review`, `needs-source`, or `deferred`.
2. Document escalation reason in notes.
3. Notify Product Authority for launch-critical or high-risk items.
4. Do not publish.

Detailed clearance states: `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md`.
