# PR Summary

- **Issue:** #2784
- Intent label: intent:feature
- PR class: release
- Size: large
- Delivery model: B-promotion
- Change mode: planned-migration
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: component-promotion
- Rollback profile: multi-step
- Implementation agent: Cursor Local
- Component branch: component/compliance-readiness
- Component master: #2784
- Promotion PR: this PR
- DOC_SOURCE: DIATAXIS_FULL
- DOC_SOURCE_FILES:
  - docs/governance/DELIVERY-AND-RELEASE.md
  - docs/how-to/operations/run-work-through-promotion-profiles.md
  - docs/how-to/agents/run-model-b.md
  - docs/ops/reports/compliance-candidate-qualification-2921.md
- DIATAXIS_GAP: NONE

## Scope

Allowed paths:
- `docs/how-to/website/compliance-recurring-review.md`
- `docs/how-to/website/takedown-soft-delete-and-recovery.md`
- `docs/ops/reports/compliance-accessibility-statement-draft-2920.md`
- `docs/ops/reports/compliance-candidate-qualification-2921.md`
- `docs/ops/reports/compliance-ga-production-state-2919.md`
- `docs/ops/reports/compliance-privacy-terms-live-state-2919.md`
- `docs/ops/reports/compliance-product-decision-register-2919.md`
- `docs/ops/reports/compliance-readiness-inventory-2918.md`
- `functions/_lib/email.ts`
- `functions/api/admin/editorial/list.ts`
- `functions/api/admin/editorial/suppress.ts`
- `functions/api/admin/member-operations/delete.ts`
- `functions/api/join.ts`
- `functions/api/library/submit.ts`
- `migrations/0045_rights_privacy_evidence_controls.sql`
- `scripts/launch-readiness/manifest.json`
- `src/app/accessibility/layout.tsx`
- `src/app/accessibility/page.tsx`
- `src/app/fanclub/submit/page.tsx`
- `src/app/layout.tsx`
- `src/app/privacy/page.tsx`
- `src/components/AnalyticsConsent.tsx`
- `src/components/Footer.tsx`
- `src/components/FriendsOfFanClub.tsx`
- `src/lib/publicSiteMetadata.ts`
- `tests/admin-editorial-archive.test.tsx`
- `tests/analytics-consent.test.tsx`
- `tests/api/admin-editorial-suppress.test.ts`
- `tests/api/admin-member-soft-delete.test.ts`
- `tests/api/join-email-opt-in-gate.test.ts`
- `tests/api/library-submit-rights-capture.test.ts`
- `tests/fanclub-operations.test.tsx`
- `tests/public-route-navigation-validation.test.ts`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Promotes the WORK-accepted #2784 Development candidate from `component/compliance-readiness` onto current `main` as a Model B Promotion Candidate. Head `14c3983f` is a main-sync merge of qualified tip `5a74abb3` with `origin/main` `9c77cfb0`. Conflict resolutions (no new features): keep current-main `/ask` FAQ consolidation and Friends static loading; take compliance Accessibility launch-readiness entries and Friend labeling.

This PR constructs the Promotion Candidate only. Independent PR Approver / Engineering review and Product acceptance / Production verification remain separately protected GitHub-native gates. This PR does not self-merge, mutate Cloudflare Production, or claim live analytics behavior.

## Verification

Local verification:
- Command: `npx vitest run tests/public-route-navigation-validation.test.ts tests/launch-readiness-manifest.test.ts tests/friends-of-fanclub.test.tsx tests/analytics-consent.test.tsx tests/api/admin-editorial-suppress.test.ts tests/api/admin-member-soft-delete.test.ts tests/api/join-email-opt-in-gate.test.ts tests/api/library-submit-rights-capture.test.ts tests/fanclub-operations.test.tsx tests/admin-editorial-archive.test.tsx`
  Result: PASS (10 files / 90 tests) on the equivalent conflict-resolved tree
- Command: `node .agents/checks/agent-governance-check.mjs .`
  Result: PASS
- Command: `bash scripts/ci/docs_check_headers.sh` (allowlisted docs)
  Result: PASS
  Note: repo-wide header-check findings on untouched files outside this allowlist were pre-existing and were not part of PR #3429 (`docs/ops/implementation-plans/issue-1075-ci-phase2-closeout-rollout.md`, `docs/ops/implementation-plans/issue-1075-ci-redesign-rollout.md`, `docs/ops/reports/pmo-dashboard-reconciliation-3100.md`).

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none expected from this diff; docs header findings above are pre-existing and out of allowlist

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below
- [x] Source issue remaining work unit 7 started: Promotion Candidate constructed from `component/compliance-readiness` onto current main
- [x] Head ref is `component/**` (delivery-profile B-promotion rule)
- [x] No new legal conclusions or public-policy copy beyond accepted #2918–#2921 work

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR
- [x] I have read all bot/advisory findings on this PR

## Queue / dependency-map status

- dependency-map result: pass
- next queue item: #2860 PROJECT: Validate and Complete Library Entries to Content Inventory Migration
- continue/halt decision: halt — this Promotion Candidate is not self-merged; successors wait on independent review and Production authority

## Post-merge issue disposition

Comment-only on #2784 after merge. Parent remains open until Product acceptance / Production verification. GitHub issue closeout occurs after merge only if WORK/Product Authority records parent closeout; this PR does not close #2784.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3779194478 — acknowledged — Copilot advisory that the credit-preference combobox test should query by accessible name; the merged submit page has a single combobox labeled "How should we credit you?", so the unnamed getByRole query is unambiguous in this merged scope — thread state: outdated
