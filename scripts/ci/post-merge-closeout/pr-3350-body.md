# PR Summary

- **Issue:** #3347
- Intent label: intent:docs
- PR class: docs-governance
- Size: small
- Delivery model: A
- Change mode: routine-ops
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: Cursor Local
- Component branch: not-applicable
- Component master: not-applicable
- Promotion PR: not-applicable

DOC_SOURCE: DIATAXIS_ROUTED
DOC_SOURCE_FILES:
- docs/reference/ci/event-wake-bridge-3340.md
- docs/governance/standards/CURSOR-RUNTIME-ROUTING.md
- docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md
DIATAXIS_GAP:
- NONE — executable fences later removed on `main` by PR #3352; current-tree DIATAXIS audit of the reference doc is PASS

## Scope

Allowed paths:
- `docs/reference/ci/event-wake-bridge-3340.md`
- `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`
- `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Canonize Bill’s #3347 direction: abandon the #3340 event-wake / `lgfc-event-wake` poller as an LGFC connection type; keep `lgfc-cursor-dispatch` on the self-hosted runner as primary. Docs only — no runtime script deletion in this PR.

## Verification

Local verification:
- Command: markdown path allowlist review
  Result: PASS (3 files only)
- Command: `node scripts/ci/diataxis_folder_audit.mjs` on current-main `docs/reference/ci/event-wake-bridge-3340.md`
  Result: PASS
  Note: the merged #3350 snapshot of this reference doc still had forbidden structure; PR #3352 stripped command blocks and bumped `Last Reviewed` on the dispatch-runner how-to.

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR
- [x] I have read all bot/advisory findings on this PR

## Queue / dependency-map status

- dependency-map result: not-applicable
- next queue item: not-applicable
- continue/halt decision: not-applicable

## Post-merge issue disposition

Comment-only on #3347. Source issue is already closed `status:complete`. This body is for post-merge closeout replay of PR #3350 / exception #3351. Self-approval/self-merge prohibited.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3759648234 — accepted — Copilot asked to bump `Last Reviewed` on `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`; PR #3352 set it to 2026-08-11 — thread state: outdated
