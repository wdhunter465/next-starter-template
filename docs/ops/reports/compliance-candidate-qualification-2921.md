---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #2921 compliance-candidate qualification evidence for Project #2784 — requirement-to-evidence trace, route/control test matrix results, rollback/safe-disable notes, Product acceptance prep, and Production-verification hold list
Does Not Own: Runtime/schema/public-copy changes, Production/D1 mutation, legal conclusions, Component→Production promotion, or Production configuration changes
Canonical Reference: /docs/ops/reports/compliance-product-decision-register-2919.md
Related Issues: #2784, #2918, #2919, #2920, #2921
Last Reviewed: 2026-08-12
---

# Compliance Candidate Qualification — #2784-004 (#2921)

## Purpose

Qualify the current `component/compliance-readiness` tip as the compliance candidate for Project #2784 by tracing #2918–#2920 requirements and Bill's accepted Product dispositions to repository evidence, recording what is resolved vs still protected for Production, running the applicable route/control test matrix, and documenting rollback/safe-disable behavior and recurring-review handoff.

This document makes **no runtime, schema, D1, or public-copy change**. It does **not** authorize Component → Production promotion.

## Scope

In scope: documentation requalification against component tip `856dbe5cf13df48932a6bdfbaf3582ad15519401` (includes WORK-accepted #2920 final increment PR #3385), focused control tests present on that tip, and pointers to the recurring-review how-to.

Out of scope: Production merge to `main`, Cloudflare/Production credential use or env mutation, new application code, migrations, provider configuration, and treating promotion as complete.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2921 (`#2784-004`) — reopened 2026-08-12 for requalification after final #2920 land |
| Parent project | #2784 |
| Component tip (qualification baseline) | `856dbe5cf13df48932a6bdfbaf3582ad15519401` |
| Prior qualification baseline (superseded) | `176de63e7fb53af1dd5904ef942c7780244d7a4c` / tip after #3102 (`f9b3b59`) — treated GA consent and accessibility as deferred |
| Working branch | `cursor/2784-004-compliance-qualification-requal-2e48` |
| PR target | `component/compliance-readiness` |
| Executing agent | Cursor Local |
| Predecessor #2918 | CLOSED — inventory accepted (PR #3045) |
| Predecessor #2919 | CLOSED `status:complete` — register + rights/privacy controls + evidence reports |
| Predecessor #2920 | CLOSED `status:complete` — WORK ACCEPT of final PR #3385 (merge `856dbe5c`, head `2372f282`); Post-Merge Intent Verification PASS |
| Writable allowlist for this task | two docs files only (this report + recurring-review how-to) |

## Intended final state

- Every Product Decision Record item 1–10 is classified as **resolved on component**, **resolved with Production evidence**, **safely deferred/disabled pending gate**, **Product-held**, or **Production promotion / configuration required**, with evidence paths.
- Applicable control tests for implemented #2919/#2920 increments are recorded PASS on this tip.
- Rollback/safe-disable for shipped increments is explicit.
- Recurring review owner, cadence, evidence, and escalation are defined in `docs/how-to/website/compliance-recurring-review.md`.
- Independent WORK review and protected Production approval remain required before any Production claim.

## Requirement-to-evidence trace (Product Decision Record items 1–10)

| ID | Disposition (Bill APPROVED) | Component evidence | Classification for #2921 (2026-08-12) |
| --- | --- | --- | --- |
| 1 | Verify live `/privacy`/`/terms`; soften unsupported proceeds claims | Public Production HTML probes + repo composition in `docs/ops/reports/compliance-privacy-terms-live-state-2919.md` (2026-08-12). Live `/terms` shows safe fallback (no unsupported proceeds claim). Exact D1 row presence via `wrangler` remains optional hygiene; seed `/terms` body hygiene deferred (WORK ACCEPT #2920). | **Resolved with Production evidence** (user-visible); D1 row hygiene **safely deferred** |
| 2 | Verify Production GA; disclosure + consent before relying on analytics | Live Production GA ID `G-BRV48J1VE` evidenced in `docs/ops/reports/compliance-ga-production-state-2919.md`. Component: privacy analytics disclosure (`src/app/privacy/page.tsx`); path **(b)** consent in `AnalyticsConsent` + `tests/analytics-consent.test.tsx` (PR #3385). Product approved default-denied Accept-before-gtag; retain `NEXT_PUBLIC_GA_ID`. | **Resolved on component** (disclosure + consent). **Production promotion required** — Production still serves pre-consent GA until component tip is promoted |
| 3 | Full rights/consent capture + fail-closed | Migration `0045_rights_privacy_evidence_controls.sql`; `tests/api/library-submit-rights-capture.test.ts` | **Resolved on component** (#2919) |
| 4 | Auditable internal takedown via `/contact` intake | Admin suppress API + `docs/how-to/website/takedown-soft-delete-and-recovery.md` | **Resolved on component** (#2919) |
| 5 | Admin soft delete + SLA; no hard delete | `tests/api/admin-member-soft-delete.test.ts`; takedown/soft-delete how-to (SLA 5 business days ack / 30 days action) | **Resolved on component** (#2919) |
| 6 | Dedicated accessibility statement (draft → Bill wording → publish) | Product approved wording as written 2026-08-12; published on component at `/accessibility` (`src/app/accessibility/page.tsx`); footer + `PUBLIC_SITEMAP_ROUTES` (PR #3385) | **Resolved on component** (#2920) |
| 7 | Enumerate auth/member fields on `/privacy` | Component privacy fallback enumerates Join/Login/Ask/session/library fields (`src/app/privacy/page.tsx`, PR #3377). Live Production probe also shows detailed enumeration. | **Resolved on component** and **resolved with Production evidence** |
| 8 | Enforce `email_opt_in` promotional gate | `tests/api/join-email-opt-in-gate.test.ts` | **Resolved on component** (#2919) |
| 9 | No unauthenticated public gallery until credit-preference + publish-time credit enforcement | Per #2919 package — gallery launch remains fail-closed / not promoted without those controls | **Safely deferred / launch-blocked** until gallery promotion package proves credit controls |
| 10 | Replace unconfirmed charity "Partner" labeling with neutral wording | `src/components/FriendsOfFanClub.tsx` defaults use `kind: 'Friend'`; PR #3089 MERGED; WORK accepted | **Resolved on component** (#2920 increment 1) |

### Launch-blocker summary

| Blocker | Status |
| --- | --- |
| Rights/consent capture fail-closed | Resolved on component |
| Takedown + soft-delete + SLA docs | Resolved on component |
| Email opt-in send gate | Resolved on component |
| Unconfirmed Partner labeling | Resolved on component (defaults) |
| Auth field enumeration on `/privacy` | Resolved on component (+ Production evidence) |
| Analytics disclosure + default-denied consent | Resolved on component (PR #3377 / #3385) |
| Accessibility statement publication | Resolved on component (PR #3385) |
| Live user-visible `/privacy`/`/terms` composition | Resolved with Production public probes (2026-08-12) |
| Component tip promoted to Production (consent gate live) | **Unresolved** — promotion separately protected |
| Public gallery without credit controls | Remains launch-blocked / not promoted |
| Optional D1 `/terms` seed-row hygiene | Deferred; not required for component acceptance |

**Product Authority must still explicitly authorize** Component → Production promotion. Until then, Production continues to serve pre-consent GA load.

## Route / control test matrix

Recorded on working tree at requalification tip `856dbe5c` (2026-08-12, Cursor Local):

| Control | Command / surface | Result |
| --- | --- | --- |
| Rights capture fail-closed | `npx vitest run tests/api/library-submit-rights-capture.test.ts` | **PASS** (6 tests) |
| Email opt-in send gate | `npx vitest run tests/api/join-email-opt-in-gate.test.ts` | **PASS** (3 tests) |
| Member soft-delete | `npx vitest run tests/api/admin-member-soft-delete.test.ts` | **PASS** (5 tests) |
| Friends labeling / render | `npx vitest run tests/friends-of-fanclub.test.tsx` | **PASS** (2 tests) |
| Analytics consent (path b) | `npx vitest run tests/analytics-consent.test.tsx` | **PASS** (3 tests) |
| Public routes include `/accessibility` | `npx vitest run tests/public-route-navigation-validation.test.ts` | **PASS** (7 tests) |
| Focused matrix aggregate | six files above | **26/26 PASS** |

Full-suite commands required by the issue package (`npx vitest run`, `npm run typecheck`, `npm run verify:invariants`, docs header/diataxis checks) are re-run before PR open and recorded in the PR Verification section. They do not mutate Production.

Public route smoke against live Production after promotion remains operator/Production-verification work and is not claimed by this docs package.

## Rollback and safe-disable

| Shipped increment | Rollback | Safe-disable / fail-closed note |
| --- | --- | --- |
| #2919 rights/privacy controls (PR #3070 family) | Revert the component-branch PR(s) that introduced migration `0045` + related API/UI; restore prior component tip | Without the controls, submissions that required new fields fail closed or lose the new admin paths; manual email intake remains for takedown/deletion |
| #2919 / #2920 evidence reports (privacy/GA live-state docs) | Remove/revise docs only — no runtime impact | N/A |
| #2920 item 10 Partner→Friend (PR #3089) | Revert PR #3089 on `component/compliance-readiness` | Defaults revert to prior labeling; D1-backed friend rows may still carry their own `kind` values |
| #2920 privacy disclosure sync (PR #3377) | Revert PR #3377 on component | Privacy fallback / analytics disclosure reverts; Production `main` copy is separate until promotion |
| #2920 consent + accessibility (PR #3385) | Revert PR #3385 on component | Consent banner and `/accessibility` removed from component tip; Production unchanged until a promotion PR |
| GA runtime on any environment | Unset `NEXT_PUBLIC_GA_ID` via authorized env path | Scripts no-op when unset; consent gate additionally blocks until Accept when env is set |
| This #2921 docs package | Revert the single #2921 requalification component PR | No runtime impact |

No Production state is changed by #2921. Rollback profile for the task PR: **multi-step** (component PR revert).

## Product acceptance and promotion prep

Ready for independent WORK review of this requalification package when:

1. Diff contains only the two allowlisted docs files.
2. Focused control matrix above is PASS (and full package validation disclosed on the PR).
3. Remaining Production holds are listed as unresolved (this section) — not claimed complete.

**Not** ready for Production promotion until: explicit Product/Production authority for promoting `component/compliance-readiness` (so consent gate and accessibility land live), any required Production smoke after that promotion, and disposition of gallery launch-blockers if gallery is in scope.

Successor after WORK accept of #2921: parent #2784 closeout and Product acceptance — not automatic Production merge.

## Recurring review

Canonical procedure: [`docs/how-to/website/compliance-recurring-review.md`](../../how-to/website/compliance-recurring-review.md).

## Explicit non-claims

- #2921 does **not** promote the component tip to Production.
- #2921 does **not** mutate Cloudflare/Production configuration or D1.
- #2921 does **not** authorize Production merge, credential creation, or paid commitments.
- Prior #2921 qualification that treated GA consent and accessibility as deferred is **superseded** by this requalification against tip `856dbe5c`.

## Rollback of this document

Remove or revise this report without other repository impact — docs-only.
