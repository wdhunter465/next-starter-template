---
Doc Type: Reference
Audience: LGFC operators, researchers, maintainers, and AI implementation agents
Authority Level: Controlled
Owns: Approved Lou Gehrig content source categories, intake channels, evidence fields, and manual intake boundaries for Program #1738
Does Not Own: Runtime ingestion, scraping, OCR, AI enrichment, publication automation, or public routing
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related issues: #1738, #1739, #1685, #1256
Last Reviewed: 2026-10-10
---

# Lou Gehrig Source Category Inventory

## Purpose

This reference inventories approved and disallowed Lou Gehrig content source
categories for the manual collection pipeline defined by Program #1738.

It separates normal editorial intake (Priority #1 unified content workflow) from
large-scale research collection that feeds future website content beyond current
member submissions.

## Scope

This reference covers:

- current repository content and data inputs related to Lou Gehrig content;
- approved candidate source categories;
- disallowed or high-risk source categories;
- intake channels and acquisition methods;
- evidence fields required at intake;
- deferred automation candidates.

This reference does not authorize scraping, crawling, OCR, AI enrichment,
external monitoring, or public publication.

## Current repository content inputs

The following existing surfaces and stores are relevant to Lou Gehrig content
collection planning:

| Surface / store | Location | Current role | Lou Gehrig relevance |
| --- | --- | --- | --- |
| Unified editorial workflow | `docs/reference/website/unified-content-workflow.md` | Member/editor intake through `submission_queue` | Baseline intake model; Gehrig research extends beyond member submit |
| Content inventory model | `docs/reference/website/content-inventory-model.md` | D1 story inventory requirements | Publication target after research review |
| Deep research archive | `docs/archive/research/lou-gehrig-deep-research.md` | Internal research notes (legacy archive) | Historical research material; not public-ready without conversion |
| Club staging preview | `src/app/admin/clubstaging/` | Staging-only sample rotation | Preview boundary for future Gehrig editorial candidates |
| Member submission path | `/fanclub/submit` → `POST /api/library/submit` | Member content leads | One intake channel for user-submitted Gehrig-related leads |
| Admin editorial APIs | `functions/api/admin/editorial/**` | Review, publish, inventory | Destination after research converts to website-ready content |
| Public website routes | `/`, `/about`, `/events`, `/ask`, `/search`, etc. | Published content surfaces | Destination for approved public-copy material only |

Research collection candidates are captured as **leads with metadata**, not as
wholesale copies of copyrighted works in the repository.

## Approved source categories

| Source type | Example | Acquisition method | Rights risk | Metadata required | Manual review owner |
| --- | --- | --- | --- | --- | --- |
| Public archives | Library of Congress, National Baseball Hall of Fame archives | Operator research; catalog citation | Low–medium; verify reproduction terms | Source title, citation, owner, date accessed, rights status | Operator / editor |
| Books (reference) | Biographies, historical accounts | Operator research; citation only | Medium; no full-text import | Source title, author, publisher, page/chapter citation, rights status | Operator / editor |
| Newspaper articles | Historical press coverage | Archive index or licensed database citation | Medium–high; host only when public domain or permission granted; otherwise not collected | Source title, publication, date, citation/URL, rights status | Operator / editor |
| MLB / Yankees official sources | MLB.com historical content, Yankees archives | Public page citation or licensed media | Medium; often permission-needed for media | Source URL, owner, credit line, rights status | Operator / editor |
| Museums and institutions | Cooperstown, ALS Association historical materials | Institution catalog or outreach | Medium; permission often required | Source title, institution, catalog ID, rights status | Operator / editor |
| LGFC-owned media | Club photos, event records, operator-created copy | Internal archive | Low when ownership documented | Acquisition method, credit line, rights status (`owned`) | Operator / editor |
| User-submitted leads | Member tip about a Gehrig artifact or story | `/fanclub/submit` or operator email | Medium; privacy review required | Submitter context, source description, privacy flag | Operator / editor |
| Academic / reference databases | Peer-reviewed historical analysis | Citation and abstract only | Medium; host only with an open license or permission; citation belongs in the credit line | Source title, author, DOI/URL, rights status | Operator / editor |
| Timeline / milestone facts | Verifiable dates and events | Primary or secondary source citation | Low–medium when corroborated | Source citation, factual confidence, provenance confidence | Operator / editor |
| Photo / artifact leads | Historical photograph or memorabilia lead | Catalog reference; not binary import without rights | High for images | Source owner, credit line, rights status, privacy flag | Operator / editor |

## Disallowed or high-risk categories

Do not intake the following without explicit Bill/ChatGPT authorization and a
documented exception path:

| Category | Risk | Action |
| --- | --- | --- |
| Scraped social media content | Copyright, privacy, unstable URLs | Reject |
| Paywalled full-text copies | Copyright violation | Reject; no link-only substitute |
| Content requiring a license fee | LGFC pays for no content | Record, flag `FEE REQUIRED: DO NOT USE`, never publish |
| Link-only leads | Members leave the site; poor experience | Not collected |
| Copyrighted full-text imports into repo | Repository liability | Reject |
| Unverifiable AI-generated claims | No source authority | Reject |
| Unattributed images | Rights and credit unknown | Reject until source established |
| Private individual data without review | Privacy violation | Reject or defer for privacy review |
| Untraceable sources | No provenance | Reject (`needs-source`) |
| Bulk automated downloads | Uncontrolled acquisition | Deferred; not authorized by #1738 |

## Intake channels

| Channel | Actor | Output |
| --- | --- | --- |
| Operator research | Editor, researcher, Bill/ChatGPT | Candidate lead with metadata |
| Member submission | Authenticated member via `/fanclub/submit` | Queue item or research lead referral |
| Internal archive review | Operator reviewing LGFC-owned assets | Candidate with `owned` rights status |
| External lead referral | Partner, donor, institution contact | Candidate with outreach notes |
| Legacy research archive | `docs/archive/research/**` review | Conversion candidate; not auto-published |

## Required evidence fields at intake

Every intake lead must capture at minimum:

- working title;
- content type (article, quote, photo, artifact, timeline item, event, biography note, source lead, other);
- source title and citation or URL;
- source owner or publisher;
- acquisition method;
- date accessed;
- rights status (initial assessment);
- review status (`candidate` default);
- reviewer assignment.

Full field definitions are expanded in Task 003 (#1741) provenance model work.

## Manual intake workflow summary

1. Discover a source lead through an approved channel.
2. Create a candidate record with required evidence fields.
3. Classify source category using the approved table above.
4. Assign initial rights risk and review status.
5. Route to research queue for triage (Task 002, #1740).
6. Do not copy wholesale copyrighted works into the repository.
7. Do not publish to public routes without full review chain completion.

Detailed operator procedure: `docs/how-to/website/lou-gehrig-content-intake.md` (Task 005, #1743).

## Deferred automation candidates

The following are explicitly **out of scope** for Program #1738 Phase 1:

- automated web scraping or crawling;
- OCR pipelines;
- AI enrichment or summarization at scale;
- external source monitoring;
- automatic public publication (#2040 predecessor evidence required first);
- duplicate detection automation;
- bulk ingestion into D1 or B2.

Automation candidacy review is documented in Task 007 (#1745).

## Compatibility with Priority #1 workflow

Lou Gehrig research collection **extends** the unified content workflow; it does
not replace it.

| Layer | Priority #1 | Program #1738 |
| --- | --- | --- |
| Member submit | `submission_queue` intake | User-submitted Gehrig leads may enter queue or research inventory |
| Research leads | Not formalized | Manual candidate records with provenance metadata |
| Publication | Human-approved `content_inventory` | Same destination after editorial conversion |
| Public render | Approved inventory only | Same rule; no bypass |

## Acceptance checklist

- [x] Approved source categories documented
- [x] Intake fields defined at inventory level
- [x] Manual intake workflow summarized
- [x] Deferred automation candidates separated from current scope
