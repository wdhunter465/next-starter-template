/**
 * Automated successor release and claim for #3669.
 * After verified completion of a project child, deterministically
 * advance the project graph and surface the next package-complete
 * eligible child(ren) as claimable, without routine PMO redispatch,
 * while preserving protected stops, collisions, reservations, queue
 * precedence, and agent eligibility.
 * Pure functions only — no GitHub API side effects.
 */

import { nextExecutable } from './next-executable.mjs';
import { evaluateAtomicClaim } from './claim-collision-contract.mjs';

export const CLOSEOUT_STATUS = Object.freeze({
  VERIFIED_COMPLETE: 'VERIFIED-COMPLETE',
  REVIEW_PENDING: 'REVIEW-PENDING',
  REMEDIATION_PENDING: 'REMEDIATION-PENDING',
  STALE_EVIDENCE: 'STALE-EVIDENCE',
  NOT_STARTED: 'NOT-STARTED'
});

const REQUIRED_CLOSEOUT_EVIDENCE = ['integrated', 'validated', 'reviewed', 'closeoutRecorded'];

/**
 * Evaluate whether a predecessor edge has verified completion evidence.
 * Successor evaluation only triggers on VERIFIED_COMPLETE. Superseded
 * (stale) evidence and outstanding remediation duty both fail closed
 * rather than releasing a successor on trust.
 *
 * @param {{
 *   integrated?: boolean,
 *   validated?: boolean,
 *   reviewed?: boolean,
 *   closeoutRecorded?: boolean,
 *   remediationPending?: boolean,
 *   supersededEvidence?: boolean
 * }} evidence
 */
export function evaluatePredecessorCloseout(evidence = {}) {
  if (evidence.supersededEvidence === true) {
    return {
      status: CLOSEOUT_STATUS.STALE_EVIDENCE,
      complete: false,
      reason: 'verification evidence has been superseded; re-verify before release'
    };
  }
  if (evidence.remediationPending === true) {
    return {
      status: CLOSEOUT_STATUS.REMEDIATION_PENDING,
      complete: false,
      reason: 'bounded remediation duty remains before closeout'
    };
  }

  // Only an explicit boolean true counts as evidence — a truthy
  // non-boolean (a string, an object) fails closed to "missing" rather
  // than accidentally releasing or blocking a successor.
  const missing = REQUIRED_CLOSEOUT_EVIDENCE.filter((key) => evidence[key] !== true);
  if (missing.length === REQUIRED_CLOSEOUT_EVIDENCE.length) {
    return {
      status: CLOSEOUT_STATUS.NOT_STARTED,
      complete: false,
      reason: 'no completion evidence recorded'
    };
  }
  if (missing.length) {
    return {
      status: CLOSEOUT_STATUS.REVIEW_PENDING,
      complete: false,
      reason: `awaiting: ${missing.join(', ')}`
    };
  }
  return {
    status: CLOSEOUT_STATUS.VERIFIED_COMPLETE,
    complete: true,
    reason: 'integration, validation, review, and closeout evidence all present'
  };
}

/**
 * Advance a project's dependency graph from verified predecessor
 * completion to a set of releasable (and optionally self-claimable)
 * successors.
 *
 * `completed` on each child is always derived from
 * `evaluatePredecessorCloseout(child.closeoutEvidence)` — a caller
 * cannot force a child into the graph as complete by any other means,
 * which is what guarantees a successor is never released from stale,
 * superseded, or incomplete verification evidence.
 *
 * @param {{
 *   children: Array<import('./next-executable.mjs').ChildNode & { closeoutEvidence?: object }>,
 *   activeClaims?: Array<{ id: string|number, collisionSurface?: object }>,
 *   requestingAgent?: string
 * }} input
 */
export function releaseSuccessors({ children = [], activeClaims = [], requestingAgent } = {}) {
  const closeoutById = new Map();
  const derivedChildren = children.map((child) => {
    const closeout = evaluatePredecessorCloseout(child.closeoutEvidence || {});
    closeoutById.set(child.id, closeout);
    return { ...child, completed: closeout.complete };
  });
  const byId = new Map(derivedChildren.map((c) => [c.id, c]));

  const graph = nextExecutable({ children: derivedChildren, activeClaims });

  const releasable = graph.executable.map((id) => {
    const entry = { id, closeout: closeoutById.get(id) };
    if (requestingAgent) {
      entry.claim = evaluateAtomicClaim({
        issue: byId.get(id),
        requestingAgent,
        activeClaims
      });
    }
    return entry;
  });

  return {
    status: graph.status,
    releasable,
    blocked: graph.blocked,
    deferred: graph.deferred,
    closeout: Object.fromEntries(closeoutById),
    errors: graph.errors,
    remediation: graph.remediation
  };
}
