/**
 * Automated CI failure remediation routing for #3668.
 * Converts routine deterministic CI/review failures into a bounded
 * remediation loop that returns work to the originating implementer
 * with exact failing evidence and permitted remediation scope,
 * without unnecessarily freezing the project or requiring Product
 * Authority relay. Escalates only when scope, architecture,
 * acceptance, protected boundaries, Production authority, or
 * repeated unclassifiable failure requires controlling-role judgment.
 * Pure functions only — no GitHub API side effects.
 */

export const FAILURE_CLASSES = Object.freeze({
  DETERMINISTIC_REMEDIATION: 'DETERMINISTIC_REMEDIATION',
  ADVISORY_DISPOSITION: 'ADVISORY_DISPOSITION',
  SCOPE_AUTHORITY_DEFECT: 'SCOPE_AUTHORITY_DEFECT',
  PROTECTED_BOUNDARY_DEFECT: 'PROTECTED_BOUNDARY_DEFECT',
  PRODUCTION_LIVE_FAILURE: 'PRODUCTION_LIVE_FAILURE'
});

export const ROUTING_ACTIONS = Object.freeze({
  REMEDIATE: 'REMEDIATE',
  ACKNOWLEDGE: 'ACKNOWLEDGE',
  ESCALATE: 'ESCALATE'
});

/** Repeated unclassifiable failure escalates regardless of nominal class. */
export const UNCLASSIFIABLE_ESCALATION_THRESHOLD = 3;

/**
 * @typedef {{
 *   checkName?: string,
 *   required?: boolean,
 *   advisory?: boolean,
 *   deterministic?: boolean,
 *   touchesProtectedPath?: boolean,
 *   productionOrLive?: boolean,
 *   postMerge?: boolean,
 *   scopeOrArchitectureQuestion?: boolean,
 *   repeatedUnclassifiableCount?: number,
 *   evidence?: string,
 *   permittedRemediationScope?: string
 * }} FailureEvidence
 */

/**
 * Classify a CI/review failure into one of the five deterministic
 * classes. Falls closed to SCOPE_AUTHORITY_DEFECT (controlling-role
 * judgment) when the failure cannot be classified deterministically
 * — never silently treated as routine.
 *
 * @param {FailureEvidence} evidence
 * @returns {{ class: string, reason: string }}
 */
export function classifyFailure(evidence = {}) {
  if (evidence.productionOrLive) {
    return {
      class: FAILURE_CLASSES.PRODUCTION_LIVE_FAILURE,
      reason: 'failure surfaced against Production/live verification'
    };
  }
  if (evidence.touchesProtectedPath) {
    return {
      class: FAILURE_CLASSES.PROTECTED_BOUNDARY_DEFECT,
      reason: 'failure touches a protected path/boundary'
    };
  }
  if (evidence.scopeOrArchitectureQuestion) {
    return {
      class: FAILURE_CLASSES.SCOPE_AUTHORITY_DEFECT,
      reason: 'failure requires scope/architecture/acceptance judgment'
    };
  }
  if (evidence.advisory && !evidence.required) {
    return {
      class: FAILURE_CLASSES.ADVISORY_DISPOSITION,
      reason: 'advisory-only finding on a non-required check'
    };
  }
  if (evidence.deterministic) {
    return {
      class: FAILURE_CLASSES.DETERMINISTIC_REMEDIATION,
      reason: 'machine-provable, reproducible failure'
    };
  }
  return {
    class: FAILURE_CLASSES.SCOPE_AUTHORITY_DEFECT,
    reason: 'failure could not be classified deterministically; escalate for controlling-role judgment'
  };
}

/**
 * Route a classified failure to a bounded action. Deterministic
 * failures (including post-merge deterministic failures) route back
 * to the originating implementer with exact evidence and a permitted
 * remediation scope, and may repeat fix -> retest -> review with no
 * arbitrary retry cap. Advisory findings are acknowledged without
 * blocking action. Everything else — scope/architecture questions,
 * protected-boundary defects, Production/live failures, and any
 * failure that has recurred unclassified past the threshold —
 * escalates to controlling-role judgment.
 *
 * @param {FailureEvidence} evidence
 */
export function routeFailure(evidence = {}) {
  const classification = classifyFailure(evidence);
  const repeatedUnclassifiableCount = evidence.repeatedUnclassifiableCount || 0;

  if (repeatedUnclassifiableCount >= UNCLASSIFIABLE_ESCALATION_THRESHOLD) {
    return {
      class: classification.class,
      action: ROUTING_ACTIONS.ESCALATE,
      phase: evidence.postMerge ? 'post-merge' : 'pre-merge',
      reason: `repeated unclassifiable failure (${repeatedUnclassifiableCount}x) requires controlling-role judgment`,
      evidence: evidence.evidence || null,
      permittedScope: null
    };
  }

  const phase = evidence.postMerge ? 'post-merge' : 'pre-merge';

  switch (classification.class) {
    case FAILURE_CLASSES.DETERMINISTIC_REMEDIATION:
      return {
        class: classification.class,
        action: ROUTING_ACTIONS.REMEDIATE,
        phase,
        reason: classification.reason,
        evidence: evidence.evidence || null,
        permittedScope: evidence.permittedRemediationScope || 'the failing check/file(s) only',
        retryLimit: null
      };
    case FAILURE_CLASSES.ADVISORY_DISPOSITION:
      return {
        class: classification.class,
        action: ROUTING_ACTIONS.ACKNOWLEDGE,
        phase,
        reason: classification.reason,
        evidence: evidence.evidence || null,
        permittedScope: null
      };
    case FAILURE_CLASSES.SCOPE_AUTHORITY_DEFECT:
    case FAILURE_CLASSES.PROTECTED_BOUNDARY_DEFECT:
    case FAILURE_CLASSES.PRODUCTION_LIVE_FAILURE:
    default:
      return {
        class: classification.class,
        action: ROUTING_ACTIONS.ESCALATE,
        phase,
        reason: classification.reason,
        evidence: evidence.evidence || null,
        permittedScope: null
      };
  }
}
