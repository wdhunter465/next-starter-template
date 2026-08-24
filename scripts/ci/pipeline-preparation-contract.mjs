/**
 * Distributed Pipeline launch-package preparation for #3672.
 * Allows more than one qualified LGFC agent-team member to prepare
 * PMO Pipeline launch packages under documented eligibility rules,
 * while preserving one active preparation claim per Pipeline parent
 * (unless bounded collaboration is explicitly requested), and while
 * keeping Project Graduation, PMO Active priority, and implementation
 * Go authority out of the preparer's reach.
 * Pure functions only — no GitHub API side effects.
 */

import { CLAIM_CLASSES, canClaim, classifyClaim } from './agent-claim-contract.mjs';
import { extractFieldValue } from './executable-child-contract.mjs';

/**
 * Launch-package fields required before a Pipeline parent may be
 * presented as Graduation Candidate (#3665's contract covers project
 * *children*; this is the analogous field set for the Pipeline
 * *parent*'s launch package).
 */
export const LAUNCH_PACKAGE_FIELDS = Object.freeze([
  { key: 'objective', labels: ['objective'] },
  { key: 'scopeNonGoals', labels: ['scope and non-goals', 'scope/non-goals', 'non-goals'] },
  { key: 'requirements', labels: ['requirements'] },
  { key: 'acceptanceCriteria', labels: ['acceptance criteria'] },
  { key: 'architectureDesign', labels: ['architecture/design', 'architecture and design'] },
  { key: 'dependencies', labels: ['dependencies'] },
  { key: 'childGraph', labels: ['child graph', 'ordered child issues', 'implementation plan'] },
  { key: 'validation', labels: ['validation'] },
  { key: 'rollback', labels: ['rollback'] },
  { key: 'stopConditions', labels: ['stop conditions'] },
  { key: 'deliveryModel', labels: ['delivery model'] },
  {
    key: 'productionDay2Boundaries',
    labels: ['production/day-2 boundaries', 'production and day-2 boundaries']
  },
  { key: 'intendedImplementationOwner', labels: ['intended implementation owner'] }
]);

function hasRealContent(value) {
  if (!value) return false;
  return /[A-Za-z0-9]/.test(value.replace(/_+/g, ''));
}

export function parseLaunchPackageFields(body) {
  const present = [];
  const missing = [];
  const values = {};

  for (const field of LAUNCH_PACKAGE_FIELDS) {
    const value = extractFieldValue(body, field.labels);
    values[field.key] = value;
    if (hasRealContent(value)) {
      present.push(field.key);
    } else {
      missing.push(field.key);
    }
  }

  return { present, missing, values };
}

/**
 * Package completeness for a launch package. A Pipeline parent may
 * only be presented as Graduation Candidate when `complete` is true.
 *
 * @param {{ body?: string }} issue
 */
export function validateLaunchPackageCompleteness(issue = {}) {
  const { present, missing, values } = parseLaunchPackageFields(issue.body || '');
  const errors = [];
  const remediation = [];

  if (missing.length) {
    errors.push(`missing required launch-package field(s): ${missing.join(', ')}`);
    remediation.push(
      `Add labeled fields for: ${missing.join(', ')} (see docs/reference/pmo/pipeline-preparation-contract.md)`
    );
  }

  return { complete: missing.length === 0, present, missing, values, errors, remediation };
}

/**
 * A Pipeline parent is ready to be presented as Graduation Candidate
 * only when its launch package is complete. Project Graduation itself
 * remains a separate, protected PMO / Engineering decision.
 *
 * @param {{ body?: string }} issue
 */
export function evaluateGraduationCandidateReadiness(issue = {}) {
  const pkg = validateLaunchPackageCompleteness(issue);
  return { readyForGraduationCandidate: pkg.complete, package: pkg };
}

/** Actions a preparation-role holder may perform without escalation. */
const PERMITTED_PREPARATION_ACTIONS = new Set([
  'draft-launch-package',
  'refine-launch-package',
  'draft-child-issues',
  'refine-child-issues'
]);

