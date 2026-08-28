# PR Summary

- **Issue:** #3671
- Intent label: intent:feature
- PR class: code
- Size: small
- Delivery model: A
- Change mode: routine-ops
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: Claude Code
- Component branch: not-applicable
- Component master: not-applicable
- Promotion PR: not-applicable

**Scope note:** this PR is deliberately an eligibility-signal library, not a live branch-protection/required-check change. Per `docs/governance/CI-AND-VERIFICATION.md`, GitHub branch protection is operator-controlled and repo docs only describe the expected surface — the same pattern `.github/queue-label-registry.json` already uses (`"status": "planning-only-no-live-mutation"`). Wiring any specific category into a live required check remains a separate, explicit operator/PMO decision.

## Scope

Allowed paths:
- `scripts/ci/deterministic-approval-inventory.mjs`
- `tests/deterministic-approval-inventory.test.mjs`
- `docs/reference/pmo/deterministic-approval-inventory-contract.md`
- `docs/governance/CI-AND-VERIFICATION.md`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Implements #3671: inventories current deterministic-versus-judgment
gates across Sandbox, Development, Promotion Candidate, Production,
documentation-only changes, refactoring, bug fixes, schema/data
changes, and protected paths, reconciled with
`docs/governance/CI-AND-VERIFICATION.md` and
`docs/governance/PMO-PORTFOLIO.md`, and defines explicit
machine-verifiable criteria for the four categories that can safely
move from manual judgment to deterministic eligibility: Sandbox,
Development, documentation-only changes, and bug fixes.

Adds `scripts/ci/deterministic-approval-inventory.mjs`:
- `GATE_INVENTORY` is the single source of truth for each category's
  mode (`DETERMINISTIC` or `JUDGMENT`).
- `evaluateDeterministicEligibility({ category, evidence })` never
  evaluates the caller's evidence for a `JUDGMENT`-mode category —
  Production, protected paths, schema/data changes, refactoring, and
  Promotion Candidate qualification cannot be forced into
  deterministic eligibility by any evidence input, honest or spoofed.
  Non-object `evidence` (null, a string, ...) fails closed instead of
  throwing. A `touchesProtectedPath` block names that disqualifier
  directly instead of unrelated fields that may already be true.
- `assertNoSelfApproval({ eligible, implementerIsApprover })` derives
  both `permitted` and `reason` from the same strict `eligible ===
  true` check, and blocks the same actor acting as both implementer
  and approver on the strength of an eligibility signal alone.

Adds `docs/reference/pmo/deterministic-approval-inventory-contract.md`
and a `Related Issues: #3671` cross-reference and inline pointer on
`docs/governance/CI-AND-VERIFICATION.md`.

**Branch history note:** this branch was rebased cleanly onto current
`main` (which now contains the merged #3665/#3668 predecessors) so
the diff is limited to exactly the four #3671 paths above.

## Verification

Local verification on the rebased head:
- Command: `npx vitest run tests/deterministic-approval-inventory.test.mjs`
  Result: PASS (16/16)
- Command: `npx vitest run`
  Result: PASS (147 files, 1622 tests)
- Command: `npx eslint scripts/ci/deterministic-approval-inventory.mjs tests/deterministic-approval-inventory.test.mjs`
  Result: PASS (no findings)
- Command: `node scripts/ci/diataxis_folder_audit.mjs`
  Result: PASS (no DIATAXIS folder hygiene defects detected)

CI verification:
- Current-head required checks must be green before merge.

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

Acceptance criteria mapping (#3671):
- Current gate inventory clearly separates machine-provable checks from judgment/protected decisions → `GATE_INVENTORY` table with rationale per category.
- Safe candidates for additional deterministic handling are implemented with explicit criteria and evidence → `DETERMINISTIC_CRITERIA` per category, returned with named missing evidence on failure.
- Implementers cannot self-approve protected or subjective work → `assertNoSelfApproval`; JUDGMENT categories are evidence-immune.
- Production Go remains protected under recorded authority → `PRODUCTION` category hard-coded `JUDGMENT`, tested against spoofed all-true evidence.
- Tests prove deterministic transitions fail closed when criteria are incomplete or ambiguous → incomplete-criteria, non-object-evidence, and unrecognized-category tests.

## Reviewer / Bot Review Attestation

- [x] All human review threads have been read and dispositioned.
- [x] All bot/advisory findings have been read and dispositioned.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3844485858 — accepted — a `touchesProtectedPath` block now reports that disqualifier explicitly instead of unrelated fields — thread state: resolved
- review-comment:3844485922 — accepted — non-object `evidence` (null, a string, an array) now fails closed instead of throwing — thread state: resolved
- review-comment:3844485969 — accepted — `assertNoSelfApproval` now derives `permitted` and `reason` from the same strict boolean check — thread state: resolved
- review-comment:5009029524 — accepted — Copilot's review submission summarized the three findings above; all three were corrected on the originating PR and are fully dispositioned here. — thread state: outdated

## Rollback

Rollback and post-merge smoke evidence are recorded on source Issue #3671. Revert the #3681 merge commit if post-merge validation identifies a material regression.

## POST-MERGE RECORD CORRECTION

- 2026-08-28 — corrected `Implementation agent` from `not-applicable` to `Claude Code` to match this Issue's explicit Claude assignment and the `claude/3671-deterministic-approval-expansion` branch. No implementation files changed; this is a lifecycle-record-only correction per `docs/ops/as-built/post-merge-originating-agent-remediation-3069.md`. See #3671 comment history for the originating-agent determination.
