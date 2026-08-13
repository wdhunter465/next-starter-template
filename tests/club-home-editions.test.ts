import { describe, expect, it } from 'vitest';

import {
  fetchClubHomeContent,
  regenerateClubHomeEdition,
  rollbackClubHomeEdition,
} from '../functions/_lib/content-inventory-club-home';
import {
  onRequestGet as regenerateGet,
  onRequestPost as regeneratePost,
} from '../functions/api/admin/editorial/club-home-edition-regenerate';
import { onRequestPost as rollbackPost } from '../functions/api/admin/editorial/club-home-edition-rollback';

type EditionRow = {
  id: number;
  status: string;
  created_at: string;
  created_by: string | null;
  completed_at: string | null;
  failure_reason: string | null;
};

type PlacementRow = {
  id: number;
  edition_id: number;
  zone_id: string;
  story_id: number | null;
  position: number;
  selection_mode: string;
  feature_size: string | null;
  created_at: string;
};

function sampleInventory() {
  return [
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
      usage_count: 0,
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
      usage_count: 0,
    },
    {
      id: 3,
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
      usage_count: 0,
      event_year: new Date().getUTCFullYear(),
    },
  ];
}

function makeEditionDb(options?: {
  inventory?: Array<Record<string, unknown>>;
  editionsEnabled?: boolean;
  pins?: Array<Record<string, unknown>>;
}) {
  const inventory = options?.inventory ?? sampleInventory();
  const editionsEnabled = options?.editionsEnabled !== false;
  const pins = options?.pins ?? [];
  const editions: EditionRow[] = [];
  const placements: PlacementRow[] = [];
  let active: { edition_id: number; activated_at: string; activated_by: string | null } | null = null;
  let nextEditionId = 1;
  let nextPlacementId = 1;

  const tableNames = editionsEnabled
    ? [
        'content_inventory',
        'content_inventory_club_home_editions',
        'content_inventory_club_home_edition_placements',
        'content_inventory_club_home_active_edition',
        'content_inventory_club_home_pins',
        'content_inventory_placement_history',
        'photos',
      ]
    : ['content_inventory', 'photos'];

  const isEligible = (row: Record<string, unknown>) =>
    row.status === 'published' &&
    String(row.allowed_sections || '').includes('club_home') &&
    String(row.source_name || '').trim() &&
    String(row.credit_line || '').trim();

  const db = {
    editions,
    placements,
    inventory,
    get active() {
      return active;
    },
    prepare(sql: string) {
      const bind = (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes('sqlite_master') && sql.includes('name = ?')) {
            const name = String(args[0] || '');
            return tableNames.includes(name) ? { name } : null;
          }
          if (sql.includes("SELECT datetime('now')")) {
            return { now: '2026-08-13T12:00:00Z' };
          }
          if (sql.includes('COUNT(1)') && sql.includes('content_inventory')) {
            return { n: inventory.filter(isEligible).length };
          }
          if (sql.includes('last_insert_rowid()')) {
            return { id: nextEditionId - 1 };
          }
          if (sql.includes('FROM content_inventory_club_home_editions') && sql.includes('status = ?')) {
            return editions.find((row) => row.status === args[0]) ?? null;
          }
          if (sql.includes('FROM content_inventory_club_home_editions') && sql.includes('id = ?')) {
            return editions.find((row) => row.id === Number(args[0])) ?? null;
          }
          if (sql.includes('FROM content_inventory_club_home_active_edition')) {
            return active;
          }
          if (sql.includes('FROM content_inventory') && sql.includes('WHERE id = ?')) {
            const row = inventory.find((item) => Number(item.id) === Number(args[0]));
            if (!row || !isEligible(row)) return null;
            return row;
          }
          if (sql.includes('FROM photos')) return null;
          return null;
        },
        all: async () => {
          if (sql.includes('sqlite_master') && sql.includes('name IN')) {
            return {
              results: tableNames.filter((name) => args.includes(name)).map((name) => ({ name })),
            };
          }
          if (sql.includes('FROM content_inventory_club_home_pins')) {
            return { results: pins };
          }
          if (sql.includes('FROM content_inventory_club_home_edition_placements')) {
            const editionId = Number(args[0]);
            return {
              results: placements
                .filter((row) => row.edition_id === editionId)
                .sort((a, b) => a.position - b.position || a.id - b.id),
            };
          }
          if (sql.includes('FROM content_inventory')) {
            return { results: inventory.filter(isEligible) };
          }
          return { results: [] };
        },
        run: async () => {
          if (sql.includes('INSERT INTO content_inventory_club_home_editions')) {
            const id = nextEditionId++;
            editions.push({
              id,
              status: String(args[0]),
              created_at: String(args[1]),
              created_by: args[2] == null ? null : String(args[2]),
              completed_at: null,
              failure_reason: null,
            });
            return { success: true, meta: { last_row_id: id } };
          }
          if (sql.includes('INSERT INTO content_inventory_club_home_edition_placements')) {
            placements.push({
              id: nextPlacementId++,
              edition_id: Number(args[0]),
              zone_id: String(args[1]),
              story_id: args[2] == null ? null : Number(args[2]),
              position: Number(args[3]) || 0,
              selection_mode: String(args[4] || 'automatic'),
              feature_size: args[5] == null ? null : String(args[5]),
              created_at: String(args[6]),
            });
            return { success: true };
          }
          if (sql.includes('UPDATE content_inventory_club_home_editions')) {
            const status = String(args[0]);
            if (status === 'ready') {
              const target = editions.find((row) => row.id === Number(args[2]));
              if (target && target.status === String(args[3])) {
                target.status = 'ready';
                target.completed_at = String(args[1]);
                target.failure_reason = null;
              }
            } else if (status === 'failed') {
              const target = editions.find((row) => row.id === Number(args[3]));
              if (target && target.status === String(args[4])) {
                target.status = 'failed';
                target.completed_at = String(args[1]);
                target.failure_reason = String(args[2]);
              }
            }
            return { success: true };
          }
          if (sql.includes('INSERT INTO content_inventory_club_home_active_edition')) {
            active = {
              edition_id: Number(args[0]),
              activated_at: String(args[1]),
              activated_by: args[2] == null ? null : String(args[2]),
            };
            return { success: true };
          }
          return { success: true };
        },
      });
      return {
        bind,
        first: async () => bind().first(),
        all: async () => bind().all(),
        run: async () => bind().run(),
      };
    },
  };

  return db;
}

