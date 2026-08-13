/**
 * P1-02 (#3387): Direct tests for admin editorial write endpoints.
 * Handlers are read-only evidence — this file asserts existing behavior only.
 */
import { describe, expect, it, vi } from 'vitest';

import { onRequestPost as inventoryPost } from '../functions/api/admin/editorial/inventory';
import {
  onRequestGet as mediaAssociationsGet,
  onRequestPost as mediaAssociationsPost,
} from '../functions/api/admin/editorial/media-associations';
import { onRequestPost as publishPost } from '../functions/api/admin/editorial/publish';
import { onRequestPost as reviewPost } from '../functions/api/admin/editorial/review';

function adminGetRequest(path: string, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { 'x-admin-token': token },
  });
}

function adminPostRequest(path: string, body: unknown, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
}

function makeWriteDb(options?: {
  submissions?: Array<Record<string, unknown>>;
  inventory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  mediaAssociations?: Array<Record<string, unknown>>;
  pins?: Array<Record<string, unknown>>;
  tableNames?: string[];
  auditWriteFails?: boolean;
}) {
  const submissions = options?.submissions ?? [];
  const inventory = options?.inventory ?? [];
  const photos = options?.photos ?? [];
  const mediaAssociations = options?.mediaAssociations ?? [];
  const pins = options?.pins ?? [];
  const auditEvents: Array<{ sql: string; args: unknown[] }> = [];
  const tableNames = options?.tableNames ?? [
    'submission_queue',
    'content_inventory',
    'content_inventory_media',
    'content_inventory_club_home_pins',
    'editorial_audit_events',
    'photos',
  ];
  const runs: Array<{ sql: string; args: unknown[] }> = [];

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
            return { results: mediaAssociations.filter((row) => row.story_id === storyId) };
          }
          return { results: mediaAssociations };
        }
        if (sql.includes('FROM photos') && sql.includes('IN (')) {
          const ids = args.filter((arg) => typeof arg === 'number');
          return { results: photos.filter((row) => ids.includes(Number(row.id))) };
        }
        if (sql.includes('FROM photos')) return { results: photos };
        if (sql.includes('FROM submission_queue')) return { results: submissions };
        if (sql.includes('FROM content_inventory_club_home_pins')) return { results: pins };
        if (sql.includes('FROM content_inventory')) return { results: inventory };
        return { results: [] };
      };

      const firstFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const table = String(args[0] || '');
          return tableNames.includes(table) ? { name: table } : null;
        }
        if (sql.includes("SELECT datetime('now')")) {
          return { now: '2026-08-12T12:00:00Z', purge_eligible_at: '2026-11-10T12:00:00Z' };
        }
        if (sql.includes('FROM photos') && sql.includes('WHERE id = ?')) {
          return photos.find((row) => row.id === args[0]) ?? null;
        }
        if (sql.includes('FROM submission_queue') && sql.includes('WHERE submission_id = ?')) {
          return submissions.find((row) => row.submission_id === args[0]) ?? null;
        }
        if (sql.includes('FROM content_inventory_club_home_pins') && sql.includes('WHERE zone_id = ?')) {
          return pins.find((row) => row.zone_id === args[0]) ?? null;
        }
        if (sql.includes('FROM content_inventory') && sql.includes('WHERE id = ?')) {
          const row = inventory.find((entry) => entry.id === args[0]) ?? null;
          if (!row) return null;
          // Eligibility re-check used by Club Home pin action.
          if (sql.includes("status = 'published'")) {
            const allowsClubHome = String(row.allowed_sections || '').includes('club_home');
            const eligible =
              row.status === 'published' &&
              allowsClubHome &&
              String(row.source_name || '').trim() &&
              String(row.credit_line || '').trim();
            return eligible ? row : null;
          }
          return row;
        }
        return null;
      };

      const runFn = async (...args: unknown[]) => {
        runs.push({ sql, args });
        if (sql.includes('INSERT INTO editorial_audit_events')) {
          if (options?.auditWriteFails) {
            throw new Error('no such table: editorial_audit_events');
          }
          auditEvents.push({ sql, args });
        }
        if (sql.includes('INSERT INTO content_inventory_club_home_pins')) {
          const next = {
            zone_id: args[0],
            story_id: args[1],
            pinned_at: args[2],
            pinned_by: args[3],
            expires_at: args[4],
            created_at: args[5],
            updated_at: args[6],
          };
          const existing = pins.findIndex((row) => row.zone_id === next.zone_id);
          if (existing >= 0) pins[existing] = next;
          else pins.push(next);
        }
        if (sql.includes('DELETE FROM content_inventory_club_home_pins')) {
          if (sql.includes('WHERE zone_id = ?')) {
            const idx = pins.findIndex((row) => row.zone_id === args[0]);
            if (idx >= 0) pins.splice(idx, 1);
          } else if (sql.includes('WHERE story_id = ?')) {
            for (let i = pins.length - 1; i >= 0; i -= 1) {
              if (pins[i].story_id === args[0]) pins.splice(i, 1);
            }
          }
        }
        if (sql.includes('INSERT INTO content_inventory_media')) {
          mediaAssociations.push({
            story_id: args[0],
            media_id: args[1],
            media_role: args[2],
            display_order: args[3],
            caption: args[4],
            alt_text: args[5],
            source_name: args[6],
            source_url: args[7],
            credit_line: args[8],
          });
        }
        return { meta: { changes: 1, last_row_id: 55 } };
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

  return { db, runs, pins, auditEvents };
}

