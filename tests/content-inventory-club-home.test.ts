import { describe, expect, it } from 'vitest';

import {
  CLUB_HOME_SECTION,
  fetchClubHomeContent,
} from '../functions/_lib/content-inventory-club-home';

function makeClubHomeDb(options?: {
  inventory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
  pins?: Array<Record<string, unknown>>;
  placementHistoryFails?: boolean;
  pinsLoadFails?: boolean;
}) {
  const inventory = options?.inventory ?? [];
  const photos = options?.photos ?? [];
  const media = options?.media ?? [];
  const pins = options?.pins ?? [];
  const placementInserts: Array<{ sql: string; args: unknown[] }> = [];

  const db = {
    placementInserts,
    prepare(sql: string) {
      const query = {
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes("SELECT datetime('now')")) {
              return { now: '2026-08-12T12:00:00Z' };
            }
            if (sql.includes('COUNT(1)') && sql.includes('content_inventory')) {
              const count = inventory.filter(
                (row) =>
                  row.status === 'published' &&
                  String(row.allowed_sections || '').includes('club_home') &&
                  String(row.source_name || '').trim() &&
                  String(row.credit_line || '').trim(),
              ).length;
              return { n: count };
            }
            if (sql.includes('FROM photos') && sql.includes('LIMIT 1')) {
              return photos[0] ?? null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes('FROM content_inventory_club_home_pins')) {
              if (options?.pinsLoadFails) {
                throw new Error('no such table: content_inventory_club_home_pins');
              }
              return { results: pins };
            }
            if (sql.includes('FROM content_inventory')) {
              const rows = inventory.filter(
                (row) =>
                  row.status === 'published' &&
                  String(row.allowed_sections || '').includes('club_home') &&
                  String(row.source_name || '').trim() &&
                  String(row.credit_line || '').trim(),
              );
              return { results: rows };
            }
            if (sql.includes('content_inventory_media')) {
              const storyId = Number(args[0]);
              return {
                results: media.filter((row) => Number(row.story_id) === storyId),
              };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO content_inventory_placement_history')) {
              if (options?.placementHistoryFails) {
                throw new Error('no such table: content_inventory_placement_history');
              }
              placementInserts.push({ sql, args });
              return { success: true };
            }
            return { success: true };
          },
        }),
        first: async () => {
          if (sql.includes("SELECT datetime('now')")) {
            return { now: '2026-08-12T12:00:00Z' };
          }
          if (sql.includes('COUNT(1)') && sql.includes('content_inventory')) {
            const count = inventory.filter(
              (row) =>
                row.status === 'published' &&
                String(row.allowed_sections || '').includes('club_home') &&
                String(row.source_name || '').trim() &&
                String(row.credit_line || '').trim(),
            ).length;
            return { n: count };
          }
          if (sql.includes('FROM photos') && sql.includes('LIMIT 1')) {
            return photos[0] ?? null;
          }
          return null;
        },
        all: async () => {
          if (sql.includes('FROM content_inventory_club_home_pins')) {
            if (options?.pinsLoadFails) {
              throw new Error('no such table: content_inventory_club_home_pins');
            }
            return { results: pins };
          }
          if (sql.includes('FROM content_inventory') && !sql.includes('COUNT')) {
            const rows = inventory.filter(
              (row) =>
                row.status === 'published' &&
                String(row.allowed_sections || '').includes('club_home') &&
                String(row.source_name || '').trim() &&
                String(row.credit_line || '').trim(),
            );
            return { results: rows };
          }
          return { results: [] };
        },
        run: async () => ({ success: true }),
      };
      return query;
    },
  };

  return db;
}

