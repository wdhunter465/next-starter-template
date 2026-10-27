---
Doc Type: Operations
Audience: Bill, Governance, Cursor, LGFC maintainers, implementation agents, and reviewers
Authority Level: Operational Authority
Owns: Priority #4 PMO readiness decision, Lou Gehrig content collection expansion scope, child-project boundaries, source/credit/privacy/readiness state, Cursor launch preconditions
Does Not Own: Runtime implementation, issue creation without launch authorization, merge authority, third-party content rights, bulk ingestion, OCR implementation, AI enrichment implementation, external monitoring implementation
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #1736, #1255, #1256, #1685, #1690, #1693, #1379, #4776
Last Reviewed: 2026-10-26
---

# Lou Gehrig Content Collection / Research Pipeline Expansion Readiness

> This program is BLOCKED from execution until Product Authority explicitly launches it. Planning, review, and documentation discussion may continue, but Cursor may not execute implementation work from this program until Product Authority explicitly launches it.

## Purpose

This document converts the PMO backlog item **Lou Gehrig content collection strategy** into a PMO July 2026 future-program readiness package.

This program exists because the LGFC website will need a durable content supply chain. Priority #1 absorbs normal editorial intake/source-credit workflow for current website content management, but this package covers the larger future expansion: discovering, triaging, crediting, reviewing, and converting Lou Gehrig-related material into website-ready content at scale.

## Scope

This readiness package covers:

1. Source discovery and intake model.
2. Research queue and triage workflow.
3. Source, credit, citation, and provenance model.
4. Rights, copyright, privacy, and publication review model.
5. Editorial approval and content conversion workflow.
6. Repository/admin/data-surface boundary model.
7. AI-assisted research guardrails, if used later.
8. Verification, evidence, and closeout model.

This document owns the PMO readiness decision, project boundaries, launch preconditions, missing-decision register, and future Cursor task structure.

This document does not implement crawling, scraping, OCR, AI enrichment, external monitoring, bulk ingestion, database schema changes, API behavior, admin UI, or public website publishing.

## Current known truth

- Normal content management and editorial intake are already partially absorbed into Priority #1.
- This expansion is for larger-scale discovery, research, provenance, and conversion workflows beyond normal current-site content operations.
- Program #1255/#1259 remains active and ahead of this program.
- Priority #1, Priority #2, and Priority #3 already have launch-control structures and remain ahead unless Product Authority explicitly reprioritizes.
- Human editorial review remains mandatory before publication.
- Source/credit/provenance must be captured before content becomes website-ready.
- Copyright, privacy, and public-domain status must be reviewed before publication.
- AI may assist research only inside bounded, evidence-preserving workflows; AI must not invent facts, citations, provenance, or publication rights.

## Intended final state

After this program is complete, LGFC should have a repeatable content collection and research pipeline that can feed the website with reviewed, credited, rights-aware content.

The intended final state is:

- source discovery rules and intake channels are documented;
- research items can be triaged and prioritized;
- every candidate item has provenance, source, credit, rights, and review status;
- editorial conversion rules define how raw material becomes website-ready content;
- admin/data-surface needs are identified without pre-authorizing admin implementation;
- AI-assisted research guardrails are explicit;
- publication requires human approval;
- deferred automation candidates are separated from immediate implementation.

## Program candidate

| Field | Value |
| --- | --- |
| Candidate program name | Lou Gehrig Content Collection / Research Pipeline Expansion |
| PMO source | PMO Backlog project 12 |
| Source issue | #1736 |
| Execution agent after launch | Cursor |
| Current readiness | Planning-ready with launch-control package created by #1736 work; blocked from execution until queue authorization |
| Primary implementation plan | `docs/ops/implementation-plans/lou-gehrig-content-collection-expansion.md` |
| Product surface | Research/content operations feeding website content, not public publishing by itself |
| Explicit non-goal | Unreviewed content publication, scraping/OCR/AI implementation, or replacing human editorial review |

## Child-project readiness inventory

| Child project | Current state | Readiness decision |
| --- | --- | --- |
| Source discovery and intake model | Future expansion beyond normal editorial intake | Needs Task 001 source inventory before build |
| Research queue and triage workflow | Not yet formalized | Needs Task 002 queue design |
| Source/credit/provenance model | Partially covered by existing content strategy; expanded here | Needs Task 003 formal model |
| Rights/copyright/privacy review | Not yet formalized | Needs Task 004 review gate |
| Editorial conversion workflow | Partially covered by Priority #1 content management | Needs Task 005 expansion workflow |
| Admin/data-surface boundary model | Dependent on Project 11 admin/tools review | Needs Task 006 boundary inventory |
| AI-assisted research guardrails | Future idea; not implementation-ready | Needs Task 007 guardrails before any AI use |
| Verification and closeout | Not yet formalized | Needs Task 008 validation package |

## Source and provenance principles

- Every collected item must retain original source location, retrieval context, date seen, contributor/researcher, and review state.
- Public display must include appropriate source/credit language when required.
- Internal research notes must not become public content without editorial conversion.
- Conflicting sources must be flagged rather than silently resolved.
- Primary sources and reputable archives are preferred over derivative summaries.
- Public-domain assumptions must be reviewed, not guessed.

## Rights, privacy, and publication rules

- Do not publish copyrighted material without rights clearance, public-domain confirmation, license permission, or approved excerpt/summary treatment.
- Do not publish private personal data about living people without explicit review.
- Do not publish donor/member/private submission information outside approved public-display rules.
- Media assets require stronger provenance and rights checks than text summaries.
- AI-generated summaries must cite source records and must remain subject to human review.

## Admin and data-surface boundary

Project 11 Admin Page and Tools Design Readiness remains ahead of this program for admin/tool surface decisions.

This program may define data needs and review states, but any admin implementation must be separately authorized through either Project 11 or a future task that explicitly allows admin code changes.

## Missing-decision register

| Decision | Needed before | Default |
| --- | --- | --- |
| Source intake channels | Task 001 | Manual/source-list first; automation deferred |
| Research queue owner | Task 002 | Human-operated queue |
| Provenance data model | Task 003 | Document-first model before schema/code |
| Rights review owner | Task 004 | Human editorial/owner review |
| Publication approval path | Task 005 | No publish without human approval |
| Admin surface ownership | Task 006 | Defer to Project 11 unless explicitly authorized |
| AI-assisted research scope | Task 007 | Guardrails only; no autonomous publishing |
| Automation expansion | Task 008 | Deferred candidates only |

## Launch preconditions

Before Cursor receives implementation assignment for this program:

1. Program #1255/#1259 status must be resolved or explicitly deprioritized.
2. Higher queued programs must be launched, deferred, or reprioritized by Product Authority.
3. Project 11 admin/tools readiness should be reviewed because this program may need admin/research queue surfaces.
4. A current program issue must explicitly launch this program.
5. Child task issues must exist with predecessor/successor chain.
6. Cursor must receive one task issue at a time unless Product Authority authorizes parallel execution.
7. Rights/privacy guardrails must be accepted before any public content publication work.

## Readiness conclusion

This package makes the Lou Gehrig content collection expansion suitable for launch-control planning.

It is not executable until Product Authority explicitly launches the program and authorizes Cursor to begin Task 001.
