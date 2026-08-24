/**
 * Deterministic eligibility inventory for #3671.
 * Produces eligibility signals only; it never grants self-approval or Production authority.
 */

export const GATE_CATEGORIES = Object.freeze({
  SANDBOX: 'sandbox', DEVELOPMENT: 'development', PROMOTION_CANDIDATE: 'promotion_candidate',
  PRODUCTION: 'production', DOCUMENTATION_ONLY: 'documentation_only', REFACTORING: 'refactoring',
  BUG_FIX: 'bug_fix', SCHEMA_DATA_CHANGE: 'schema_data_change', PROTECTED_PATH: 'protected_path'
});
export const GATE_MODE = Object.freeze({ DETERMINISTIC: 'DETERMINISTIC', JUDGMENT: 'JUDGMENT' });

export const GATE_INVENTORY = Object.freeze({
  [GATE_CATEGORIES.SANDBOX]: { mode: GATE_MODE.DETERMINISTIC, rationale: 'isolated environment with no Production credentials, writes, bindings, or promotion path' },
  [GATE_CATEGORIES.DEVELOPMENT]: { mode: GATE_MODE.DETERMINISTIC, rationale: 'eligible non-main integration for a non-protected Development child under Delivery policy' },
  [GATE_CATEGORIES.DOCUMENTATION_ONLY]: { mode: GATE_MODE.DETERMINISTIC, rationale: 'no code diff; structure is machine-verifiable' },
  [GATE_CATEGORIES.BUG_FIX]: { mode: GATE_MODE.DETERMINISTIC, rationale: 'objectively provable with bounded rollback and regression evidence' },
  [GATE_CATEGORIES.REFACTORING]: { mode: GATE_MODE.JUDGMENT, rationale: 'behavior-preservation is not machine-provable in general' },
  [GATE_CATEGORIES.SCHEMA_DATA_CHANGE]: { mode: GATE_MODE.JUDGMENT, rationale: 'protected multi-step boundary; irreversible data risk' },
  [GATE_CATEGORIES.PROTECTED_PATH]: { mode: GATE_MODE.JUDGMENT, rationale: 'protected boundary by definition; never deterministic' },
  [GATE_CATEGORIES.PROMOTION_CANDIDATE]: { mode: GATE_MODE.JUDGMENT, rationale: 'qualification requires PMO/Engineering and PR Approver judgment' },
  [GATE_CATEGORIES.PRODUCTION]: { mode: GATE_MODE.JUDGMENT, rationale: 'Production Go always requires recorded Production authority; never deterministic' }
});

function allTrue(evidence, keys) {
  const missing = keys.filter((key) => evidence[key] !== true);
  return { met: missing.length === 0, missing };
}

function protectedResult(evidence) {
  if (evidence.touchesProtectedPath === true) return { met: false, missing: [], disqualifier: 'touchesProtectedPath' };
  return null;
}

const DETERMINISTIC_CRITERIA = Object.freeze({
  [GATE_CATEGORIES.SANDBOX]: (evidence) => allTrue(evidence, ['isolatedEnvironment', 'noProductionCredentials', 'noProductionWrites', 'noPromotionPath']),
  [GATE_CATEGORIES.DEVELOPMENT]: (evidence) => protectedResult(evidence) || allTrue(evidence, ['nonProtectedPath', 'componentBranchTarget', 'requiredChecksPassing']),
  [GATE_CATEGORIES.DOCUMENTATION_ONLY]: (evidence) => protectedResult(evidence) || allTrue(evidence, ['allPathsMatchDocsGlob']),
  [GATE_CATEGORIES.BUG_FIX]: (evidence) => protectedResult(evidence) || allTrue(evidence, ['singleReviewablePr', 'oneStepRollback', 'testReproducesDefectBeforeFix', 'testPassesAfterFix'])
});

export function evaluateDeterministicEligibility({ category, evidence = {} } = {}) {
  const entry = GATE_INVENTORY[category];
  if (!entry) return { eligible: false, mode: GATE_MODE.JUDGMENT, reason: `unrecognized gate category "${category}"; fails closed to judgment` };
  if (entry.mode === GATE_MODE.JUDGMENT) return { eligible: false, mode: GATE_MODE.JUDGMENT, reason: entry.rationale };

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { eligible: false, mode: GATE_MODE.JUDGMENT, reason: 'invalid evidence object; fails closed to judgment' };
  }

  const criteria = DETERMINISTIC_CRITERIA[category];
  const result = criteria ? criteria(evidence) : { met: false, missing: ['no machine-verifiable criteria defined'] };
  if (!result.met) {
    const detail = result.disqualifier ? `disqualifier ${result.disqualifier}` : `missing ${result.missing.join(', ')}`;
    return { eligible: false, mode: GATE_MODE.JUDGMENT, reason: `criteria not met, falls back to judgment: ${detail}` };
  }
  return { eligible: true, mode: GATE_MODE.DETERMINISTIC, reason: 'all machine-verifiable criteria met' };
}

export function assertNoSelfApproval({ eligible, implementerIsApprover = false } = {}) {
  const strictlyEligible = eligible === true;
  if (strictlyEligible && implementerIsApprover) {
    return { permitted: false, reason: 'deterministic eligibility does not grant self-approval; independent review/approval role required' };
  }
  return {
    permitted: strictlyEligible,
    reason: strictlyEligible ? 'deterministic eligibility granted to a distinct approving role' : 'not eligible'
  };
}
