---
Doc Type: Reference
Audience: LGFC operators, editors, and AI implementation agents
Authority Level: Controlled
Owns: Source metadata, credit display rules, contributor/researcher records, evidence retention, and conflicting-source handling
Does Not Own: Runtime schema implementation, D1 migrations, or public publication
Canonical Reference: /docs/reference/website/lou-gehrig-content-metadata-schema.md
Related issues: #1738, #1741, #1739, #1740
Last Reviewed: 2026-10-10
---

# Lou Gehrig Source Provenance Model

## Purpose

This reference defines required source metadata, credit display needs,
contributor/researcher evidence handling, and conflicting-source rules for
Lou Gehrig content collection.

## Provenance principles

- Every collected item retains original source location, retrieval context, date
  seen, contributor/researcher, and review state.
- Public display must include appropriate source/credit language when required.
- Internal research notes must not become public content without editorial conversion.
- Conflicting sources must be flagged rather than silently resolved.
- Primary sources and reputable archives are preferred over derivative summaries.
- Public-domain assumptions must be reviewed, not guessed.

## Required provenance metadata

All fields in `docs/reference/website/lou-gehrig-content-metadata-schema.md`
apply. Provenance-specific requirements:

| Field group | Requirement |
| --- | --- |
| Source identity | `source_title`, `source_citation`, and `source_url` when durable |
| Source authority | `source_owner` must identify publisher, archive, or rights holder |
| Retrieval context | `acquisition_method`, `date_accessed` |
| Confidence | `provenance_confidence`, `factual_confidence` |
| Attribution | `credit_line` required for every candidate |

## One record for every search

Search collects a record for everything it finds; the content evaluation process decides what is admitted to B2 and D1. Every search from every source records the same provenance set so LGFC can
always account for where content originated: `source_name`, `source_domain`,
`source_url`, `source_owner`, `date_accessed`, the search run (`run_uid`, query,
source), `credit_line`, the source's own license text, `contact_info` when
offered, and the decision with its reviewer. Fee-required items are recorded the
same way and flagged do-not-use. See
`docs/how-to/website/lou-gehrig-free-use-content-discovery.md`.

## Credit display rules

| Scenario | Credit requirement |
| --- | --- |
| LGFC-owned media | Credit line may state LGFC ownership; document acquisition |
| Public archive citation | Credit archive name and catalog identifier |
| Licensed or permission-granted | Credit per license terms; retain permission record in notes |
| Link-only / reference-only | Retired 2026-10-10; not admitted to the libraries or shown on the site (hosted content only). The URL stays in the collection record |
| Free use with credit cited | Credit per the source's license: author, title, license, source; required on the page |
| Fee required | No credit; item is recorded and flagged do-not-use |
| User submission | Credit submitter only when approved; separate source credit for underlying material |
| Unknown rights | No public credit until rights review completes |

Credit lines must be human-readable and suitable for future public display on
website surfaces (homepage, library, gallery, timeline).

## Contributor and researcher records

| Role | Evidence retained |
| --- | --- |
| Operator researcher | Reviewer name, review date, intake notes |
| Member submitter | Submission path, submitter ID (internal), submission timestamp |
| External institution contact | Institution name, contact reference, response date in notes |
| ChatGPT/Bill escalation | Escalation reason and decision in notes |

Researcher identity is retained for audit; public pages display source credit,
not internal researcher notes, unless editorially approved.

## Evidence retention

Retain for the life of the candidate record:

- source citation and access date;
- rights status history (in notes when status changes);
- review decisions and reviewer identity;
- rejection or defer reasons;
- permission documentation references (external to repo when sensitive);
- conflicting-source flags and resolution notes.

Do not store paywalled full text, scraped social content, or unlicensed media
binaries in the repository.

## Conflicting sources

When two or more sources disagree on a fact:

1. Flag the candidate notes with `conflict: true` and list sources.
2. Set `factual_confidence` to `low` until resolved.
3. Do not publish interpretive resolution without editor approval.
4. Prefer primary sources; document why a source was chosen if editorially approved.
5. Alternate perspectives may become non-canonical inventory rows per content
   inventory model; do not silently overwrite canonical facts.

Escalate unresolved conflicts to Bill/ChatGPT before public-copy approval.

## Relationship to unified workflow

Provenance capture at research intake aligns with `submission_queue` source fields
and `content_inventory` publication requirements. Research candidates that
promote to public copy must satisfy both this model and
`docs/reference/website/content-inventory-model.md`.

## Acceptance checklist

- [x] Provenance fields documented
- [x] Source-credit rules documented
- [x] Contributor/researcher evidence handling documented
- [x] Conflicting-source handling documented
