---
Doc Type: Reference
Audience: LGFC operators, Governance, Bill, and AI agents
Authority Level: Controlled
Owns: AI-assisted research guardrails, evidence-preservation requirements, and human-review boundaries for Lou Gehrig content collection
Does Not Own: AI implementation, OCR, scrapers, or autonomous publishing
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related issues: #1738, #1745, #2040
Last Reviewed: 2026-10-26
---

# Lou Gehrig Research AI Guardrails

## Purpose

Define if and how AI may assist Lou Gehrig source discovery, summarization,
deduplication, OCR review, or enrichment without bypassing evidence or human review.

## Core guardrails

1. **AI is not source authority** — facts require human-verified primary or secondary sources.
2. **Evidence preservation** — AI outputs must link to source records, not replace them.
3. **Human review mandatory** — no AI-only path to `approved-for-public-copy` or publication.
4. **No invented provenance** — AI must not generate citations, URLs, or rights status.
5. **Privacy first** — AI must not process or expose donor/member/minor data without review.
6. **Transparency** — when AI assists drafting, operator notes record AI involvement.

## Permitted AI assistance (future, with human gate)

| Use case | AI may | AI may not |
| --- | --- | --- |
| Metadata extraction | Suggest field values from provided source text | Invent missing source fields |
| Summarization | Draft summary for reviewer | Publish summary without review |
| Deduplication | Flag possible duplicates | Auto-merge or auto-reject |
| OCR review | Assist reading scanned operator-provided images | Run bulk OCR pipeline (#1738 out of scope) |
| Source discovery | Suggest search queries | Crawl or scrape autonomously |
| Formatting | Normalize citation format | Alter factual content silently |

## Evidence-preservation requirements

When AI assists any step:

- retain original source citation and access date;
- retain AI prompt/output in operator notes when material to review;
- mark `factual_confidence` conservatively if AI participated;
- require human `reviewer` signature before promotion.

## Human-review requirements

| Decision | Human required |
| --- | --- |
| Source truth | yes |
| Rights approval | yes |
| Privacy approval | yes |
| Public-copy approval | yes |
| Publication | yes |
| Rejection | yes |
| Metadata completeness flag | may assist; human confirms |

## Prohibited AI uses

- autonomous web scraping or monitoring;
- generating factual claims without cited sources;
- replacing provenance or rights review;
- publishing to public routes;
- processing sensitive member data without authorization;
- bulk enrichment at scale (deferred).

## Relationship to #2040

Automation candidates identified in Task 007 inventory feed #2040 only after manual
workflow evidence demonstrates safe boundaries. AI guardrails in this document are
preconditions for any #2040 AI-assisted feature.

## Acceptance checklist

- [x] AI guardrails documented
- [x] Evidence-preservation requirements documented
- [x] Human-review requirements documented
- [x] Automation candidates deferred to Task 007 inventory report
