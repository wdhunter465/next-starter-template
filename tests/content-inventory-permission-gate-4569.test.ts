// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// #4569: the publishing gate on content_inventory reads, and the report-only monitor (#4528).

const gate = vi.hoisted(() => ({ on: false }));

vi.mock('../functions/_lib/content-inventory-permission-gate', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../functions/_lib/content-inventory-permission-gate')>();
  return {
    ...mod,
    permissionGateWhere: (alias?: string) => mod.buildPermissionGate(gate.on).permissionGateWhere(alias),
    permissionStatusSelect: (alias?: string) => mod.buildPermissionGate(gate.on).permissionStatusSelect(alias),
    passesPermissionGate: (row: { permission_final_status?: unknown }) =>
      mod.buildPermissionGate(gate.on).passesPermissionGate(row),
  };
});

import { composeClubHomeSelection } from '../functions/_lib/content-inventory-club-home';
import { CONTENT_PERMISSION_GATE_ENABLED } from '../functions/_lib/content-inventory-permission-gate';
import {
  CLUB_HOME_SECTION,
  countPublishedInventoryForSection,
  fetchRelatedInventoryStories,
  fetchSearchInventoryResults,
  LIBRARY_SECTION,
  publishedInventoryWhere,
  SEARCH_SECTION,
} from '../functions/_lib/content-inventory-public';
import { fetchRotationEligibleRows, isRotationEligibleRow } from '../functions/_lib/content-inventory-rotation';
import { buildReport, MONITOR_SQL } from '../scripts/ci/content-permission-monitor-4569.mjs';

type Row = Record<string, unknown>;

