import { describe, expect, it } from 'vitest';
import { NEXT_EXECUTABLE_STATUS, nextExecutable } from '../scripts/ci/next-executable.mjs';

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

function child(overrides = {}) {
  return {
    body: COMPLETE_BODY,
    labels: ['pmo:task', 'pmo:active'],
    predecessors: [],
    collisionSurface: {},
    ...overrides
  };
}

describe('nextExecutable (#3666)', () => {
  it('resolves a serial chain to only the first incomplete child', () => {
    const result = nextExecutable({
      children: [
        child({ id: 1, predecessors: [], completed: true }),
        child({ id: 2, predecessors: [1] }),
        child({ id: 3, predecessors: [2] })
      ]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.RESOLVED);
    expect(result.executable).toEqual([2]);
    expect(result.blocked.find((b) => b.id === 3)).toBeTruthy();
  });

  it('returns a collision-safe parallel set when explicitly authorized', () => {
    const result = nextExecutable({
      children: [
        child({ id: 1, predecessors: [], completed: true }),
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
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.RESOLVED);
    expect(result.executable.sort()).toEqual([2, 3]);
  });

  it('defers a colliding candidate within an authorized parallel set', () => {
    const result = nextExecutable({
      children: [
        child({ id: 1, predecessors: [], completed: true }),
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
    expect(result.executable).toEqual([2]);
    expect(result.deferred.find((d) => d.id === 3)).toBeTruthy();
  });

  it('blocks an unrelated node without blocking siblings (blocked case)', () => {
    const result = nextExecutable({
      children: [
        child({ id: 1, predecessors: [], body: 'Objective: incomplete package only' }),
        child({ id: 2, predecessors: [], collisionSurface: { filePaths: ['src/other/**'] } })
      ]
    });
    expect(result.blocked.find((b) => b.id === 1)).toBeTruthy();
    expect(result.executable).toEqual([2]);
  });

  it('excludes a protected-stop node without blocking unrelated nodes', () => {
    const result = nextExecutable({
      children: [
        child({ id: 1, protectedStop: { active: true, evidence: 'Production authority required' } }),
        child({ id: 2, collisionSurface: { filePaths: ['src/other/**'] } })
      ]
    });
    const blocked1 = result.blocked.find((b) => b.id === 1);
    expect(blocked1.reasons[0]).toMatch(/protected stop/);
    expect(result.executable).toEqual([2]);
  });

  it('excludes completed children from both executable and blocked sets', () => {
    const result = nextExecutable({
      children: [child({ id: 1, completed: true }), child({ id: 2 })]
    });
    expect(result.executable).toEqual([2]);
    expect(result.blocked.find((b) => b.id === 1)).toBeUndefined();
  });

  it('excludes an already-claimed child (claimed case)', () => {
    const claimedChild = child({ id: 1, labels: ['pmo:task', 'pmo:active', 'agent:grok'] });
    claimedChild.hasRecentExecutionEvidence = true;
    const result = nextExecutable({
      children: [claimedChild, child({ id: 2, collisionSurface: { filePaths: ['src/other/**'] } })]
    });
    expect(result.blocked.find((b) => b.id === 1).reasons[0]).toMatch(/already claimed/);
    expect(result.executable).toEqual([2]);
  });

  it('fails closed on a malformed graph: missing child id', () => {
    const result = nextExecutable({
      children: [child({ id: 1 }), child({ id: undefined })]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.AMBIGUOUS);
    expect(result.errors[0]).toMatch(/missing or empty id/);
  });

  it('fails closed on a malformed graph: duplicate child id', () => {
    const result = nextExecutable({
      children: [child({ id: 1 }), child({ id: 1 })]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.AMBIGUOUS);
    expect(result.errors[0]).toMatch(/duplicate child id/);
  });

  it('fails closed on a malformed graph: unknown predecessor reference', () => {
    const result = nextExecutable({
      children: [child({ id: 1, predecessors: [999] })]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.AMBIGUOUS);
    expect(result.executable).toEqual([]);
    expect(result.errors[0]).toMatch(/unknown predecessor/);
  });

  it('fails closed on a malformed graph: dependency cycle', () => {
    const result = nextExecutable({
      children: [child({ id: 1, predecessors: [2] }), child({ id: 2, predecessors: [1] })]
    });
    expect(result.status).toBe(NEXT_EXECUTABLE_STATUS.AMBIGUOUS);
    expect(result.errors[0]).toMatch(/dependency cycle/);
  });

  it('blocks ambiguous unauthorized parallel siblings without collapsing the whole graph', () => {
    const result = nextExecutable({
      children: [
        child({ id: 1, predecessors: [], completed: true }),
        child({ id: 2, predecessors: [1] }),
        child({ id: 3, predecessors: [1] }),
        child({ id: 4, predecessors: [], collisionSurface: { filePaths: ['src/unrelated/**'] } })
      ]
    });
    expect(result.blocked.find((b) => b.id === 2)).toBeTruthy();
    expect(result.blocked.find((b) => b.id === 3)).toBeTruthy();
    expect(result.executable).toEqual([4]);
    expect(result.errors[0]).toMatch(/ambiguous parallel authorization/);
  });
});
