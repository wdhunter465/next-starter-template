---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #2919 Product-decision register (remediated), the approved Product Decision Record, conservative/approved dispositions, and #2919/#2920 implementation-ownership split for Project #2784's compliance findings
Does Not Own: Legal conclusions, public-policy authorship, rights authorizations, runtime/schema implementation, public-copy changes, or Production/Promotion authority
Canonical Reference: /docs/ops/reports/compliance-readiness-inventory-2918.md
Related Issues: #2784, #2918, #2919, #2920, #2921
Last Reviewed: 2026-08-05
---

# Compliance Product-Decision Register — First Increment (#2919)

## Purpose

Convert the accepted #2918 inventory (`docs/ops/reports/compliance-readiness-inventory-2918.md`, findings F1–F7 and every P0/P1 matrix row) into an executable Product-decision register: concrete decision options for Bill, a conservative default disposition for every item while unresolved, and an exact implementation-ownership split between #2919 (rights/privacy evidence controls) and #2920 (public disclosures and fundraiser/provider boundaries).

This document makes **no legal conclusion**, approves **no public copy**, and changes **no runtime behavior**. It is a decision-routing and disposition register only. As of this remediation (2026-08-04), Bill has recorded all ten Product decisions as **APPROVED** (see "Product Decision Record" below); the per-item dispositions throughout this document have been updated to reflect the approved direction. No runtime, schema, or public-copy implementation has occurred through this document at any point — approval of a decision authorizes a later, separately bounded implementation increment; it does not itself implement anything.

## Current known truth

- Predecessor #2918 (compliance inventory) is accepted and complete.
- This register's first increment (PR #3051, head `688a7d1a`) merged into `component/compliance-readiness` but was classified **REMEDIATE** by WORK independent review, not yet accepted — the merged version was missing the canonical `## Current known truth` / `## Intended final state` sections and had not yet incorporated Bill's decisions (which had not been recorded at merge time).
- Bill has since recorded all ten Product decisions referenced in the original "Summary — items requiring an explicit Bill decision" section as **APPROVED** (2026-08-04), per the Product Decision Record below.
- This remediation updates the existing report in place — no new Issue, no new report file, per Bill's explicit remediation instruction that this correction stay bounded to `docs/ops/reports/compliance-product-decision-register-2919.md`.
- No runtime, schema, D1, or public-copy change has been made by #2918, this register's first increment, or this remediation. #2919's own separately bounded rights/privacy evidence-control implementation increment has not yet been authorized or started.

## Intended final state

- Every F1–F7 finding and every P1 matrix row below carries an approved Product disposition (achieved by this remediation) instead of an open decision request.
- After this remediated register is merged and independently accepted, #2919 remains open for a separately recorded runtime-implementation increment that builds the #2919-owned rights/privacy evidence controls per the approved dispositions: full rights/consent capture (F4), an internal auditable takedown workflow via `/contact` (F5), administrator-controlled soft deletion with a documented SLA (F6), and the `email_opt_in` send-gate enforcement — plus verifying the live `/privacy`/`/terms` D1 state and the Production `NEXT_PUBLIC_GA_ID` state (F1/F2/F3 evidence steps that #2919 owns even though the resulting copy change belongs to #2920).
- #2920 does not begin until #2919's implementation increment is complete and independently accepted (per #2920's own Issue body and Bill's continuous-execution direction), and then implements the #2920-owned public-copy/disclosure items: the `/privacy`/`/terms` copy and proceeds-claim correction (F1/F2), the GA disclosure/consent UI (F3), the accessibility statement (F7), the auth-data enumeration on `/privacy`, and the charity-label wording change.
- This document itself reaches its final state once every item below shows an approved (not open) disposition and an unambiguous #2919/#2920 implementation owner — both are true as of this remediation.

## Product Decision Record — approved 2026-08-04

Product Authority: Bill. Decision date: 2026-08-04. Disposition: **APPROVED**. Recorded verbatim in substance from Bill's decision comment on #2919, `issuecomment-5184402502` (2026-08-04):

