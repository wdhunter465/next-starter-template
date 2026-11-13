// @vitest-environment node
// #5075: migration 0099 (edition_plan) and the row builder in functions/_lib/edition-plan-rows.ts.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { EDITION_PLAN_UPSERT_SQL, bindValues, planToRows } from '../functions/_lib/edition-plan-rows';
import { planEditions, type PoolItem } from '../functions/_lib/social-edition-planner';

const MIGRATIONS = path.join(process.cwd(), 'migrations');
const TARGET = '0099_edition_plan_5075.sql';

function schemaThroughTarget(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
    if (file === TARGET) break;
  }
  return db;
}

function pool(count: number): PoolItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${String(i + 1).padStart(3, '0')}`,
    title: `Gehrig story ${i + 1}`,
    caption: `Caption for story ${i + 1}.`,
    post_url: `https://lougehrigfanclub.com/archive/${i + 1}`,
    image_url: `https://media.example/${i + 1}.jpg`,
    image_alt: `Photo ${i + 1}`,
    usage_count: 0,
    last_featured: null,
  }));
}

const INPUT = { startDate: '2027-01-01', endDate: '2027-01-10', pool: pool(60) };

function write(db: DatabaseSync, version: string, input = INPUT) {
  const stmt = db.prepare(EDITION_PLAN_UPSERT_SQL);
  const rows = planToRows(planEditions(input), version);
  for (const row of rows) stmt.run(...bindValues(row));
  return rows;
}

const count = (db: DatabaseSync) => (db.prepare('SELECT COUNT(*) AS n FROM edition_plan').get() as { n: number }).n;

describe('migration 0099 edition_plan', () => {
  it('applies after every earlier migration and is safe to run twice', () => {
    const db = schemaThroughTarget();
    db.exec(fs.readFileSync(path.join(MIGRATIONS, TARGET), 'utf8'));
    expect(count(db)).toBe(0);
  });

  it('rejects bad dates, surfaces, platforms and a surface that does not match its platform', () => {
    const db = schemaThroughTarget();
    const insert = (date: string, surface: string, platform: string) =>
      db.prepare('INSERT INTO edition_plan (edition_date, surface, platform, plan_version) VALUES (?, ?, ?, ?)').run(date, surface, platform, 'v1');
    expect(() => insert('2027-1-1', 'website', 'website')).toThrow();
    expect(() => insert('2027-01-01', 'blog', 'website')).toThrow();
    expect(() => insert('2027-01-01', 'social', 'tiktok')).toThrow();
    expect(() => insert('2027-01-01', 'website', 'x')).toThrow();
    expect(() => insert('2027-01-01', 'social', 'website')).toThrow();
    expect(() => insert('2027-01-01', 'website', 'website')).not.toThrow();
  });

  it('allows one row per date, surface and platform, including the website surface', () => {
    const db = schemaThroughTarget();
    const insert = () =>
      db.prepare("INSERT INTO edition_plan (edition_date, surface, platform, plan_version) VALUES ('2027-01-01', 'website', 'website', 'v1')").run();
    insert();
    expect(insert).toThrow();
  });

  it('never changes or deletes a posted row', () => {
    const db = schemaThroughTarget();
    db.exec(
      "INSERT INTO edition_plan (edition_date, surface, platform, plan_version, status, external_id) VALUES ('2027-01-01', 'social', 'x', 'v1', 'posted', 'ext1')",
    );
    expect(() => db.exec("UPDATE edition_plan SET text = 'changed' WHERE platform = 'x'")).toThrow(/posted row cannot be changed/);
    expect(() => db.exec("DELETE FROM edition_plan WHERE platform = 'x'")).toThrow(/posted row cannot be deleted/);
    expect(count(db)).toBe(1);
  });
});

describe('edition plan rows', () => {
  it('builds website rows and social rows per platform from the planner', () => {
    const rows = planToRows(planEditions(INPUT), 'v1');
    expect(rows.filter((r) => r.surface === 'website')).toHaveLength(10);
    expect(rows.filter((r) => r.surface === 'website').every((r) => r.platform === 'website' && r.channel === null)).toBe(true);
    const social = rows.filter((r) => r.surface === 'social');
    expect(new Set(social.map((r) => r.platform))).toEqual(new Set(['facebook_page', 'instagram', 'pinterest', 'x']));
    expect(social.find((r) => r.platform === 'x')?.channel).toBe('buffer');
    expect(social.find((r) => r.platform === 'instagram')?.channel).toBe('zapier');
  });

  it('records a website day with no item as a skipped row', () => {
    const rows = planToRows(planEditions({ ...INPUT, pool: [] }), 'v1');
    const web = rows.filter((r) => r.surface === 'website');
    expect(web).toHaveLength(10);
    expect(web.every((r) => r.status === 'skipped' && r.skip === 1 && r.skip_reason === 'empty_pool')).toBe(true);
  });

  it('requires a plan version', () => {
    expect(() => planToRows(planEditions(INPUT), '  ')).toThrow(/planVersion/);
  });

  it('writes the plan once and a re-run adds nothing', () => {
    const db = schemaThroughTarget();
    const rows = write(db, 'v1');
    const first = count(db);
    expect(first).toBe(rows.length);
    write(db, 'v1');
    expect(count(db)).toBe(first);
  });

  it('a re-run refreshes planned rows with a new plan version', () => {
    const db = schemaThroughTarget();
    write(db, 'v1');
    write(db, 'v2');
    const versions = db.prepare('SELECT DISTINCT plan_version AS v FROM edition_plan').all() as Array<{ v: string }>;
    expect(versions.map((r) => r.v)).toEqual(['v2']);
  });

  it('leaves queued, failed and posted rows untouched on a re-run', () => {
    const db = schemaThroughTarget();
    write(db, 'v1');
    db.exec("UPDATE edition_plan SET status = 'queued' WHERE edition_date = '2027-01-01' AND platform = 'instagram'");
    db.exec("UPDATE edition_plan SET status = 'failed', error = 'boom' WHERE edition_date = '2027-01-02' AND platform = 'instagram'");
    db.exec("UPDATE edition_plan SET status = 'posted', external_id = 'ext1' WHERE edition_date = '2027-01-03' AND platform = 'x'");
    const before = db.prepare('SELECT * FROM edition_plan WHERE status <> \'planned\' ORDER BY id').all();
    expect(before).toHaveLength(3);
    write(db, 'v2', { ...INPUT, pool: pool(60).reverse() });
    const after = db.prepare('SELECT * FROM edition_plan WHERE status <> \'planned\' ORDER BY id').all();
    expect(after).toEqual(before);
  });
});
