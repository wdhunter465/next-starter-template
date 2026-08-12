---
Doc Type: How-To
Audience: Bill, Product Authority, WORK (ChatGPT), Cursor, Claude Code, LGFC operators and maintainers
Authority Level: Operational Procedure
Owns: Recurring compliance review ownership, cadence, evidence checklist, and escalation for Project #2784 / candidate tip on `component/compliance-readiness`
Does Not Own: Runtime implementation, Production mutation, legal conclusions, Component→Production promotion, or replacing one-off task PRs (#2918–#2921)
Canonical Reference: /docs/ops/reports/compliance-candidate-qualification-2921.md
Related Issues: #2784, #2918, #2919, #2920, #2921
Last Reviewed: 2026-08-12
---

# Run Recurring Compliance Review

## Purpose

Establish who owns ongoing compliance review for the Lou Gehrig Fan Club public/member surfaces, how often review runs, what evidence to collect, and how to escalate protected gaps (especially Component → Production promotion and live Production smoke after promotion).

## Scope

Covers recurring review against the compliance candidate on `component/compliance-readiness` and any later Production tip that inherits those controls. Does not authorize Production configuration changes, Cloudflare credential creation, or Component → Production promotion without explicit Product/Production authority.

## Current known truth

- Inventory and Product decisions: #2918 / #2919 register (accepted).
- Rights/privacy evidence controls and soft-delete/takedown procedures: shipped on component via #2919; operator how-to at `docs/how-to/website/takedown-soft-delete-and-recovery.md`.
- Charity labeling first increment: #2920 PR #3089 (neutral "Friend" defaults).
- Privacy disclosure + auth enumeration sync: #2920 PR #3377.
- Analytics consent path (b) + public `/accessibility`: #2920 PR #3385 (WORK ACCEPT; #2920 CLOSED `status:complete`).
- Live Production user-visible `/privacy`/`/terms` and GA presence evidenced 2026-08-12 via public probes (see live-state reports). Production still serves pre-consent GA until the component tip is promoted.
- Qualification evidence: `docs/ops/reports/compliance-candidate-qualification-2921.md` (requalified 2026-08-12 against tip `856dbe5c`).

## Roles

| Role | Owner | Responsibility |
| --- | --- | --- |
| Product Authority | Bill | Accept or defer launch blockers; authorize Production-facing promotion and protected configuration |
| WORK / independent review | ChatGPT (WORK) | Independent review of qualification and child PRs; WORK must not independently verify or accept work that WORK itself implemented |
| Implementation / Operations | Cursor Local (default); Claude when labeled | Bounded code/docs packages only; no self-merge to Production |
| Production operator | Bill or designated operator with CF access | Live D1/Pages reads; Production env disable/enable and promotion when authorized |

## Steps

1. Confirm the tip SHA under review and which #2919 / #2920 increments it includes (expect PR #3089, #3377, and #3385 on current candidate).
2. Run the focused control tests listed in Evidence checklist (or equivalent CI jobs).
3. Spot-check public routes in the authorized target environment (`/privacy`, `/terms`, `/join`, `/contact`, `/accessibility`).
4. Confirm takedown/soft-delete SLA docs still match ops practice.
5. Record promotion and Production holds (component tip on Production? consent gate live in Production? optional D1 seed hygiene?).
6. Cite or update the latest qualification report; open follow-up Issues for new gaps.
7. Escalate per the Escalation table when a protected gate is unknown or conflicted.

## Cadence

| Review | Cadence | Trigger |
| --- | --- | --- |
| Control regression smoke | Before each compliance-related component PR merge and after merge to `component/compliance-readiness` | PR open / post-merge |
| Protected Production verification | When CF auth is available, and at least once before any Production promotion of #2784; again after promotion | Gate clearance or promotion prep / post-promotion |
| Full recurring compliance review | **Quarterly**, or immediately after material public-copy / auth / analytics / rights changes | Calendar or change-driven |
| Emergency review | Within **2 business days** of a rights, privacy, or charitable-claim incident | Incident / external complaint |

## Evidence checklist (each full review)

1. Confirm tip SHA under review and whether it includes #2919 controls + #2920 increments (item 10, privacy disclosure, consent, accessibility).
2. Re-run focused control tests (or CI equivalents):
   - `tests/api/library-submit-rights-capture.test.ts`
   - `tests/api/join-email-opt-in-gate.test.ts`
   - `tests/api/admin-member-soft-delete.test.ts`
   - `tests/friends-of-fanclub.test.tsx`
   - `tests/analytics-consent.test.tsx`
   - `tests/public-route-navigation-validation.test.ts` (includes `/accessibility`)
3. Spot-check public routes in the target environment (component preview and/or Production when authorized): `/privacy`, `/terms`, `/join`, `/contact`, `/accessibility`.
4. Confirm takedown/soft-delete SLA procedure still matches ops practice (`docs/how-to/website/takedown-soft-delete-and-recovery.md`).
5. Record status of remaining protected / promotion items:
   - Component → Production promotion status for the consent gate and `/accessibility`
   - Live Production behavior of GA (pre-consent vs Accept-before-gtag after promotion)
   - Optional D1 `/terms` seed-row hygiene (deferred; only if D1 rows are edited)
   - Public gallery credit-control launch blockers (if gallery is in scope)
6. Update or cite the latest qualification report (`docs/ops/reports/compliance-candidate-qualification-2921.md` or successor).
7. File follow-up Issues for any new gap; do not expand an in-flight PR allowlist.

## Escalation

| Condition | Action |
| --- | --- |
| Missing accepted Product decision for a public claim | Stop; open/route to Product Authority — do not invent copy |
| Production promotion requested without Product/Production GO | **HOLD** — do not promote |
| Consent gate present on component but Production still loads GA pre-consent | Expected until promotion; escalate only if a Production-ready claim is made without promotion evidence |
| Control test regression | Block merge; Implementation remediates under a new bounded Issue/PR |
| Suspected credential or private-data exposure | Stop; escalate to Bill/WORK; no further mutation |
| Authority conflict between agents | Stop; WORK/PMO reconciles — prompts do not override `Agent.md` chain |

## Safe-disable reminders

- GA: component loads analytics only when `NEXT_PUBLIC_GA_ID` is set **and** the visitor has Accepted (`AnalyticsConsent`); Decline keeps GA off. Production disable remains an authorized env change (unset `NEXT_PUBLIC_GA_ID`), not a docs edit.
- Rights capture and opt-in gates: fail closed when required fields/gates are unmet — do not bypass in Production for convenience.
- Takedown/soft-delete: prefer suppress/soft-delete; hard delete remains unauthorized.
- Charity labeling: prefer documented relationship/consent before any non-neutral label.
- Accessibility statement: do not strengthen wording into a certification or full WCAG guarantee without a separate Product decision.

## Related documents

- `docs/ops/reports/compliance-candidate-qualification-2921.md`
- `docs/ops/reports/compliance-product-decision-register-2919.md`
- `docs/ops/reports/compliance-readiness-inventory-2918.md`
- `docs/ops/reports/compliance-privacy-terms-live-state-2919.md`
- `docs/ops/reports/compliance-ga-production-state-2919.md`
- `docs/ops/reports/compliance-accessibility-statement-draft-2920.md`
- `docs/how-to/website/takedown-soft-delete-and-recovery.md`
- `docs/how-to/website/website-production-smoke-test.md`
