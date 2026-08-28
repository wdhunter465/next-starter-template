import { describe, expect, it } from 'vitest';

import {
  buildCatchUpDigest,
  canClaim,
  dependenciesSatisfied,
  isSystemClerkEventAllowed,
  isValidEventType,
  isValidRoleClass,
  isValidTaskState,
  parseDependsOn,
  type ChatterboxEventRow,
} from '../functions/_lib/chatterbox';

describe('chatterbox validators', () => {
  it('accepts only the defined event types', () => {
    expect(isValidEventType('STATUS')).toBe(true);
    expect(isValidEventType('QUESTION')).toBe(true);
    expect(isValidEventType('MADE_UP')).toBe(false);
    expect(isValidEventType(42)).toBe(false);
  });

  it('accepts only the defined role classes', () => {
    expect(isValidRoleClass('pmo')).toBe(true);
    expect(isValidRoleClass('system_clerk')).toBe(true);
    expect(isValidRoleClass('super_admin')).toBe(false);
  });

  it('accepts only the defined task states', () => {
    expect(isValidTaskState('AVAILABLE')).toBe(true);
    expect(isValidTaskState('DONE')).toBe(false);
  });
});

describe('system_clerk event boundary', () => {
  it('allows deterministic administrative event types', () => {
    expect(isSystemClerkEventAllowed('STATUS')).toBe(true);
    expect(isSystemClerkEventAllowed('SYSTEM')).toBe(true);
    expect(isSystemClerkEventAllowed('CHECK_IN')).toBe(true);
  });

  it('rejects substantive PMO/Product transition types', () => {
    expect(isSystemClerkEventAllowed('COMPLETE')).toBe(false);
    expect(isSystemClerkEventAllowed('PMO_ACCEPT')).toBe(false);
    expect(isSystemClerkEventAllowed('DECISION_RECORDED')).toBe(false);
  });
});

describe('parseDependsOn', () => {
  it('parses a valid JSON array of task keys', () => {
    expect(parseDependsOn('["t1", "t2"]')).toEqual(['t1', 't2']);
  });

  it('fails closed to an empty list for malformed or non-array input', () => {
    expect(parseDependsOn('not json')).toEqual([]);
    expect(parseDependsOn('{"a":1}')).toEqual([]);
    expect(parseDependsOn(undefined)).toEqual([]);
    expect(parseDependsOn('[1, 2, "t3"]')).toEqual(['t3']);
  });
});

describe('dependenciesSatisfied', () => {
  it('is satisfied only when every dependency is ACCEPTED or COMPLETE', () => {
    expect(dependenciesSatisfied(['a', 'b'], { a: 'COMPLETE', b: 'ACCEPTED' })).toBe(true);
    expect(dependenciesSatisfied(['a', 'b'], { a: 'COMPLETE', b: 'IN_PROGRESS' })).toBe(false);
    expect(dependenciesSatisfied(['a'], {})).toBe(false);
    expect(dependenciesSatisfied([], {})).toBe(true);
  });

  it('does not treat a REWORK task as satisfying a dependency it once completed', () => {
    expect(dependenciesSatisfied(['a'], { a: 'REWORK' })).toBe(false);
  });
});

describe('canClaim', () => {
  it('rejects a claim on a task that is not AVAILABLE', () => {
    const result = canClaim({ task_key: 't1', state: 'CLAIMED', depends_on: '[]' }, {});
    expect(result).toEqual({ ok: false, reason: 'task_not_available:CLAIMED' });
  });

  it('rejects a claim with unsatisfied dependencies', () => {
    const result = canClaim(
      { task_key: 't2', state: 'AVAILABLE', depends_on: '["t1"]' },
      { t1: 'IN_PROGRESS' },
    );
    expect(result).toEqual({ ok: false, reason: 'unsatisfied_dependencies' });
  });

  it('allows a claim on an available task with satisfied dependencies', () => {
    const result = canClaim(
      { task_key: 't2', state: 'AVAILABLE', depends_on: '["t1"]' },
      { t1: 'COMPLETE' },
    );
    expect(result).toEqual({ ok: true });
  });

  it('allows a claim on an available task with no dependencies', () => {
    const result = canClaim({ task_key: 't1', state: 'AVAILABLE', depends_on: '[]' }, {});
    expect(result).toEqual({ ok: true });
  });
});

