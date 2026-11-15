import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { planEditions } from '../functions/_lib/social-edition-planner';
import { EDITION_PLAN_UPSERT_SQL, bindValues, planToRows } from '../functions/_lib/edition-plan-rows';
import { assertSelectOnly } from '../scripts/ops/archive-report-lib.mjs';
import {
  POOL_SQL,
  applyGuardFailures,
  daysInWindow,
  dryRunReport,
  parseArgs,
  rowsToPool,
} from '../scripts/ops/edition-plan-write-lib.mjs';
import { resolve as resolveHook } from '../scripts/ops/ts-extensionless-hook.mjs';

const GO = 'https://github.com/wdhunter465/next-starter-template/issues/5218#issuecomment-123456';

function freshDb() {
  const d = new DatabaseSync(':memory:');
  for (const f of readdirSync(resolve(process.cwd(), 'migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    d.exec(readFileSync(resolve(process.cwd(), 'migrations', f), 'utf8'));
  }
  return d;
}

function addStory(d, { tag, title, status = 'published', canonical = 1, eligible = 1, hold = 0, alt = null, caption = null, roles = ['primary_image'] }) {
  const photo = d.prepare('INSERT INTO photos (url, publication_eligible, rights_hold) VALUES (?, ?, ?)').run(`https://media.example/${tag}.jpg`, eligible, hold);
  const story = d
    .prepare("INSERT INTO content_inventory (tag, title, text, credit_line, source_name, status, canonical, summary) VALUES (?, ?, ?, 'LGFC', 'Source', ?, ?, ?)")
    .run(tag, title, `Body of ${title}. `.repeat(20), status, canonical, `Summary of ${title}`);
  roles.forEach((role, i) => {
    d.prepare('INSERT INTO content_inventory_media (story_id, media_id, media_role, display_order, caption, alt_text) VALUES (?, ?, ?, ?, ?, ?)')
      .run(story.lastInsertRowid, photo.lastInsertRowid, role, i, caption, alt);
  });
  return Number(story.lastInsertRowid);
}

describe('edition plan writer (#5218): the pool', () => {
  it('is a single read-only statement', () => {
    expect(() => assertSelectOnly(POOL_SQL)).not.toThrow();
  });

  it('takes published canonical stories with a cleared picture and nothing else', () => {
    const d = freshDb();
    const good = addStory(d, { tag: 'good', title: 'Good story', alt: 'A clear alt' });
    addStory(d, { tag: 'draft', title: 'Draft', status: 'draft' });
    addStory(d, { tag: 'dup', title: 'Duplicate', canonical: 0 });
    addStory(d, { tag: 'held', title: 'Held', hold: 1 });
    addStory(d, { tag: 'ineligible', title: 'Ineligible', eligible: 0 });
    addStory(d, { tag: 'logo', title: 'Wrong role', roles: ['ocr_source', 'newspaper_source'] });
    const rows = d.prepare(POOL_SQL).all();
    expect(rows.map((r) => r.id)).toEqual([good]);
    const [item] = rowsToPool(rows);
    expect(item).toMatchObject({ id: String(good), title: 'Good story', image_alt: 'A clear alt', post_url: null });
    expect(item.image_url).toBe('https://media.example/good.jpg');
  });

  it('returns one row per story even when several pictures qualify', () => {
    const d = freshDb();
    addStory(d, { tag: 'many', title: 'Many pictures', roles: ['primary_image', 'gallery_image', 'supporting_image'] });
    expect(d.prepare(POOL_SQL).all()).toHaveLength(1);
  });

  it('falls back from alt text to caption to the title, and from summary to the text', () => {
    const [byCaption] = rowsToPool([{ id: 1, title: 'T', summary: '', text: 'x '.repeat(400), image_url: 'u', image_alt: null }]);
    expect(byCaption.image_alt).toBe('T');
    expect(byCaption.caption.length).toBeLessThanOrEqual(280);
    expect(rowsToPool([{ id: 2, title: 'T', summary: 'S', text: 't', image_url: '', image_alt: 'a' }])).toEqual([]);
  });
});

describe('edition plan writer (#5218): plan, rows and the write', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({
    id: String(i + 1), title: `T${i + 1}`, caption: `C${i + 1}`, post_url: null,
    image_url: `https://m/${i + 1}.jpg`, image_alt: `A${i + 1}`, usage_count: 0, last_featured: null,
  }));
  const plan = planEditions({ pool, startDate: '2027-01-01', endDate: '2027-01-31' });
  const rows = planToRows(plan, 'v1');

  it('dry run reports counts, shortfalls and a sample, and says nothing was written', () => {
    const report = dryRunReport({ plan, rows, poolSize: 30, start: '2027-01-01', end: '2027-01-31', planVersion: 'v1', database: 'lgfc-litedev' });
    expect(report).toContain('Nothing was written.');
    expect(report).toContain('Pool: 30 published stories');
    expect(report).toContain(`Rows to write: ${rows.length}`);
    expect(report).toContain('| website/website |');
    expect(report).toContain('| Date | Surface | Platform | Item | Status |');
  });

  it('writes into edition_plan, and a re-run changes nothing', () => {
    const d = freshDb();
    const write = () => rows.forEach((r) => d.prepare(EDITION_PLAN_UPSERT_SQL).run(...bindValues(r)));
    write();
    const count = () => d.prepare('SELECT COUNT(*) n FROM edition_plan').get().n;
    const first = count();
    expect(first).toBe(rows.length);
    write();
    expect(count()).toBe(first);
  });

  it('never overwrites a row that is no longer planned', () => {
    const d = freshDb();
    rows.forEach((r) => d.prepare(EDITION_PLAN_UPSERT_SQL).run(...bindValues(r)));
    const target = rows.find((r) => r.surface === 'social');
    d.prepare("UPDATE edition_plan SET status = 'queued' WHERE edition_date = ? AND surface = ? AND platform = ?").run(target.edition_date, target.surface, target.platform);
    const changed = { ...target, content_item_id: 'other', plan_version: 'v2' };
    d.prepare(EDITION_PLAN_UPSERT_SQL).run(...bindValues(changed));
    const kept = d.prepare('SELECT content_item_id, plan_version FROM edition_plan WHERE edition_date = ? AND surface = ? AND platform = ?').get(target.edition_date, target.surface, target.platform);
    expect(kept.plan_version).toBe('v1');
    expect(kept.content_item_id).toBe(target.content_item_id);
  });
});

