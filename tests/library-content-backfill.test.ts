import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CREDIT_LINE,
  DEFAULT_SOURCE_NAME,
  buildInsertStatement,
  buildMigratedFields,
  buildPlanForBackfill,
  buildSearchText,
  buildSummary,
  buildUpdateStatement,
  classifyLegacyRow,
  computeRowClassCounts,
  deriveCreditLine,
  hasApprovalColumn,
  planRow,
  sqlLiteral,
  tagForLegacyId,
} from '../scripts/migrations/library-content-backfill.mjs';

type RowPlan = {
  legacyId: number;
  action: 'insert' | 'update' | 'noop' | 'excluded' | 'conflict';
  fields?: Record<string, unknown>;
  id?: number;
  exceptionCode?: string;
  willBecomePublished?: boolean;
};

type LegacyRow = {
  id: number;
  name: string;
  email: string;
  title: string;
  content: string;
  created_at: string;
  is_approved?: number;
};

function row(overrides: Partial<LegacyRow> = {}): LegacyRow {
  return {
    id: 1,
    name: 'Jane Fan',
    email: 'jane@example.com',
    title: 'My Gehrig Memory',
    content: 'A real memory about Lou Gehrig.',
    created_at: '2020-05-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sqlLiteral', () => {
  it('escapes single quotes and never leaves them unescaped', () => {
    expect(sqlLiteral("O'Brien's story")).toBe("'O''Brien''s story'");
  });

  it('renders null and numbers without quoting', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(42)).toBe('42');
  });
});

describe('tagForLegacyId', () => {
  it('produces the deterministic source identity from the #2910 map', () => {
    expect(tagForLegacyId(7)).toBe('legacy-library-7');
  });
});

describe('hasApprovalColumn', () => {
  it('detects the schema-variance case (0002 vs 0004)', () => {
    expect(hasApprovalColumn([{ name: 'id' }, { name: 'title' }])).toBe(false);
    expect(hasApprovalColumn([{ name: 'id' }, { name: 'is_approved' }])).toBe(true);
  });
});

describe('deriveCreditLine', () => {
  it('uses the trimmed name when present', () => {
    expect(deriveCreditLine('  Jane Fan  ')).toBe('Jane Fan');
  });

  it('falls back to the standing anonymous default when the name is blank', () => {
    expect(deriveCreditLine('')).toBe(DEFAULT_CREDIT_LINE);
    expect(deriveCreditLine('   ')).toBe(DEFAULT_CREDIT_LINE);
  });
});

describe('buildSearchText / buildSummary', () => {
  it('never includes email and joins only the sanctioned fields, lowercased', () => {
    const text = buildSearchText({
      title: 'My Title',
      text: 'Body TEXT',
      creditLine: 'Jane Fan',
      sourceName: DEFAULT_SOURCE_NAME,
      tag: 'legacy-library-1',
    });
    expect(text).toBe('my title body text jane fan lgfc fan club library (legacy submission) legacy-library-1');
    expect(text).not.toContain('@');
  });

  it('truncates summary to 160 chars and trims whitespace', () => {
    const long = 'x'.repeat(200);
    const summary = buildSummary(long);
    expect(summary).toHaveLength(160);
    expect(buildSummary('   ')).toBeNull();
  });
});

describe('classifyLegacyRow', () => {
  it('excludes rows with an empty title, failing closed', () => {
    const c = classifyLegacyRow(row({ title: '  ' }), false);
    expect(c.disposition).toBe('excluded');
    expect(c.exceptionCode).toBe('LE_INVALID_EMPTY');
  });

  it('excludes rows with empty content', () => {
    const c = classifyLegacyRow(row({ content: '' }), false);
    expect(c.disposition).toBe('excluded');
  });

  it('treats rows as draft when the approval column is absent from the schema', () => {
    const c = classifyLegacyRow(row({ is_approved: 1 }), false);
    expect((c as { status?: string }).status).toBe('draft');
    expect(c.approved).toBe(false);
  });

  it('publishes approved rows with a usable credit line (name present)', () => {
    const c = classifyLegacyRow(row({ is_approved: 1 }), true);
    expect((c as { status?: string }).status).toBe('published');
    expect(c.approved).toBe(true);
  });

  it('still publishes approved rows with a blank name, via the default credit line', () => {
    const c = classifyLegacyRow(row({ name: '', is_approved: 1 }), true);
    expect((c as { status?: string }).status).toBe('published');
    expect(c.missingName).toBe(true);
  });

  it('flags rows with an email without ever exposing it downstream', () => {
    const c = classifyLegacyRow(row({ email: 'someone@example.com' }), false);
    expect(c.hasEmail).toBe(true);
  });
});

describe('computeRowClassCounts', () => {
  it('produces privacy-safe aggregate counts matching the #2910 taxonomy', () => {
    const rows = [
      row({ id: 1, is_approved: 1, name: 'A' }),
      row({ id: 2, is_approved: 0, name: '' }),
      row({ id: 3, title: '' }),
      row({ id: 4, email: '' }),
    ];
    const counts = computeRowClassCounts(rows, true);
    expect(counts).toEqual({
      LE_TOTAL: 4,
      LE_APPROVED: 1,
      LE_UNAPPROVED: 3,
      LE_INVALID_EMPTY: 1,
      LE_MISSING_NAME: 1,
      LE_HAS_EMAIL: 3,
    });
  });
});

