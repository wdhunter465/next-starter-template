# PR Summary

- **Issue:** #3347
- Intent label: intent:fix
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
- docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md
DIATAXIS_GAP:
- NONE

## Scope

Allowed paths:
- `docs/reference/ci/event-wake-bridge-3340.md`
- `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Remediates post-merge validation failures on #3350: strip procedure/command blocks from the #3340 reference doc (DIATAXIS), and bump `Last Reviewed` on the dispatch-runner how-to (Copilot review-comment:3759648234).

## Verification

Local verification:
- Command: allowlist + DIATAXIS structure review (no bash fences in reference doc)
  Result: PASS
- Command: `node scripts/ci/diataxis_folder_audit.mjs` on current-main `docs/reference/ci/event-wake-bridge-3340.md`
  Result: PASS

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

Comment-only on #3347. Source issue is already closed `status:complete` (the original closeout failed on unrecognized `status:remediation`; that label is no longer present). This body is for post-merge closeout replay of PR #3352 / exception #3354. Self-approval/self-merge prohibited.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3759648234 — accepted — bumped `Last Reviewed` to 2026-08-11 on `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md` — thread state: outdated
