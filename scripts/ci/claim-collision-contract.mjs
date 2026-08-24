/**
 * Atomic claim and collision detection for #3667.
 * Extends the team-vs-agent claim lifecycle (#3240,
 * agent-claim-contract.mjs) and the executable child contract (#3665,
 * executable-child-contract.mjs) with deterministic collision
 * evaluation before claim/start, so duplicate starts and unsafe
 * parallel execution are prevented while independent work stays
 * maximally collision-safe concurrent. No arbitrary global WIP cap is
 * imposed — only demonstrably shared resources block a claim.
 * Pure functions only — no GitHub API side effects.
 */

import { canClaim, classifyClaim } from './agent-claim-contract.mjs';
import {
  CONTRACT_STATUS,
  evaluateExecutableChildContract
} from './executable-child-contract.mjs';

export const COLLISION_CLASSES = Object.freeze({
  SAFE_PARALLEL: 'SAFE_PARALLEL',
  SERIAL_DEPENDENCY: 'SERIAL_DEPENDENCY',
  COLLISION: 'COLLISION'
});

export const CLAIM_ELIGIBILITY_STATUS = Object.freeze({
  BLOCKED_INVALID_QUEUE_STATE: `BLOCKED-${CONTRACT_STATUS.INVALID_QUEUE_STATE}`,
  BLOCKED_LIFECYCLE_CONTRADICTION: `BLOCKED-${CONTRACT_STATUS.LIFECYCLE_CONTRADICTION}`,
  BLOCKED_PACKAGE_INCOMPLETE: `BLOCKED-${CONTRACT_STATUS.PACKAGE_INCOMPLETE}`,
  BLOCKED_CLAIM_STATE: 'BLOCKED-CLAIM-STATE',
  BLOCKED_COLLISION: 'BLOCKED-COLLISION',
  BLOCKED_SERIAL_DEPENDENCY: 'BLOCKED-SERIAL-DEPENDENCY',
  ALLOWED: 'ALLOWED'
});

function normalizeScopePath(value) {
  return String(value || '')
    .trim()
    .replace(/\/\*\*?$/, '')
    .replace(/\/$/, '');
}

