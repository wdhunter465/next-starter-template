import { describe, expect, it, vi } from 'vitest';

import { rightsClearedClause } from '../functions/_lib/rights-hold';
import { buildNewIntakeKey, isNewIntakeKey, NEW_INTAKE_KEY_PREFIX } from '../functions/_lib/content-pipeline-media-key';
import { onRequestGet as photosListGet } from '../functions/api/photos';
import { onRequestGet as photosListLegacyGet } from '../functions/api/photos/list';
import { onRequestGet as photosGetOne } from '../functions/api/photos/get';
import { listStoryMediaAssociations, resolvePhotoByReference } from '../functions/_lib/content-inventory-media';
import { fetchClubHomeContent } from '../functions/_lib/content-inventory-club-home';

const CLEARED_PHOTO = {
  id: 1,
  photo_id: 'p1',
  url: 'https://example.com/cleared.jpg',
  is_memorabilia: 0,
  title: 'Cleared photo',
  description: 'Rights-cleared',
  tags: null,
  source: 'LOC',
  created_at: '2026-08-17T00:00:00Z',
  rights_hold: 0,
};

const HELD_PHOTO = {
  id: 2,
  photo_id: 'p2',
  url: 'https://example.com/held.jpg',
  is_memorabilia: 0,
  title: 'Held legacy photo',
  description: 'Unverified rights',
  tags: null,
  source: 'legacy',
  created_at: '2026-08-01T00:00:00Z',
  rights_hold: 1,
};

// Minimal D1 stand-in that actually evaluates the `rights_hold = 0` predicate
// this suite is verifying, rather than ignoring WHERE clauses entirely.
function makeRightsAwareDb(photos: Array<Record<string, unknown>>) {
  function apply(sql: string, args: unknown[]) {
    let rows = photos.slice();
    if (sql.includes('rights_hold = 0')) {
      rows = rows.filter((row) => Number(row.rights_hold) === 0);
    }
    if (sql.includes('WHERE id = ?')) {
      const id = args.find((arg) => typeof arg === 'number');
      rows = rows.filter((row) => Number(row.id) === id);
    } else if (sql.includes('photo_id)) = lower')) {
      const ref = String(args[0] ?? '').toLowerCase();
      rows = rows.filter((row) => String(row.photo_id ?? '').toLowerCase() === ref);
    } else if (sql.includes('trim(url)) = lower')) {
      const ref = String(args[0] ?? '').toLowerCase();
      rows = rows.filter((row) => String(row.url ?? '').toLowerCase() === ref);
    }
    return rows;
  }

  return {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async () => ({ results: apply(sql, args) }),
        first: async () => apply(sql, args)[0] ?? null,
      }),
      all: async () => ({ results: apply(sql, []) }),
      first: async () => apply(sql, [])[0] ?? null,
    })),
  };
}

function photosRequest(path: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`);
}

describe('rights-hold quarantine (#3552)', () => {
  it('rightsClearedClause defaults to the unaliased column and supports an alias', () => {
    expect(rightsClearedClause()).toBe('rights_hold = 0');
    expect(rightsClearedClause('p')).toBe('p.rights_hold = 0');
  });

  it('/api/photos excludes held legacy rows', async () => {
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO]) };
    const res = await photosListGet({ env, request: photosRequest('/api/photos') });
    const body = await res.json();
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([1]);
  });

  it('/api/photos/list excludes held legacy rows', async () => {
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO]) };
    const res = await photosListLegacyGet({ env, request: photosRequest('/api/photos/list') });
    const body = await res.json();
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([1]);
  });

  it('/api/photos/get returns 404 for a held photo instead of leaking it', async () => {
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO]) };
    const held = await photosGetOne({ env, params: { id: '2' }, request: photosRequest('/api/photos/get?id=2') });
    expect(held.status).toBe(404);

    const cleared = await photosGetOne({ env, params: { id: '1' }, request: photosRequest('/api/photos/get?id=1') });
    expect(cleared.status).toBe(200);
    const body = await cleared.json();
    expect(body.item.id).toBe(1);
  });

  it('resolvePhotoByReference refuses to resolve a held photo', async () => {
    const db = makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO]);
    await expect(resolvePhotoByReference(db, '1')).resolves.toMatchObject({ id: 1 });
    await expect(resolvePhotoByReference(db, '2')).resolves.toBeNull();
  });

  it('listStoryMediaAssociations drops held photos from the join', async () => {
    const associations = [
      { id: 10, story_id: 1, media_id: 1, media_role: 'primary_image', display_order: 0 },
      { id: 11, story_id: 1, media_id: 2, media_role: 'gallery_image', display_order: 1 },
    ];
    const db = {
      prepare: vi.fn(() => ({
        bind: (...args: unknown[]) => ({
          all: async () => {
            const storyId = args.find((arg) => typeof arg === 'number');
            const clearedIds = new Set([CLEARED_PHOTO.id]);
            const rows = associations
              .filter((a) => a.story_id === storyId && clearedIds.has(a.media_id))
              .map((a) => ({ ...a, url: CLEARED_PHOTO.url }));
            return { results: rows };
          },
        }),
      })),
    };

    const grouped = await listStoryMediaAssociations(db, [1]);
    const rows = grouped.get(1) ?? [];
    expect(rows.map((r) => Number(r.media_id))).toEqual([1]);
  });

  it('club-home media fallback never surfaces a held photo', async () => {
    const db = {
      prepare: vi.fn((sql: string) => ({
        first: async () => {
          if (sql.includes('COUNT(1)')) return { n: 0 };
          if (sql.includes('rights_hold = 0')) return CLEARED_PHOTO;
          return HELD_PHOTO;
        },
        all: async () => ({ results: [] }),
      })),
    };

    const payload = await fetchClubHomeContent(db, { request: photosRequest('/') });
    expect(payload.source).toBe('static');
    expect(payload.media_feature).toBeNull();
  });

  it('new-intake key prefix helper marks pipeline-collected media distinctly from legacy keys', () => {
    expect(NEW_INTAKE_KEY_PREFIX).toBe('LGFC_');
    expect(buildNewIntakeKey('loc-1923-gehrig-01.jpg')).toBe('LGFC_loc-1923-gehrig-01.jpg');
    expect(isNewIntakeKey('LGFC_loc-1923-gehrig-01.jpg')).toBe(true);
    expect(isNewIntakeKey('legacy/old-photo.jpg')).toBe(false);
  });
});
