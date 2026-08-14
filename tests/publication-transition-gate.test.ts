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
});