const pendingSubmission = {
  submission_id: 21,
  submitted_by: 'Member <member@example.com>',
  title: 'Write-endpoint story',
  description: 'Body text for write-endpoint coverage.',
  proposed_tag: 'write-endpoint-story',
  status: 'pending',
  credit_line: '',
  source_name: '',
  source_url: '',
};

describe('admin editorial write endpoints (#3387 P1-02)', () => {
  describe('review', () => {
    it('rejects unauthorized review writes', async () => {
      const response = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', { submission_id: 1, action: 'triage' }, ''),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db },
      });
      expect(response.status).toBe(401);
    });

    it('rejects invalid action payloads', async () => {
      const response = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', { submission_id: 21, action: 'not-a-real-action' }),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb({ submissions: [pendingSubmission] }).db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'submission_id and valid action are required.',
      });
    });

    it('starts review on an open submission (positive path)', async () => {
      const { db, runs } = makeWriteDb({ submissions: [pendingSubmission] });
      const response = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', {
          submission_id: 21,
          action: 'start_review',
          review_notes: 'Entering review.',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'start_review', submission_id: 21 });
      expect(runs.some((run) => run.sql.includes("status = 'under_review'"))).toBe(true);
    });

    it('blocks approve when required credit attribution cannot be resolved', async () => {
      const { db, runs } = makeWriteDb({
        submissions: [
          {
            ...pendingSubmission,
            submitted_by: '',
            credit_line: '',
          },
        ],
      });
      const response = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', {
          submission_id: 21,
          action: 'approve',
          source_name: 'Archive',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'Approved records require title, text, tag, and credit_line.',
      });
      expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory'))).toBe(false);
    });
  });

  describe('inventory', () => {
    it('rejects unauthorized inventory writes', async () => {
      const response = await inventoryPost({
        request: adminPostRequest(
          '/api/admin/editorial/inventory',
          { title: 'x', text: 'y', tag: 'z', credit_line: 'c' },
          '',
        ),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db },
      });
      expect(response.status).toBe(401);
    });

    it('creates a draft inventory record (positive path)', async () => {
      const { db, runs } = makeWriteDb();
      const response = await inventoryPost({
        request: adminPostRequest('/api/admin/editorial/inventory', {
          tag: 'p1-02-draft',
          title: 'P1-02 draft',
          text: 'Draft body',
          credit_line: 'LGFC Editorial',
          allowed_sections: ['library', 'club_home'],
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        action: 'create',
        status: 'draft',
        id: 55,
      });
      expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory'))).toBe(true);
    });

    it('rejects invalid allowed_sections values', async () => {
      const response = await inventoryPost({
        request: adminPostRequest('/api/admin/editorial/inventory', {
          tag: 'bad-section',
          title: 'Bad section',
          text: 'Body',
          credit_line: 'LGFC Editorial',
          allowed_sections: ['not_a_real_section'],
        }),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'Invalid allowed_sections value: not_a_real_section',
      });
    });

    it('requires perspective_label for non-canonical records', async () => {
      const response = await inventoryPost({
        request: adminPostRequest('/api/admin/editorial/inventory', {
          tag: 'alt-view',
          title: 'Alternate view',
          text: 'Body',
          credit_line: 'LGFC Editorial',
          canonical: false,
        }),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'Alternate-perspective records require perspective_label.',
      });
    });
  });

  describe('publish', () => {
    it('rejects unauthorized publish writes', async () => {
      const response = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }, ''),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db },
      });
      expect(response.status).toBe(401);
    });

    it('publishes when source_name and credit_line are present (positive path)', async () => {
      const { db, runs } = makeWriteDb({
        inventory: [{ id: 4, status: 'draft', source_name: 'Archive', credit_line: 'LGFC Archive' }],
      });
      const response = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        id: 4,
        status: 'published',
        published_at: '2026-08-12T12:00:00Z',
      });
      expect(runs.some((run) => run.sql.includes('UPDATE content_inventory'))).toBe(true);
    });

    it('blocks publish without required attribution fields', async () => {
      const { db, runs } = makeWriteDb({
        inventory: [{ id: 4, status: 'draft', source_name: '', credit_line: '' }],
      });
      const response = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'Published content_inventory records require source_name and credit_line.',
      });
      expect(runs.some((run) => run.sql.includes('UPDATE content_inventory'))).toBe(false);
    });

    it('rejects invalid publication status values', async () => {
      const response = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'live' }),
        env: {
          ADMIN_TOKEN: 'secret',
          DB: makeWriteDb({
            inventory: [{ id: 4, status: 'draft', source_name: 'Archive', credit_line: 'LGFC Archive' }],
          }).db,
        },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'id and valid status are required.',
      });
    });

    it('pins an eligible published club_home story to a zone', async () => {
      const { db, runs, pins } = makeWriteDb({
        inventory: [
          {
            id: 4,
            status: 'published',
            source_name: 'Archive',
            credit_line: 'LGFC Archive',
            allowed_sections: '["club_home"]',
            story_type: 'primary',
          },
        ],
      });
      const response = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', {
          action: 'pin',
          id: 4,
          zone_id: 'lead-story',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        action: 'pin',
        zone_id: 'lead-story',
        story_id: 4,
      });
      expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory_club_home_pins'))).toBe(true);
      expect(pins).toHaveLength(1);
    });

    it('rejects pin attempts that bypass publication or zone eligibility', async () => {
      const draft = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', {
          action: 'pin',
          id: 4,
          zone_id: 'lead-story',
        }),
        env: {
          ADMIN_TOKEN: 'secret',
          DB: makeWriteDb({
            inventory: [
              {
                id: 4,
                status: 'draft',
                source_name: 'Archive',
                credit_line: 'LGFC Archive',
                allowed_sections: '["club_home"]',
                story_type: 'primary',
              },
            ],
          }).db,
        },
      });
      expect(draft.status).toBe(400);

      const badZoneType = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', {
          action: 'pin',
          id: 4,
          zone_id: 'story-rail',
        }),
        env: {
          ADMIN_TOKEN: 'secret',
          DB: makeWriteDb({
            inventory: [
              {
                id: 4,
                status: 'published',
                source_name: 'Archive',
                credit_line: 'LGFC Archive',
                allowed_sections: '["club_home"]',
                story_type: 'primary',
              },
            ],
          }).db,
        },
      });
      expect(badZoneType.status).toBe(400);
    });

    it('unpins a zone and clears pins when a story leaves published', async () => {
      const { db, runs, pins } = makeWriteDb({
        inventory: [
          {
            id: 4,
            status: 'published',
            source_name: 'Archive',
            credit_line: 'LGFC Archive',
            allowed_sections: '["club_home"]',
            story_type: 'primary',
          },
        ],
        pins: [
          {
            zone_id: 'lead-story',
            story_id: 4,
            pinned_at: '2026-08-12T12:00:00Z',
            pinned_by: 'admin-ui',
            expires_at: null,
          },
        ],
      });

      const unpin = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', {
          action: 'unpin',
          zone_id: 'lead-story',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(unpin.status).toBe(200);
      expect(pins).toHaveLength(0);

      pins.push({
        zone_id: 'lead-story',
        story_id: 4,
        pinned_at: '2026-08-12T12:00:00Z',
        pinned_by: 'admin-ui',
        expires_at: null,
      });
      const archive = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'archived' }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(archive.status).toBe(200);
      expect(runs.some((run) => run.sql.includes('DELETE FROM content_inventory_club_home_pins'))).toBe(true);
      expect(pins).toHaveLength(0);
    });
  });

  describe('media-associations', () => {
    it('rejects unauthorized GET and POST', async () => {
      const env = { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db };
      const getResponse = await mediaAssociationsGet({
        request: adminGetRequest('/api/admin/editorial/media-associations?story_id=12', ''),
        env,
      });
      const postResponse = await mediaAssociationsPost({
        request: adminPostRequest(
          '/api/admin/editorial/media-associations',
          { story_id: 12, media_associations: [] },
          '',
        ),
        env,
      });
      expect(getResponse.status).toBe(401);
      expect(postResponse.status).toBe(401);
    });

    it('reads associations for an existing story (positive GET path)', async () => {
      const { db } = makeWriteDb({
        inventory: [{ id: 12 }],
        mediaAssociations: [
          {
            story_id: 12,
            media_id: 3,
            media_role: 'primary_image',
            display_order: 1,
            caption: 'Lead photo',
            alt_text: 'Gehrig',
            source_name: 'Archive',
            source_url: null,
            credit_line: 'LGFC Archive',
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
        media_associations: [expect.objectContaining({ media_id: 3, media_role: 'primary_image' })],
      });
    });

    it('writes associations when media_id values resolve to photos (positive POST path)', async () => {
      const { db, runs } = makeWriteDb({
        inventory: [{ id: 12 }],
        photos: [{ id: 3, photo_id: 'p3', url: 'https://cdn.example/p3.jpg', title: 'Photo 3' }],
      });
      const response = await mediaAssociationsPost({
        request: adminPostRequest('/api/admin/editorial/media-associations', {
          story_id: 12,
          media_associations: [
            {
              media_id: 3,
              media_role: 'primary_image',
              display_order: 1,
              caption: 'Lead',
              alt_text: 'Lead photo alt text',
              source_name: 'Archive',
              credit_line: 'LGFC Archive',
            },
          ],
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        story_id: 12,
        media_associations: [expect.objectContaining({ media_id: 3 })],
      });
      expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory_media'))).toBe(true);
      expect(runs.some((run) => run.sql.includes('UPDATE content_inventory SET media'))).toBe(true);
    });

    it('rejects associations for unknown photo media_id values', async () => {
      const { db, runs } = makeWriteDb({
        inventory: [{ id: 12 }],
        photos: [{ id: 3, photo_id: 'p3', url: 'https://cdn.example/p3.jpg' }],
      });
      const response = await mediaAssociationsPost({
        request: adminPostRequest('/api/admin/editorial/media-associations', {
          story_id: 12,
          media_associations: [
            {
              media_id: 99,
              media_role: 'gallery_image',
              display_order: 1,
              alt_text: 'Missing photo',
            },
          ],
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'One or more media_id values do not match approved photo records.',
      });
      expect(runs.some((run) => run.sql.includes('INSERT INTO content_inventory_media'))).toBe(false);
    });

    it('requires story_id on GET', async () => {
      const response = await mediaAssociationsGet({
        request: adminGetRequest('/api/admin/editorial/media-associations'),
        env: { ADMIN_TOKEN: 'secret', DB: makeWriteDb().db },
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: 'story_id is required.',
      });
    });
  });

  describe('editorial audit (#3416 P1-08)', () => {
    it('writes structured audit on successful review triage', async () => {
      const { db, auditEvents } = makeWriteDb({ submissions: [pendingSubmission] });
      const response = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', {
          submission_id: 21,
          action: 'triage',
          reviewer: 'ops-reviewer',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]?.args[0]).toBe('triage');
      expect(auditEvents[0]?.args[1]).toBe('submission');
      expect(auditEvents[0]?.args[2]).toBe(21);
      expect(auditEvents[0]?.args[3]).toBe('ops-reviewer');
      expect(String(auditEvents[0]?.args[4])).toContain('pending');
      expect(String(auditEvents[0]?.args[5])).toContain('triaged');
    });

    it('writes audit on inventory create and publish status change', async () => {
      const created = makeWriteDb();
      const createResponse = await inventoryPost({
        request: adminPostRequest('/api/admin/editorial/inventory', {
          tag: 'audit-create',
          title: 'Audit create',
          text: 'Body',
          story_type: 'brief',
          source_name: 'Archive',
          credit_line: 'LGFC',
          submitted_by: 'editor',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: created.db },
      });
      expect(createResponse.status).toBe(200);
      expect(created.auditEvents.some((row) => row.args[0] === 'inventory_create')).toBe(true);

      const { db, auditEvents } = makeWriteDb({
        inventory: [
          {
            id: 4,
            status: 'draft',
            source_name: 'Archive',
            credit_line: 'LGFC',
            allowed_sections: 'club_home',
          },
        ],
      });
      const publishResponse = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(publishResponse.status).toBe(200);
      expect(auditEvents.some((row) => row.args[0] === 'status_change' && row.args[2] === 4)).toBe(true);
    });

    it('does not write success audit for unauthorized or invalid writes', async () => {
      const denied = makeWriteDb({ submissions: [pendingSubmission] });
      const deniedResponse = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', { submission_id: 21, action: 'triage' }, ''),
        env: { ADMIN_TOKEN: 'secret', DB: denied.db },
      });
      expect(deniedResponse.status).toBe(401);
      expect(denied.auditEvents).toHaveLength(0);

      const invalid = makeWriteDb({
        inventory: [{ id: 4, status: 'draft', source_name: '', credit_line: '' }],
      });
      const invalidResponse = await publishPost({
        request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }),
        env: { ADMIN_TOKEN: 'secret', DB: invalid.db },
      });
      expect(invalidResponse.status).toBe(400);
      expect(invalid.auditEvents).toHaveLength(0);
    });

    it('fail-opens when audit storage is unavailable', async () => {
      const { db, auditEvents } = makeWriteDb({
        submissions: [pendingSubmission],
        auditWriteFails: true,
      });
      const response = await reviewPost({
        request: adminPostRequest('/api/admin/editorial/review', {
          submission_id: 21,
          action: 'triage',
          reviewer: 'ops-reviewer',
        }),
        env: { ADMIN_TOKEN: 'secret', DB: db },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'triage' });
      expect(auditEvents).toHaveLength(0);
    });
  });
});
