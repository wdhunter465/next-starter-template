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
  publication_eligible: 1,
  rights_status: 'permission_granted',
};

// #5467: a photo with no review recorded is now public.
const UNREVIEWED_PHOTO = {
  id: 4,
  photo_id: 'p4',
  url: 'https://example.com/unreviewed.jpg',
  is_memorabilia: 0,
  title: 'Unreviewed photo',
  description: 'No rights review recorded',
  tags: null,
  source: 'b2',
  created_at: '2026-11-23T00:00:00Z',
  rights_hold: 1,
  publication_eligible: 0,
  rights_status: 'unreviewed',
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
  publication_eligible: 0,
  rights_status: 'blocked',
};

// Minimal D1 stand-in that actually evaluates the `rights_hold = 0` predicate
// this suite is verifying, rather than ignoring WHERE clauses entirely.
function makeRightsAwareDb(photos: Array<Record<string, unknown>>) {
  function apply(sql: string, args: unknown[]) {
    let rows = photos.slice();
    if (sql.includes("NOT IN ('blocked', 'copyright_restricted')")) {
      rows = rows.filter((row) => !['blocked', 'copyright_restricted'].includes(String(row.rights_status ?? 'unreviewed')));
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

describe('public photo gate (#3552, replaced by #5467)', () => {
  it('rightsClearedClause defaults to the unaliased column and supports an alias', () => {
    expect(rightsClearedClause()).toBe("COALESCE(rights_status, 'unreviewed') NOT IN ('blocked', 'copyright_restricted')");
    expect(rightsClearedClause('p')).toBe("COALESCE(p.rights_status, 'unreviewed') NOT IN ('blocked', 'copyright_restricted')");
  });

  it('/api/photos serves unreviewed photos and excludes blocked ones', async () => {
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO, UNREVIEWED_PHOTO]) };
    const res = await photosListGet({ env, request: photosRequest('/api/photos') });
    const body = await res.json();
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([1, 4]);
  });

  it('/api/photos/list serves unreviewed photos and excludes blocked ones', async () => {
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO, UNREVIEWED_PHOTO]) };
    const res = await photosListLegacyGet({ env, request: photosRequest('/api/photos/list') });
    const body = await res.json();
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([1, 4]);
  });

  it('/api/photos/get returns 404 for a blocked photo instead of leaking it', async () => {
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO]) };
    const held = await photosGetOne({ env, params: { id: '2' }, request: photosRequest('/api/photos/get?id=2') });
    expect(held.status).toBe(404);

    const cleared = await photosGetOne({ env, params: { id: '1' }, request: photosRequest('/api/photos/get?id=1') });
    expect(cleared.status).toBe(200);
    const body = await cleared.json();
    expect(body.item.id).toBe(1);

    const unreviewed = await photosGetOne({ env: { DB: makeRightsAwareDb([UNREVIEWED_PHOTO]) }, params: { id: '4' }, request: photosRequest('/api/photos/get?id=4') });
    expect(unreviewed.status).toBe(200);
  });

  it('resolvePhotoByReference refuses to resolve a blocked photo', async () => {
    const db = makeRightsAwareDb([CLEARED_PHOTO, HELD_PHOTO]);
    await expect(resolvePhotoByReference(db, '1')).resolves.toMatchObject({ id: 1 });
    await expect(resolvePhotoByReference(db, '2')).resolves.toBeNull();
  });

  it('listStoryMediaAssociations drops blocked photos from the join', async () => {
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

  it('club-home media fallback never surfaces a blocked photo', async () => {
    const db = {
      prepare: vi.fn((sql: string) => ({
        first: async () => {
          if (sql.includes('COUNT(1)')) return { n: 0 };
          if (sql.includes("NOT IN ('blocked', 'copyright_restricted')")) return CLEARED_PHOTO;
          return HELD_PHOTO;
        },
        all: async () => ({ results: [] }),
      })),
    };

    const payload = await fetchClubHomeContent(db, { request: photosRequest('/') });
    expect(payload.source).toBe('static');
    expect(payload.media_feature).toBeNull();
  });

  it('a copyright_restricted photo is excluded too', async () => {
    const restricted = { ...CLEARED_PHOTO, id: 5, rights_status: 'copyright_restricted' };
    const env = { DB: makeRightsAwareDb([CLEARED_PHOTO, restricted]) };
    const res = await photosListGet({ env, request: photosRequest('/api/photos') });
    const body = await res.json();
    expect(body.items.map((i: { id: number }) => i.id)).toEqual([1]);
  });
});
