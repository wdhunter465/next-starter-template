// @vitest-environment node
// #5289: the ledger gains 'handed_off' and the evidence table arrives. Rehearses migration 0102 against a
// database that already holds ledger rows: nothing existing may change, and the new values are accepted.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const dir = path.join(process.cwd(), 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const MIGRATION = '0102_social_ledger_handed_off_5289.sql';

function dbBefore() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of files.filter((f) => f < MIGRATION)) sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  return sqlite;
}

const rows = (sqlite: DatabaseSync) =>
  sqlite
    .prepare('SELECT post_id, platform, status, platform_post_id, attempts, error, recorded_at FROM social_post_ledger ORDER BY post_id, platform')
    .all();

describe('migration 0102 rehearsal (#5289)', () => {
  it('keeps every existing ledger row exactly as it was', () => {
    const sqlite = dbBefore();
    const insert = sqlite.prepare(
      "INSERT INTO social_post_ledger (post_id, platform, status, platform_post_id, attempts, error, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    insert.run('2026-11-09-daily', 'x', 'posted', 'buffer-1', 1, null, '2026-11-09T15:04:00.000Z');
    insert.run('2026-11-09-daily', 'facebook', 'posted', 'issue#5181', 1, null, '2026-11-09T15:05:00.000Z');
    insert.run('2026-11-10-daily', 'pinterest', 'failed', null, 3, 'boom', '2026-11-10T15:05:00.000Z');
    const before = rows(sqlite);
    expect(before).toHaveLength(3);

    sqlite.exec(fs.readFileSync(path.join(dir, MIGRATION), 'utf8'));

    expect(rows(sqlite)).toEqual(before);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM social_post_ledger WHERE status = 'posted'").get()).toEqual({ n: 2 });
  });

  it('accepts handed_off, still refuses an unknown status, and keeps one row per post and platform', () => {
    const sqlite = dbBefore();
    sqlite.exec(fs.readFileSync(path.join(dir, MIGRATION), 'utf8'));
    const insert = (status: string, platform = 'facebook') =>
      sqlite.prepare('INSERT INTO social_post_ledger (post_id, platform, status) VALUES (?, ?, ?)').run('2026-11-11-daily', platform, status);
    insert('handed_off');
    expect(() => insert('handed_off')).toThrow();
    expect(() => insert('maybe', 'instagram')).toThrow();
    expect(() => insert('posted', 'myspace')).toThrow();
    expect(sqlite.prepare("SELECT status FROM social_post_ledger WHERE platform = 'facebook'").get()).toEqual({ status: 'handed_off' });
  });

  it('creates the evidence table with one row per record version', () => {
    const sqlite = dbBefore();
    sqlite.exec(fs.readFileSync(path.join(dir, MIGRATION), 'utf8'));
    const insert = (version: number, status = 'handed_off', origin = 'queue') =>
      sqlite
        .prepare('INSERT INTO social_post_evidence (post_id, platform, version, origin, status, record_json) VALUES (?, ?, ?, ?, ?, ?)')
        .run('adhoc-2026-11-17-1', 'x', version, origin, status, '{"schema":"social_post_evidence/1"}');
    insert(1, 'handed_off', 'ad_hoc');
    insert(2, 'confirmed', 'ad_hoc');
    expect(() => insert(2, 'confirmed', 'ad_hoc')).toThrow();
    expect(() => insert(0)).toThrow();
    expect(() => insert(3, 'posted')).toThrow();
    expect(() => insert(3, 'failed', 'someone')).toThrow();
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM social_post_evidence').get()).toEqual({ n: 2 });
  });
});