function scopesOverlap(a, b) {
  const na = normalizeScopePath(a);
  const nb = normalizeScopePath(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(`${nb}/`) || nb.startsWith(`${na}/`);
}

function findOverlaps(listA = [], listB = []) {
  const overlaps = [];
  for (const a of listA) {
    for (const b of listB) {
      if (scopesOverlap(a, b)) overlaps.push([a, b]);
    }
  }
  return overlaps;
}

/**
 * Classify the collision relationship between two claim surfaces.
 * Ordered predecessor/successor relationships classify as
 * SERIAL_DEPENDENCY (not a collision — bounded queue precedence
 * applies instead). Any materially shared file/domain scope,
 * schema/migration surface, shared configuration, or project
 * dependency classifies as COLLISION. Otherwise SAFE_PARALLEL.
 *
 * @param {{
 *   id?: string|number,
 *   predecessorOf?: string|number,
 *   successorOf?: string|number,
 *   filePaths?: string[],
 *   schemaSurfaces?: string[],
 *   sharedConfig?: string[],
 *   dependsOn?: string[]
 * }} a
 * @param {typeof a} b
 * @returns {{ classification: string, evidence: string[] }}
 */
export function classifyCollision(a = {}, b = {}) {
  if (
    (a.predecessorOf !== undefined && a.predecessorOf === b.id) ||
    (b.predecessorOf !== undefined && b.predecessorOf === a.id) ||
    (a.successorOf !== undefined && a.successorOf === b.id) ||
    (b.successorOf !== undefined && b.successorOf === a.id)
  ) {
    return {
      classification: COLLISION_CLASSES.SERIAL_DEPENDENCY,
      evidence: ['ordered predecessor/successor relationship']
    };
  }

  const evidence = [];
  const fileOverlaps = findOverlaps(a.filePaths, b.filePaths);
  if (fileOverlaps.length) {
    evidence.push(
      `overlapping file/domain scope: ${fileOverlaps.map(([x, y]) => `${x} ~ ${y}`).join(', ')}`
    );
  }
  const schemaOverlaps = findOverlaps(a.schemaSurfaces, b.schemaSurfaces);
  if (schemaOverlaps.length) {
    evidence.push(
      `shared schema/migration surface: ${schemaOverlaps.map(([x, y]) => `${x} ~ ${y}`).join(', ')}`
    );
  }
  const configOverlaps = findOverlaps(a.sharedConfig, b.sharedConfig);
  if (configOverlaps.length) {
    evidence.push(
      `shared configuration: ${configOverlaps.map(([x, y]) => `${x} ~ ${y}`).join(', ')}`
    );
  }
  const dependencyOverlaps = findOverlaps(a.dependsOn, b.dependsOn);
  if (dependencyOverlaps.length) {
    evidence.push(
      `shared project dependency: ${dependencyOverlaps.map(([x, y]) => `${x} ~ ${y}`).join(', ')}`
    );
  }

  if (evidence.length) {
    return { classification: COLLISION_CLASSES.COLLISION, evidence };
  }

  return {
    classification: COLLISION_CLASSES.SAFE_PARALLEL,
    evidence: ['no materially shared resource detected']
  };
}

/**
 * Evaluate whether a requesting agent may atomically claim an Issue.
 * Enforces, in fail-closed precedence order: queue invariants,
 * lifecycle-state consistency, package completeness (all via #3665's
 * evaluateExecutableChildContract), claim-state validity (#3240's
 * canClaim/classifyClaim — preserves Product Authority reservations
 * and stale-claim recovery), and collision evaluation against the
 * supplied active claims.
 *
 * @param {{
 *   issue: { body?: string, labels?: Array<string|{name?: string}>, id?: string|number, collisionSurface?: object },
 *   requestingAgent: string,
 *   activeClaims?: Array<{ id: string|number, collisionSurface?: object }>
 * }} input
 */
export function evaluateAtomicClaim({ issue = {}, requestingAgent, activeClaims = [] } = {}) {
  const contract = evaluateExecutableChildContract(issue);

  // Fail closed at the highest-precedence check first: an invalid
  // queue/lifecycle/package state is never evaluated for claim state
  // or collisions, so a higher-precedence block is never diluted with
  // lower-precedence evidence.
  if (contract.status !== CONTRACT_STATUS.PACKAGE_COMPLETE) {
    return {
      allowed: false,
      status: `BLOCKED-${contract.status}`,
      contract,
      claimState: null,
      claimDecision: null,
      collisions: [],
      errors: [...new Set(contract.errors)],
      remediation: [...new Set(contract.remediation)]
    };
  }

  const claimState = classifyClaim(issue);
  const claimDecision = canClaim({
    labels: issue.labels,
    requestingAgent,
    claimClass: claimState.class
  });

  if (!claimDecision.allowed) {
    return {
      allowed: false,
      status: CLAIM_ELIGIBILITY_STATUS.BLOCKED_CLAIM_STATE,
      contract,
      claimState,
      claimDecision,
      collisions: [],
      errors: [...new Set(contract.errors), `claim blocked: ${claimDecision.reason}`],
      remediation: [...new Set(contract.remediation)]
    };
  }

  const errors = [...contract.errors];
  const remediation = [...contract.remediation];

  const collisionSurface = issue.collisionSurface || {};
  const collisions = activeClaims.map((other) => {
    const result = classifyCollision(
      { id: issue.id, ...collisionSurface },
      { id: other.id, ...(other.collisionSurface || {}) }
    );
    return { withId: other.id, ...result };
  });

  const blockingCollisions = collisions.filter(
    (c) => c.classification === COLLISION_CLASSES.COLLISION
  );
  if (blockingCollisions.length) {
    errors.push(
      `collision with active claim(s): ${blockingCollisions
        .map((c) => `#${c.withId} (${c.evidence.join('; ')})`)
        .join(', ')}`
    );
    remediation.push(
      'Resolve or wait for the colliding active claim before claiming this Issue'
    );
  }

  const serialDependencies = collisions.filter(
    (c) => c.classification === COLLISION_CLASSES.SERIAL_DEPENDENCY
  );
  if (serialDependencies.length) {
    errors.push(
      `serial dependency with active claim(s): #${serialDependencies.map((c) => c.withId).join(', #')}`
    );
    remediation.push(
      `Ordered predecessor/successor with #${serialDependencies.map((c) => c.withId).join(', #')} — wait for queue precedence, not a collision`
    );
  }

  let status;
  if (blockingCollisions.length) {
    status = CLAIM_ELIGIBILITY_STATUS.BLOCKED_COLLISION;
  } else if (serialDependencies.length) {
    status = CLAIM_ELIGIBILITY_STATUS.BLOCKED_SERIAL_DEPENDENCY;
  } else {
    status = CLAIM_ELIGIBILITY_STATUS.ALLOWED;
  }

  return {
    allowed: status === CLAIM_ELIGIBILITY_STATUS.ALLOWED,
    status,
    contract,
    claimState,
    claimDecision,
    collisions,
    errors: [...new Set(errors)],
    remediation: [...new Set(remediation)]
  };
}
