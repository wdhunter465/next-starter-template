import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAssociationsFromSubmission,
  computeRenditionDimensions,
  normalizeMediaAssociation,
  normalizeMediaAssociations,
  readyRenditionUrl,
  renditionObjectKey,
  serializeLegacyMediaJson,
  validatePersistedRenditionDimensions,
} from '../functions/_lib/content-inventory-media';
import { onRequestGet as mediaAssociationsGet } from '../functions/api/admin/editorial/media-associations';
import { onRequestPost as mediaAssociationsPost } from '../functions/api/admin/editorial/media-associations';
import { onRequestPost as editorialReviewPost } from '../functions/api/admin/editorial/review';

function adminPostRequest(path: string, body: unknown, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
}

function adminGetRequest(path: string, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { 'x-admin-token': token },
  });
}

function makeMediaDb(options?: {
  submissions?: Array<Record<string, unknown>>;
  inventory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  mediaAssociations?: Array<Record<string, unknown>>;
}) {
  const submissions = options?.submissions ?? [];
  const inventory = options?.inventory ?? [];
  const photos = options?.photos ?? [];
  const mediaAssociations = options?.mediaAssociations ?? [];
  const runs: Array<{ sql: string; args: unknown[] }> = [];
  const tableNames = [
    'submission_queue',
    'content_inventory',
    'content_inventory_media',
    'content_inventory_media_renditions',
    'photos',
    'library_entries',
    'member_sessions',
    'members',
  ];

  const db = {
    prepare: vi.fn((sql: string) => {
      const allFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const requested = args.length ? tableNames.filter((name) => args.includes(name)) : tableNames;
          return { results: requested.map((name) => ({ name })) };
        }
        if (sql.includes('FROM content_inventory_media')) {
          const storyId = args.find((arg) => typeof arg === 'number');
          if (typeof storyId === 'number') {
            return {
              results: mediaAssociations.filter((row) => row.story_id === storyId),
            };
          }
          return { results: mediaAssociations };
        }
        if (sql.includes('FROM photos') && sql.includes('IN (')) {
          const ids = args.filter((arg) => typeof arg === 'number');
          return { results: photos.filter((row) => ids.includes(Number(row.id))) };
        }
        if (sql.includes('FROM photos')) return { results: photos };
        if (sql.includes('FROM submission_queue')) return { results: submissions };
        if (sql.includes('FROM content_inventory')) return { results: inventory };
        return { results: [] };
      };

      const firstFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const table = String(args[0] || '');
          return tableNames.includes(table) ? { name: table } : null;
        }
        if (sql.includes("SELECT datetime('now')")) {
          return { now: '2026-06-07T12:00:00Z', purge_eligible_at: '2026-09-05T12:00:00Z' };
        }
        if (sql.includes('FROM photos') && sql.includes('WHERE id = ?')) {
          return photos.find((row) => row.id === args[0]) ?? null;
        }
        if (sql.includes('FROM photos') && sql.includes('photo_id')) {
          return photos.find((row) => String(row.photo_id).toLowerCase() === String(args[0]).toLowerCase()) ?? null;
        }
        if (sql.includes('FROM photos') && sql.includes('url')) {
          return photos.find((row) => String(row.url).toLowerCase() === String(args[0]).toLowerCase()) ?? null;
        }
        if (sql.includes('FROM submission_queue') && sql.includes('WHERE submission_id = ?')) {
          return submissions.find((row) => row.submission_id === args[0]) ?? null;
        }
        if (sql.includes('FROM content_inventory') && sql.includes('WHERE id = ?')) {
          return inventory.find((row) => row.id === args[0]) ?? null;
        }
        return null;
      };

      const runFn = async (...args: unknown[]) => {
        runs.push({ sql, args });
        return { meta: { changes: 1, last_row_id: 88 } };
      };

      return {
        all: () => allFn(),
        first: () => firstFn(),
        run: () => runFn(),
        bind: (...args: unknown[]) => ({
          all: () => allFn(args),
          first: () => firstFn(args),
          run: () => runFn(...args),
        }),
      };
    }),
  };

  return { db, runs };
}