describe('buildMigratedFields', () => {
  it('never carries the legacy email into any inventory field', () => {
    const r = row({ email: 'secret@example.com' });
    const fields = buildMigratedFields(r, classifyLegacyRow(r, false));
    const serialized = JSON.stringify(fields);
    expect(serialized).not.toContain('secret@example.com');
    expect(fields.source_name).toBe(DEFAULT_SOURCE_NAME);
    expect(fields.canonical).toBe(1);
    expect(fields.allowed_sections).toBe('["library"]');
  });
});

describe('planRow', () => {
  it('plans an insert for a brand-new legacy row', () => {
    const plan = planRow(row({ id: 5 }), false, new Map());
    expect(plan.action).toBe('insert');
    expect(plan.fields?.tag).toBe('legacy-library-5');
  });

  it('excludes invalid rows without planning any write', () => {
    const plan = planRow(row({ id: 6, content: '' }), false, new Map());
    expect(plan.action).toBe('excluded');
  });

  it('plans a no-op when the existing migrated row already matches (idempotency)', () => {
    const r = row({ id: 7 });
    const classification = classifyLegacyRow(r, false);
    const fields = buildMigratedFields(r, classification);
    const existing = new Map([[fields.tag, { id: 100, ...fields }]]);
    const plan = planRow(r, false, existing);
    expect(plan.action).toBe('noop');
  });

  it('plans an update when the source row changed since the last migration', () => {
    const r = row({ id: 8 });
    const classification = classifyLegacyRow(r, false);
    const fields = buildMigratedFields(r, classification);
    const stale = { id: 101, ...fields, title: 'An older title' };
    const plan = planRow(r, false, new Map([[fields.tag, stale]]));
    expect(plan.action).toBe('update');
    expect(plan.id).toBe(101);
  });

  it('fails closed on a tag collision with a row this migration does not own', () => {
    const r = row({ id: 9 });
    const foreign = { id: 102, tag: 'legacy-library-9', source_name: 'Some Editor Manually Set This' };
    const plan = planRow(r, false, new Map([[foreign.tag, foreign]]));
    expect(plan.action).toBe('conflict');
    expect(plan.exceptionCode).toBe('TAG_COLLISION_NON_MIGRATION_SOURCE');
  });

  it('only marks published_at for a first-time transition into published, not an already-published row', () => {
    const r = row({ id: 10, is_approved: 1 });
    const classification = classifyLegacyRow(r, true);
    const fields = buildMigratedFields(r, classification);
    const alreadyPublished = { id: 103, ...fields, status: 'published', title: 'stale title' };
    const plan = planRow(r, true, new Map([[fields.tag, alreadyPublished]]));
    expect(plan.action).toBe('update');
    expect(plan.willBecomePublished).toBe(false);
  });
});

describe('buildPlanForBackfill — full idempotency proof', () => {
  it('produces zero net new tags on a second run against its own output', () => {
    const rows = [
      row({ id: 1, is_approved: 1, name: 'Jane' }),
      row({ id: 2, is_approved: 0, name: '' }),
      row({ id: 3, title: '' }), // excluded
    ];

    const firstRun = buildPlanForBackfill(rows, true, []);
    expect(firstRun.summary).toEqual({ insert: 2, update: 0, noop: 0, excluded: 1, conflict: 0 });

    // Simulate applying the first run's inserts, then plan again with that as existing state.
    const existingAfterFirstRun = (firstRun.plans as RowPlan[])
      .filter((p) => p.action === 'insert')
      .map((p, i) => ({ id: 1000 + i, ...p.fields }));

    const secondRun = buildPlanForBackfill(rows, true, existingAfterFirstRun);
    expect(secondRun.summary).toEqual({ insert: 0, update: 0, noop: 2, excluded: 1, conflict: 0 });
    expect(secondRun.counts.CI_LEGACY_TAG).toBe(2);
  });

  it('migrates two legacy rows with identical title/content as separate tags, no auto-merge', () => {
    const rows = [
      row({ id: 1, title: 'Same Title', content: 'Same content body.' }),
      row({ id: 2, title: 'Same Title', content: 'Same content body.' }),
    ];
    const plan = buildPlanForBackfill(rows, false, []);
    expect(plan.summary.insert).toBe(2);
    const tags = (plan.plans as RowPlan[])
      .filter((p) => p.action === 'insert')
      .map((p) => p.fields?.tag);
    expect(new Set(tags).size).toBe(2);
  });
});

describe('SQL statement builders', () => {
  it('builds a syntactically safe INSERT with escaped content', () => {
    const r = row({ id: 1, title: "It's a title", content: 'Body' });
    const fields = buildMigratedFields(r, classifyLegacyRow(r, false));
    const sql = buildInsertStatement(fields, false);
    expect(sql).toContain("INSERT INTO content_inventory");
    expect(sql).toContain("'It''s a title'");
    expect(sql).not.toContain('email');
  });

  it('builds an UPDATE targeting the existing row id only', () => {
    const r = row({ id: 2 });
    const fields = buildMigratedFields(r, classifyLegacyRow(r, false));
    const sql = buildUpdateStatement(999, fields, false);
    expect(sql).toContain('WHERE id = 999');
    expect(sql).not.toContain('published_at');
  });

  it('sets published_at only when explicitly instructed to', () => {
    const r = row({ id: 3, is_approved: 1 });
    const fields = buildMigratedFields(r, classifyLegacyRow(r, true));
    const sql = buildUpdateStatement(999, fields, true);
    expect(sql).toContain('published_at');
  });
});
