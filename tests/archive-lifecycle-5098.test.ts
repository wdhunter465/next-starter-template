// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteB2ObjectAllVersions, parseListObjectVersionsXml } from '../functions/_lib/b2';
import { parseArgs, parseMediaRef, runSweep } from '../scripts/ops/archive-sweep-lib.mjs';

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';
const NOW = '2026-11-05T12:00:00.000Z';

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  return db;
}

// A D1-style wrapper over node:sqlite (prepare / bind / all / first / run).
function d1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      let params: unknown[] = [];
      const statement = {
        bind(...p: unknown[]) {
          params = p;
          return statement;
        },
        async all() {
          return { results: db.prepare(sql).all(...(params as never[])) };
        },
        async first() {
          return db.prepare(sql).get(...(params as never[])) ?? null;
        },
        async run() {
          db.prepare(sql).run(...(params as never[]));
          return { success: true };
        },
      };
      return statement;
    },
  };
}

let counter = 0;
function addItem(db: DatabaseSync, over: Record<string, unknown> = {}): number {
  counter += 1;
  const row = {
    candidate_id: `cand-5098-${counter}`, input_stream: 'scheduled_discovery', title: `Item ${counter}`, source_name: 'Test', source_type: 'archive',
    content_type: 'photo', summary: 's', rights_status: 'unknown', source_trust_status: 'pending', relevance_status: 'pending',
    review_status: 'pending_review', publication_status: 'not_ready', privacy_flag: 'none', privacy_review_status: 'not_applicable',
    review_priority: 'normal', source_domain: 'loc.gov', source_url: `https://www.loc.gov/item/${counter}`, ...over,
  };
  const keys = Object.keys(row);
  return Number(db.prepare(`INSERT INTO content_items (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...(Object.values(row) as never[])).lastInsertRowid);
}

function move(db: DatabaseSync, id: number, state: string, reason: string, extra = '') {
  db.prepare(`UPDATE content_items SET lifecycle_state = ?, lifecycle_reason = ?, lifecycle_set_by = 'test', lifecycle_issue = 5098 ${extra} WHERE id = ?`).run(state, reason, id);
}

function approveForDeletion(db: DatabaseSync, id: number, deleteAfter = PAST) {
  move(db, id, 'not_to_be_used', 'does not name Gehrig');
  move(db, id, 'ok_to_delete', 'approved on #5098', `, delete_after = '${deleteAfter}'`);
}

function addPicture(db: DatabaseSync, key: string, photoOver: Record<string, unknown> = {}) {
  db.prepare('INSERT INTO media_assets (media_uid, b2_key, size, etag, rights_hold) VALUES (?, ?, 1, ?, 1)').run(`uid-${key}`, key, `etag-${key}`);
  const photoId = Number(
    db
      .prepare('INSERT INTO photos (url, is_memorabilia, description, photo_id, publication_eligible, rights_hold) VALUES (?, 0, ?, ?, ?, 1)')
      .run(`https://s3.example/LouGehrigFanClub/${key}`, key, key, Number(photoOver.publication_eligible ?? 0)).lastInsertRowid,
  );
  return photoId;
}

describe('lifecycle states (#5098)', () => {
  it('starts every record active and allows only the legal moves, each with a new reason', () => {
    const db = migratedDb();
    const id = addItem(db);
    const state = () => (db.prepare('SELECT lifecycle_state AS s FROM content_items WHERE id = ?').get(id) as { s: string }).s;
    expect(state()).toBe('active');
    expect(() => move(db, id, 'ok_to_delete', 'skip a step', `, delete_after = '${PAST}'`)).toThrow(/illegal lifecycle move/);
    expect(() => move(db, id, 'purged', 'skip steps')).toThrow(/illegal lifecycle move/);
    expect(() => db.prepare("UPDATE content_items SET lifecycle_state = 'not_to_be_used' WHERE id = ?").run(id)).toThrow(/needs a new reason/);
    move(db, id, 'not_to_be_used', 'off topic');
    expect(() => db.prepare("UPDATE content_items SET lifecycle_state = 'ok_to_delete', lifecycle_reason = 'again' WHERE id = ?").run(id)).toThrow(/delete_after/);
    expect(() => move(db, id, 'ok_to_delete', 'off topic', `, delete_after = '${PAST}'`)).toThrow(/new reason/);
    move(db, id, 'ok_to_delete', 'approved', `, delete_after = '${FUTURE}'`);
    expect(() => move(db, id, 'purged', 'too early')).toThrow(/waiting period/);
    move(db, id, 'not_to_be_used', 'cancelled');
    move(db, id, 'active', 'restored');
    expect(state()).toBe('active');
    expect(db.prepare('SELECT from_state, to_state, reason FROM archive_lifecycle_events WHERE content_item_id = ? ORDER BY id').all(id)).toEqual([
      { from_state: 'active', to_state: 'not_to_be_used', reason: 'off topic' },
      { from_state: 'not_to_be_used', to_state: 'ok_to_delete', reason: 'approved' },
      { from_state: 'ok_to_delete', to_state: 'not_to_be_used', reason: 'cancelled' },
      { from_state: 'not_to_be_used', to_state: 'active', reason: 'restored' },
    ]);
  });

  it('makes purged final, keeps the event log and tombstones append-only, and hides non-active records from selection', () => {
    const db = migratedDb();
    const kept = addItem(db);
    const retired = addItem(db);
    const gone = addItem(db);
    move(db, retired, 'not_to_be_used', 'retired');
    approveForDeletion(db, gone);
    move(db, gone, 'purged', 'sweep');
    expect(() => move(db, gone, 'active', 'try to bring back')).toThrow(/illegal lifecycle move/);
    expect(db.prepare('SELECT id FROM active_content_items ORDER BY id').all()).toEqual([{ id: kept }]);
    expect(() => db.prepare('UPDATE archive_lifecycle_events SET reason = ?').run('x')).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM archive_lifecycle_events').run()).toThrow(/append-only/);
    db.prepare("INSERT INTO archive_tombstones (content_item_id, source_url) VALUES (?, 'https://x')").run(gone);
    expect(() => db.prepare("UPDATE archive_tombstones SET reason = 'x'").run()).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM archive_tombstones').run()).toThrow(/append-only/);
    expect(() => db.prepare("INSERT INTO archive_tombstones (content_item_id) VALUES (?)").run(gone)).toThrow();
  });

  it('keeps the lifecycle columns, triggers and view after the 0065 emergency rollback rebuilds content_items', () => {
    const db = migratedDb();
    const id = addItem(db);
    const other = addItem(db);
    move(db, other, 'not_to_be_used', 'retired');
    db.exec(fs.readFileSync(path.join(process.cwd(), 'scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql'), 'utf8'));
    expect(db.prepare('SELECT lifecycle_state FROM content_items WHERE id = ?').get(other)).toEqual({ lifecycle_state: 'not_to_be_used' });
    expect(db.prepare('SELECT id FROM active_content_items').all()).toEqual([{ id }]);
    expect(() => move(db, id, 'purged', 'skip')).toThrow(/illegal lifecycle move/);
    move(db, id, 'not_to_be_used', 'after rollback');
    expect((db.prepare('SELECT COUNT(*) AS n FROM archive_lifecycle_events WHERE content_item_id = ?').get(id) as { n: number }).n).toBe(1);
  });
});

describe('the sweep (#5098)', () => {
  function setup() {
    const db = migratedDb();
    const id = addItem(db, { media_asset_id: 'b2://LGFC_a.jpg' });
    const photoId = addPicture(db, 'LGFC_a.jpg');
    db.prepare("INSERT INTO content_inventory_media_renditions (media_id, size, b2_key, url, status, generated_at) VALUES (?, 'small', 'renditions/LGFC_a_small.jpg', 'https://x/renditions/LGFC_a_small.jpg', 'ready', ?)").run(photoId, NOW);
    approveForDeletion(db, id);
    return { db, id, photoId };
  }
  const deleted: string[] = [];
  const deleteObject = async (key: string) => {
    deleted.push(key);
  };
  const run = (db: DatabaseSync, over: Record<string, unknown> = {}) => runSweep(d1(db), { deleteObject, nowIso: NOW, sweepRun: 'run-1', limit: 5, ...over } as never);

  afterEach(() => {
    deleted.length = 0;
  });

  it('plans without changing anything on a dry run', async () => {
    const { db, id } = setup();
    const before = JSON.stringify([db.prepare('SELECT * FROM content_items').all(), db.prepare('SELECT * FROM media_assets').all(), db.prepare('SELECT * FROM photos').all()]);
    const report = await run(db);
    expect(report).toMatchObject({ due: 1, purged: [], planned: [{ content_item_id: id, b2_objects: 2, photo_rows: 1 }] });
    expect(deleted).toEqual([]);
    expect(JSON.stringify([db.prepare('SELECT * FROM content_items').all(), db.prepare('SELECT * FROM media_assets').all(), db.prepare('SELECT * FROM photos').all()])).toBe(before);
  });

  it('purges a due item: tombstone, B2 objects, picture rows and the record, and is safe to repeat', async () => {
    const { db, id } = setup();
    const report = await run(db, { apply: true });
    expect(report.purged).toEqual([id]);
    expect(deleted.sort()).toEqual(['LGFC_a.jpg', 'renditions/LGFC_a_small.jpg']);
    expect(db.prepare('SELECT lifecycle_state, media_asset_id, lifecycle_set_by FROM content_items WHERE id = ?').get(id)).toEqual({ lifecycle_state: 'purged', media_asset_id: null, lifecycle_set_by: 'archive-sweep' });
    expect(db.prepare('SELECT b2_key, source_url, flagged_issue, sweep_run FROM archive_tombstones WHERE content_item_id = ?').get(id)).toMatchObject({ b2_key: 'LGFC_a.jpg', flagged_issue: 5098, sweep_run: 'run-1' });
    for (const table of ['media_assets', 'photos', 'content_inventory_media_renditions']) {
      expect((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n).toBe(0);
    }
    expect(db.prepare('SELECT to_state FROM archive_lifecycle_events WHERE content_item_id = ? ORDER BY id DESC LIMIT 1').get(id)).toEqual({ to_state: 'purged' });
    expect((await run(db, { apply: true })).due).toBe(0);
  });

  it('skips items still inside the waiting period', async () => {
    const db = migratedDb();
    const id = addItem(db, { media_asset_id: 'b2://LGFC_b.jpg' });
    addPicture(db, 'LGFC_b.jpg');
    approveForDeletion(db, id, FUTURE);
    expect((await run(db, { apply: true })).due).toBe(0);
    expect(deleted).toEqual([]);
  });

  it('refuses an item whose picture is still in use, and says why', async () => {
    const cases: [string, (db: DatabaseSync, photoId: number) => void, string][] = [
      ['website-eligible photo', (db, p) => db.prepare('UPDATE photos SET publication_eligible = 1 WHERE id = ?').run(p), 'photo_publication_eligible'],
      ['featured photo', (db, p) => db.prepare('UPDATE photos SET is_featured = 1 WHERE id = ?').run(p), 'photo_featured'],
      ['matchup-eligible photo', (db, p) => db.prepare('UPDATE photos SET is_matchup_eligible = 1 WHERE id = ?').run(p), 'photo_matchup_eligible'],
      [
        'story media',
        (db, p) => {
          db.prepare("INSERT INTO content_inventory (id, tag, title, text, credit_line) VALUES (900, 'tag', 't', 'x', 'credit')").run();
          db.prepare("INSERT INTO content_inventory_media (story_id, media_id, media_role) VALUES (900, ?, 'primary_image')").run(p);
        },
        'photo_used_by_story',
      ],
    ];
    for (const [label, mutate, reason] of cases) {
      const { db, id, photoId } = setup();
      mutate(db, photoId);
      const report = await run(db, { apply: true });
      expect(report.blocked, label).toEqual([{ content_item_id: id, candidate_id: expect.any(String), reason }]);
      expect(report.purged, label).toEqual([]);
      expect(deleted, label).toEqual([]);
      expect(db.prepare('SELECT lifecycle_state FROM content_items WHERE id = ?').get(id), label).toEqual({ lifecycle_state: 'ok_to_delete' });
      deleted.length = 0;
    }
  });

  it('refuses a picture shared with a live record, and purges only the record when the picture is already gone', async () => {
    const { db, id } = setup();
    addItem(db, { media_asset_id: 'media_uid:uid-LGFC_a.jpg' });
    expect((await run(db, { apply: true })).blocked).toEqual([expect.objectContaining({ content_item_id: id, reason: 'shared_with_live_record' })]);

    const db2 = migratedDb();
    const orphan = addItem(db2, { media_asset_id: 'b2://already_gone.jpg' });
    approveForDeletion(db2, orphan);
    const report = await run(db2, { apply: true });
    expect(report.purged).toEqual([orphan]);
    expect(deleted).toEqual([]);
    expect(db2.prepare('SELECT b2_key FROM archive_tombstones WHERE content_item_id = ?').get(orphan)).toEqual({ b2_key: null });
  });

  it('reports a failure and finishes the item on the next run', async () => {
    const { db, id } = setup();
    let fail = true;
    const flaky = async (key: string) => {
      if (fail && key.startsWith('renditions/')) throw new Error('B2 unavailable');
      deleted.push(key);
    };
    const first = await runSweep(d1(db), { deleteObject: flaky, apply: true, limit: 5, nowIso: NOW, sweepRun: 'run-1' } as never);
    expect(first.failed).toEqual([{ content_item_id: id, error: 'B2 unavailable' }]);
    expect(db.prepare('SELECT lifecycle_state FROM content_items WHERE id = ?').get(id)).toEqual({ lifecycle_state: 'ok_to_delete' });
    fail = false;
    const second = await runSweep(d1(db), { deleteObject: flaky, apply: true, limit: 5, nowIso: NOW, sweepRun: 'run-2' } as never);
    expect(second.purged).toEqual([id]);
    expect((db.prepare('SELECT COUNT(*) AS n FROM archive_tombstones').get() as { n: number }).n).toBe(1);
  });

  it('reads media references and arguments', () => {
    expect(parseMediaRef('b2://LGFC_a.jpg')).toEqual({ key: 'LGFC_a.jpg', uid: null });
    expect(parseMediaRef('media_uid:sha256_abc')).toEqual({ key: null, uid: 'sha256_abc' });
    expect(parseMediaRef(null)).toEqual({ key: null, uid: null });
    expect(parseArgs([])).toEqual({ database: 'lgfc_lite', target: 'remote', limit: 5, apply: false });
    expect(parseArgs(['--apply', '--limit', '1', '--local'])).toMatchObject({ apply: true, limit: 1, target: 'local' });
    expect(() => parseArgs(['--limit', '0'])).toThrow(/1 to 100/);
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
  });
});

describe('B2 permanent delete (#5098)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists versions and delete markers from the S3 response', () => {
    const xml = `<ListVersionsResult><Version><Key>a.jpg</Key><VersionId>v1</VersionId></Version>
      <DeleteMarker><Key>a.jpg</Key><VersionId>v2</VersionId></DeleteMarker><Version><Key>a.jpg.bak</Key><VersionId>v3</VersionId></Version></ListVersionsResult>`;
    expect(parseListObjectVersionsXml(xml)).toEqual([
      { key: 'a.jpg', versionId: 'v1', isDeleteMarker: false },
      { key: 'a.jpg', versionId: 'v2', isDeleteMarker: true },
      { key: 'a.jpg.bak', versionId: 'v3', isDeleteMarker: false },
    ]);
  });

  it('deletes every version of exactly the requested key', async () => {
    const calls: { method: string; url: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: { method?: string }) => {
        const url = String((input as { url?: string }).url ?? input);
        const method = init?.method ?? (input as { method?: string }).method ?? 'GET';
        calls.push({ method, url });
        if (method === 'GET') {
          return new Response('<ListVersionsResult><Version><Key>a.jpg</Key><VersionId>v1</VersionId></Version><DeleteMarker><Key>a.jpg</Key><VersionId>v2</VersionId></DeleteMarker><Version><Key>a.jpg.bak</Key><VersionId>v3</VersionId></Version></ListVersionsResult>', { status: 200 });
        }
        return new Response(null, { status: 204 });
      }),
    );
    const result = await deleteB2ObjectAllVersions({ B2_ENDPOINT: 'https://s3.example', B2_BUCKET: 'bucket', B2_KEY_ID: 'id', B2_APP_KEY: 'key' }, 'a.jpg');
    expect(result).toEqual({ versionsDeleted: 2 });
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
    expect(deletes).toEqual(['https://s3.example/bucket/a.jpg?versionId=v1', 'https://s3.example/bucket/a.jpg?versionId=v2']);
    expect(calls[0].url).toContain('versions');
    expect(calls[0].url).toContain('prefix=a.jpg');
  });
});