1. **F1/F2 — privacy, terms, and proceeds claim:** verify the live D1-composed `/privacy` and `/terms` state. Soften or remove the proceeds claim unless documentary support exists. No unsupported charitable or tax-status representation may remain.
2. **F3 — analytics:** verify the Production `NEXT_PUBLIC_GA_ID` state through an authorized read-only check. If GA is active, keep it disabled or disable it until the required disclosure and consent control are implemented and approved.
3. **F4 — rights/consent capture:** implement the full documented rights and consent fields, validation, persistence, and fail-closed behavior before broader submission promotion.
4. **F5 — takedown:** implement an auditable internal takedown workflow using the existing `/contact` intake. No dedicated public takedown route is required in this increment.
5. **F6 — deletion:** implement administrator-controlled soft deletion, retain manual request intake, and document an operational response SLA. Destructive hard deletion is not authorized.
6. **F7 — accessibility:** prepare a dedicated public accessibility statement for Product review and later #2920 implementation.
7. **Auth/member-data disclosure:** enumerate the specific member and authentication data collected in the approved privacy disclosure.
8. **`email_opt_in`:** enforce the opt-in gate for promotional or periodic-update content. Non-opted-in members may receive only a strictly transactional confirmation.
9. **Public gallery credit:** no unauthenticated public gallery may launch until credit-preference capture and publish-time credit enforcement exist.
10. **Charity relationship labeling:** replace "Partner" with neutral wording unless the specific relationship and consent are documented and confirmed.

This decision record authorizes the direction stated in each item above. It does not itself implement any code, schema, or public-copy change — that remains scoped to the separately authorized #2919 (items 3, 4, 5, 8, 9, and the evidence-verification half of items 1/2/6) and #2920 (the public-copy half of items 1/2, 3, 6, 7, and 10) implementation increments referenced throughout this document.

## Scope

Source authority: accepted #2918 report, PR #3045, merge commit `e2d5e0d70a2d20600a7f7266f8ae900c4892658f` on `component/compliance-readiness`. Every F1–F7 finding and every P0/P1 matrix row from that report is represented below. P2 rows are out of scope for this increment (per #2918: no known active claim at risk).

Ownership split used throughout:
- **#2919 (rights/privacy evidence controls)** — consent/rights/credit/provenance capture, takedown workflow, data-subject deletion/retention mechanisms, evidence-custody and audit-trail controls. Matches #2919's charter text: "provenance, permission, credit, privacy, takedown, submission, and evidence-custody controls."
- **#2920 (public disclosures and fundraiser/provider boundaries)** — public-facing copy, disclosure wording, consent-banner UI, partner/charity representation text, accessibility statement copy. Matches #2920's charter text: "approved public disclosures and fundraiser/provider boundaries."

Where an item has both an evidence/mechanism component and a public-copy component (e.g., `/privacy` and `/terms`), the split is stated explicitly per item.

## Findings F1–F7 (from #2918)

### F1 — Live-copy ambiguity (`/privacy`, `/terms`)

- **Current evidence:** Per-section D1 rendering (`title`/`lead_html`/`body_html`), each falling back to hardcoded copy independently when absent. Migration 0009 seeds only `title`/`body_html` for both pages (no `lead_html` row). Live per-section D1 state was not queried by #2918.
- **Risk / launch impact:** Cannot evaluate legal sufficiency of either page's actual rendered text without knowing which sections are live — the composed page may be a seed/fallback hybrid, not either document reviewed in isolation.
- **Decision owner:** Bill (Product), with legal review of the resulting composed text.
- **External review required:** Unknown until live state is confirmed; likely yes once the composed text is known (privacy-disclosure and charity-claim adequacy).
- **Concrete Product options:**
  1. Confirm live D1 section state first (read-only query), then route the composed text to legal/Bill review.
  2. Skip confirmation and proactively overwrite `lead_html` for both pages with reviewed copy, making the hybrid-ambiguity question moot regardless of prior seed state.
  3. Leave as-is and accept current risk pending a later review cycle.
