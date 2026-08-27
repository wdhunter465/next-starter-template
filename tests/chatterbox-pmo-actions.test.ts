// #3794 Layer 3 tests: the PMO action queue's acknowledge/expire semantics
// generalize Jules's #3579 JULES-2 finding. The core property under test:
// an action is only overdue-for-escalation while it is still PENDING —
// once acknowledged, it is no longer silently escalated, and reading it
// (as opposed to acking/completing it) never changes its status at all.

import { describe, expect, it } from 'vitest';

import { computeDefaultExpiry, isPmoActionOverdue, isValidPmoActionType } from '../functions/_lib/chatterbox';

describe('isValidPmoActionType', () => {
  it('accepts only the defined action types', () => {
    expect(isValidPmoActionType('CLOSE_ISSUE')).toBe(true);
    expect(isValidPmoActionType('UPDATE_TRACKER')).toBe(true);
    expect(isValidPmoActionType('RELEASE_SUCCESSOR')).toBe(true);
    expect(isValidPmoActionType('OTHER')).toBe(true);
    expect(isValidPmoActionType('MADE_UP')).toBe(false);
    expect(isValidPmoActionType(undefined)).toBe(false);
  });
});

describe('computeDefaultExpiry', () => {
  it('defaults to 24 hours from the given time', () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    expect(computeDefaultExpiry(now)).toBe('2026-08-28T00:00:00.000Z');
  });

  it('honors a custom hours value', () => {
    const now = new Date('2026-08-27T00:00:00.000Z');
    expect(computeDefaultExpiry(now, 1)).toBe('2026-08-27T01:00:00.000Z');
  });
});

describe('isPmoActionOverdue', () => {
  it('is overdue only when PENDING and past its own expires_at', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    expect(isPmoActionOverdue({ status: 'PENDING', expires_at: '2026-08-28T00:00:00.000Z' }, now)).toBe(true);
    expect(isPmoActionOverdue({ status: 'PENDING', expires_at: '2026-08-29T00:00:00.000Z' }, now)).toBe(false);
  });

  it('is never overdue once acknowledged — acking is not the same as completing, but it stops escalation', () => {
    const now = new Date('2026-08-30T00:00:00.000Z');
    expect(isPmoActionOverdue({ status: 'ACKED', expires_at: '2026-08-28T00:00:00.000Z' }, now)).toBe(false);
  });

  it('is never overdue once DONE or already EXPIRED', () => {
    const now = new Date('2026-08-30T00:00:00.000Z');
    expect(isPmoActionOverdue({ status: 'DONE', expires_at: '2026-08-28T00:00:00.000Z' }, now)).toBe(false);
    expect(isPmoActionOverdue({ status: 'EXPIRED', expires_at: '2026-08-28T00:00:00.000Z' }, now)).toBe(false);
  });
});
