import { describe, expect, it } from 'vitest';

import {
  CLUB_HOME_SECTION,
  fetchClubHomeContent,
} from '../functions/_lib/content-inventory-club-home';

function makeClubHomeDb(options?: {
  inventory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
}) {
  const inventory = options?.inventory ?? [];
  const photos = options?.photos ?? [];
  const media = options?.media ?? [];

  const db = {
    prepare(sql: string) {
      const query = {
        bind: (...args: unknown[]) => ({
          first: async () => {
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
        }),
        first: async () => {
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
    const payload = await fetchClubHomeContent(
      makeClubHomeDb({
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
      }),
    );

    expect(payload.source).toBe('content_inventory');
    expect(payload.lead_story?.headline).toBe('Lead headline');
    expect(payload.lead_story?.credit).toBe('Club Historians');
    expect(payload.rail_stories).toHaveLength(2);
    expect(payload.rail_stories[0]?.headline).toBe('Rail story');
    expect(payload.archive_spotlight?.headline).toBe('Spotlight story');
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
});