function d1(db: DatabaseSync) {
  const statement = (sql: string, args: SQLInputValue[] = []) => ({
    bind: (...next: SQLInputValue[]) => statement(sql, next),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => {
      const info = db.prepare(sql).run(...args);
      return { meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
    },
  });
  return { prepare: (sql: string) => statement(sql) };
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  return db;
}

function insertStory(db: DatabaseSync, tag: string): number {
  const info = db
    .prepare(
      `INSERT INTO content_inventory (tag, title, text, summary, story_type, allowed_sections, source_name, credit_line, status, published_at)
       VALUES (?, ?, ?, ?, 'primary', '["library","club_home","related_content","search"]', 'Example Archive', 'Example Archive', 'published', '2026-10-01T00:00:00Z')`,
    )
    .run(tag, `Gehrig story ${tag}`, `Gehrig story text ${tag}`, `Gehrig summary ${tag}`);
  return Number(info.lastInsertRowid);
}

const PERMITTED_LAYERS = {
  origin_permission: 'permitted',
  cmg_permission: 'not_applicable',
  mlb_permission: 'not_applicable',
  yankees_permission: 'not_applicable',
  privacy_status: 'not_applicable',
  final_status: 'permitted',
  outcome_basis: 'public_domain',
};

let itemCounter = 0;
function linkRecord(db: DatabaseSync, storyId: number, extra: Record<string, string | number> = {}) {
  itemCounter += 1;
  const cols: Record<string, string | number> = {
    candidate_id: `cand-4569-${itemCounter}`,
    input_stream: 'scheduled_discovery',
    title: `Record ${itemCounter}`,
    source_url: `https://example.org/4569-${itemCounter}`,
    source_name: 'Example',
    source_domain: 'example.org',
    source_type: 'archive',
    content_type: 'story',
    summary: 'summary',
    rights_status: 'unknown',
    source_trust_status: 'pending',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    content_inventory_id: storyId,
    ...extra,
  };
  const names = Object.keys(cols);
  db.prepare(`INSERT INTO content_items (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).run(
    ...Object.values(cols),
  );
}

/** One published story per case; returns story ids by case name. */
function seed(db: DatabaseSync) {
  const ids = {
    permitted: insertStory(db, 'permitted'),
    notPermitted: insertStory(db, 'not-permitted'),
    forAdminReview: insertStory(db, 'for-admin-review'),
    feeRequired: insertStory(db, 'fee-required'),
    superseded: insertStory(db, 'superseded'),
    deleted: insertStory(db, 'deleted'),
    unlinked: insertStory(db, 'unlinked'),
    mixed: insertStory(db, 'mixed'),
  };
  linkRecord(db, ids.permitted, PERMITTED_LAYERS);
  linkRecord(db, ids.notPermitted, { final_status: 'not_permitted' });
  linkRecord(db, ids.forAdminReview, { final_status: 'for_admin_review' });
  linkRecord(db, ids.feeRequired, { final_status: 'not_permitted', outcome_basis: 'fee_required' });
  linkRecord(db, ids.superseded, { ...PERMITTED_LAYERS, superseded_at: '2026-10-12T00:00:00Z', superseded_by: 'cand-new' });
  linkRecord(db, ids.deleted, { ...PERMITTED_LAYERS, deleted_at: '2026-10-12T00:00:00Z' });
  linkRecord(db, ids.mixed, PERMITTED_LAYERS);
  linkRecord(db, ids.mixed, { final_status: 'not_permitted' });
  return ids;
}

const idsOf = (rows: Array<{ id: unknown }>) => rows.map((row) => Number(row.id)).sort((a, b) => a - b);

describe('publishing gate (#4569)', () => {
  beforeEach(() => {
    gate.on = false;
  });

  it('ships off, and with the gate off the reads are unchanged', async () => {
    expect(CONTENT_PERMISSION_GATE_ENABLED).toBe(false);
    expect(publishedInventoryWhere(LIBRARY_SECTION)).not.toMatch(/active_content_items/);

    const db = freshDb();
    const ids = seed(db);
    const rows = await fetchRotationEligibleRows(d1(db), { sectionKey: LIBRARY_SECTION });
    expect(idsOf(rows)).toEqual(Object.values(ids).sort((a, b) => a - b));
  });

  it('with the gate on, only the permitted story is selected, counted, related or searched', async () => {
    gate.on = true;
    const db = freshDb();
    const ids = seed(db);
    const D1 = d1(db);

    expect(idsOf(await fetchRotationEligibleRows(D1, { sectionKey: LIBRARY_SECTION }))).toEqual([ids.permitted]);
    expect(await countPublishedInventoryForSection(D1, CLUB_HOME_SECTION)).toBe(1);
    expect(idsOf(await fetchRelatedInventoryStories(D1, { q: 'gehrig', limit: 20 }))).toEqual([ids.permitted]);
    expect(idsOf(await fetchSearchInventoryResults(D1, { sectionKey: SEARCH_SECTION, q: 'gehrig' }))).toEqual([
      ids.permitted,
    ]);
  });

  it('with the gate on, Club Home composes only from the permitted story', async () => {
    gate.on = true;
    const db = freshDb();
    const ids = seed(db);

    const selection = await composeClubHomeSelection(d1(db));
    const placed = new Set((selection?.placements ?? []).map((p) => p.story_id));
    expect([...placed]).toEqual([ids.permitted]);
  });

  it('with the gate on, a row without a permission status fails the second check', () => {
    gate.on = true;
    const row = {
      id: 1,
      status: 'published',
      allowed_sections: '["library"]',
      source_name: 'Example',
      credit_line: 'Example',
    };
    expect(isRotationEligibleRow(row, LIBRARY_SECTION)).toBe(false);
    expect(isRotationEligibleRow({ ...row, permission_final_status: 'for_admin_review' }, LIBRARY_SECTION)).toBe(false);
    expect(isRotationEligibleRow({ ...row, permission_final_status: 'permitted' }, LIBRARY_SECTION)).toBe(true);
  });

  it('with the gate on and active_content_items missing, nothing is shown', async () => {
    gate.on = true;
    const db = freshDb();
    seed(db);
    db.exec('DROP VIEW active_content_items');

    await expect(fetchRotationEligibleRows(d1(db), { sectionKey: LIBRARY_SECTION })).rejects.toThrow(
      /active_content_items/,
    );
  });
});

describe('published content permission monitor (#4528 / #4569)', () => {
  it('reports every published story that is not permitted, without story text', () => {
    const db = freshDb();
    const ids = seed(db);

    const rows = db.prepare(MONITOR_SQL).all() as Row[];
    const report = buildReport(rows, 'scratch');

    expect(report.total).toBe(8);
    expect(report.counts).toEqual({ permitted: 1, not_permitted: 3, for_admin_review: 1, no_linked_record: 3 });
    expect(report.hidden.map((item: Row) => item.id).sort()).toEqual(
      Object.values(ids)
        .filter((id) => id !== ids.permitted)
        .sort(),
    );
    expect(report.markdown).toMatch(/Stories the publishing gate would hide: \*\*7\*\*/);
    expect(report.markdown).not.toMatch(/Gehrig story/);
  });

  it('is a fixed read-only query', () => {
    expect(MONITOR_SQL.trim()).toMatch(/^SELECT/);
    expect(MONITOR_SQL).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i);
  });

  it('workflow is manual only, read-only and takes no SQL input', () => {
    const file = path.join(process.cwd(), '.github/workflows/content-permission-monitor.yml');
    const workflow = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}database:\n/m);
    expect(workflow).not.toMatch(/\b(schedule|push|pull_request|workflow_run):/);
    expect(workflow).toMatch(/default: lgfc-litedev/);
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    expect(workflow).toMatch(/content-permission-monitor-4569\.mjs/);
    expect(workflow).not.toMatch(/--command|--file|migrations apply/);
  });
});
