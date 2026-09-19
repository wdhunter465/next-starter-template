import { describe, expect, it } from 'vitest';

import {
  CLUB_HOME_SECTION,
  fetchClubHomeContent,
} from '../functions/_lib/content-inventory-club-home';

function makeClubHomeDb(options?: {
  inventory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
  renditions?: Array<Record<string, unknown>>;
}) {
  const inventory = options?.inventory ?? [];
  const photos = options?.photos ?? [];
  const media = options?.media ?? [];
  const renditions = options?.renditions ?? [];

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
            if (sql.includes('content_inventory_media_renditions')) {
              const [mediaId, size] = args;
              return renditions.find((row) => Number(row.media_id) === Number(mediaId) && row.size === size) ?? null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes('FROM content_inventory') && !sql.includes('content_inventory_media')) {
              const rows = inventory.filter(
                (row) =>
                  row.status === 'published' &&
                  String(row.allowed_sections || '').includes('club_home') &&
                  String(row.source_name || '').trim() &&
                  String(row.credit_line || '').trim(),
              );
              return { results: rows };
            }
            if (sql.includes('content_inventory_media') && !sql.includes('renditions')) {
              const storyIds = args.map((arg) => Number(arg));
              return {
                results: media.filter((row) => storyIds.includes(Number(row.story_id))),
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
    expect(payload.rail_stories[0]?.image).toBeNull();
    expect(payload.archive_spotlight?.image).toBeNull();
  });

  it('attaches a thumbnail-sized image to rail and spotlight stories, and fails closed without a ready rendition (#4180)', async () => {
    const inventory = [
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
        title: 'No-image rail story',
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
        id: 5,
        title: 'Unready-rendition rail story',
        summary: 'Third rail summary',
        credit_line: 'Archive Desk',
        source_name: 'Library',
        story_type: 'brief',
        allowed_sections: 'club_home',
        status: 'published',
        canonical: 1,
        priority: 3,
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
    ];

    const payload = await fetchClubHomeContent(
      makeClubHomeDb({
        inventory,
        media: [
          {
            story_id: 2,
            media_id: 501,
            media_role: 'primary_image',
            display_order: 0,
            caption: 'Rail story photo',
            alt_text: 'Members at a clubhouse reunion',
            source_name: 'LGFC Photo Desk',
            credit_line: 'LGFC Archive',
          },
          {
            story_id: 4,
            media_id: 502,
            media_role: 'primary_image',
            display_order: 0,
            caption: 'Spotlight photo',
            alt_text: 'Archive spotlight photograph',
            source_name: 'LGFC Photo Desk',
            credit_line: 'LGFC Archive',
          },
          {
            story_id: 5,
            media_id: 503,
            media_role: 'primary_image',
            display_order: 0,
            caption: 'Unready photo',
            alt_text: 'Photo still being processed',
            source_name: 'LGFC Photo Desk',
            credit_line: 'LGFC Archive',
          },
        ],
        renditions: [
          {
            media_id: 501,
            size: 'thumbnail',
            status: 'ready',
            url: 'https://cdn.example.com/renditions/501/thumbnail.jpg',
          },
          {
            media_id: 502,
            size: 'thumbnail',
            status: 'ready',
            url: 'https://cdn.example.com/renditions/502/thumbnail.jpg',
          },
          // Deliberately no "medium" rendition for 501/502 — proves rail/spotlight
          // request "thumbnail", not the media-feature "medium" size.
          // Deliberately no rendition row at all for media_id 503 — story 5 has a
          // primary_image association but no persisted rendition yet, exercising
          // the association-present / rendition-missing fail-closed path.
        ],
      }),
    );

    expect(payload.rail_stories[0]?.image).toEqual({
      url: 'https://cdn.example.com/renditions/501/thumbnail.jpg',
      alt: 'Members at a clubhouse reunion',
      credit_line: 'LGFC Archive',
      source_name: 'LGFC Photo Desk',
      rendition_size: 'thumbnail',
    });
    // No media association at all for this story → fails closed to null.
    expect(payload.rail_stories[1]?.headline).toBe('No-image rail story');
    expect(payload.rail_stories[1]?.image).toBeNull();
    // A primary_image association exists for this story, but no rendition row was
    // ever persisted for it → still fails closed to null, not a stale/partial image.
    expect(payload.rail_stories[2]?.headline).toBe('Unready-rendition rail story');
    expect(payload.rail_stories[2]?.image).toBeNull();

    expect(payload.archive_spotlight?.image).toEqual({
      url: 'https://cdn.example.com/renditions/502/thumbnail.jpg',
      alt: 'Archive spotlight photograph',
      credit_line: 'LGFC Archive',
      source_name: 'LGFC Photo Desk',
      rendition_size: 'thumbnail',
    });
  });
});