/** Actions preparation authority never grants, regardless of package state. */
const PROHIBITED_PREPARATION_ACTIONS = new Set([
  'assign-pmo-active-priority',
  'grant-project-graduation',
  'grant-implementation-go',
  'self-approve-package'
]);

/**
 * Preparation agents may draft/refine launch packages and
 * implementation child Issues, but may not assign PMO Active
 * priority, grant Project Graduation, grant implementation Go, or
 * self-approve their own package. An unrecognized action fails closed
 * (not permitted) rather than defaulting to allowed.
 *
 * @param {string} action
 */
export function assertPreparationAuthorityBoundary(action) {
  if (PROHIBITED_PREPARATION_ACTIONS.has(action)) {
    return {
      permitted: false,
      reason: `"${action}" requires PMO / Engineering authority, not Preparation-role authority`
    };
  }
  if (PERMITTED_PREPARATION_ACTIONS.has(action)) {
    return { permitted: true, reason: 'within bounded preparation authority' };
  }
  return {
    permitted: false,
    reason: `unrecognized action "${action}"; fails closed outside bounded preparation authority`
  };
}

export const PREPARATION_CLAIM_STATUS = Object.freeze({
  ALLOWED: 'ALLOWED',
  ALLOWED_BOUNDED_COLLABORATION: 'ALLOWED-BOUNDED-COLLABORATION',
  BLOCKED_DUPLICATE_CLAIM: 'BLOCKED-DUPLICATE-CLAIM',
  BLOCKED_RESERVATION: 'BLOCKED-RESERVATION',
  BLOCKED_AMBIGUOUS_CLAIM_STATE: 'BLOCKED-AMBIGUOUS-CLAIM-STATE',
  BLOCKED_INVALID_REQUEST: 'BLOCKED-INVALID-REQUEST'
});

/**
 * Evaluate whether a requesting agent may claim (or bounded-
 * collaborate on) Pipeline launch-package preparation for a Pipeline
 * parent. Preserves one active preparation claim per parent unless
 * bounded collaboration is explicitly requested, without creating
 * dual queue ownership.
 *
 * @param {{
 *   pipelineParent: { labels?: Array<string|{name?: string}> },
 *   requestingAgent: string,
 *   collaborationRequested?: boolean
 * }} input
 */
export function evaluatePreparationClaim({
  pipelineParent = {},
  requestingAgent,
  collaborationRequested = false
} = {}) {
  const claimState = classifyClaim(pipelineParent);
  const decision = canClaim({
    labels: pipelineParent.labels,
    requestingAgent,
    claimClass: claimState.class
  });

  if (decision.allowed) {
    return { status: PREPARATION_CLAIM_STATUS.ALLOWED, claimState, decision };
  }

  if (collaborationRequested && claimState.class === CLAIM_CLASSES.ACTIVE_CLAIM) {
    return {
      status: PREPARATION_CLAIM_STATUS.ALLOWED_BOUNDED_COLLABORATION,
      claimState,
      decision,
      note: 'bounded multi-agent collaboration explicitly requested; does not create dual queue ownership'
    };
  }

  // Distinguish materially different blocked reasons so callers do not
  // have to parse decision.reason/claimState themselves to choose the
  // correct remediation path.
  if (!requestingAgent) {
    return { status: PREPARATION_CLAIM_STATUS.BLOCKED_INVALID_REQUEST, claimState, decision };
  }
  if (claimState.class === CLAIM_CLASSES.ACTIVE_CLAIM) {
    return { status: PREPARATION_CLAIM_STATUS.BLOCKED_DUPLICATE_CLAIM, claimState, decision };
  }
  if (claimState.class === CLAIM_CLASSES.EXPLICIT_RESERVATION) {
    return { status: PREPARATION_CLAIM_STATUS.BLOCKED_RESERVATION, claimState, decision };
  }
  return { status: PREPARATION_CLAIM_STATUS.BLOCKED_AMBIGUOUS_CLAIM_STATE, claimState, decision };
}
