// #3794 Layer 1 / Jules #3579 JULES-3 regression test: a concurrent event
// written between a check-in's read and its own CHECK_IN insert must never
// be permanently skipped by that check-in's checkpoint advance.

import { describe, expect, it } from 'vitest';

import { buildCatchUpDigest, computeCheckInHighWatermark, type ChatterboxEventRow } from '../functions/_lib/chatterbox';

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
    created_at: '2026-08-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeCheckInHighWatermark (JULES-3 fix)', () => {
  it('returns the last id in the events read at check-in time, not any later id', () => {
    const priorEvents = [event({ id: 1 }), event({ id: 2 }), event({ id: 3 })];
    expect(computeCheckInHighWatermark(priorEvents, 0)).toBe(3);
  });

  it('falls back to lastSeenEventId when there are no prior events at all', () => {
    expect(computeCheckInHighWatermark([], 7)).toBe(7);
  });

  it('never advances past a concurrently-written event the read never saw', () => {
    // Participant A checks in. At read time the room has events 1-3.
    const priorEvents = [event({ id: 1 }), event({ id: 2 }), event({ id: 3 })];
    const highWatermark = computeCheckInHighWatermark(priorEvents, 0);

    // Concurrently, participant B posts event 4 — after A's read, before A's
    // own CHECK_IN event (which lands as id 5) is inserted.
    const concurrentEventId = 4;
    const ownCheckInEventId = 5;

    // The bug this regression test guards against: advancing to the newly
    // inserted CHECK_IN event's own id instead of the captured watermark.
    expect(highWatermark).not.toBe(ownCheckInEventId);
    expect(highWatermark).toBeLessThan(concurrentEventId);
  });

  it('leaves a concurrent event visible to the very next check-in instead of skipping it forever', () => {
    const firstCheckInPriorEvents = [event({ id: 1 }), event({ id: 2 }), event({ id: 3 })];
    const firstCheckpoint = computeCheckInHighWatermark(firstCheckInPriorEvents, 0);
    expect(firstCheckpoint).toBe(3);

    // Event 4 was written concurrently with the first check-in and never
    // appeared in its digest. Event 5 was that check-in's own CHECK_IN event.
    // By the second check-in, the room additionally contains events 4 and 5.
    const secondCheckInPriorEvents = [
      ...firstCheckInPriorEvents,
      event({ id: 4, body: 'concurrent write B missed the first time' }),
      event({ id: 5, event_type: 'CHECK_IN', body: 'CHECK-IN — A' }),
    ];

    const secondDigest = buildCatchUpDigest({
      events: secondCheckInPriorEvents,
      participantId: 1,
      lastSeenEventId: firstCheckpoint,
    });

    // Event 4 must surface now — it was never permanently lost.
    expect(secondDigest.tail.map((e) => e.id)).toContain(4);
  });
});
