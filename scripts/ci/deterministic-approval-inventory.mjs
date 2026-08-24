/**
 * Deterministic approval expansion for #3671.
 * Inventories current deterministic-versus-judgment gates across
 * Sandbox, Development, Promotion Candidate, Production,
 * documentation-only changes, refactoring, bug fixes, schema/data
 * changes, and protected paths, and defines explicit
 * machine-verifiable criteria for the categories that may safely move
 * from manual judgment to deterministic eligibility.
 *
 * This module produces an eligibility SIGNAL only. It does not grant
 * self-approval, does not mutate live GitHub branch protection (which
 * remains operator-controlled per docs/governance/CI-AND-VERIFICATION.md
 * — repo docs describe the expected surface, they do not mutate GitHub
 * settings), and — structurally, not by convention — can never return
 * eligible for Production, protected paths, schema/data changes,
 * refactoring, or Promotion Candidate qualification: those categories
 * are hard-coded JUDGMENT and no evidence input can move them.
 * Pure functions only — no GitHub API side effects.
 */

export const GATE_CATEGORIES = Object.freeze({
  SANDBOX: 'sandbox',
  DEVELOPMENT: 'development',
  PROMOTION_CANDIDATE: 'promotion_candidate',
  PRODUCTION: 'production',
  DOCUMENTATION_ONLY: 'documentation_only',
  REFACTORING: 'refactoring',
  BUG_FIX: 'bug_fix',
  SCHEMA_DATA_CHANGE: 'schema_data_change',
  PROTECTED_PATH: 'protected_path'
});

export const GATE_MODE = Object.freeze({
  DETERMINISTIC: 'DETERMINISTIC',
  JUDGMENT: 'JUDGMENT'
});

/**
 * Canonical gate inventory, reconciled with
 * docs/governance/CI-AND-VERIFICATION.md ("Deterministic eligibility
 * vs human approval") and docs/governance/PMO-PORTFOLIO.md ("Sandbox
 * authority", "Size contract"). A category's `mode` here is the
 * single source of truth: JUDGMENT categories can never be forced
 * into deterministic eligibility, regardless of evidence supplied to
 * evaluateDeterministicEligibility.
 */
export const GATE_INVENTORY = Object.freeze({
  [GATE_CATEGORIES.SANDBOX]: {
    mode: GATE_MODE.DETERMINISTIC,
    rationale:
      'isolated environment, no Production credentials/writes/bindings/promotion path (docs/governance/PMO-PORTFOLIO.md § Sandbox authority)'
  },
  [GATE_CATEGORIES.DEVELOPMENT]: {
    mode: GATE_MODE.DETERMINISTIC,
    rationale:
      'eligible non-main integration for a non-protected Development child under Delivery policy (docs/governance/CI-AND-VERIFICATION.md § Deterministic eligibility vs human approval)'
  },
  [GATE_CATEGORIES.DOCUMENTATION_ONLY]: {
    mode: GATE_MODE.DETERMINISTIC,
    rationale: 'no code diff; structure is already machine-verified (scripts/ci/diataxis_folder_audit.mjs)'
  },
  [GATE_CATEGORIES.BUG_FIX]: {
    mode: GATE_MODE.DETERMINISTIC,
    rationale:
      'objectively provable when scoped to one reviewable PR with a regression test that fails before and passes after the fix'
  },
  [GATE_CATEGORIES.REFACTORING]: {
    mode: GATE_MODE.JUDGMENT,
    rationale: 'behavior-preservation is not machine-provable in general'
  },
  [GATE_CATEGORIES.SCHEMA_DATA_CHANGE]: {
    mode: GATE_MODE.JUDGMENT,
    rationale: 'protected multi-step boundary; irreversible data risk'
  },
  [GATE_CATEGORIES.PROTECTED_PATH]: {
    mode: GATE_MODE.JUDGMENT,
    rationale: 'protected boundary by definition; never deterministic'
  },
  [GATE_CATEGORIES.PROMOTION_CANDIDATE]: {
    mode: GATE_MODE.JUDGMENT,
    rationale: 'qualification requires PMO/Engineering and PR Approver judgment'
  },
  [GATE_CATEGORIES.PRODUCTION]: {
    mode: GATE_MODE.JUDGMENT,
    rationale: 'Production Go always requires recorded Production authority; never deterministic'
  }
});

