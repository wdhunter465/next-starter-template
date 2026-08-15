import { describe, expect, it } from 'vitest';

import {
  evaluatePublicationTransition,
  inferPublicationAction,
  resolveOperationalState,
} from '../functions/_lib/publication-transition-gate';

describe('publication-transition-gate', () => {
  it('maps missing operational_state from inventory status', () => {
    expect(resolveOperationalState('draft', null)).toBe('draft');
    expect(resolveOperationalState('published', '')).toBe('published');
    expect(resolveOperationalState('archived', undefined)).toBe('unpublished');
    expect(resolveOperationalState('draft', 'approved')).toBe('approved');
  });

  it('infers legacy status posts into named actions', () => {
    expect(inferPublicationAction('published')).toBe('publish');
    expect(inferPublicationAction('archived')).toBe('archive');
    expect(inferPublicationAction('draft')).toBe('return_to_draft');
  });

  it('A1 refuses publish when operational state is not approved or scheduled', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'published',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A1' });
  });

  it('A2 refuses publish when approved_by or approved_at is missing', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A2' });
  });

  it('A3 refuses illegal draft to published jump', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'draft',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A3' });
  });

  it('A4 refuses scheduled fire before scheduled_at or while paused', () => {
    const early = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'scheduled',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-15T00:00:00Z',
      nowIso: '2026-08-14T23:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(early).toMatchObject({ ok: false, checkId: 'A4' });

    const paused = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'scheduled',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-14T20:00:00Z',
      nowIso: '2026-08-14T23:00:00Z',
      paused: true,
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(paused).toMatchObject({ ok: false, checkId: 'A4' });
  });

  it('A4 parses D1 datetime(now) space-form timestamps for scheduled fire', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'scheduled',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14 22:00:00',
      scheduledAt: '2026-08-14 20:00:00',
      nowIso: '2026-08-14 23:00:00',
      paused: false,
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toEqual({ ok: true });
  });

  it('A5 refuses automation-invented approvers', () => {
    const result = evaluatePublicationTransition({
      action: 'approve',
      currentInventoryStatus: 'draft',
      operationalState: 'draft',
      requestedApprovedBy: 'scheduler',
      requestedApprovedAt: '2026-08-14T22:00:00Z',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A5' });
  });

  it('A6 refuses republish from unpublished without a new approved step', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'archived',
      operationalState: 'unpublished',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A6' });
  });

  it('A6 allows republish after a new approve while inventory status is still archived', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'archived',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T23:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toEqual({ ok: true });
  });

  it('A7 refuses rollback that would publish without an approval snapshot', () => {
    const result = evaluatePublicationTransition({
      action: 'rollback',
      currentInventoryStatus: 'archived',
      operationalState: 'unpublished',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A7' });
  });

  it('allows approved to published when A2 and S4 pass', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toEqual({ ok: true });
  });

  it('S4 refuses publish without source_name and credit_line', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      sourceName: '',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'S4' });
  });

  it('S9 refuses unpublish without a reason', () => {
    const result = evaluatePublicationTransition({
      action: 'unpublish',
      currentInventoryStatus: 'published',
      operationalState: 'published',
      reason: '',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'S9' });
  });

  it('allows unpublish from published when a reason is recorded', () => {
    const result = evaluatePublicationTransition({
      action: 'unpublish',
      currentInventoryStatus: 'published',
      operationalState: 'published',
      reason: 'Withdrawn by Product Authority',
    });
    expect(result).toEqual({ ok: true });
  });

  it('allows A7 when rollback carries an approval snapshot', () => {
    const result = evaluatePublicationTransition({
      action: 'rollback',
      currentInventoryStatus: 'archived',
      operationalState: 'unpublished',
      approvalSnapshot: { approvedBy: 'Bill', approvedAt: '2026-08-14T22:00:00Z' },
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toEqual({ ok: true });
  });

  it('S4 refuses rollback restore without source_name and credit_line', () => {
    const result = evaluatePublicationTransition({
      action: 'rollback',
      currentInventoryStatus: 'archived',
      operationalState: 'unpublished',
      approvalSnapshot: { approvedBy: 'Bill', approvedAt: '2026-08-14T22:00:00Z' },
      sourceName: '',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'S4' });
  });

  it('A3 refuses rollback restore from published', () => {
    const result = evaluatePublicationTransition({
      action: 'rollback',
      currentInventoryStatus: 'published',
      operationalState: 'published',
      approvalSnapshot: { approvedBy: 'Bill', approvedAt: '2026-08-14T22:00:00Z' },
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A3' });
  });

  it('A4 refuses schedule without an explicit UTC scheduled_at', () => {
    const result = evaluatePublicationTransition({
      action: 'schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A4' });
  });

  it('A4 refuses schedule when scheduled_at lacks an explicit UTC timezone', () => {
    const timezoneLess = evaluatePublicationTransition({
      action: 'schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-16T12:00:00',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(timezoneLess).toMatchObject({ ok: false, checkId: 'A4' });

    const nonUtcOffset = evaluatePublicationTransition({
      action: 'schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-16T12:00:00+05:00',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(nonUtcOffset).toMatchObject({ ok: false, checkId: 'A4' });
  });

  it('A3 refuses schedule from draft', () => {
    const result = evaluatePublicationTransition({
      action: 'schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'draft',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-16T12:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A3' });
  });

  it('allows approved to scheduled when A2, A4, and S4 pass', () => {
    const withZ = evaluatePublicationTransition({
      action: 'schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-16T12:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(withZ).toEqual({ ok: true });

    const withOffset = evaluatePublicationTransition({
      action: 'schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'approved',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-16T12:00:00+00:00',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(withOffset).toEqual({ ok: true });
  });

  it('S9 refuses pause without a reason', () => {
    const result = evaluatePublicationTransition({
      action: 'pause_schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'scheduled',
      reason: '',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'S9' });
  });

  it('allows cancel_schedule from scheduled', () => {
    const result = evaluatePublicationTransition({
      action: 'cancel_schedule',
      currentInventoryStatus: 'draft',
      operationalState: 'scheduled',
    });
    expect(result).toEqual({ ok: true });
  });

  it('allows scheduled fire after scheduled_at when not paused', () => {
    const result = evaluatePublicationTransition({
      action: 'publish',
      currentInventoryStatus: 'draft',
      operationalState: 'scheduled',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      scheduledAt: '2026-08-14T20:00:00Z',
      nowIso: '2026-08-14T23:00:00Z',
      paused: false,
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });
    expect(result).toEqual({ ok: true });
  });

  it('allows stage from draft and reviewed', () => {
    expect(
      evaluatePublicationTransition({
        action: 'stage',
        currentInventoryStatus: 'draft',
        operationalState: 'draft',
      }),
    ).toEqual({ ok: true });
    expect(
      evaluatePublicationTransition({
        action: 'stage',
        currentInventoryStatus: 'draft',
        operationalState: 'reviewed',
      }),
    ).toEqual({ ok: true });
  });

  it('A3 refuses stage from published', () => {
    const result = evaluatePublicationTransition({
      action: 'stage',
      currentInventoryStatus: 'published',
      operationalState: 'published',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'A3' });
  });

  it('S4 refuses review when rights or privacy is missing', () => {
    const result = evaluatePublicationTransition({
      action: 'review',
      currentInventoryStatus: 'draft',
      operationalState: 'staged',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
      rightsStatus: 'unknown',
      privacyFlag: 'none',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'S4' });
  });

  it('allows review when source, credit, rights, and privacy are present', () => {
    const result = evaluatePublicationTransition({
      action: 'review',
      currentInventoryStatus: 'draft',
      operationalState: 'staged',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
      rightsStatus: 'owned',
      privacyFlag: 'none',
      requestedReviewer: 'Editor',
    });
    expect(result).toEqual({ ok: true });
  });

  it('S9 refuses reject without a reason', () => {
    const result = evaluatePublicationTransition({
      action: 'reject',
      currentInventoryStatus: 'draft',
      operationalState: 'staged',
      reason: '',
    });
    expect(result).toMatchObject({ ok: false, checkId: 'S9' });
  });
});
