---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Current LGFC website as-built reconciliation and verified design-vs-runtime disposition
Does Not Own: Product and Design Domain Policy; runtime implementation; live GitHub queue state
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #3074, #3148, #3149
Last Reviewed: 2026-08-08
---

# LGFC Website Current As-Built Reconciliation

## Purpose

Record the current website as-built state verified for #3074 and supersede the June 2026 Phase 1 snapshot in `docs/reference/website/lgfc-website-as-built-reconciliation.md` for current-state decisions.

The June 2026 document remains historical evidence for its assessment date. Current implementation and operational conclusions must use this document together with live GitHub evidence and the canonical Product/Design authority.

## Scope

This document records verified current behavior, approved Product decisions, known implementation/documentation discrepancies, and bounded follow-up Issues. It does not replace the Product and Design Domain Policy or authorize implementation.

## Current known truth

Assessment date: **2026-08-07**.

Evidence used:

- `docs/reference/design/LGFC-Production-Design-and-Standards.md`;
- current source on `main` for Search, FAQ, Privacy, and Terms;
- Product Authority decisions recorded in #3074;
- live GitHub Issue state for bounded follow-up defects.

Repository and live GitHub evidence supersede historical tracker/queue snapshots.

## Intended final state

This reference remains a current-state reconciliation layer rather than a competing Product/design authority. The intended final state is that canonical design, current runtime behavior, and maintained website reference documentation agree on the approved route and disclosure model; bounded discrepancies such as #3148 and #3149 are completed or explicitly accepted; and historical snapshots remain clearly historical rather than being used as current queue or implementation authority.

When those conditions change materially, update this reference with verified evidence and a new review date instead of creating another competing current-state owner.

## Review boundary

This document may record implementation evidence and bounded follow-up, but it does not self-accept the work that produced it. The actor performing the documentation increment must not serve as the independent closeout reviewer for the same increment; closeout must use the repository's independent review and acceptance path.

## Approved Product behavior

- Homepage `ABOUT` section is approved and is the Lou Gehrig biography location.
- `/about` is the Fan Club history/about page.
- `/join` is the canonical dual-tab Join/Login page; `/join?mode=login` selects Login first.
- Ask and FAQ are consolidated; `/ask` is the active question workflow.
- Ask uses Join identity fields plus the submitted question and uses member creation/verification and magic-link verification where applicable.
- Footer behavior is approved as the D1-backed rotating quote, dynamic copyright/legal line, centered logo, Terms, Privacy, and Contact model. No footer `mailto:` or email form is required.
- `/contact` is the support/administration contact surface.
- Weekly-matchup naming is canonical; obsolete weekly-vote naming variants are not current authority.
- `/health` is operational.
- `/fanclub` authentication is operational; the Fan Club product surface remains under active feature implementation.

## Current implementation disposition

| Surface | Current disposition | Evidence / follow-up |
|---|---|---|
| Search | **Implemented in source** | `src/app/search/page.tsx` provides query, pagination, public/member-aware results, loading/error states, and `/api/search` integration. Deployment/live indexing remains an operational verification concern, not an implementation-absence finding. |
| `/faq` | **Legacy compatibility** | Redirects to `/ask/` (query preserved). Canonical FAQ browse + Ask workflow lives on `/ask` (#3148). |
| `/privacy` | **Disclosure gap** | Current fallback text omits the newer Ask/member-verification data flow. Follow-up #3149 owns bounded correction and Terms factual review. |
| `/terms` | **Review required, no defect assumed** | Current fallback terms cover respectful use, submissions, copyright/attribution, no-warranty, and contact. #3149 must change Terms only if current Join/Login/Ask/member behavior creates a concrete factual inconsistency. |
| `/login` | **Legacy compatibility** | Canonical design requires redirect to `/`. |
| `/auth` | **Legacy compatibility** | Canonical design requires redirect to `/join`. |
| `/ask` | **Canonical active question workflow** | Product Authority decision in #3074; runtime details remain governed by current implementation and follow-up validation. |
| Homepage milestones | **Not yet proven defective from repository text search** | The reported visitor-facing sentence `Pulled live from D1 milestones table.` was not found in current repository source search. This may originate from D1-managed content or a production-data/content surface. Do not infer a code defect without live D1/render evidence. |

## Milestones verification boundary

#3074 reported both helper-copy residue and possible loading/data behavior. Current repository text search did not locate the reported sentence, so the repository alone cannot determine whether it is:

- D1-managed page/content data;
- stale Production data;
- already removed source residue;
- or a separate fetch/render failure.

A future live/D1 verification must record the rendered state and redacted milestone counts before a code/content remediation Issue is created. Absence of repository evidence is not proof of Production correctness.

## DIATAXIS disposition

- **Reference:** `LGFC-Production-Design-and-Standards.md` remains the canonical supporting specification for exact production behavior, routes, navigation, and invariants. This current as-built record owns verified implementation disposition only.
- **Explanation:** rationale such as biography placement, Fan Club `/about`, and Ask/FAQ consolidation belongs in existing Product/design explanation surfaces when needed; do not duplicate normative route rules there.
- **How-to:** create or update only for repeatable operator actions such as content administration or verification. No new how-to is justified merely by this reconciliation.
- **Tutorial:** not applicable to this reconciliation; no learning-oriented workflow is required.

## Known bounded follow-up

- #3148 — `/faq` → `/ask` compatibility (implemented in source when this row is current; closeout follows independent review).
- #3149 — reconcile Privacy disclosure with Join/Ask member-verification flow and record Terms disposition.

These are implementation/content corrections and must not be silently folded into this documentation-only reconciliation.

## Historical-document disposition

`docs/reference/website/lgfc-website-as-built-reconciliation.md` remains a historical Phase 1 snapshot assessed in June 2026. It must not be used as current queue, route, or implementation authority where it conflicts with this document, current source, Product Authority, or live GitHub evidence.

## Current-state rule

For website current-state decisions use, in order:

1. Product/Design domain authority and current controlled design specifications;
2. current repository implementation and tests;
3. live GitHub Issues/PRs/checks for implementation state;
4. this current as-built reconciliation;
5. historical snapshots only as historical evidence.

## Closeout condition for #3074

#3074 may close only after independent review confirms this reconciliation and the canonical design/runtime discrepancies routed to #3148/#3149 are either completed or explicitly accepted as bounded open follow-up without leaving contradictory canonical documentation.