function allTrue(evidence, keys) {
  const missing = keys.filter((key) => evidence[key] !== true);
  return { met: missing.length === 0, missing };
}

/** Machine-verifiable criteria for each DETERMINISTIC category. */
const DETERMINISTIC_CRITERIA = Object.freeze({
  [GATE_CATEGORIES.SANDBOX]: (evidence) =>
    allTrue(evidence, [
      'isolatedEnvironment',
      'noProductionCredentials',
      'noProductionWrites',
      'noPromotionPath'
    ]),
  [GATE_CATEGORIES.DEVELOPMENT]: (evidence) => {
    if (evidence.touchesProtectedPath) {
      return { met: false, missing: ['nonProtectedPath'] };
    }
    return allTrue(evidence, ['nonProtectedPath', 'componentBranchTarget', 'requiredChecksPassing']);
  },
  [GATE_CATEGORIES.DOCUMENTATION_ONLY]: (evidence) => {
    if (evidence.touchesProtectedPath) {
      return { met: false, missing: ['allPathsMatchDocsGlob'] };
    }
    return allTrue(evidence, ['allPathsMatchDocsGlob']);
  },
  [GATE_CATEGORIES.BUG_FIX]: (evidence) => {
    if (evidence.touchesProtectedPath) {
      return { met: false, missing: ['singleReviewablePr'] };
    }
    return allTrue(evidence, [
      'singleReviewablePr',
      'oneStepRollback',
      'testReproducesDefectBeforeFix',
      'testPassesAfterFix'
    ]);
  }
});

/**
 * Evaluate whether a change is eligible for deterministic approval
 * under this contract. Falls closed to JUDGMENT on an unrecognized
 * category, on a JUDGMENT-mode category (regardless of evidence — the
 * evidence object is never even consulted for those categories), and
 * on any DETERMINISTIC-mode category whose machine-verifiable
 * criteria are not all met.
 *
 * @param {{ category: string, evidence?: Record<string, boolean> }} input
 */
export function evaluateDeterministicEligibility({ category, evidence = {} } = {}) {
  const entry = GATE_INVENTORY[category];
  if (!entry) {
    return {
      eligible: false,
      mode: GATE_MODE.JUDGMENT,
      reason: `unrecognized gate category "${category}"; fails closed to judgment`
    };
  }

  if (entry.mode === GATE_MODE.JUDGMENT) {
    return { eligible: false, mode: GATE_MODE.JUDGMENT, reason: entry.rationale };
  }

  const criteria = DETERMINISTIC_CRITERIA[category];
  const result = criteria ? criteria(evidence) : { met: false, missing: ['no machine-verifiable criteria defined'] };

  if (!result.met) {
    return {
      eligible: false,
      mode: GATE_MODE.JUDGMENT,
      reason: `criteria not met, falls back to judgment: missing ${result.missing.join(', ')}`
    };
  }

  return { eligible: true, mode: GATE_MODE.DETERMINISTIC, reason: 'all machine-verifiable criteria met' };
}

/**
 * Deterministic eligibility is an evidence signal, never a grant of
 * self-approval. This guard blocks the specific case this contract
 * exists to prevent: the same actor acting as both implementer and
 * approver on the strength of an eligibility signal alone.
 *
 * @param {{ eligible: boolean, implementerIsApprover?: boolean }} input
 */
export function assertNoSelfApproval({ eligible, implementerIsApprover = false } = {}) {
  if (eligible && implementerIsApprover) {
    return {
      permitted: false,
      reason: 'deterministic eligibility does not grant self-approval; independent review/approval role required'
    };
  }
  return {
    permitted: eligible === true,
    reason: eligible ? 'deterministic eligibility granted to a distinct approving role' : 'not eligible'
  };
}
