import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { evaluateQuality } from '../functions/_lib/content-quality-gate';
import {
  buildGateUpdate,
  buildUncheckedInCountSql,
  buildUnevaluatedArchivedSql,
  EDITION_RELEASE_PAUSED,
  gateInputForRow,
  gateRecord,
  MANUAL_KEEP_CANDIDATE_IDS,
  RELEASE_BASIS,
  stripDiscoveryBoilerplate,
  summarizeVerdicts,
} from '../scripts/content-pipeline/archive-gate-lib.mjs';
import { ARCHIVE_NOTE_MARKER, buildArchiveCandidatesSql } from '../scripts/content-pipeline/archive-ingest-lib.mjs';

const NOW = '2026-11-04T20:00:00.000Z';

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  return db;
}

let counter = 0;
function addItem(db: DatabaseSync, over: Record<string, unknown> = {}) {
  counter += 1;
  const row = {
    candidate_id: `cand-${counter}`,
    input_stream: 'scheduled_discovery',
    title: `Item ${counter}`,
    source_name: 'Test',
    source_type: 'archive',
    content_type: 'photo',
    summary: 'summary',
    rights_status: 'unknown',
    source_trust_status: 'pending',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    source_domain: 'commons.wikimedia.org',
    ...over,
  };
  const keys = Object.keys(row);
  const info = db
    .prepare(`INSERT INTO content_items (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
    .run(...(Object.values(row) as never[]));
  return { id: Number(info.lastInsertRowid), candidate_id: String(row.candidate_id) };
}

describe('archive gate glue (#5053)', () => {
  it('strips the collector sentence that repeats the search query', () => {
    expect(stripDiscoveryBoilerplate('Discovered via loc.gov search for "Lou Gehrig". A rights note.')).toBe('A rights note.');
    expect(stripDiscoveryBoilerplate('Discovered via Wikimedia Commons category Lou Gehrig. License template.')).toBe('License template.');
    expect(stripDiscoveryBoilerplate('Babe Ruth and Lou Gehrig, 1927')).toBe('Babe Ruth and Lou Gehrig, 1927');
    expect(stripDiscoveryBoilerplate(null)).toBe('');
  });

  it('does not let the search query make an item look like it names Gehrig', () => {
    const row = { candidate_id: 'c1', title: 'Babe Dahlgren traded to the Braves', summary: 'Discovered via loc.gov search for "Lou Gehrig".' };
    const input = gateInputForRow(row, { widthPx: 2000, heightPx: 1500, kind: 'photograph', text: [row.summary] });
    expect(JSON.stringify(input)).not.toMatch(/gehrig/i);
    expect(evaluateQuality(input)).toMatchObject({ decision: 'not_good', reasons: ['no_gehrig_reference'] });
  });

  it('carries fee flag, kind and manual keep into the gate input', () => {
    const base = { candidate_id: 'c2', title: 'Lou Gehrig' };
    expect(gateInputForRow({ ...base, fee_required: 1 }, {}).feeRequired).toBe(true);
    expect(gateInputForRow({ ...base, fee_required: 0 }, {}).feeRequired).toBe(false);
    expect(gateInputForRow(base, { kind: 'newspaper' }).kind).toBe('newspaper');
    expect(gateInputForRow({ ...base, gate_manual_keep: 1 }, {}).manualKeep).toBe(true);
    expect(gateInputForRow({ candidate_id: MANUAL_KEEP_CANDIDATE_IDS[0], title: 'Derek Jeter Hit' }, {}).manualKeep).toBe(true);
    expect(gateInputForRow(base, {}).manualKeep).toBe(false);
  });

  it('keeps the manual-keep Jeter picture, drops the disease picture, and flags the mixed case', () => {
    const jeter = gateInputForRow({ candidate_id: MANUAL_KEEP_CANDIDATE_IDS[0], title: 'File:Derek Jeter Hit -2722 edit.jpg' }, { widthPx: 1731, heightPx: 2591, kind: 'photograph', text: ['Category:Derek Jeter'] });
    expect(evaluateQuality(jeter)).toMatchObject({ decision: 'good', relevance: 'manual-keep' });
    const awareness = gateInputForRow({ candidate_id: 'c3', title: "File:JB Charleston hosts runners, raises awareness for Lou Gehrig's Disease.jpg" }, { widthPx: 3000, heightPx: 2000 });
    expect(evaluateQuality(awareness).decision).toBe('not_good');
    const mixed = gateInputForRow({ candidate_id: 'c4', title: 'Lou Gehrig leaves the Mayo Clinic, 1939' }, { widthPx: 2000, heightPx: 1500, text: ["Doctors named it Lou Gehrig's disease."] });
    expect(evaluateQuality(mixed).decision).toBe('needs_review');
  });

  it('records a good verdict but releases nothing while the release is paused (#5088)', () => {
    expect(EDITION_RELEASE_PAUSED).toBe(true);
    const verdict = evaluateQuality(gateInputForRow({ candidate_id: 'c5', title: 'Lou Gehrig at bat' }, { widthPx: 2000, heightPx: 1400 }));
    expect(gateRecord(verdict, NOW)).toEqual({
      gate_decision: 'good',
      gate_relevance: 'gehrig-primary',
      gate_reasons: 'names_gehrig',
      gate_evaluated_at: NOW,
      released_for_editions_at: null,
      release_basis: null,
    });
  });

  it('writes a release only for a good verdict and never claims a rights release', () => {
    const good = gateRecord(evaluateQuality(gateInputForRow({ candidate_id: 'c5', title: 'Lou Gehrig at bat' }, { widthPx: 2000, heightPx: 1400 })), NOW, { releasePaused: false });
    expect(good).toMatchObject({ gate_decision: 'good', released_for_editions_at: NOW, release_basis: RELEASE_BASIS });
    expect(RELEASE_BASIS).toMatch(/^Product Authority direction 2026-10-31/);
    expect(RELEASE_BASIS).toMatch(/not a person's rights release/);
    const held = gateRecord(evaluateQuality(gateInputForRow({ candidate_id: 'c6', title: 'Someone else' }, { widthPx: 2000, heightPx: 1400 })), NOW, { releasePaused: false });
    expect(held).toMatchObject({ gate_decision: 'not_good', released_for_editions_at: null, release_basis: null, gate_reasons: 'no_gehrig_reference' });
    const fee = gateRecord(evaluateQuality(gateInputForRow({ candidate_id: 'c7', title: 'Lou Gehrig', fee_required: 1 }, { widthPx: 2000, heightPx: 1400 })), NOW, { releasePaused: false });
    expect(fee).toMatchObject({ gate_decision: 'not_good', released_for_editions_at: null, gate_reasons: 'fee_required' });
  });

  it('summarizes verdict counts and the reasons items were held', () => {
    const v = (title: string, extra = {}) => evaluateQuality(gateInputForRow({ candidate_id: 'x', title, ...extra }, { widthPx: 2000, heightPx: 1400 }));
    const summary = summarizeVerdicts([v('Lou Gehrig'), v('Other person'), v('Another person'), v('Lou Gehrig', { fee_required: 1 })]);
    expect(summary.counts).toEqual({ good: 1, needs_review: 0, not_good: 3 });
    expect(summary.reasons).toEqual({ no_gehrig_reference: 2, fee_required: 1 });
  });
});

describe('migration 0091 and the SQL that uses it (#5053)', () => {
  it('adds the gate and release columns, with checks, and the documented re-hold statement works', () => {
    const db = migratedDb();
    const a = addItem(db);
    const update = buildGateUpdate(a.id, gateRecord(evaluateQuality(gateInputForRow({ candidate_id: a.candidate_id, title: 'Lou Gehrig' }, { widthPx: 2000, heightPx: 1400 })), NOW, { releasePaused: false }));
    db.prepare(update.sql).run(...(update.params as never[]));
    const stored = db.prepare('SELECT gate_decision, gate_relevance, released_for_editions_at, release_basis, gate_manual_keep FROM content_items WHERE id = ?').get(a.id) as Record<string, unknown>;
    expect(stored).toMatchObject({ gate_decision: 'good', gate_relevance: 'gehrig-primary', released_for_editions_at: NOW, gate_manual_keep: 0 });

    expect(() => db.prepare("UPDATE content_items SET gate_decision = 'maybe' WHERE id = ?").run(a.id)).toThrow();
    expect(() => db.prepare('UPDATE content_items SET gate_manual_keep = 2 WHERE id = ?').run(a.id)).toThrow();

    db.prepare("UPDATE content_items SET released_for_editions_at = NULL, release_basis = NULL WHERE release_basis LIKE 'Product Authority direction 2026-10-31%'").run();
    expect(db.prepare('SELECT released_for_editions_at FROM content_items WHERE id = ?').get(a.id)).toEqual({ released_for_editions_at: null });
  });

  it('selects unprocessed rows and re-selects a gate-held row only when Product Authority marked it a manual keep', () => {
    const db = migratedDb();
    const fresh = addItem(db, { source_domain: 'loc.gov' });
    const note = `${ARCHIVE_NOTE_MARKER} skipped, quality gate: not good (no_gehrig_reference) (2026-11-04).`;
    const held = addItem(db, { source_domain: 'loc.gov', admin_notes: note });
    const kept = addItem(db, { source_domain: 'loc.gov', admin_notes: note, gate_manual_keep: 1 });
    const keptAlreadyGood = addItem(db, { source_domain: 'loc.gov', admin_notes: note, gate_manual_keep: 1, gate_decision: 'good' });
    const ids = (db.prepare(buildArchiveCandidatesSql()).all(50) as Array<{ candidate_id: string }>).map((r) => r.candidate_id);
    expect(ids).toContain(fresh.candidate_id);
    expect(ids).toContain(kept.candidate_id);
    expect(ids).not.toContain(held.candidate_id);
    expect(ids).not.toContain(keptAlreadyGood.candidate_id);
  });

  it('flags a fee-required item for the gate, from rights evidence or the outcome', () => {
    const db = migratedDb();
    const paid = addItem(db);
    const free = addItem(db);
    db.prepare("INSERT INTO rights_evidence (content_item_id, evidence_type, usage_basis, fee_required, usage_decision) VALUES (?, 'commons_license', 'fee_required', 1, 'deny')").run(paid.id);
    const rows = db.prepare(buildArchiveCandidatesSql()).all(50) as Array<{ candidate_id: string; fee_required: number }>;
    expect(rows.find((r) => r.candidate_id === paid.candidate_id)?.fee_required).toBe(1);
    expect(rows.find((r) => r.candidate_id === free.candidate_id)?.fee_required).toBe(0);
  });

  it('lists archived pictures the gate has not seen, linked the way the ingest links them (b2:// key or media_uid:), with stored size and kind', () => {
    const db = migratedDb();
    db.prepare("INSERT INTO media_assets (media_uid, b2_key, size, width_px, height_px, quality_tier) VALUES ('sha256_aaa', 'LGFC_1_A.jpg', 10, 2000, 1400, 'photograph')").run();
    db.prepare("INSERT INTO media_assets (media_uid, b2_key, size, width_px, height_px, quality_tier) VALUES ('sha256_bbb', 'LGFC_2_B.jpg', 10, 900, 600, 'newspaper')").run();
    const viaKey = addItem(db, { media_asset_id: 'b2://LGFC_1_A.jpg' });
    const viaUid = addItem(db, { media_asset_id: 'media_uid:sha256_bbb' });
    const done = addItem(db, { media_asset_id: 'b2://LGFC_1_A.jpg', gate_decision: 'good' });
    const retired = addItem(db, { media_asset_id: 'b2://LGFC_1_A.jpg', deleted_at: NOW });
    addItem(db); // not archived
    addItem(db, { media_asset_id: 'b2://missing-from-media-assets.jpg' });
    const rows = db.prepare(buildUnevaluatedArchivedSql()).all(50) as Array<{ candidate_id: string; width_px: number; height_px: number; quality_tier: string }>;
    expect(rows.map((r) => r.candidate_id).sort()).toEqual([viaKey.candidate_id, viaUid.candidate_id].sort());
    expect(rows.find((r) => r.candidate_id === viaKey.candidate_id)).toMatchObject({ width_px: 2000, height_px: 1400, quality_tier: 'photograph' });
    expect(rows.find((r) => r.candidate_id === viaUid.candidate_id)).toMatchObject({ width_px: 900, quality_tier: 'newspaper' });
    const ids = rows.map((r) => r.candidate_id);
    expect(ids).not.toContain(done.candidate_id);
    expect(ids).not.toContain(retired.candidate_id);
  });

  it('counts what is unchecked in: imported photos with no gate verdict, split by archived or not (#5074)', () => {
    const db = migratedDb();
    db.prepare("INSERT INTO media_assets (media_uid, b2_key, size) VALUES ('sha256_ccc', 'k.jpg', 1)").run();
    addItem(db); // unchecked, not archived
    addItem(db); // unchecked, not archived
    addItem(db, { media_asset_id: 'b2://k.jpg' }); // unchecked, archived
    addItem(db, { gate_decision: 'good' }); // checked in
    addItem(db, { gate_decision: 'not_good' }); // held
    addItem(db, { deleted_at: NOW }); // retired
    expect(db.prepare(buildUncheckedInCountSql()).get()).toEqual({ unchecked_in: 3, not_yet_archived: 2, archived: 1 });
  });
});
