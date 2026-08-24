import { describe, expect, it } from 'vitest';
import { NEXT_EXECUTABLE_STATUS } from '../scripts/ci/next-executable.mjs';
import {
  CLOSEOUT_STATUS,
  evaluatePredecessorCloseout,
  releaseSuccessors
} from '../scripts/ci/successor-release.mjs';

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

const VERIFIED = { integrated: true, validated: true, reviewed: true, closeoutRecorded: true };

function child(overrides = {}) {
  return {
    body: COMPLETE_BODY,
    labels: ['pmo:task', 'pmo:active'],
    predecessors: [],
    collisionSurface: {},
    closeoutEvidence: {},
    ...overrides
  };
}

describe('evaluatePredecessorCloseout (#3669)', () => {
  it('is VERIFIED-COMPLETE only with all four evidence flags', () => {
    expect(evaluatePredecessorCloseout(VERIFIED).status).toBe(CLOSEOUT_STATUS.VERIFIED_COMPLETE);
  });

  it('is NOT-STARTED with no evidence', () => {
    expect(evaluatePredecessorCloseout({}).status).toBe(CLOSEOUT_STATUS.NOT_STARTED);
  });

  it('is REVIEW-PENDING with partial evidence', () => {
    const result = evaluatePredecessorCloseout({ integrated: true, validated: true });
    expect(result.status).toBe(CLOSEOUT_STATUS.REVIEW_PENDING);
    expect(result.complete).toBe(false);
  });

  it('treats a non-boolean truthy value as missing evidence, not as true', () => {
    const result = evaluatePredecessorCloseout({
      integrated: 'true',
      validated: 1,
      reviewed: {},
      closeoutRecorded: true
    });
    expect(result.status).toBe(CLOSEOUT_STATUS.REVIEW_PENDING);
    expect(result.complete).toBe(false);
  });

  it('does not treat a non-boolean truthy override as remediationPending/supersededEvidence', () => {
    const result = evaluatePredecessorCloseout({
      ...VERIFIED,
      remediationPending: 'no',
      supersededEvidence: 'n/a'
    });
    expect(result.status).toBe(CLOSEOUT_STATUS.VERIFIED_COMPLETE);
    expect(result.complete).toBe(true);
  });

  it('is REMEDIATION-PENDING even with otherwise-complete evidence', () => {
    const result = evaluatePredecessorCloseout({ ...VERIFIED, remediationPending: true });
    expect(result.status).toBe(CLOSEOUT_STATUS.REMEDIATION_PENDING);
    expect(result.complete).toBe(false);
  });

  it('is STALE-EVIDENCE when superseded, even with otherwise-complete evidence', () => {
    const result = evaluatePredecessorCloseout({ ...VERIFIED, supersededEvidence: true });
    expect(result.status).toBe(CLOSEOUT_STATUS.STALE_EVIDENCE);
    expect(result.complete).toBe(false);
  });
});

describe('releaseSuccessors (#3669)', () => {
  it('releases the successor of a serially verified-complete predecessor', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: VERIFIED }),
        child({ id: 2, predecessors: [1] })
      ]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.RESOLVED);
    expect(result.releasable.map((r) => r.id)).toEqual([2]);
  });

  it('releases independent parallel successors when collision-safe', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: VERIFIED }),
        child({
          id: 2,
          predecessors: [1],
          executionRelationship: 'parallel-authorized',
          collisionSurface: { filePaths: ['src/widget/a/**'] }
        }),
        child({
          id: 3,
          predecessors: [1],
          executionRelationship: 'parallel-authorized',
          collisionSurface: { filePaths: ['src/widget/b/**'] }
        })
      ]
    });
    expect(result.releasable.map((r) => r.id).sort()).toEqual([2, 3]);
  });

  it('does not release a successor while predecessor review is pending', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: { integrated: true, validated: true } }),
        child({ id: 2, predecessors: [1], collisionSurface: { filePaths: ['src/successor/**'] } })
      ]
    });
    expect(result.releasable.map((r) => r.id)).not.toContain(2);
    expect(result.closeout[1].status).toBe(CLOSEOUT_STATUS.REVIEW_PENDING);
    expect(result.blocked.find((b) => b.id === 2).reasons[0]).toMatch(/serial dependency/);
  });

  it('does not release a successor while predecessor remediation is pending', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: { ...VERIFIED, remediationPending: true } }),
        child({ id: 2, predecessors: [1], collisionSurface: { filePaths: ['src/successor/**'] } })
      ]
    });
    expect(result.releasable.map((r) => r.id)).not.toContain(2);
    expect(result.closeout[1].status).toBe(CLOSEOUT_STATUS.REMEDIATION_PENDING);
  });

  it('does not release a successor from stale/superseded verification evidence', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: { ...VERIFIED, supersededEvidence: true } }),
        child({ id: 2, predecessors: [1], collisionSurface: { filePaths: ['src/successor/**'] } })
      ]
    });
    expect(result.releasable.map((r) => r.id)).not.toContain(2);
    expect(result.closeout[1].status).toBe(CLOSEOUT_STATUS.STALE_EVIDENCE);
  });

  it('keeps a protected-stop successor unreleased with explicit evidence, without blocking an unrelated successor', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: VERIFIED }),
        child({
          id: 2,
          predecessors: [1],
          protectedStop: { active: true, evidence: 'Production authority required' }
        }),
        child({ id: 3, collisionSurface: { filePaths: ['src/unrelated/**'] } })
      ]
    });
    expect(result.releasable.map((r) => r.id)).toEqual([3]);
    const blocked2 = result.blocked.find((b) => b.id === 2);
    expect(blocked2.reasons[0]).toMatch(/protected stop/);
  });

  it('defers a colliding successor rather than releasing both', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: VERIFIED }),
        child({
          id: 2,
          predecessors: [1],
          executionRelationship: 'parallel-authorized',
          collisionSurface: { filePaths: ['src/widget/shared.ts'] }
        }),
        child({
          id: 3,
          predecessors: [1],
          executionRelationship: 'parallel-authorized',
          collisionSurface: { filePaths: ['src/widget/shared.ts'] }
        })
      ]
    });
    expect(result.releasable.map((r) => r.id)).toEqual([2]);
    expect(result.deferred.find((d) => d.id === 3)).toBeTruthy();
  });

  it('fails closed on a malformed successor graph', () => {
    const result = releaseSuccessors({
      children: [child({ id: 1, predecessors: [999], closeoutEvidence: VERIFIED })]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.AMBIGUOUS);
    expect(result.releasable).toEqual([]);
    expect(result.errors[0]).toMatch(/unknown predecessor/);
  });

  it('supports atomic self-claim by an eligible requesting agent', () => {
    const result = releaseSuccessors({
      children: [
        child({ id: 1, closeoutEvidence: VERIFIED }),
        child({ id: 2, predecessors: [1] })
      ],
      requestingAgent: 'claude'
    });
    const successor = result.releasable.find((r) => r.id === 2);
    expect(successor.claim.allowed).toBe(true);
  });
});