describe('edition plan writer (#5218): guards on the write', () => {
  const base = { apply: true, goUrl: GO, database: 'lgfc-litedev', env: {}, poolSize: 400, days: 365 };

  it('needs nothing for a dry run', () => {
    expect(applyGuardFailures({ ...base, apply: false, goUrl: '', poolSize: 0 })).toEqual([]);
  });

  it('needs a link to the Go comment on the issue', () => {
    expect(applyGuardFailures({ ...base, goUrl: '' })[0]).toMatch(/confirm-go/);
    expect(applyGuardFailures({ ...base, goUrl: 'https://github.com/wdhunter465/next-starter-template/issues/1#issuecomment-1' })[0]).toMatch(/confirm-go/);
    expect(applyGuardFailures(base)).toEqual([]);
  });

  it('refuses Production without the environment switch', () => {
    expect(applyGuardFailures({ ...base, database: 'lgfc_lite' }).join()).toMatch(/LGFC_EDITION_PLAN_PRODUCTION/);
    expect(applyGuardFailures({ ...base, database: 'lgfc_lite', env: { LGFC_EDITION_PLAN_PRODUCTION: 'yes' } })).toEqual([]);
  });

  it('refuses Production while the pool is under the confirmed target', () => {
    const failures = applyGuardFailures({ ...base, database: 'lgfc_lite', env: { LGFC_EDITION_PLAN_PRODUCTION: 'yes' }, poolSize: 395 });
    expect(failures.join()).toMatch(/396/);
  });

  it('refuses a short pool unless a non-Production run allows the shortfall, never on Production', () => {
    expect(applyGuardFailures({ ...base, poolSize: 10 }).join()).toMatch(/allow-shortfall/);
    expect(applyGuardFailures({ ...base, poolSize: 10, allowShortfall: true })).toEqual([]);
    const prod = applyGuardFailures({ ...base, database: 'lgfc_lite', env: { LGFC_EDITION_PLAN_PRODUCTION: 'yes' }, poolSize: 10, allowShortfall: true });
    expect(prod.join()).toMatch(/not allowed on the Production/);
  });

  it('counts the days in the window', () => {
    expect(daysInWindow('2027-01-01', '2027-12-31')).toBe(365);
    expect(daysInWindow('2027-01-02', '2027-01-01')).toBe(0);
  });
});

describe('edition plan writer (#5218): command line and loader', () => {
  it('defaults to a read-only dry run on Production, remote, for 2027', () => {
    const o = parseArgs([], '2026-11-15');
    expect(o).toMatchObject({ database: 'lgfc_lite', target: 'remote', start: '2027-01-01', end: '2027-12-31', apply: false, planVersion: 'plan-2026-11-15' });
  });

  it('rejects an unknown argument', () => {
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
  });

  it('the loader hook only adds .ts to relative extensionless imports from a .ts file', async () => {
    const seen = [];
    const next = async (spec) => { seen.push(spec); return { url: spec }; };
    await resolveHook('./social-post-formatter', { parentURL: 'file:///a/planner.ts' }, next);
    await resolveHook('./thing.mjs', { parentURL: 'file:///a/planner.ts' }, next);
    await resolveHook('node:fs', { parentURL: 'file:///a/planner.ts' }, next);
    await resolveHook('./plain', { parentURL: 'file:///a/script.mjs' }, next);
    expect(seen).toEqual(['./social-post-formatter.ts', './thing.mjs', 'node:fs', './plain']);
  });
});