describe('content inventory media helpers', () => {
  it('requires alt_text for public image roles', () => {
    const result = normalizeMediaAssociation({ media_id: 3, media_role: 'primary_image' }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('alt_text');
    }
  });

  it('computes aspect-preserving long-edge dimensions without upscaling', () => {
    const downscale = computeRenditionDimensions(4000, 2000, 'thumbnail');
    expect(downscale).toMatchObject({ width: 320, height: 160, upscaled: false });

    const noUpscale = computeRenditionDimensions(200, 100, 'medium');
    expect(noUpscale).toMatchObject({ width: 200, height: 100, upscaled: false });
  });

  it('validates declared rendition dimensions against the size contract', () => {
    const ok = validatePersistedRenditionDimensions({
      size: 'small',
      source_width: 2000,
      source_height: 1000,
      width_px: 640,
      height_px: 320,
    });
    expect(ok).toEqual({ ok: true });

    const bad = validatePersistedRenditionDimensions({
      size: 'small',
      source_width: 2000,
      source_height: 1000,
      width_px: 2000,
      height_px: 1000,
    });
    expect(bad.ok).toBe(false);
  });

  it('fail-closes readyRenditionUrl unless status is ready', () => {
    expect(readyRenditionUrl({ status: 'ready', url: 'https://cdn.example.com/r.jpg' })).toBe(
      'https://cdn.example.com/r.jpg',
    );
    expect(readyRenditionUrl({ status: 'failed', url: 'https://cdn.example.com/r.jpg' })).toBeNull();
    expect(readyRenditionUrl({ status: 'pending', url: 'https://cdn.example.com/r.jpg' })).toBeNull();
    expect(readyRenditionUrl(null)).toBeNull();
  });

  it('uses deterministic B2 object keys per media_id and size', () => {
    expect(renditionObjectKey(12, 'medium')).toBe('club-newspaper/renditions/12/medium.jpg');
  });

  it('accepts complete media association payloads', () => {
    const result = normalizeMediaAssociations([
      {
        media_id: 3,
        media_role: 'gallery_image',
        display_order: 2,
        caption: 'Yankee Stadium',
        alt_text: 'Lou Gehrig at Yankee Stadium',
        source_name: 'LGFC Archive',
        source_url: 'https://example.com/photo',
        credit_line: 'Courtesy LGFC Archive',
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        expect.objectContaining({
          media_id: 3,
          media_role: 'gallery_image',
          display_order: 2,
          alt_text: 'Lou Gehrig at Yankee Stadium',
        }),
      ]);
    }
  });

  it('serializes legacy media JSON with photo and attribution fields', () => {
    const json = serializeLegacyMediaJson(
      [
        {
          media_id: 4,
          media_role: 'supporting_image',
          display_order: 0,
          caption: 'Caption',
          alt_text: 'Alt text',
          source_name: 'Archive',
          source_url: 'https://example.com',
          credit_line: 'Credit',
        },
      ],
      [{ id: 4, url: 'https://cdn.example.com/photo.jpg', photo_id: 'photo-4' }],
    );

    expect(JSON.parse(json)).toEqual([
      expect.objectContaining({
        media_id: 4,
        url: 'https://cdn.example.com/photo.jpg',
        alt_text: 'Alt text',
        credit_line: 'Credit',
      }),
    ]);
  });

  it('resolves submission media references to photo associations', async () => {
    const { db } = makeMediaDb({
      photos: [
        {
          id: 9,
          photo_id: 'gehrig-1939',
          url: 'https://cdn.example.com/gehrig-1939.jpg',
          title: 'Gehrig portrait',
          description: 'Portrait from 1939',
          source: 'LGFC Archive',
          is_memorabilia: 0,
        },
      ],
    });

    const result = await buildAssociationsFromSubmission(
      db,
      { media_reference: 'gehrig-1939' },
      [],
      { source_name: 'LGFC Archive', source_url: null, credit_line: 'LGFC Archive' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        expect.objectContaining({
          media_id: 9,
          media_role: 'supporting_image',
          alt_text: 'Gehrig portrait',
          credit_line: 'LGFC Archive',
        }),
      ]);
    }
  });
});

describe('editorial media association APIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('approves submissions with explicit media associations', async () => {
    const { db, runs } = makeMediaDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          status: 'pending',
        },
      ],
      photos: [{ id: 5, url: 'https://cdn.example.com/photo.jpg', title: 'Photo', is_memorabilia: 0 }],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'approve',
        source_name: 'Member interview',
        credit_line: 'Member Name',
        media_associations: [
          {
            media_id: 5,
            media_role: 'primary_image',
            display_order: 0,
            alt_text: 'Primary story image',
            source_name: 'Member interview',
            credit_line: 'Member Name',
          },
        ],
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'approve',
      inventory_id: 88,
      media_associations: [
        expect.objectContaining({
          media_id: 5,
          media_role: 'primary_image',
        }),
      ],
    });
    expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory_media'))).toBe(true);
    expect(runs.some((run) => run.sql.includes('UPDATE content_inventory SET media = ?'))).toBe(true);
  });

  it('rejects approvals when submission media does not match a photo record', async () => {
    const { db, runs } = makeMediaDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          media_reference: 'missing-photo',
          status: 'pending',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'approve',
        source_name: 'Member interview',
        credit_line: 'Member Name',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Submission media reference does not match an approved photo record.',
    });
    expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory'))).toBe(false);
  });

  it('updates media associations for an existing story', async () => {
    const { db, runs } = makeMediaDb({
      inventory: [{ id: 12, title: 'Existing story' }],
      photos: [{ id: 6, url: 'https://cdn.example.com/gallery.jpg', title: 'Gallery', is_memorabilia: 0 }],
    });

    const response = await mediaAssociationsPost({
      request: adminPostRequest('/api/admin/editorial/media-associations', {
        story_id: 12,
        media_associations: [
          {
            media_id: 6,
            media_role: 'gallery_image',
            display_order: 1,
            alt_text: 'Gallery image',
            source_name: 'Archive',
            credit_line: 'Archive credit',
          },
        ],
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      story_id: 12,
      media_associations: expect.any(Array),
    });
    expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory_media'))).toBe(true);
    expect(runs.some((run) => run.sql.includes('UPDATE content_inventory SET media = ?'))).toBe(true);
  });

  it('reads media associations for a story', async () => {
    const { db } = makeMediaDb({
      inventory: [{ id: 12, title: 'Existing story' }],
      mediaAssociations: [
        {
          id: 1,
          story_id: 12,
          media_id: 6,
          media_role: 'gallery_image',
          display_order: 1,
          alt_text: 'Gallery image',
          url: 'https://cdn.example.com/gallery.jpg',
        },
      ],
    });

    const response = await mediaAssociationsGet({
      request: adminGetRequest('/api/admin/editorial/media-associations?story_id=12'),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      story_id: 12,
      media_associations: [expect.objectContaining({ media_role: 'gallery_image' })],
    });
  });
});
