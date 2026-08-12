import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  compareRotationRows,
  computeEventProximityBoost,
  computeRecentFeaturePenalty,
  computeRotationScore,
  daysUntilAnniversary,
  DEFAULT_HARD_COOLDOWN_DAYS,
  fetchRotationEligibleRows,
  fetchRotationRankedInventory,
  filterRotationFairnessPool,
  HOMEPAGE_SPOTLIGHT_SECTION,
  isRotationEligibleRow,
  isWithinHardCooldown,
  parseRotationTimestamp,
  recordRotationFeature,
  sortRotationRows,
} from '../functions/_lib/content-inventory-rotation';

const AS_OF = new Date('2026-06-04T12:00:00.000Z');

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Story A',
    priority: 1,
    canonical: 1,
    feature_weight: 1,
    usage_count: 0,
    allowed_sections: '["library","homepage_spotlight"]',
    status: 'published',
    source_name: 'NYT',
    credit_line: 'Jane Editor',
    event_date: null,
    event_year: null,
    rotation_group: null,
    last_featured: null,
    ...overrides,
  };
}

describe('content inventory rotation scoring', () => {
  it('boosts stories with nearby event_date anniversaries', () => {
    const near = baseRow({ id: 1, event_date: '1939-06-04' });
    const far = baseRow({ id: 2, event_date: '1939-12-25' });
    expect(computeEventProximityBoost(near, AS_OF)).toBeGreaterThan(computeEventProximityBoost(far, AS_OF));
  });

  it('parses sqlite datetime strings as UTC for deterministic scoring', () => {
    expect(parseRotationTimestamp('2026-06-01 00:00:00')).toBe(Date.parse('2026-06-01T00:00:00Z'));
  });

  it('applies recent-feature suppression from last_featured', () => {
    const recent = baseRow({ id: 1, last_featured: '2026-06-01 00:00:00' });
    const stale = baseRow({ id: 2, last_featured: '2025-01-01T00:00:00Z' });
    expect(computeRecentFeaturePenalty(recent, AS_OF)).toBeGreaterThan(computeRecentFeaturePenalty(stale, AS_OF));
    expect(computeRotationScore(recent, { asOfDate: AS_OF })).toBeLessThan(
      computeRotationScore(stale, { asOfDate: AS_OF }),
    );
  });

  it('prefers canonical rows unless alternates are explicitly included', () => {
    const canonical = baseRow({ id: 1, canonical: 1, priority: 1 });
    const alternate = baseRow({ id: 2, canonical: 0, priority: 1 });
    expect(computeRotationScore(canonical, { asOfDate: AS_OF })).toBeGreaterThan(
      computeRotationScore(alternate, { asOfDate: AS_OF }),
    );
    expect(computeRotationScore(canonical, { asOfDate: AS_OF, includeAlternates: true })).toEqual(
      computeRotationScore(alternate, { asOfDate: AS_OF, includeAlternates: true }),
    );
  });

  it('penalizes recently featured rotation groups when alternatives exist', () => {
    const grouped = baseRow({ id: 1, rotation_group: 'speech-day', priority: 2 });
    const ungrouped = baseRow({ id: 2, rotation_group: 'als-awareness', priority: 2 });
    const groupedScore = computeRotationScore(grouped, {
      asOfDate: AS_OF,
      recentFeaturedGroupCounts: { 'speech-day': 2 },
    });
    const ungroupedScore = computeRotationScore(ungrouped, {
      asOfDate: AS_OF,
      recentFeaturedGroupCounts: { 'speech-day': 2 },
    });
    expect(groupedScore).toBeLessThan(ungroupedScore);
  });

  it('sorts deterministically with stable tie-breakers', () => {
    const rows = [
      baseRow({ id: 3, title: 'Charlie', priority: 2, feature_weight: 1 }),
      baseRow({ id: 1, title: 'Alpha', priority: 2, feature_weight: 1 }),
      baseRow({ id: 2, title: 'Bravo', priority: 2, feature_weight: 1 }),
    ];
    const first = sortRotationRows(rows, { asOfDate: AS_OF });
    const second = sortRotationRows(rows, { asOfDate: AS_OF });
    expect(first.map((row) => row.id)).toEqual(second.map((row) => row.id));
    expect(first.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(compareRotationRows(first[0], first[1], { asOfDate: AS_OF })).toBeLessThan(0);
  });

  it('excludes ineligible records from rotation eligibility', () => {
    expect(
      isRotationEligibleRow(
        baseRow({ status: 'draft' }),
        HOMEPAGE_SPOTLIGHT_SECTION,
      ),
    ).toBe(false);
    expect(
      isRotationEligibleRow(
        baseRow({ allowed_sections: '["library"]' }),
        HOMEPAGE_SPOTLIGHT_SECTION,
      ),
    ).toBe(false);
    expect(
      isRotationEligibleRow(
        baseRow({ source_name: '' }),
        HOMEPAGE_SPOTLIGHT_SECTION,
      ),
    ).toBe(false);
    expect(
      isRotationEligibleRow(
        baseRow({ credit_line: '' }),
        HOMEPAGE_SPOTLIGHT_SECTION,
      ),
    ).toBe(false);
    expect(isRotationEligibleRow(baseRow(), HOMEPAGE_SPOTLIGHT_SECTION)).toBe(true);
  });

  it('hard-excludes rows inside the recent-use cooldown window', () => {
    const recent = baseRow({ id: 1, last_featured: '2026-06-01T00:00:00Z', priority: 99 });
    const ready = baseRow({ id: 2, last_featured: '2025-01-01T00:00:00Z', priority: 1 });
    const future = baseRow({ id: 3, last_featured: '2026-06-10T00:00:00Z', priority: 99 });
    expect(isWithinHardCooldown(recent, AS_OF, DEFAULT_HARD_COOLDOWN_DAYS)).toBe(true);
    expect(isWithinHardCooldown(ready, AS_OF, DEFAULT_HARD_COOLDOWN_DAYS)).toBe(false);
    expect(isWithinHardCooldown(future, AS_OF, DEFAULT_HARD_COOLDOWN_DAYS)).toBe(true);
    expect(filterRotationFairnessPool([recent, ready, future], { asOfDate: AS_OF }).map((row) => row.id)).toEqual([
      2,
    ]);
  });

  it('prefers least-used eligible rows when editorial scores tie', () => {
    const heavy = baseRow({ id: 1, title: 'Alpha', usage_count: 5, priority: 2 });
    const light = baseRow({ id: 2, title: 'Bravo', usage_count: 1, priority: 2 });
    const ranked = sortRotationRows([heavy, light], { asOfDate: AS_OF });
    expect(ranked.map((row) => row.id)).toEqual([2, 1]);
    expect(computeRotationScore(light, { asOfDate: AS_OF })).toBeGreaterThan(
      computeRotationScore(heavy, { asOfDate: AS_OF }),
    );
  });

  it('relaxes hard cooldown only when the eligible pool would otherwise be empty', () => {
    const onlyCooling = [
      baseRow({ id: 1, last_featured: '2026-06-02T00:00:00Z', usage_count: 3 }),
      baseRow({ id: 2, last_featured: '2026-06-03T00:00:00Z', usage_count: 1 }),
    ];
    expect(filterRotationFairnessPool(onlyCooling, { asOfDate: AS_OF }).map((row) => row.id)).toEqual([1, 2]);
    expect(
      filterRotationFairnessPool(onlyCooling, { asOfDate: AS_OF, relaxHardCooldownWhenEmpty: false }),
    ).toEqual([]);
  });
});

describe('content inventory rotation queries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ranks eligible inventory rows for a section', async () => {
    const inventory = [
      baseRow({
        id: 1,
        title: 'Older feature',
        priority: 1,
        last_featured: '2026-05-01T00:00:00Z',
        usage_count: 2,
        allowed_sections: '["library"]',
      }),
      baseRow({
        id: 2,
        title: 'Event boost',
        priority: 1,
        event_date: '1939-06-04',
        usage_count: 0,
        allowed_sections: '["library"]',
      }),
      baseRow({
        id: 3,
        title: 'Draft',
        status: 'draft',
        allowed_sections: '["library"]',
      }),
      baseRow({
        id: 4,
        title: 'Hard cooldown feature',
        priority: 99,
        last_featured: '2026-06-01T00:00:00Z',
        usage_count: 0,
        allowed_sections: '["library"]',
      }),
    ];

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async () => {
            if (sql.includes('FROM content_inventory')) {
              const filtered = inventory.filter((row) => {
                if (sql.includes("status = 'published'") && row.status !== 'published') return false;
                if (sql.includes("LIKE '%library%'") && !String(row.allowed_sections).includes('library')) {
                  return false;
                }
                if (sql.includes("source_name") && !String(row.source_name || '').trim()) return false;
                if (sql.includes("credit_line") && !String(row.credit_line || '').trim()) return false;
                return true;
              });
              return { results: filtered };
            }
            return { results: [] };
          },
        }),
      })),
    };

    const { items, total } = await fetchRotationRankedInventory(db, {
      sectionKey: 'library',
      limit: 5,
      asOfDate: AS_OF,
    });

    expect(total).toBe(2);
    expect(items.map((row) => row.id)).toEqual([2, 1]);
    expect(items.some((row) => row.id === 4)).toBe(false);
  });

  it('records last_featured through approved rotation behavior only for published rows', async () => {
    const updates: Array<{ sql: string; args: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => {
        const statement = {
          first: async () => ({ now: '2026-06-04T12:00:00.000Z' }),
          run: async () => {
            updates.push({ sql, args: [] });
            return { success: true };
          },
          all: async () => ({ results: [] }),
          bind: (...args: unknown[]) => ({
            first: async () => ({ now: '2026-06-04T12:00:00.000Z' }),
            run: async () => {
              updates.push({ sql, args });
              return { success: true };
            },
            all: async () => ({ results: [] }),
          }),
        };
        return statement;
      }),
    };

    const result = await recordRotationFeature(db, 42);
    expect(result).toEqual({ ok: true, id: 42, last_featured: '2026-06-04T12:00:00.000Z' });
    expect(updates[0]?.sql).toContain('last_featured');
    expect(updates[0]?.sql).toContain('usage_count = COALESCE(usage_count, 0) + 1');
    expect(updates[0]?.sql).toContain("status = 'published'");
  });

  it('computes anniversary distance for event-aware boosts', () => {
    expect(daysUntilAnniversary('1939-06-04', AS_OF)).toBe(0);
    expect(daysUntilAnniversary('1939-06-10', AS_OF)).toBe(6);
  });

  it('fetches rotation candidate rows for a section query', async () => {
    const inventory = [
      baseRow({ id: 1, allowed_sections: '["library"]' }),
      baseRow({ id: 2, allowed_sections: '["search"]' }),
    ];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: () => ({
          all: async () => ({
            results: inventory.filter((row) => {
              if (sql.includes("status = 'published'") && row.status !== 'published') return false;
              if (sql.includes("LIKE '%library%'") && !String(row.allowed_sections).includes('library')) {
                return false;
              }
              return true;
            }),
          }),
        }),
      })),
    };

    const rows = await fetchRotationEligibleRows(db, { sectionKey: 'library' });
    expect(rows.map((row) => row.id)).toEqual([1]);
  });
});
