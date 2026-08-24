/**
 * nextExecutable dependency-graph selection for #3666.
 * Deterministic logic to identify the next executable PMO project
 * child, or collision-safe parallel set, within an already-graduated
 * project's child graph. Preserves PMO parent priority as
 * project-selection authority (decided elsewhere, e.g.
 * scripts/orchestrator/queue-routing.mjs) — this module is
 * child-selection authority only, scoped to one project's graph.
 * Pure functions only — no GitHub API side effects.
 */

import { classifyClaim, CLAIM_CLASSES } from './agent-claim-contract.mjs';
import { classifyCollision, COLLISION_CLASSES } from './claim-collision-contract.mjs';
import { CONTRACT_STATUS, evaluateExecutableChildContract } from './executable-child-contract.mjs';

export const NEXT_EXECUTABLE_STATUS = Object.freeze({
  RESOLVED: 'RESOLVED',
  AMBIGUOUS: 'AMBIGUOUS'
});

/**
 * @typedef {{
 *   id: string|number,
 *   body?: string,
 *   labels?: Array<string|{name?: string}>,
 *   predecessors?: Array<string|number>,
 *   completed?: boolean,
 *   protectedStop?: { active: boolean, evidence?: string },
 *   executionRelationship?: 'serial'|'parallel-authorized',
 *   collisionSurface?: object
 * }} ChildNode
 */

