/**
 * Machine-readable agent claim contract for #3240.
 * team:* = durable queue ownership; agent:* = active claim or explicit reservation.
 * Pure functions only — no GitHub API side effects.
 */

export const CLAIM_CLASSES = Object.freeze({
  ACTIVE_CLAIM: 'ACTIVE_CLAIM',
  EXPLICIT_RESERVATION: 'EXPLICIT_RESERVATION',
  STALE_PREASSIGNMENT: 'STALE_PREASSIGNMENT',
  AMBIGUOUS: 'AMBIGUOUS',
  NONE: 'NONE'
});

const AGENT_LABEL_RE = /^agent:/i;

/**
 * @param {string[]|undefined} labels
 * @returns {string[]}
 */
export function agentLabelsFrom(labels = []) {
  return (labels || [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter((name) => typeof name === 'string' && AGENT_LABEL_RE.test(name));
}

/**
 * Classify an open Issue's agent claim state from evidence flags.
 * Never invents STALE without explicit evidence flags.
 *
 * @param {{
 *   labels?: string[],
 *   hasRecentExecutionEvidence?: boolean,
 *   hasExplicitReservationEvidence?: boolean,
 *   hasStaleEvidence?: boolean,
 *   bodyContradictsLabel?: boolean
 * }} issue
 * @returns {{ class: string, agentLabels: string[], reason: string }}
 */
export function classifyClaim(issue = {}) {
  const agentLabels = agentLabelsFrom(issue.labels);
  if (agentLabels.length === 0) {
    return { class: CLAIM_CLASSES.NONE, agentLabels, reason: 'no agent:* label' };
  }
  if (agentLabels.length > 1) {
    return {
      class: CLAIM_CLASSES.AMBIGUOUS,
      agentLabels,
      reason: 'multiple agent:* labels; do not choose silently'
    };
  }
  if (issue.bodyContradictsLabel) {
    return {
      class: CLAIM_CLASSES.AMBIGUOUS,
      agentLabels,
      reason: 'body ownership contradicts agent:* label'
    };
  }
  if (issue.hasExplicitReservationEvidence) {
    return {
      class: CLAIM_CLASSES.EXPLICIT_RESERVATION,
      agentLabels,
      reason: 'Product Authority or controlling reservation evidence present'
    };
  }
  if (issue.hasRecentExecutionEvidence) {
    return {
      class: CLAIM_CLASSES.ACTIVE_CLAIM,
      agentLabels,
      reason: 'recent execution, remediation, or verification evidence'
    };
  }
  if (issue.hasStaleEvidence) {
    return {
      class: CLAIM_CLASSES.STALE_PREASSIGNMENT,
      agentLabels,
      reason: 'proven stale pre-assignment with no activity or reservation'
    };
  }
  return {
    class: CLAIM_CLASSES.AMBIGUOUS,
    agentLabels,
    reason: 'insufficient evidence to classify safely'
  };
}

/**
 * Whether a requesting agent may claim an Issue.
 * Collision-safe: another active/reserved claim blocks independent start.
 *
 * @param {{
 *   labels?: string[],
 *   claimClass?: string,
 *   requestingAgent: string
 * }} input
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canClaim(input = {}) {
  const requesting = String(input.requestingAgent || '')
    .trim()
    .toLowerCase()
    .replace(/^agent:/i, '');
  if (!requesting) {
    return { allowed: false, reason: 'requestingAgent required' };
  }

  const agentLabels = agentLabelsFrom(input.labels);
  const claimClass =
    input.claimClass ||
    classifyClaim({
      labels: input.labels,
      hasRecentExecutionEvidence: input.hasRecentExecutionEvidence,
      hasExplicitReservationEvidence: input.hasExplicitReservationEvidence,
      hasStaleEvidence: input.hasStaleEvidence,
      bodyContradictsLabel: input.bodyContradictsLabel
    }).class;

  if (agentLabels.length === 0 || claimClass === CLAIM_CLASSES.NONE) {
    return { allowed: true, reason: 'queue-only issue; no active claim' };
  }

  if (claimClass === CLAIM_CLASSES.STALE_PREASSIGNMENT) {
    return {
      allowed: true,
      reason: 'stale pre-assignment may be released then claimed'
    };
  }

  const owners = agentLabels.map((label) => label.replace(/^agent:/i, '').toLowerCase());
  if (owners.includes(requesting) && agentLabels.length === 1) {
    return { allowed: true, reason: 'requesting agent already holds the claim' };
  }

  if (claimClass === CLAIM_CLASSES.ACTIVE_CLAIM || claimClass === CLAIM_CLASSES.EXPLICIT_RESERVATION) {
    return {
      allowed: false,
      reason: `blocked by ${claimClass}: ${agentLabels.join(', ')}`
    };
  }

  // AMBIGUOUS: do not start independently without disposition
  return {
    allowed: false,
    reason: `blocked by AMBIGUOUS claim state: ${agentLabels.join(', ')}`
  };
}

/**
 * Whether the implementing agent should release agent:* at handoff.
 * Keep claim when remediation or post-merge duties remain.
 *
 * @param {{
 *   prReady?: boolean,
 *   retainsRemediationDuty?: boolean,
 *   retainsPostMergeDuty?: boolean
 * }} state
 * @returns {{ release: boolean, reason: string }}
 */
export function shouldReleaseAtHandoff(state = {}) {
  if (state.retainsRemediationDuty) {
    return { release: false, reason: 'bounded remediation duty remains' };
  }
  if (state.retainsPostMergeDuty) {
    return { release: false, reason: 'post-merge verification duty remains' };
  }
  if (state.prReady) {
    return { release: true, reason: 'PR-ready handoff; no residual duties' };
  }
  return { release: false, reason: 'not at PR-ready / handoff boundary' };
}