function adminContext(db: ReturnType<typeof makeEditionDb>, body?: unknown, method = 'POST') {
  return {
    request: new Request('https://www.lougehrigfanclub.com/api/admin/editorial/club-home-edition', {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'secret' },
      body: method === 'GET' || body === undefined ? undefined : JSON.stringify(body),
    }),
    env: { ADMIN_TOKEN: 'secret', DB: db },
  };
}

describe('club-home editions P1-06', () => {
  it('preserves live rotation when edition migration is absent', async () => {
    const db = makeEditionDb({ editionsEnabled: false });
    const payload = await fetchClubHomeContent(db);
    expect(payload.source).toBe('content_inventory');
    expect(payload.lead_story?.id).toBe(1);
    expect(payload.edition_id).toBeNull();
  });

  it('serves static when edition tables exist but no active edition is set', async () => {
    const db = makeEditionDb();
    const payload = await fetchClubHomeContent(db);
    expect(payload.source).toBe('static');
    expect(payload.lead_story).toBeNull();
    expect(payload.edition_id).toBeNull();
  });

  it('regenerates an immutable edition and serves it without recomputing rotation', async () => {
    const db = makeEditionDb();
    const generated = await regenerateClubHomeEdition(db, { createdBy: 'tester' });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    expect(generated.edition_id).toBe(1);
    expect(generated.placements.length).toBeGreaterThan(0);
    expect(db.active?.edition_id).toBe(1);

    const payload = await fetchClubHomeContent(db);
    expect(payload.source).toBe('content_inventory');
    expect(payload.edition_id).toBe(1);
    expect(payload.lead_story?.id).toBe(1);
    expect(payload.rail_stories[0]?.id).toBe(2);
  });

  it('fails closed on concurrent building regeneration', async () => {
    const db = makeEditionDb();
    db.editions.push({
      id: 99,
      status: 'building',
      created_at: '2026-08-13T11:00:00Z',
      created_by: 'other',
      completed_at: null,
      failure_reason: null,
    });
    const result = await regenerateClubHomeEdition(db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(db.active).toBeNull();
  });

  it('rolls back to a prior ready edition without rewriting placements', async () => {
    const db = makeEditionDb();
    const first = await regenerateClubHomeEdition(db, { createdBy: 'tester' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstPlacementCount = db.placements.filter((row) => row.edition_id === first.edition_id).length;

    const second = await regenerateClubHomeEdition(db, { createdBy: 'tester' });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(db.active?.edition_id).toBe(second.edition_id);

    const rolled = await rollbackClubHomeEdition(db, first.edition_id, { activatedBy: 'tester' });
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(rolled.edition_id).toBe(first.edition_id);
    expect(db.active?.edition_id).toBe(first.edition_id);
    expect(db.placements.filter((row) => row.edition_id === first.edition_id)).toHaveLength(
      firstPlacementCount,
    );

    const payload = await fetchClubHomeContent(db);
    expect(payload.source).toBe('content_inventory');
    expect(payload.edition_id).toBe(first.edition_id);
  });

  it('omits unpublished edition placements at serve time (gates remain authoritative)', async () => {
    const inventory = sampleInventory();
    const db = makeEditionDb({ inventory });
    const generated = await regenerateClubHomeEdition(db);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    inventory[0].status = 'draft';
    const payload = await fetchClubHomeContent(db);
    expect(payload.source).toBe('content_inventory');
    expect(payload.edition_id).toBe(generated.edition_id);
    expect(payload.lead_story).toBeNull();
    expect(payload.rail_stories[0]?.id).toBe(2);
  });

  it('admin regenerate/rollback endpoints enforce auth and mutate editions', async () => {
    const db = makeEditionDb();
    const denied = await regeneratePost({
      request: new Request('https://example.com', { method: 'POST', body: '{}' }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });
    expect(denied.status).toBe(401);

    const created = await regeneratePost(adminContext(db, { created_by: 'admin-ui' }));
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.ok).toBe(true);
    expect(createdBody.edition_id).toBe(1);

    const inspect = await regenerateGet(adminContext(db, undefined, 'GET'));
    expect(inspect.status).toBe(200);
    const inspectBody = await inspect.json();
    expect(inspectBody.active.edition_id).toBe(1);

    await regeneratePost(adminContext(db, { created_by: 'admin-ui' }));
    const rolled = await rollbackPost(adminContext(db, { edition_id: 1, activated_by: 'admin-ui' }));
    expect(rolled.status).toBe(200);
    const rolledBody = await rolled.json();
    expect(rolledBody.edition_id).toBe(1);
  });
});
