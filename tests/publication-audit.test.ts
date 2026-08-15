import { describe, expect, it } from 'vitest';

import {
  buildPublicationEventBinds,
  toAuditAction,
} from '../functions/_lib/publication-audit';

describe('publication-audit', () => {
  it('maps pause_schedule to the Task 005 pause action', () => {
    expect(toAuditAction('pause_schedule')).toBe('pause');
    expect(toAuditAction('cancel_schedule')).toBe('cancel_schedule');
    expect(toAuditAction('approve')).toBe('approve');
  });

  it('copies approval and source snapshots and marks public_check only for published', () => {
    const binds = buildPublicationEventBinds({
      inventoryId: 4,
      action: 'publish',
      actor: 'Bill',
      fromState: 'approved',
      toState: 'published',
      reason: '',
      eventAt: '2026-08-15T12:00:00Z',
      approvedBy: 'Bill',
      approvedAt: '2026-08-14T22:00:00Z',
      sourceName: 'Archive',
      creditLine: 'LGFC Archive',
    });

    expect(binds[5]).toBe(4);
    expect(binds[8]).toBe('publish');
    expect(binds[12]).toBe(JSON.stringify({ approved_by: 'Bill', approved_at: '2026-08-14T22:00:00Z' }));
    expect(binds[13]).toBe(JSON.stringify({ source_name: 'Archive', credit_line: 'LGFC Archive' }));
    expect(binds[14]).toBe(1);
  });

  it('does not mark public_check for unpublish', () => {
    const binds = buildPublicationEventBinds({
      inventoryId: 4,
      action: 'unpublish',
      actor: 'Bill',
      fromState: 'published',
      toState: 'unpublished',
      reason: 'Withdrawn by Product Authority',
      eventAt: '2026-08-15T12:00:00Z',
    });
    expect(binds[8]).toBe('unpublish');
    expect(binds[9]).toBe('Withdrawn by Product Authority');
    expect(binds[14]).toBe(0);
  });
});
