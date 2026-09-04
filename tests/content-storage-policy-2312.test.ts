import { describe, expect, it } from 'vitest';
import {
  classifyDedupe,
  evaluateObjectAvailability,
  evaluatePurgeEligibility,
  evaluateRecoveryOutcome,
  evaluateStorageCapacity,
  mustRetainOriginal,
} from '../functions/_lib/content-storage-policy';

// Deterministic fixtures for #2312's seven named scenarios: normal
// retention, duplicate object, missing object, free-tier threshold, rights
// hold, recovery failure, and approved deletion.

describe('#2312 content storage policy — normal retention', () => {
  it('keeps a retained PDF original within capacity, with its B2 object present', () => {
    expect(evaluateStorageCapacity(1_000_000, 10_000_000_000).status).toBe('ok');
    expect(mustRetainOriginal('pdf')).toBe(true);
    expect(evaluateObjectAvailability(true, true)).toBe('available');
  });
});

describe('#2312 content storage policy — duplicate object', () => {
  it('classifies a candidate whose hash already exists as a duplicate, not a new retention', () => {
    const existing = ['a1b2c3', 'd4e5f6'];
    expect(classifyDedupe('a1b2c3', existing)).toBe('duplicate');
    expect(classifyDedupe('99z99z', existing)).toBe('new');
  });
});

describe('#2312 content storage policy — missing object', () => {
  it('raises a tracked exception for a D1 reference whose B2 object does not exist', () => {
    expect(evaluateObjectAvailability(true, false)).toBe('missing_object_exception');
  });

  it('is available when there is no B2 reference to begin with', () => {
    expect(evaluateObjectAvailability(false, false)).toBe('available');
  });
});

describe('#2312 content storage policy — free-tier threshold', () => {
  it('fails closed into blocked_exception at or above the free-tier capacity', () => {
    const atCapacity = evaluateStorageCapacity(10_000_000_000, 10_000_000_000);
    expect(atCapacity.status).toBe('blocked_exception');
    expect(atCapacity.reason).toBe('free_tier_threshold_exceeded');
  });

  it('warns before the threshold is reached rather than only at the limit', () => {
    const nearCapacity = evaluateStorageCapacity(8_500_000_000, 10_000_000_000);
    expect(nearCapacity.status).toBe('warning');
  });

  it('treats unknown/zero capacity as an exception rather than an unbounded free pass', () => {
    expect(evaluateStorageCapacity(1, 0).status).toBe('blocked_exception');
  });
});

describe('#2312 content storage policy — rights hold', () => {
  it('blocks purge for a rights hold even when deletion was otherwise approved', () => {
    const result = evaluatePurgeEligibility({
      legalHold: false,
      rightsHold: true,
      privacyRestricted: false,
      deletionApproved: true,
    });
    expect(result).toEqual({ eligible: false, reason: 'rights_hold' });
  });
});

describe('#2312 content storage policy — recovery failure', () => {
  it('treats a restore that was attempted but not verified as a failure, not a success', () => {
    expect(evaluateRecoveryOutcome(true, false)).toBe('recovery_failure_exception');
    expect(evaluateRecoveryOutcome(false, false)).toBe('recovery_failure_exception');
  });

  it('confirms recovery only once both restored and verified are true', () => {
    expect(evaluateRecoveryOutcome(true, true)).toBe('confirmed');
  });
});

describe('#2312 content storage policy — approved deletion', () => {
  it('permits purge only with no holds/restrictions and explicit deletion approval', () => {
    const result = evaluatePurgeEligibility({
      legalHold: false,
      rightsHold: false,
      privacyRestricted: false,
      deletionApproved: true,
    });
    expect(result).toEqual({ eligible: true, reason: null });
  });

  it('never auto-approves deletion: withholding approval blocks purge even with no holds', () => {
    const result = evaluatePurgeEligibility({
      legalHold: false,
      rightsHold: false,
      privacyRestricted: false,
      deletionApproved: false,
    });
    expect(result).toEqual({ eligible: false, reason: 'deletion_not_approved' });
  });
});