function validateGraphStructure(children) {
  const errors = [];

  const missingId = children.some(
    (c) => c.id === undefined || c.id === null || c.id === ''
  );
  if (missingId) {
    errors.push('one or more children have a missing or empty id');
  }

  const seen = new Set();
  const duplicates = new Set();
  for (const child of children) {
    if (seen.has(child.id)) {
      duplicates.add(child.id);
    }
    seen.add(child.id);
  }
  if (duplicates.size) {
    errors.push(`duplicate child id(s): ${[...duplicates].map((id) => `#${id}`).join(', ')}`);
  }

  // A missing/duplicate id would silently corrupt byId/cycle detection
  // below, so fail closed before attempting predecessor or cycle checks.
  if (errors.length) return { valid: false, errors };

  const ids = new Set(children.map((c) => c.id));

  for (const child of children) {
    for (const pid of child.predecessors || []) {
      if (!ids.has(pid)) {
        errors.push(`child #${child.id} references unknown predecessor #${pid}`);
      }
    }
  }
  if (errors.length) return { valid: false, errors };

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(children.map((c) => [c.id, WHITE]));
  const byId = new Map(children.map((c) => [c.id, c]));
  const cycleNodes = new Set();
  let cyclic = false;

  function visit(id, stack) {
    if (cyclic) return;
    color.set(id, GRAY);
    const child = byId.get(id);
    for (const pid of child.predecessors || []) {
      if (color.get(pid) === GRAY) {
        cyclic = true;
        [...stack, id, pid].forEach((node) => cycleNodes.add(node));
        return;
      }
      if (color.get(pid) === WHITE) {
        visit(pid, [...stack, id]);
      }
    }
    color.set(id, BLACK);
  }

  for (const child of children) {
    if (color.get(child.id) === WHITE) visit(child.id, []);
  }

  if (cyclic) {
    errors.push(
      `dependency cycle detected involving: ${[...cycleNodes].map((id) => `#${id}`).join(', ')}`
    );
  }

  return { valid: errors.length === 0, errors };
}

function predecessorGroupKey(predecessors = []) {
  return [...predecessors].sort().join(',');
}

/**
 * Determine the next executable child(ren) within a single graduated
 * project's child graph.
 *
 * @param {{ children: ChildNode[], activeClaims?: Array<{ id: string|number, collisionSurface?: object }> }} input
 */
export function nextExecutable({ children = [], activeClaims = [] } = {}) {
  const structure = validateGraphStructure(children);
  if (!structure.valid) {
    return {
      status: NEXT_EXECUTABLE_STATUS.AMBIGUOUS,
      executable: [],
      blocked: [],
      deferred: [],
      errors: structure.errors,
      remediation: [
        'Correct the dependency graph: remove cycles and unknown predecessor references before re-evaluating'
      ]
    };
  }

  const byId = new Map(children.map((c) => [c.id, c]));
  const blocked = [];
  const candidates = [];

  for (const child of children) {
    if (child.completed) continue;

    const reasons = [];

    if (child.protectedStop && child.protectedStop.active) {
      reasons.push(`protected stop: ${child.protectedStop.evidence || 'evidence not recorded'}`);
    }

    const predecessors = child.predecessors || [];
    const predecessorsComplete = predecessors.every((pid) => byId.get(pid)?.completed);
    if (!predecessorsComplete) {
      const incomplete = predecessors.filter((pid) => !byId.get(pid)?.completed);
      reasons.push(
        `serial dependency: predecessor(s) not complete: ${incomplete.map((id) => `#${id}`).join(', ')}`
      );
    }

    const contract = evaluateExecutableChildContract(child);
    if (contract.status !== CONTRACT_STATUS.PACKAGE_COMPLETE) {
      reasons.push(`contract ${contract.status}`);
    }

    const claim = classifyClaim(child);
    if (claim.class === CLAIM_CLASSES.ACTIVE_CLAIM || claim.class === CLAIM_CLASSES.EXPLICIT_RESERVATION) {
      reasons.push(`already claimed (${claim.class}: ${claim.reason})`);
    } else if (claim.class === CLAIM_CLASSES.AMBIGUOUS) {
      reasons.push(`ambiguous claim state: ${claim.reason}`);
    }

    if (reasons.length) {
      blocked.push({ id: child.id, reasons });
    } else {
      candidates.push(child);
    }
  }

  // Parallel-authorization contradiction: multiple otherwise-eligible
  // children sharing the same predecessor set are ambiguous unless
  // every one of them explicitly opts in to parallel execution.
  const groups = new Map();
  for (const candidate of candidates) {
    const key = predecessorGroupKey(candidate.predecessors);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }

  const resolvedCandidates = [];
  for (const group of groups.values()) {
    if (group.length > 1 && !group.every((c) => c.executionRelationship === 'parallel-authorized')) {
      for (const child of group) {
        blocked.push({
          id: child.id,
          reasons: [
            `ambiguous parallel authorization: multiple children share the same predecessor set without executionRelationship "parallel-authorized" (${group.map((c) => `#${c.id}`).join(', ')})`
          ]
        });
      }
      continue;
    }
    resolvedCandidates.push(...group);
  }

  // Collision-safe set selection, in caller-supplied (queue-precedence) order.
  const selected = [];
  const deferred = [];
  for (const candidate of resolvedCandidates) {
    const surface = candidate.collisionSurface || {};
    const collisionWithSelected = selected
      .map((s) => classifyCollision({ id: candidate.id, ...surface }, { id: s.id, ...(s.collisionSurface || {}) }))
      .find((r) => r.classification === COLLISION_CLASSES.COLLISION);
    const collisionWithActive = activeClaims
      .map((a) => ({
        withId: a.id,
        ...classifyCollision({ id: candidate.id, ...surface }, { id: a.id, ...(a.collisionSurface || {}) })
      }))
      .find((r) => r.classification === COLLISION_CLASSES.COLLISION);

    if (collisionWithSelected) {
      deferred.push({
        id: candidate.id,
        reason: `collision with another selected candidate: ${collisionWithSelected.evidence.join('; ')}`
      });
    } else if (collisionWithActive) {
      deferred.push({
        id: candidate.id,
        reason: `collision with active claim #${collisionWithActive.withId}: ${collisionWithActive.evidence.join('; ')}`
      });
    } else {
      selected.push(candidate);
    }
  }

  const errors = blocked
    .filter((b) => b.reasons.some((r) => r.startsWith('ambiguous parallel authorization')))
    .map((b) => b.reasons[0]);
  const remediation = errors.length
    ? ['Mark all children sharing a predecessor as executionRelationship "parallel-authorized", or split them onto distinct predecessors']
    : [];

  return {
    status: NEXT_EXECUTABLE_STATUS.RESOLVED,
    executable: selected.map((c) => c.id),
    blocked,
    deferred,
    errors,
    remediation
  };
}
