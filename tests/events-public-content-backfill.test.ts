import { describe, expect, it } from 'vitest';

import {
  ALLOWED_SECTIONS_JSON,
  DEFAULT_CREDIT_LINE,
  DEFAULT_SOURCE_NAME,
  MIGRATION_TAG_PREFIX,
  ROTATION_GROUP,
  buildInsertStatement,
  buildMigratedFields,
  buildPlanForBackfill,
  buildSearchText,
  buildSummary,
  buildUpdateStatement,
  classifyEventRow,
  composeEventText,
  computeRowClassCounts,
  deriveSourceName,
  eventYearFromStartDate,
  planRow,
  sqlLiteral,
  tagForLegacyId,
} from '../scripts/migrations/events-public-content-backfill.mjs';

type EventRow = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  host?: string | null;
  fees?: string | null;
  description: string;
  external_url?: string | null;
  status: 'posted' | 'hidden';
  created_at?: string | null;
  updated_at?: string | null;
};

function row(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    title: 'Lou Gehrig Day',
    start_date: '2026-06-02',
    end_date: null,
    location: 'Yankee Stadium',
    host: 'LGFC',
    fees: 'Free',
    description: 'Annual remembrance day.',
    external_url: 'https://example.com/lgd',
    status: 'posted',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('sqlLiteral', () => {
  it('escapes single quotes', () => {
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'");
  });
});

describe('tagForLegacyId', () => {
  it('uses the mapping identity prefix', () => {
    expect(tagForLegacyId(21)).toBe(`${MIGRATION_TAG_PREFIX}21`);
  });
});

describe('classifyEventRow', () => {
  it('publishes posted rows with required fields', () => {
    expect(classifyEventRow(row()).status).toBe('published');
  });

  it('archives hidden rows', () => {
    expect(classifyEventRow(row({ status: 'hidden' })).status).toBe('archived');
  });

  it('excludes blank title/description/start_date', () => {
    expect(classifyEventRow(row({ title: '  ' })).exceptionCode).toBe('EV_INVALID_EMPTY');
    expect(classifyEventRow(row({ description: '' })).exceptionCode).toBe('EV_INVALID_EMPTY');
    expect(classifyEventRow(row({ start_date: null as unknown as string })).exceptionCode).toBe(
      'EV_INVALID_EMPTY',
    );
  });
});

describe('composeEventText / summary / search', () => {
  it('folds end_date, location, and fees into text', () => {
    const text = composeEventText(
      row({ end_date: '2026-06-03', location: 'Park', fees: '$5', description: 'Hello' }),
    );
    expect(text).toContain('Hello');
    expect(text).toContain('Through 2026-06-03');
    expect(text).toContain('Location: Park');
    expect(text).toContain('Fees: $5');
  });

  it('builds summary and search_text without inventing search section', () => {
    expect(buildSummary({ title: 'A', startDate: '2026-06-02', location: 'NY' })).toBe(
      'A — 2026-06-02 — NY',
    );
    expect(buildSearchText({ title: 'A', text: 'B', location: 'C', host: 'D', tag: 'legacy-events-1' })).toBe(
      'a b c d legacy-events-1',
    );
  });

  it('derives event_year and source_name defaults', () => {
    expect(eventYearFromStartDate('2026-06-02')).toBe(2026);
    expect(deriveSourceName('')).toBe(DEFAULT_SOURCE_NAME);
    expect(deriveSourceName('  Host  ')).toBe('Host');
  });
});

describe('buildMigratedFields', () => {
  it('sets calendar-only allowed_sections and required credit_line', () => {
    const fields = buildMigratedFields(row(), classifyEventRow(row()));
    expect(fields.allowed_sections).toBe(ALLOWED_SECTIONS_JSON);
    expect(fields.allowed_sections).not.toContain('search');
    expect(fields.credit_line).toBe(DEFAULT_CREDIT_LINE);
    expect(fields.rotation_group).toBe(ROTATION_GROUP);
    expect(fields.event_date).toBe('2026-06-02');
    expect(fields.event_year).toBe(2026);
    expect(fields.source_name).toBe('LGFC');
  });
});

describe('planRow / buildPlanForBackfill', () => {
  it('plans inserts for new tags and noops for unchanged migration rows', () => {
    const event = row();
    const fields = buildMigratedFields(event, classifyEventRow(event));
    const insertPlan = planRow(event, new Map());
    expect(insertPlan.action).toBe('insert');

    const existing = new Map([
      [
        fields.tag,
        {
          id: 99,
          ...fields,
        },
      ],
    ]);
    expect(planRow(event, existing).action).toBe('noop');
  });

  it('fail-closes on non-migration tag collisions', () => {
    const event = row();
    const existing = new Map([
      [
        tagForLegacyId(event.id),
        {
          id: 5,
          tag: tagForLegacyId(event.id),
          credit_line: 'Someone else',
          rotation_group: 'editorial',
          source_name: 'Editor',
        },
      ],
    ]);
    expect(planRow(event, existing)).toMatchObject({
      action: 'conflict',
      exceptionCode: 'TAG_COLLISION_NON_MIGRATION_SOURCE',
    });
  });

  it('aggregates privacy-safe class counts', () => {
    const plan = buildPlanForBackfill(
      [row(), row({ id: 2, status: 'hidden' }), row({ id: 3, title: ' ' })],
      [],
    );
    expect(plan.counts.EV_TOTAL).toBe(3);
    expect(plan.counts.EV_POSTED).toBe(2); // includes invalid empty that still has status=posted
    expect(plan.counts.EV_HIDDEN).toBe(1);
    expect(plan.counts.EV_INVALID_EMPTY).toBe(1);
    expect(plan.summary.insert).toBe(2);
    expect(plan.summary.excluded).toBe(1);
  });
});

describe('SQL builders', () => {
  it('includes event_date/event_year/rotation_group and publish attribution fields', () => {
    const fields = buildMigratedFields(row(), classifyEventRow(row()));
    const insertSql = buildInsertStatement(fields, true);
    expect(insertSql).toContain('event_date');
    expect(insertSql).toContain('event_year');
    expect(insertSql).toContain('rotation_group');
    expect(insertSql).toContain('published_at');
    expect(insertSql).toContain('calendar');
    expect(insertSql).not.toContain('"search"');

    const updateSql = buildUpdateStatement(9, fields, false);
    expect(updateSql).toContain('WHERE id = 9');
    expect(updateSql).not.toContain('published_at');
  });
});

describe('computeRowClassCounts', () => {
  it('counts posted/hidden/invalid without emitting row content', () => {
    expect(computeRowClassCounts([row({ status: 'posted' }), row({ id: 2, status: 'hidden' })])).toEqual({
      EV_TOTAL: 2,
      EV_POSTED: 1,
      EV_HIDDEN: 1,
      EV_INVALID_EMPTY: 0,
    });
  });
});
