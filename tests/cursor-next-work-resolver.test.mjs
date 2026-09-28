import { describe, expect, it } from 'vitest';
import {
  NO_ELIGIBLE_WORK,
  RESOLVER_STATUS,
  resolveCursorNextWork,
} from '../scripts/ci/cursor_next_work_resolver.mjs';

function issue(overrides = {}) {
  return {
    number: 1,
    title: 'Implement the widget',
    state: 'open',
    labels: ['agent:cursor', 'team:engineering', 'status:active'],
    body: 'Writable files: src/widget',
    ...overrides,
  };
}

describe('resolveCursorNextWork (#3607)', () => {
  it('moves from a completed assignment to the next eligible issue', () => {
    const result = resolveCursorNextWork([
      issue({ number: 10, state: 'closed', title: 'Done' }),
      issue({ number: 11 }),
      issue({ number: 12, labels: ['agent:cursor', 'team:engineering', 'status:queued'] }),
    ]);
    expect(result.status).toBe(RESOLVER_STATUS.SELECTED);
    expect(result.issue).toBe(11);
    expect(result.rejected.find((row) => row.number === 10).reason).toBe('closed');
  });

  it('selects work present in the snapshot when an earlier poll missed it', () => {
    const missed = issue({ number: 40, title: 'Assigned after the watermark' });
    const result = resolveCursorNextWork([missed]);
    expect(result.issue).toBe(40);
    expect(result.eligibilityReason).toMatch(/agent:cursor/);
  });

  it('excludes dependency-blocked work', () => {
    const result = resolveCursorNextWork([
      issue({ number: 2, body: 'Blocked by #9' }),
      issue({ number: 3 }),
    ], { openNumbers: [9] });
    expect(result.issue).toBe(3);
    expect(result.rejected.find((row) => row.number === 2).reason).toMatch(/dependency blocked by #9/);
  });

  it('returns NO_ELIGIBLE_WORK when nothing is executable', () => {
    const result = resolveCursorNextWork([
      issue({ number: 1, state: 'closed' }),
      issue({ number: 2, labels: ['team:engineering', 'status:queued'] }),
    ]);
    expect(result.status).toBe(RESOLVER_STATUS.NO_ELIGIBLE_WORK);
    expect(result.issue).toBeNull();
    expect(result.eligibilityReason).toBe(NO_ELIGIBLE_WORK);
  });

  it('dispatches one issue when several active claims exist', () => {
    const result = resolveCursorNextWork([
      issue({ number: 30 }),
      issue({ number: 20 }),
      issue({ number: 25 }),
    ]);
    expect(result.issue).toBe(20);
    expect(result.priorityReason).toMatch(/not dispatched/);
  });

  it('keeps the in-flight claim instead of starting a second one', () => {
    const result = resolveCursorNextWork(
      [issue({ number: 20 }), issue({ number: 21 })],
      { activeIssue: 21 },
    );
    expect(result.issue).toBe(21);
    expect(result.priorityReason).toMatch(/duplicate dispatch suppressed/);
  });

  it('is deterministic across the same merge and assignment snapshot', () => {
    const snapshot = [
      issue({ number: 7, state: 'closed' }),
      issue({ number: 8, labels: ['agent:cursor', 'team:governance', 'status:active'] }),
      issue({ number: 9, labels: ['agent:cursor', 'team:engineering', 'status:active'] }),
    ];
    const first = resolveCursorNextWork(snapshot);
    const second = resolveCursorNextWork(snapshot);
    expect(second).toEqual(first);
    expect(first.issue).toBe(9);
    expect(first.queue).toBe('engineering');
  });

  it('does not let a queued assignee row beat an agent:cursor claim', () => {
    const result = resolveCursorNextWork([
      issue({
        number: 2643,
        title: 'PLANNING follow-on',
        labels: ['team:pmo', 'status:queued'],
        body: 'no Cursor claim authorized',
      }),
      issue({ number: 3240 }),
    ]);
    expect(result.issue).toBe(3240);
    expect(result.rejected.find((row) => row.number === 2643).reason).toBe(
      'assignee is not implementation authority',
    );
  });

  it('orders Operations before Engineering before Governance', () => {
    const result = resolveCursorNextWork([
      issue({ number: 3, labels: ['agent:cursor', 'team:governance', 'status:active'] }),
      issue({ number: 2, labels: ['agent:cursor', 'team:engineering', 'status:active'] }),
      issue({
        number: 4,
        labels: ['agent:cursor', 'team:operations', 'ops:priority:2', 'status:active'],
      }),
    ]);
    expect(result.issue).toBe(4);
    expect(result.queue).toBe('operations');
  });

  it('does not select status:review work as the next assignment', () => {
    const result = resolveCursorNextWork([
      issue({ number: 3607, labels: ['agent:cursor', 'team:engineering', 'status:review'] }),
      issue({ number: 4000 }),
    ]);
    expect(result.issue).toBe(4000);
    expect(result.rejected.find((row) => row.number === 3607).reason).toBe('blocking status:review');
  });

  it('reports DISABLED without choosing an issue', () => {
    const result = resolveCursorNextWork([issue({ number: 1 })], { disabled: true });
    expect(result.status).toBe(RESOLVER_STATUS.DISABLED);
    expect(result.issue).toBeNull();
  });
});