describe('content-inventory-club-home', () => {
  it('exports club_home section constant', () => {
    expect(CLUB_HOME_SECTION).toBe('club_home');
  });

  it('returns static source when no published club_home inventory exists', async () => {
    const payload = await fetchClubHomeContent(makeClubHomeDb({ inventory: [] }));
    expect(payload.source).toBe('static');
    expect(payload.lead_story).toBeNull();
    expect(payload.rail_stories).toEqual([]);
  });

  it('selects lead, rail, and spotlight stories with credit metadata', async () => {
    const db = makeClubHomeDb({
      inventory: [
        {
          id: 1,
          title: 'Lead headline',
          text: 'Lead body text',
          summary: 'Lead summary',
          credit_line: 'Club Historians',
          source_name: 'LGFC Archive',
          story_type: 'primary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 10,
          feature_weight: 2,
        },
        {
          id: 2,
          title: 'Rail story',
          summary: 'Rail summary',
          credit_line: 'Member Historian',
          source_name: 'Member Notes',
          story_type: 'secondary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 5,
          feature_weight: 1,
        },
        {
          id: 3,
          title: 'Another rail story',
          summary: 'Second rail summary',
          credit_line: 'Archive Desk',
          source_name: 'Library',
          story_type: 'brief',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 4,
          feature_weight: 1,
        },
        {
          id: 4,
          title: 'Spotlight story',
          summary: 'Spotlight summary',
          credit_line: 'Archive Desk',
          source_name: 'Library',
          story_type: 'primary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 1,
          feature_weight: 1,
          event_year: new Date().getUTCFullYear(),
        },
      ],
    });

    const payload = await fetchClubHomeContent(db);

    expect(payload.source).toBe('content_inventory');
    expect(payload.lead_story?.headline).toBe('Lead headline');
    expect(payload.lead_story?.credit).toBe('Club Historians');
    expect(payload.rail_stories).toHaveLength(2);
    expect(payload.rail_stories[0]?.headline).toBe('Rail story');
    expect(payload.archive_spotlight?.headline).toBe('Spotlight story');
    expect(db.placementInserts.length).toBeGreaterThanOrEqual(3);
    expect(db.placementInserts.some((row) => row.args[1] === 'lead-story')).toBe(true);
    expect(db.placementInserts.some((row) => row.args[1] === 'story-rail')).toBe(true);
    expect(db.placementInserts.some((row) => row.args[1] === 'archive-spotlight')).toBe(true);
  });

  it('still renders Club Home when placement history storage is unavailable', async () => {
    const db = makeClubHomeDb({
      placementHistoryFails: true,
      inventory: [
        {
          id: 1,
          title: 'Lead headline',
          summary: 'Lead summary',
          credit_line: 'Club Historians',
          source_name: 'LGFC Archive',
          story_type: 'primary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 10,
          feature_weight: 2,
        },
        {
          id: 2,
          title: 'Rail story',
          summary: 'Rail summary',
          credit_line: 'Member Historian',
          source_name: 'Member Notes',
          story_type: 'secondary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 5,
          feature_weight: 1,
        },
      ],
    });

    const payload = await fetchClubHomeContent(db);
    expect(payload.source).toBe('content_inventory');
    expect(payload.lead_story?.id).toBe(1);
    expect(payload.rail_stories[0]?.id).toBe(2);
  });

  it('skips hard-cooldown lead candidates in favor of least-used eligible inventory', async () => {
    const asOfIso = new Date().toISOString();
    const payload = await fetchClubHomeContent(
      makeClubHomeDb({
        inventory: [
          {
            id: 10,
            title: 'Recently featured lead',
            summary: 'Should cool down',
            credit_line: 'Archive',
            source_name: 'LGFC',
            story_type: 'primary',
            allowed_sections: 'club_home',
            status: 'published',
            canonical: 1,
            priority: 50,
            feature_weight: 5,
            usage_count: 9,
            last_featured: asOfIso,
          },
          {
            id: 11,
            title: 'Fresh least-used lead',
            summary: 'Should win',
            credit_line: 'Archive',
            source_name: 'LGFC',
            story_type: 'primary',
            allowed_sections: 'club_home',
            status: 'published',
            canonical: 1,
            priority: 1,
            feature_weight: 1,
            usage_count: 0,
            last_featured: null,
          },
          {
            id: 12,
            title: 'Rail filler',
            summary: 'Rail',
            credit_line: 'Archive',
            source_name: 'LGFC',
            story_type: 'secondary',
            allowed_sections: 'club_home',
            status: 'published',
            canonical: 1,
            priority: 1,
            feature_weight: 1,
            usage_count: 0,
            last_featured: null,
          },
        ],
      }),
    );

    expect(payload.source).toBe('content_inventory');
    expect(payload.lead_story?.id).toBe(11);
    expect(payload.lead_story?.headline).toBe('Fresh least-used lead');
  });

  it('honors an eligible lead-story pin over ordinary rotation', async () => {
    const db = makeClubHomeDb({
      pins: [
        {
          zone_id: 'lead-story',
          story_id: 20,
          pinned_at: '2026-08-12T12:00:00Z',
          pinned_by: 'admin-ui',
          expires_at: null,
        },
      ],
      inventory: [
        {
          id: 10,
          title: 'Natural lead',
          summary: 'Would win without pin',
          credit_line: 'Archive',
          source_name: 'LGFC',
          story_type: 'primary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 50,
          feature_weight: 5,
          usage_count: 0,
        },
        {
          id: 20,
          title: 'Pinned lead',
          summary: 'Forced by pin',
          credit_line: 'Archive',
          source_name: 'LGFC',
          story_type: 'primary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 1,
          feature_weight: 1,
          usage_count: 0,
        },
        {
          id: 30,
          title: 'Rail filler',
          summary: 'Rail',
          credit_line: 'Archive',
          source_name: 'LGFC',
          story_type: 'secondary',
          allowed_sections: 'club_home',
          status: 'published',
          canonical: 1,
          priority: 1,
          feature_weight: 1,
        },
      ],
    });

    const payload = await fetchClubHomeContent(db);
    expect(payload.lead_story?.id).toBe(20);
    expect(db.placementInserts.some((row) => row.args[1] === 'lead-story' && row.args[4] === 'pinned')).toBe(
      true,
    );
  });

  it('ignores ineligible/expired pins and fails open when pin storage is missing', async () => {
    const missing = await fetchClubHomeContent(
      makeClubHomeDb({
        pinsLoadFails: true,
        inventory: [
          {
            id: 1,
            title: 'Lead',
            summary: 'Lead',
            credit_line: 'Archive',
            source_name: 'LGFC',
            story_type: 'primary',
            allowed_sections: 'club_home',
            status: 'published',
            canonical: 1,
            priority: 10,
            feature_weight: 1,
          },
        ],
      }),
    );
    expect(missing.lead_story?.id).toBe(1);

    const ignored = await fetchClubHomeContent(
      makeClubHomeDb({
        pins: [
          {
            zone_id: 'lead-story',
            story_id: 99,
            pinned_at: '2026-08-12T12:00:00Z',
            pinned_by: 'admin-ui',
            expires_at: '2020-01-01T00:00:00Z',
          },
        ],
        inventory: [
          {
            id: 1,
            title: 'Lead',
            summary: 'Lead',
            credit_line: 'Archive',
            source_name: 'LGFC',
            story_type: 'primary',
            allowed_sections: 'club_home',
            status: 'published',
            canonical: 1,
            priority: 10,
            feature_weight: 1,
          },
        ],
      }),
    );
    expect(ignored.lead_story?.id).toBe(1);
  });
});