- **Approved disposition (2026-08-04, Product Decision Record item 1):** Verify the live D1-composed state for **both `/privacy` and `/terms`** (option 1). Held current behavior remains in force until that verification and any resulting copy change are implemented — this document still makes no `/privacy` or `/terms` copy change itself.
- **#2919 vs #2920 owner:** #2919 owns confirming live D1 section state (evidence step, no copy change) in its separately authorized implementation increment. #2920 owns any resulting copy remediation, after #2919 completes.
- **Exact proposed writable paths (future, not this increment):** `docs/ops/reports/compliance-privacy-terms-live-state-2919.md` (evidence-confirmation sub-report, #2919); `migrations/00XX_privacy_terms_copy_review.sql`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` (#2920, only after Bill approves the specific resulting text).
- **Required tests/evidence:** A read-only D1 query (or authorized script) confirming which `page_content` rows/sections exist for `privacy` and `terms` slugs; screenshot or rendered-HTML capture of the current composed page for Bill's review.
- **Rollback/disable behavior:** N/A this increment (no change made). Future copy change: revert migration/page edit to restore current composed state.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04 (see Product Decision Record above, item 1). No further Bill decision is required to begin #2919's verification step.

### F2 — Unverified charitable-proceeds claim (`/terms`)

- **Current evidence:** Seeded `/terms` `body_html` (migration 0009) states proceeds go to "ALS-related charitable giving" under a "zero-profit mission." No corroborating charity/tax-status documentation exists in the repository. Live-ness of this seed row is the same open question as F1.
- **Risk / launch impact:** If live, this is an unsubstantiated public charitable/tax representation — P0, plausible legal exposure now.
- **Decision owner:** Bill (Product) — requires knowledge of the organization's actual tax/charity status, which is outside repository evidence.
- **External review required:** Yes, if the claim is kept — requires the org's actual charitable/tax-status documentation, not an AI conclusion.
- **Concrete Product options:**
  1. Retract/soften the claim to a factually supportable statement (e.g., "we encourage support of ALS-related charities" without implying a formal proceeds-distribution guarantee).
  2. Substantiate the claim with actual tax/charity-status evidence and keep it as-is or reworded to match that evidence exactly.
  3. Remove the claim entirely pending resolution.
- **Approved disposition (2026-08-04, Product Decision Record item 1):** Soften or remove the proceeds claim unless documentary charity/tax-status support exists (selects option 1 or 3 depending on whether Bill supplies substantiating documentation; option 2 — keeping the claim as-is — is foreclosed unless that documentation is produced). No unsupported charitable or tax-status representation may remain live. Bundled with F1's live-state confirmation since both concern the same seed row.
- **#2919 vs #2920 owner:** #2919 confirms live state (bundled with F1, its implementation increment). #2920 implements the softened/removed copy.
- **Exact proposed writable paths (future, not this increment):** Same as F1 — `migrations/00XX_privacy_terms_copy_review.sql`, `src/app/terms/page.tsx` (#2920).
- **Required tests/evidence:** Organization's actual charity/tax-status documentation, if Bill later chooses to substantiate rather than soften/remove the claim (external, not repository-derivable); confirmation of live seed state (shared with F1).
- **Rollback/disable behavior:** N/A this increment. Future: revert to current text if the new claim is later disputed.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04 (see Product Decision Record above, item 1: soften or remove absent documentation). If Bill later wants to substantiate and keep the original wording instead, that requires supplying the underlying documentation as a new, separate decision.

### F3 — Undisclosed analytics (conditional on `NEXT_PUBLIC_GA_ID`)

- **Current evidence:** `GoogleAnalytics.tsx` is a no-op unless `NEXT_PUBLIC_GA_ID` is set; Production's actual env configuration was not confirmed by #2918.
- **Risk / launch impact:** P0 only if the variable is set in Production; otherwise not applicable. No consent gate or `/privacy` disclosure exists today regardless.
- **Decision owner:** Bill (Product) — jurisdiction/consent-model decision once live configuration is known.
- **External review required:** Unknown until Production config is confirmed; likely yes for jurisdiction-specific consent-mechanism adequacy if GA is live.
- **Concrete Product options:**
  1. Confirm whether `NEXT_PUBLIC_GA_ID` is set in Production (evidence step, no code change).
  2. If set: add a `/privacy` disclosure only (lowest-friction remediation).
  3. If set and jurisdiction requires it: add consent-before-load gating in addition to disclosure.
  4. If set and no immediate remediation is authorized: unset the variable to disable GA until disclosure/consent is implemented (conservative default per #2784's zero-cost rule).
- **Approved disposition (2026-08-04, Product Decision Record item 2):** Verify the Production `NEXT_PUBLIC_GA_ID` state through an authorized read-only check (option 1). If GA is active, it must be kept disabled or disabled (option 4) until the required disclosure and consent control are implemented and separately approved — options 2/3 (disclosure-only or consent-gated) are not authorized to go live on their own; disabling is the interim requirement whenever GA is found active.
- **#2919 vs #2920 owner:** #2919 confirms live Production configuration (evidence step) and, if GA is found active, is authorized to disable it as the approved interim state — this remains a Production-configuration action requiring the authorized Production configuration path, not a change made by this document. #2920 owns any disclosure copy or consent-UI build that would later allow GA to be re-enabled.
- **Exact proposed writable paths (future, not this increment):** `docs/ops/reports/compliance-ga-production-state-2919.md` (evidence sub-report, #2919); `src/app/privacy/page.tsx` or a new `src/components/ConsentBanner.tsx` (#2920, once a disclosure/consent mechanism is authorized).
- **Required tests/evidence:** Confirmation of Production `NEXT_PUBLIC_GA_ID` value via the authorized Production configuration path; if a consent banner is later built, focused component/route tests.
- **Rollback/disable behavior:** Disclosure copy: revert page edit. Consent banner: feature-flag or remove component. Env var: revert to prior Production value through the authorized Production configuration path if GA is later re-enabled with an approved disclosure/consent mechanism in place.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04 (see Product Decision Record above, item 2: verify, and disable if active until disclosure/consent exists). No further Bill decision is required to begin #2919's verification step.

### F4 — Rights/consent capture gap (`/fanclub/submit`)

- **Current evidence:** The documented content model (`ownership_statement`, `permission_statement`, `credit_preference`, `consent_status`) is not implemented in the live submission form or `submission_queue` schema; the form collects no rights attestation today.
- **Risk / launch impact:** P0 — a documented, self-identified gap against the org's own required data model, not merely an external-standard gap.
- **Decision owner:** Bill (Product) — rights-capture is a protected decision.
- **External review required:** No — this is implementing the org's own already-documented model, not inventing a new legal position.
- **Concrete Product options:**
  1. Implement the documented fields (schema migration + form fields + validation) before broader submission-feature promotion.
  2. Explicitly defer and keep the submission feature limited/internal-only until implemented.
  3. Implement a minimal subset (e.g., ownership + permission only, deferring credit-preference/consent-status) as an interim step.
- **Approved disposition (2026-08-04, Product Decision Record item 3):** Implement the full documented fields (`ownership_statement`, `permission_statement`, `credit_preference`, `consent_status`), schema migration, form fields, and fail-closed validation before broader submission-feature promotion (option 1, in full — not the minimal-subset option 3).
- **#2919 vs #2920 owner:** #2919 — this is core rights/consent evidence-capture, squarely within #2919's charter, and is now approved for full implementation in #2919's next increment.
- **Exact proposed writable paths (future, not this increment):** `migrations/00XX_submission_rights_capture.sql` (add `ownership_statement`, `permission_statement`, `credit_preference`, `consent_status` to `submission_queue`); `src/app/fanclub/submit/page.tsx` (form fields); `functions/api/library/submit.ts` (validation/persistence); `tests/api/library-submit-rights-capture.test.ts` (new, focused).
- **Required tests/evidence:** Focused API/route tests proving required-field validation, persistence, and fail-closed rejection of submissions missing required rights attestations.
- **Rollback/disable behavior:** Revert migration and form/API changes; submission feature reverts to current (no rights capture) behavior, which is itself the documented gap — rollback should be paired with re-limiting the feature to internal-only use if implementation must be reverted before completion.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, full scope (see Product Decision Record above, item 3). Exact field wording/requiredness is defined by the already-documented content model (`ownership_statement`, `permission_statement`, `credit_preference`, `consent_status`); no further wording decision is pending.

### F5 — No takedown process

- **Current evidence:** No dedicated takedown page, form, or schema fields; removal handled only via `/contact` → manual email → manual admin action. Gap is self-documented in `cc-002-provenance-rights-contract-package.md` (missing `suppression_reason`, `takedown_request_source`, etc.).
- **Risk / launch impact:** P1 — should resolve before any rights-sensitive content goes public at scale.
- **Decision owner:** Bill (Product).
- **External review required:** No — implementing an already-identified internal gap.
- **Concrete Product options:**
  1. Accept manual email-based takedown as the permanent interim process (no build required).
  2. Implement the documented schema fields (`suppression_reason`, `takedown_request_source`, etc.) and an internal admin workflow, keeping the request intake at `/contact` (no new public route).
  3. Implement a dedicated public takedown-request path in addition to schema/workflow support.
- **Approved disposition (2026-08-04, Product Decision Record item 4):** Implement the documented schema fields (`suppression_reason`, `takedown_request_source`, etc.) and an internal auditable admin workflow, keeping request intake at `/contact` (option 2). No dedicated public takedown route is authorized in this increment (option 3 is not selected).
- **#2919 vs #2920 owner:** #2919 — takedown controls are explicitly named in #2919's charter, and the approved scope (internal workflow only, no new public route) stays entirely within #2919; there is no #2920 boundary item for this decision as approved.
- **Exact proposed writable paths (future, not this increment):** `migrations/00XX_takedown_fields.sql` (add fields to the relevant content/moderation table); `functions/api/admin/takedown.ts` (new, internal); `docs/how-to/website/review-content-submission.md` (process doc update).
- **Required tests/evidence:** Focused tests proving a takedown record is created with required fields, is auditable, and that content is suppressed (not deleted) pending review.
- **Rollback/disable behavior:** Revert schema/workflow changes; current manual email process remains available regardless.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, option 2 (see Product Decision Record above, item 4).

### F6 — No account-deletion self-service or documented SLA

- **Current evidence:** No self-service deletion UI/API; no `deleted_at`/soft-delete column on `members` or `join_requests`; only documented retention mechanism is the quarterly `submission_queue` purge for rejected content.
- **Risk / launch impact:** P1 — should resolve before broader launch; also affects whether `/privacy` can accurately describe a deletion process (see F1/#2920 boundary).
- **Decision owner:** Bill (Product).
- **External review required:** Unknown — depends on applicable jurisdiction(s) for data-subject deletion rights; flag for legal review if the club has EU/CA members or otherwise represents a deletion right publicly.
- **Concrete Product options:**
  1. Accept manual email-based deletion as the permanent interim process; document an internal SLA (e.g., "within 30 days") without building self-service tooling.
  2. Implement a soft-delete mechanism (`deleted_at` column, admin-triggered) reachable only via the existing manual email intake (no new public UI).
  3. Implement full self-service deletion (member-triggered, from `/fanclub/myprofile`).
- **Approved disposition (2026-08-04, Product Decision Record item 5):** Implement administrator-controlled soft deletion (`deleted_at`, admin-triggered — option 2's mechanism), retain manual email request intake, and document an internal operational response SLA (option 1's SLA element, combined with option 2's mechanism). Full member-triggered self-service deletion (option 3) is not authorized. Destructive hard deletion is explicitly not authorized under any option.
- **#2919 vs #2920 owner:** #2919 — the soft-delete mechanism and evidence-custody (audit of what was deleted/when) are evidence-control work; the internal SLA documentation is also #2919-owned (operational process doc, not public copy). Any future public-facing SLA statement is a #2920 boundary item layered on #2919's mechanism, not itself approved in this decision.
- **Exact proposed writable paths (future, not this increment):** `migrations/00XX_members_soft_delete.sql`, `migrations/00XX_join_requests_soft_delete.sql`; `functions/api/admin/delete-member.ts`; an internal SLA note in `docs/how-to/website/review-content-submission.md` or a new focused ops doc.
- **Required tests/evidence:** Focused tests proving deletion is soft (auditable, not destructive, no hard delete path), reversible within a defined window if applicable, and that a deletion request produces durable evidence.
- **Rollback/disable behavior:** Revert schema/route changes; manual email process remains the fallback regardless.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, option 2 mechanism plus option 1's documented SLA, hard deletion excluded (see Product Decision Record above, item 5). Applicable-jurisdiction confirmation for any future public deletion-rights statement remains a #2920-scope question, not a blocker to #2919's approved mechanism.

### F7 — No public accessibility statement

- **Current evidence:** No public accessibility statement or route exists; an internal WCAG AA build-standard exists (`style-guide.md`) but is not user-facing.
- **Risk / launch impact:** P1 — should resolve before broader public launch.
- **Decision owner:** Bill (Product).
- **External review required:** No — publishing an accessibility statement based on the existing internal build-standard is a copy/publication decision, not a new legal position.
- **Concrete Product options:**
  1. Publish a public accessibility statement page referencing the existing internal WCAG AA standard and the `/contact` channel for accessibility issues.
  2. Add a short accessibility-contact mention to an existing page (e.g., `/contact` or footer) without a dedicated statement page.
  3. Defer — no public statement yet.
- **Approved disposition (2026-08-04, Product Decision Record item 6):** A dedicated public accessibility statement (option 1) is approved in direction. #2919's next increment may prepare/draft the statement text (referencing the existing internal WCAG AA build-standard and the `/contact` channel) for Bill's review; publishing the live route/page is #2920's implementation, not this document's or #2919's runtime scope.
- **#2919 vs #2920 owner:** #2919 may draft the statement text for Product review as part of its evidence/decision work (no runtime publication). #2920 owns implementing and publishing the live `/accessibility` route once Bill approves the exact drafted wording — this remains entirely public-facing copy/disclosure at the implementation stage.
- **Exact proposed writable paths (future, not this increment):** `src/app/accessibility/page.tsx` (#2920, option 1 route).
- **Required tests/evidence:** None beyond standard route/render tests once #2920 implements.
- **Rollback/disable behavior:** Remove the new route/copy; no schema or data impact.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, option 1, dedicated page (see Product Decision Record above, item 6). Exact statement wording still requires Bill's review once #2919 prepares a draft.

## Additional P1 matrix rows (not already covered by F1–F7)

### Auth/member data disclosure completeness (`/join`, `/login`, `/fanclub/myprofile`)

- **Current evidence:** Screen name, name, email, `email_opt_in` collected at join; 30-day session cookie; documented in `docs/reference/design/auth-model.md`. `/privacy` currently describes collected data only in generic terms.
- **Risk / launch impact:** P1 — disclosure completeness question, not a missing control.
- **Decision owner:** Bill (Product).
- **External review required:** No.
- **Concrete Product options:** (1) Leave `/privacy`'s generic description as-is; (2) enumerate the specific fields collected (screen name, name, email, opt-in flag, session cookie) explicitly.
- **Approved disposition (2026-08-04, Product Decision Record item 7):** Enumerate the specific fields collected (screen name, name, email, opt-in flag, session cookie) explicitly on `/privacy` (option 2, not the generic option 1). Bundled with the broader F1 `/privacy` copy-review implementation.
- **#2919 vs #2920 owner:** #2920 (public disclosure copy), informed by #2919's F1 live-state confirmation.
- **Exact proposed writable paths (future):** `src/app/privacy/page.tsx` or the corresponding `page_content` migration (#2920).
- **Required tests/evidence:** None beyond the shared F1 live-state confirmation.
- **Rollback/disable behavior:** Revert copy edit.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, option 2 (see Product Decision Record above, item 7).

### `email_opt_in` send-gate

- **Current evidence:** Checkbox exists and is persisted at join, but no code path reads it as a send gate; the welcome message ("periodic updates about new content, milestones, events, and ways to support ALS charities") sends regardless of opt-in state.
- **Risk / launch impact:** P1 — consent captured but not enforced; welcome copy exceeds strictly transactional content.
- **Decision owner:** Bill (Product).
- **External review required:** No.
- **Concrete Product options:** (1) Gate the current welcome message on `email_opt_in`, sending a shorter strictly-transactional confirmation to non-opted-in members instead; (2) reword the welcome message to be strictly transactional so no gating is needed; (3) leave as-is and accept the gap.
- **Approved disposition (2026-08-04, Product Decision Record item 8):** Gate the welcome/periodic-update message on `email_opt_in` (option 1); non-opted-in members receive only a strictly transactional confirmation. Option 2 (rewriting the welcome message to be strictly transactional for everyone) and option 3 (leave as-is) are not selected.
- **#2919 vs #2920 owner:** #2919 — enforcing captured consent against a send path is a consent-evidence control, not public copy. The non-opted-in strictly-transactional confirmation's exact wording is a small #2920 boundary item (new copy) layered on #2919's gating logic.
- **Exact proposed writable paths (future):** `functions/api/join.ts` (`sendWelcomeEmail` gating logic, #2919); `functions/_lib/email.ts` (strictly-transactional template, #2919 mechanism / #2920 exact copy); `tests/api/join-email-opt-in-gate.test.ts` (new, focused).
- **Required tests/evidence:** Focused tests proving opted-out members receive only strictly-transactional content and opted-in members receive the full welcome message.
- **Rollback/disable behavior:** Revert gating logic; welcome message reverts to sending unconditionally (current behavior).
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, option 1 (see Product Decision Record above, item 8). Exact non-opted-in confirmation wording remains a small open copy item for #2920 to finalize with Bill when #2919's gating logic is ready.

### Fan Club photo/memorabilia attribution/credit display

- **Current evidence:** Authenticated member views (`useMemberSession`-gated) render `uploaded_by`/source/tags; a separate admin editorial workflow holds source/credit fields; no public (unauthenticated) credit/rights UI exists.
- **Risk / launch impact:** P1 — relevant only if/when a public (unauthenticated) gallery is launched; current member-gated display is not itself a gap.
- **Decision owner:** Bill (Product).
- **External review required:** No.
- **Concrete Product options:** (1) Confirm no public gallery is planned near-term — no action needed; (2) if a public gallery is planned, require a visible credit line enforced at publish time before that launch.
- **Approved disposition (2026-08-04, Product Decision Record item 9):** No unauthenticated public gallery may launch until credit-preference capture (F4) and publish-time credit enforcement both exist. This is a hard launch gate, not merely advisory (option 2's substance, made mandatory rather than conditional). Current member-gated display is unaffected and requires no change.
- **#2919 vs #2920 owner:** #2919 owns credit-preference capture/enforcement (already covered under F4's approved full-scope implementation); #2920 owns any new public-facing credit-line UI, and may not launch a public gallery until #2919's F4 implementation is complete and enforced at publish time.
- **Exact proposed writable paths (future):** Public gallery route + credit-line component (#2920), gated on #2919's credit-preference field existing and being enforced at publish time.
- **Required tests/evidence:** Deferred until a public gallery is authorized; the gate condition itself (credit-preference enforced at publish time) is verified as part of F4's implementation.
- **Rollback/disable behavior:** N/A — no change this increment.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04 as a hard gate (see Product Decision Record above, item 9). Whether/when a public gallery is actually planned remains open and does not block recording this gate condition.

### Fundraiser/charity campaign spotlight (dormant, already gated)

- **Current evidence:** Feature hidden by default; implementation program explicitly BLOCKED pending Bill/ChatGPT launch authorization; no tax-deductibility or 501(c) claim found anywhere; Givebutter is the external processor.
- **Risk / launch impact:** P1, dormant — correctly gated, no live exposure today.
- **Decision owner:** Bill (Product) — already exercised via the existing block.
- **External review required:** Deferred to that program's own launch review.
- **Concrete Product options:** None needed this increment — re-review belongs to the fundraiser program's own launch authorization, not #2784/#2919 closeout.
- **Disposition:** No action — already conservatively held by the existing program block. Not one of the ten items in the 2026-08-04 Product Decision Record (no decision was needed).
- **#2919 vs #2920 owner:** N/A this increment.
- **Exact proposed writable paths (future):** None (out of #2919/#2920 scope; owned by the fundraiser program's own implementation plan).
- **Required tests/evidence:** N/A.
- **Rollback/disable behavior:** N/A.
- **Explicit decision required from Bill:** None pending — noted for completeness only, per #2918's own recommendation.

### Third-party charity "Partner" labeling (`CharitySpotlight`, `CharitiesTiles`, `FriendsOfFanClub`)

- **Current evidence:** `FriendsOfFanClub.tsx` explicitly labels default entities `kind: 'Partner'` (visible "Partner" badge) with descriptive blurbs (e.g., "Supporting ALS awareness and impact through community action") — an affirmative partnership/support representation, not a neutral outbound link. No on-site donation processing.
- **Risk / launch impact:** P1 — representational accuracy risk if named entities have not agreed to the "Partner" label or blurb wording.
- **Decision owner:** Bill (Product).
- **External review required:** No legal review required to change wording; confirming each named entity's actual relationship/consent is a Product/relationship-management task, not a legal one.
- **Concrete Product options:** (1) Confirm each named entity's actual relationship and consent to the "Partner" label/blurb, keeping current wording if confirmed; (2) soften to a neutral label (e.g., "Resources" or "Related organizations") pending confirmation; (3) remove entities whose relationship cannot be confirmed.
- **Approved disposition (2026-08-04, Product Decision Record item 10):** Replace "Partner" with neutral wording (option 2) unless the specific relationship and consent for a given named entity are documented and confirmed — confirmed entities may keep the "Partner" label (option 1's outcome, but only where evidenced); unconfirmed entities default to neutral wording rather than removal (option 3 is not the default).
- **#2919 vs #2920 owner:** #2920 — this is public representation/copy, not an evidence-control mechanism.
- **Exact proposed writable paths (future):** `src/components/FriendsOfFanClub.tsx`, `src/components/CharitySpotlight.tsx`, `src/components/CharitiesTiles.tsx` (#2920).
- **Required tests/evidence:** Confirmation (external to this repository) of each named entity's actual relationship/consent, tracked per entity before #2920 restores "Partner" wording for any of them.
- **Rollback/disable behavior:** Revert label/blurb wording to current text.
- **Explicit decision required from Bill:** Recorded — APPROVED 2026-08-04, neutral-by-default unless confirmed (see Product Decision Record above, item 10). Per-entity relationship/consent confirmation remains open and is tracked by #2920 at implementation time.

## Summary — approved dispositions and implementation ownership (2026-08-04)

| # | Item | Approved disposition | Next-step owner |
| --- | --- | --- | --- |
| 1 | F1/F2 — `/privacy`/`/terms` live state and proceeds claim | Verify live D1 state; soften/remove the proceeds claim absent documentation | #2919 (verify) → #2920 (copy) |
| 2 | F3 — Production analytics | Verify `NEXT_PUBLIC_GA_ID`; keep/disable until disclosure+consent exist | #2919 (verify/disable) → #2920 (disclosure/consent UI) |
| 3 | F4 — rights/consent capture | Full documented fields, validation, fail-closed persistence | #2919 |
| 4 | F5 — takedown | Internal auditable workflow via existing `/contact` intake; no new public route | #2919 |
| 5 | F6 — deletion | Admin-controlled soft deletion + documented SLA; no hard delete, no self-service | #2919 |
| 6 | F7 — accessibility statement | Dedicated public page; #2919 may draft text for review | #2919 (draft) → #2920 (publish) |
| 7 | Auth/member-data disclosure | Enumerate specific collected fields on `/privacy` | #2920 |
| 8 | `email_opt_in` | Gate welcome/update message; non-opted-in get transactional-only confirmation | #2919 (gate) → #2920 (exact copy) |
| 9 | Public gallery credit | Hard launch gate: no public gallery until credit capture+enforcement exist | #2919 (F4) gates #2920 |
| 10 | Charity "Partner" labeling | Neutral wording by default; "Partner" only where relationship/consent confirmed | #2920 |

Every item above is **approved in direction** by Bill (2026-08-04, Product Decision Record). No item is implemented, disabled, or publicly changed by this document — approval authorizes the separately bounded #2919 and #2920 implementation increments referenced in the "Next-step owner" column; it does not substitute for them.

## Remaining task boundary

This remediated register does not itself implement anything and does not complete #2919. Runtime implementation of the #2919-owned approved rights/privacy evidence controls (F4, F5, F6, the `email_opt_in` gate, the F1/F2/F3 verification steps, and the F7 draft) requires a separately recorded second bounded assignment — not yet authorized or started — after this remediated register is independently accepted. Public-copy and disclosure implementation (F1/F2 copy, F3's disclosure/consent UI, F7's publication, auth-data enumeration, and charity-label wording) is out of #2919's runtime scope entirely and belongs to #2920, which per its own Issue body and Bill's continuous-execution direction does not begin until #2919's implementation increment is complete and independently accepted.

## Validation

This is a documentation-only decision-register remediation — no code, schema, or public-copy change was made.

- `bash scripts/ci/docs_check_headers.sh` — PASS (recorded at remediation PR open; canonical `Current known truth` / `Intended final state` sections now present, resolving the REMEDIATE finding).
- `node scripts/ci/diataxis_folder_audit.mjs` — PASS (recorded at remediation PR open).
- `git diff --check` — PASS (recorded at remediation PR open).
- Source verification: every finding and matrix row above is traced directly to the accepted #2918 report; the approved-decision text is traced directly to Bill's 2026-08-04 decision comment on #2919; no new repository claims were made without citation.

## Rollback

This document can be removed or revised without any other repository impact — it makes no code, schema, or public-copy change.

## Stop conditions triggered

None reached the level requiring a full stop of this remediation. F3's Production `NEXT_PUBLIC_GA_ID` confirmation and F1/F2's live-D1-state confirmation both still require read access beyond static repository survey; both remain recorded as required evidence steps for #2919's separately authorized implementation increment, not attempted here, since confirming them is outside this document's writable-file allowlist.
