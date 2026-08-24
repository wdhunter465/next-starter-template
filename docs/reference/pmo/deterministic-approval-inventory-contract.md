---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Deterministic-versus-judgment gate inventory and machine-verifiable eligibility criteria for objectively safe transitions
Does Not Own: Live GitHub branch-protection configuration, Production authorization, or independent review/approval authority itself
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #3671, #3665
Last Reviewed: 2026-08-24
---

# Deterministic Approval Inventory Contract

## Purpose

Increase continuous agent throughput by extending deterministic
eligibility/approval automation only where outcomes are objectively
machine-provable, while preserving independent judgment and protected
human authority (#3671). Implemented in
`scripts/ci/deterministic-approval-inventory.mjs`.

This module produces an eligibility **signal**, not an approval action.
It does not mutate live GitHub branch protection or required-check
configuration — per `docs/governance/CI-AND-VERIFICATION.md`, "Live
GitHub branch-protection settings are operator-controlled. Repo docs
describe the expected surface; they do not mutate GitHub settings." — and
it does not grant self-approval (see `assertNoSelfApproval` below).

## Gate inventory

`GATE_INVENTORY` classifies nine categories, reconciled with
`docs/governance/CI-AND-VERIFICATION.md` ("Deterministic eligibility vs
human approval") and `docs/governance/PMO-PORTFOLIO.md` ("Sandbox
authority", "Size contract"):

| Category | Mode | Why |
| --- | --- | --- |
| Sandbox | `DETERMINISTIC` | isolated, no Production credentials/writes/bindings/promotion path |
| Development | `DETERMINISTIC` | eligible non-main integration for a non-protected child under existing Delivery policy |
| Documentation-only | `DETERMINISTIC` | no code diff; structure already machine-verified |
| Bug fix | `DETERMINISTIC` | provable when scoped to one PR with a regression test failing before and passing after the fix |
| Refactoring | `JUDGMENT` | behavior-preservation is not machine-provable in general |
| Schema/data change | `JUDGMENT` | protected multi-step boundary; irreversible data risk |
| Protected path | `JUDGMENT` | protected boundary by definition |
| Promotion Candidate | `JUDGMENT` | requires PMO/Engineering and PR Approver judgment |
| Production | `JUDGMENT` | Go always requires recorded Production authority |

`GATE_INVENTORY[category].mode` is the single source of truth. A
`JUDGMENT` category can never become eligible — `evaluateDeterministicEligibility`
returns its fixed rationale immediately and never even evaluates the
caller's evidence object for that category, so no evidence input (honest
or spoofed) can move Production, protected paths, schema/data changes,
refactoring, or Promotion Candidate qualification into deterministic
eligibility.

## Machine-verifiable criteria

Each `DETERMINISTIC` category has an explicit criteria function that
every flag must satisfy:

- **Sandbox**: `isolatedEnvironment`, `noProductionCredentials`,
  `noProductionWrites`, `noPromotionPath`.
- **Development**: `nonProtectedPath`, `componentBranchTarget`,
  `requiredChecksPassing` — and unconditionally not eligible if
  `touchesProtectedPath`.
- **Documentation-only**: `allPathsMatchDocsGlob` — and unconditionally
  not eligible if `touchesProtectedPath`.
- **Bug fix**: `singleReviewablePr`, `oneStepRollback`,
  `testReproducesDefectBeforeFix`, `testPassesAfterFix` — and
  unconditionally not eligible if `touchesProtectedPath`.

Any missing flag falls back to `JUDGMENT` with the specific missing
criteria named — never silently treated as eligible.

## No self-approval

`assertNoSelfApproval({ eligible, implementerIsApprover })` blocks the
one case this contract exists to prevent: the same actor acting as both
implementer and approver on the strength of an eligibility signal alone.
Deterministic eligibility widens *which categories* can be judged by a
distinct, non-human Deterministic CI role (already recognized in
`docs/governance/AGENT-TEAM.md`); it never widens *who* may approve their
own work.

## Non-goals

This contract does not configure live branch protection, does not
authorize Production, and does not itself perform independent review —
it only produces the eligibility evidence a downstream, human-configured
gate may choose to rely on.
