// #3794 JULES-5 tests: only pmo/product_authority roles may force-release
// another participant's active claim, and a claim is a stale-reclamation
// candidate only once its lease is genuinely old — this only flags,
// consistent with #3415's own caution against blind reassignment.

import { describe, expect, it } from 'vitest';

import { canForceRelease, isClaimStale } from '../functions/_lib/chatterbox';

describe('canForceRelease', () => {
  it('permits pmo and product_authority role classes', () => {
    expect(canForceRelease('pmo')).toBe(true);
    expect(canForceRelease('product_authority')).toBe(true);
  });

  it('denies every other role class', () => {
    expect(canForceRelease('implementation_agent')).toBe(false);
    expect(canForceRelease('engineering_validation')).toBe(false);
    expect(canForceRelease('system_clerk')).toBe(false);
    expect(canForceRelease('not_a_real_role')).toBe(false);
  });
});

describe('isClaimStale', () => {
  it('is stale once the lease is older than the default 24h threshold', () => {
    const now = new Date('2026-08-28T00:00:00.000Z');
    expect(isClaimStale({ renewed_at: '2026-08-26T23:00:00.000Z' }, now)).toBe(true);
    expect(isClaimStale({ renewed_at: '2026-08-27T12:00:00.000Z' }, now)).toBe(false);
  });

  it('honors a custom threshold', () => {
    const now = new Date('2026-08-28T00:00:00.000Z');
    const oneHourAgo = '2026-08-27T23:00:00.000Z';
    expect(isClaimStale({ renewed_at: oneHourAgo }, now, 30 * 60_000)).toBe(true);
    expect(isClaimStale({ renewed_at: oneHourAgo }, now, 2 * 3600_000)).toBe(false);
  });
});
