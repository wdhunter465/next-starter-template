import { describe, expect, it } from 'vitest';
import {
  CLAIM_ELIGIBILITY_STATUS,
  COLLISION_CLASSES,
  classifyCollision,
  evaluateAtomicClaim
} from '../scripts/ci/claim-collision-contract.mjs';

const COMPLETE_BODY = `
Objective: Ship the widget rollback path
Parent project: #1000
Predecessor: #1001
Writable files/actions: src/widget/**
Acceptance criteria: widget renders without error
Required validation: npm test passes
Expected artifact/PR: PR against main with test evidence
Rollback: revert the merge commit
Protected stops: none identified
Independent reviewer role holder: WORK
Successor: #1002
Durable evidence location: PR description and CI run link
`;

function baseIssue(overrides = {}) {
  return {
    id: 2000,
    body: COMPLETE_BODY,
    labels: ['pmo:task', 'pmo:active'],
    collisionSurface: { filePaths: ['src/widget/**'] },
    ...overrides
  };
}

describe('claim-collision-contract (#3667)', () => {
  it('classifies overlapping file scope as COLLISION', () => {
    const result = classifyCollision(
      { id: 1, filePaths: ['src/widget/**'] },
      { id: 2, filePaths: ['src/widget/button.tsx'] }
    );
    expect(result.classification).toBe(COLLISION_CLASSES.COLLISION);
    expect(result.evidence[0]).toMatch(/overlapping file/);
  });

  it('classifies shared migration/config surface as COLLISION', () => {
    const result = classifyCollision(
      { id: 1, schemaSurfaces: ['migrations/0007_widgets.sql'] },
      { id: 2, sharedConfig: ['wrangler.toml'] } // no overlap here
    );
    expect(result.classification).toBe(COLLISION_CLASSES.SAFE_PARALLEL);

    const migrationCollision = classifyCollision(
      { id: 1, schemaSurfaces: ['migrations/0007_widgets.sql'] },
      { id: 2, schemaSurfaces: ['migrations/0007_widgets.sql'] }
    );
    expect(migrationCollision.classification).toBe(COLLISION_CLASSES.COLLISION);

    const configCollision = classifyCollision(
      { id: 1, sharedConfig: ['wrangler.toml'] },
      { id: 2, sharedConfig: ['wrangler.toml'] }
    );
    expect(configCollision.classification).toBe(COLLISION_CLASSES.COLLISION);
  });

  it('classifies an ordered predecessor/successor pair as SERIAL_DEPENDENCY', () => {
    const result = classifyCollision({ id: 2, predecessorOf: 3 }, { id: 3 });
    expect(result.classification).toBe(COLLISION_CLASSES.SERIAL_DEPENDENCY);
  });

  it('classifies independent work with no shared resource as SAFE_PARALLEL', () => {
    const result = classifyCollision(
      { id: 1, filePaths: ['src/widget/**'] },
      { id: 2, filePaths: ['src/other-feature/**'] }
    );
    expect(result.classification).toBe(COLLISION_CLASSES.SAFE_PARALLEL);
  });

  it('blocks a duplicate claim: another agent already holds an active claim', () => {
    const issue = baseIssue({ labels: ['pmo:task', 'pmo:active', 'agent:grok'] });
    issue.hasRecentExecutionEvidence = true;
    const result = evaluateAtomicClaim({
      issue,
      requestingAgent: 'claude',
      activeClaims: []
    });
    expect(result.allowed).toBe(false);
    expect(result.claimState.class).toBe('ACTIVE_CLAIM');
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_CLAIM_STATE);
  });

  it('allows claim on a proven stale pre-assignment', () => {
    const issue = baseIssue({ labels: ['pmo:task', 'pmo:active', 'agent:cursor'] });
    issue.hasStaleEvidence = true;
    const result = evaluateAtomicClaim({
      issue,
      requestingAgent: 'claude',
      activeClaims: []
    });
    expect(result.allowed).toBe(true);
  });

  it('respects an explicit Product Authority reservation, blocking other agents', () => {
    const issue = baseIssue({ labels: ['pmo:task', 'pmo:active', 'agent:claude'] });
    issue.hasExplicitReservationEvidence = true;
    const result = evaluateAtomicClaim({
      issue,
      requestingAgent: 'grok',
      activeClaims: []
    });
    expect(result.allowed).toBe(false);
    expect(result.claimState.class).toBe('EXPLICIT_RESERVATION');
  });

  it('blocks dual team ownership (INVALID-QUEUE-STATE) and short-circuits claim/collision evaluation', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ labels: ['team:pmo', 'team:engineering', 'pmo:task', 'pmo:active'] }),
      requestingAgent: 'claude',
      activeClaims: [{ id: 999, collisionSurface: { filePaths: ['src/widget/**'] } }]
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_INVALID_QUEUE_STATE);
    expect(result.allowed).toBe(false);
    // Higher-precedence block means lower-precedence checks never ran,
    // so their results are not diluted into the error evidence.
    expect(result.claimState).toBeNull();
    expect(result.claimDecision).toBeNull();
    expect(result.collisions).toEqual([]);
  });

  it('blocks cross-namespace priority (INVALID-QUEUE-STATE)', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ labels: ['pmo:task', 'ops:priority:1'] }),
      requestingAgent: 'claude',
      activeClaims: []
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_INVALID_QUEUE_STATE);
  });

  it('blocks contradictory lifecycle labels (LIFECYCLE-CONTRADICTION)', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({
        body: `${COMPLETE_BODY}\nStatus: Closed and reconciled.\n`,
        labels: ['pmo:task', 'pmo:active']
      }),
      requestingAgent: 'claude',
      activeClaims: []
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_LIFECYCLE_CONTRADICTION);
  });

  it('blocks missing package fields (PACKAGE-INCOMPLETE)', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ body: 'Objective: fix the bug' }),
      requestingAgent: 'claude',
      activeClaims: []
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_PACKAGE_INCOMPLETE);
  });

  it('blocks a claim colliding with an active claim on overlapping files', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ id: 5, collisionSurface: { filePaths: ['src/widget/**'] } }),
      requestingAgent: 'claude',
      activeClaims: [
        { id: 6, collisionSurface: { filePaths: ['src/widget/button.tsx'] } }
      ]
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_COLLISION);
    expect(result.collisions[0].classification).toBe(COLLISION_CLASSES.COLLISION);
  });

  it('blocks a claim colliding with an active claim on shared migration surface', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({
        id: 5,
        collisionSurface: { schemaSurfaces: ['migrations/0007_widgets.sql'] }
      }),
      requestingAgent: 'claude',
      activeClaims: [
        {
          id: 6,
          collisionSurface: { schemaSurfaces: ['migrations/0007_widgets.sql'] }
        }
      ]
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_COLLISION);
  });

  it('blocks on serial dependency rather than treating it as a collision', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ id: 7, collisionSurface: { predecessorOf: 8 } }),
      requestingAgent: 'claude',
      activeClaims: [{ id: 8, collisionSurface: {} }]
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_SERIAL_DEPENDENCY);
    expect(result.collisions[0].classification).toBe(COLLISION_CLASSES.SERIAL_DEPENDENCY);
    expect(result.errors.some((e) => e.includes('serial dependency'))).toBe(true);
  });

  it('rejects malformed claim state: multiple agent:* labels (AMBIGUOUS)', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ labels: ['pmo:task', 'pmo:active', 'agent:claude', 'agent:grok'] }),
      requestingAgent: 'claude',
      activeClaims: []
    });
    expect(result.claimState.class).toBe('AMBIGUOUS');
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.BLOCKED_CLAIM_STATE);
  });

  it('allows independent parallel claims with no shared resource', () => {
    const result = evaluateAtomicClaim({
      issue: baseIssue({ id: 9, collisionSurface: { filePaths: ['src/widget/**'] } }),
      requestingAgent: 'claude',
      activeClaims: [
        { id: 10, collisionSurface: { filePaths: ['src/other-feature/**'] } }
      ]
    });
    expect(result.status).toBe(CLAIM_ELIGIBILITY_STATUS.ALLOWED);
    expect(result.allowed).toBe(true);
    expect(result.collisions[0].classification).toBe(COLLISION_CLASSES.SAFE_PARALLEL);
  });
});
