# PR Summary

- **Issue:** #3340
- Intent label: intent:ci
- PR class: ci
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
- Documentation source classification: DIATAXIS_ROUTED
- Design source of truth: Issue #3340
DOC_SOURCE: DIATAXIS_ROUTED
DOC_SOURCE_FILES:
- docs/reference/ci/event-wake-bridge-3340.md
DIATAXIS_GAP:
- NONE — command fences later removed on `main` by PR #3352; current-tree DIATAXIS audit of this reference doc is PASS

## Scope

Allowed paths:
- `docs/reference/ci/event-wake-bridge-3340.md`
- `scripts/lgfc-event-wake/**`
- `tests/lgfc-event-wake.test.mjs`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Prototype a reversible non-AI Chromebook poller that detects actionable GitHub state and invokes existing identifiers-only lgfc-cursor-dispatch (dry-run / status-only by default). Documents architecture options, security boundaries, credit comparison vs the one-minute AI tick, and an Adapt (hybrid) recommendation. Rejects My Machines / public inbound webhook as the Local pager.

## Verification

Local verification:
- Command: `npx vitest run tests/lgfc-event-wake.test.mjs`
  Result: PASS (5/5 vitest)
- Command: `node scripts/lgfc-event-wake/poll.mjs --once --status-only`
  Result: PASS (candidates fetched; dry-run; elapsed ~1s; no model inference)
- Command: `node scripts/ci/diataxis_folder_audit.mjs` on current-main `docs/reference/ci/event-wake-bridge-3340.md`
  Result: PASS
  Note: the merged #3342 snapshot of this reference doc had executable fences; PR #3352 stripped those. Closeout re-validates the current tree.

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Event transport proven (outbound poller + reuse dispatch)
- [x] Idle waiting does not require Cursor model inference
- [x] Duplicate suppression unit-tested
- [x] Recommendation: Adapt hybrid (retain tick fallback)
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR
- [x] I have read all bot/advisory findings on this PR

## Rollback

Revert this PR; stop any local poller process; AI tick and label dispatch unchanged.

## Queue / dependency-map status

- dependency-map result: not-applicable
- next queue item: not-applicable
- continue/halt decision: not-applicable

## Post-merge issue disposition

Comment-only on #3340. Source issue is already closed `status:complete`. This body is for post-merge closeout replay of PR #3342 / exception #3344. Self-approval/self-merge prohibited.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3758857503 — accepted — DIATAXIS forbade executable bash/sh command fences in this reference doc; PR #3352 removed those blocks from `docs/reference/ci/event-wake-bridge-3340.md` and current-main audit is PASS — thread state: outdated
- review-comment:3758857576 — acknowledged — `--repo` missing-value hardening on the prototype poller; `lgfc-event-wake` was abandoned as an LGFC connection type under #3347 / PR #3350 and is not the live pager — thread state: outdated
- review-comment:3758857642 — acknowledged — corrupt watermark JSON should not crash the prototype loop; poller abandoned under #3347 and is not operating — thread state: outdated
- review-comment:3758857674 — acknowledged — watermark file should use 0o600; poller abandoned under #3347 and is not operating — thread state: outdated
