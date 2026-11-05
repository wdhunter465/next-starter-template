// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  CONTENT_WITHOUT_MEDIA_SQL,
  PHOTOS_WITHOUT_MEDIA_SQL,
  REPORT_SQL,
  assertSelectOnly,
  classifyRow,
  renderMarkdown,
  summarize,
  toCsv,
} from '../scripts/ops/archive-report-lib.mjs';
import { parseArgs } from '../scripts/ops/archive-report.mjs';

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  return db;
}

function addMedia(db: DatabaseSync, key: string, hold: number) {
  db.prepare('INSERT INTO media_assets (media_uid, b2_key, size, etag, rights_hold) VALUES (?, ?, 1, ?, ?)').run(`uid-${key}`, key, `etag-${key}`, hold);
}

function addContent(db: DatabaseSync, candidate: string, mediaRef: string | null, extra: Record<string, unknown> = {}) {
  const row = {
    candidate_id: candidate, input_stream: 'scheduled_discovery', title: `Title ${candidate}`, source_name: 'Test', source_type: 'archive',
    content_type: 'photo', summary: 's', rights_status: 'public_domain_candidate', source_trust_status: 'pending', relevance_status: 'pending',
    review_status: 'pending_review', publication_status: 'not_ready', privacy_flag: 'none', privacy_review_status: 'not_applicable',
    review_priority: 'normal', source_domain: 'loc.gov', media_asset_id: mediaRef, ...extra,
  };
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO content_items (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...(Object.values(row) as never[]));
}

describe('archive report (#5084)', () => {
  it('lists every B2 picture, joins content and photo rows, and accounts for the unmatched ones', () => {
    const db = migratedDb();
    addMedia(db, 'LGFC_sha256_a.jpg', 0); // released, no content record
    addMedia(db, 'LGFC_sha256_b.jpg', 1); // held, content record without a verdict
    addMedia(db, 'LGFC_sha256_c.jpg', 1); // held, content record with a verdict
    addContent(db, 'cand-b', 'b2://LGFC_sha256_b.jpg', { final_status: 'for_admin_review' });
    addContent(db, 'cand-c', 'media_uid:uid-LGFC_sha256_c.jpg', { final_status: 'not_permitted', gate_decision: 'not_good', gate_relevance: 'excluded', gate_reasons: 'no_gehrig_reference' });
    addContent(db, 'cand-orphan', 'b2://missing.jpg');
    addContent(db, 'cand-deleted', 'b2://LGFC_sha256_b.jpg', { deleted_at: '2026-11-01T00:00:00Z' });
    db.prepare("INSERT INTO photos (url, is_memorabilia, description, photo_id, publication_eligible, rights_hold) VALUES ('https://s3.example/LouGehrigFanClub/LGFC_sha256_a.jpg', 0, 'a', 'a', 1, 0)").run();
    db.prepare("INSERT INTO photos (url, is_memorabilia, description, photo_id, publication_eligible, rights_hold) VALUES ('https://example.com/not-in-b2.jpg', 0, 'z', 'z', 0, 1)").run();

    const rows = (db.prepare(REPORT_SQL).all() as Record<string, unknown>[]).map(classifyRow);
    expect(rows.map((r) => r.b2_key)).toEqual(['LGFC_sha256_a.jpg', 'LGFC_sha256_b.jpg', 'LGFC_sha256_c.jpg']);
    const by = Object.fromEntries(rows.map((r) => [r.b2_key as string, r]));
    expect(by['LGFC_sha256_a.jpg']).toMatchObject({ rights_state: 'released', skip_reason: 'no_content_record', permitted_for_website_today: 'yes', photo_publication_eligible: 1 });
    expect(by['LGFC_sha256_b.jpg']).toMatchObject({ rights_state: 'for_admin_review', subject_state: 'no_verdict', skip_reason: 'no_subject_verdict_recorded', permitted_for_website_today: 'no' });
    expect(by['LGFC_sha256_c.jpg']).toMatchObject({ rights_state: 'not_permitted', subject_state: 'not_good', skip_reason: '', permitted_for_social_today: 'no' });

    expect(db.prepare(PHOTOS_WITHOUT_MEDIA_SQL).all()).toEqual([expect.objectContaining({ url: 'https://example.com/not-in-b2.jpg' })]);
    expect(db.prepare(CONTENT_WITHOUT_MEDIA_SQL).all()).toEqual([expect.objectContaining({ candidate_id: 'cand-orphan' })]);

    const summary = summarize(rows);
    expect(summary).toMatchObject({ pictures: 3, permittedToday: 1, skip: { no_content_record: 1, no_subject_verdict_recorded: 1 } });
    expect((summary.crossTab as Record<string, number>)['released | no_verdict']).toBe(1);
    const markdown = renderMarkdown(summary, { photosWithoutMedia: [1], contentWithoutMedia: [1] }, '2026-11-05T00:00:00Z');
    expect(markdown).toContain('B2 pictures (media rows): **3**');
    expect(markdown).toContain('Read-only');
  });

  it('writes only SELECT statements and refuses anything else', () => {
    for (const sql of [REPORT_SQL, PHOTOS_WITHOUT_MEDIA_SQL, CONTENT_WITHOUT_MEDIA_SQL]) expect(() => assertSelectOnly(sql)).not.toThrow();
    expect(() => assertSelectOnly('DELETE FROM media_assets')).toThrow(/single SELECT/);
    expect(() => assertSelectOnly('SELECT 1; DROP TABLE photos')).toThrow(/single SELECT/);
    expect(() => assertSelectOnly("SELECT 1 FROM x WHERE a = 'b' UPDATE y")).toThrow(/single SELECT/);
  });

  it('escapes commas, quotes and line breaks in the CSV and parses arguments', () => {
    expect(toCsv([{ a: 'x,y', b: 'say "hi"', c: null, d: 'l1\nl2' }])).toBe('a,b,c,d\n"x,y","say ""hi""",,"l1\nl2"\n');
    expect(parseArgs([])).toEqual({ database: 'lgfc_lite', target: 'remote', outDir: 'archive-report' });
    expect(parseArgs(['--local', '--out-dir', 'x']).target).toBe('local');
    expect(() => parseArgs(['--write'])).toThrow(/Unknown argument/);
  });
});