describe('buildCatchUpDigest', () => {
  function event(overrides: Partial<ChatterboxEventRow>): ChatterboxEventRow {
    return {
      id: 1,
      event_type: 'STATUS',
      participant_id: 1,
      target_participant_id: null,
      in_reply_to_event_id: null,
      task_ref: null,
      body: 'status',
      github_ref: null,
      created_at: '2026-08-14T00:00:00.000Z',
      ...overrides,
    };
  }

  it('returns only unread events past the checkpoint in the tail', () => {
    const events = [
      event({ id: 1, body: 'old' }),
      event({ id: 2, body: 'new1' }),
      event({ id: 3, body: 'new2' }),
    ];
    const digest = buildCatchUpDigest({ events, participantId: 1, lastSeenEventId: 1 });
    expect(digest.unreadCount).toBe(2);
    expect(digest.tail.map((e) => e.body)).toEqual(['new1', 'new2']);
  });

  it('caps the tail at tailLimit without dropping unreadCount accuracy', () => {
    const events = Array.from({ length: 30 }, (_, i) => event({ id: i + 1, body: `e${i + 1}` }));
    const digest = buildCatchUpDigest({ events, participantId: 1, lastSeenEventId: 0, tailLimit: 5 });
    expect(digest.unreadCount).toBe(30);
    expect(digest.tail).toHaveLength(5);
    expect(digest.tail[digest.tail.length - 1].body).toBe('e30');
  });

  it('does not count a previous check-in of the same participant as unread (live 401-fix regression)', () => {
    // Reproduces the Development integration-check failure surfaced after
    // fixing the Cloudflare Pages project-name 404: a participant's own
    // prior CHECK_IN row (inserted by check-in.ts on every call) must not
    // inflate the unreadCount reported to that participant's next check-in.
    const events = [
      event({ id: 1, event_type: 'CHECK_IN', body: 'CHECK-IN — clerk' }),
      event({ id: 2, body: 'while away 1' }),
      event({ id: 3, body: 'while away 2' }),
    ];
    const digest = buildCatchUpDigest({ events, participantId: 1, lastSeenEventId: 0 });
    expect(digest.unreadCount).toBe(2);
    expect(digest.tail.map((e) => e.id)).toEqual([2, 3]);
  });

  it('surfaces a QUESTION targeted at the participant with no ANSWER as an open question', () => {
    const events = [
      event({ id: 1, event_type: 'QUESTION', target_participant_id: 1, body: 'q1' }),
      event({ id: 2, event_type: 'QUESTION', target_participant_id: 2, body: 'q2 (not for me)' }),
    ];
    const digest = buildCatchUpDigest({ events, participantId: 1, lastSeenEventId: 0 });
    expect(digest.openQuestions.map((e) => e.body)).toEqual(['q1']);
  });

  it('excludes a QUESTION once a matching ANSWER exists, even outside the unread window', () => {
    const events = [
      event({ id: 1, event_type: 'QUESTION', target_participant_id: 1, body: 'q1' }),
      event({ id: 2, event_type: 'ANSWER', in_reply_to_event_id: 1, body: 'a1' }),
    ];
    // Checkpoint already past both events — question is answered, not just unread.
    const digest = buildCatchUpDigest({ events, participantId: 1, lastSeenEventId: 2 });
    expect(digest.openQuestions).toHaveLength(0);
  });

  it('treats a broadcast QUESTION (no target) as open for every participant', () => {
    const events = [event({ id: 1, event_type: 'QUESTION', target_participant_id: null, body: 'broadcast' })];
    const digest = buildCatchUpDigest({ events, participantId: 42, lastSeenEventId: 0 });
    expect(digest.openQuestions).toHaveLength(1);
  });

  it('caps pmoInstructions at pmoInstructionLimit, keeping the most recent', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      event({ id: i + 1, event_type: 'PMO_INSTRUCTION', body: `pmo${i + 1}` }),
    );
    const digest = buildCatchUpDigest({ events, participantId: 1, lastSeenEventId: 0, pmoInstructionLimit: 2 });
    expect(digest.pmoInstructions.map((e) => e.body)).toEqual(['pmo4', 'pmo5']);
  });
});
