// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  computeFinalStatus,
  DEFAULT_PERMISSION_LAYERS,
  isUsableOnWebsite,
  usageDecisionForBasis,
  type PermissionLayers,
} from '../functions/_lib/content-permission-status';

// #4523: permission layers, outcome basis, fee flag and supersession (migration 0084).

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const TARGET = '0084_content_permission_layers_4523.sql';

function migrations(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

/** Applies every migration before 0084, so rows can exist before the new columns do. */
function dbBefore0084(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const file of migrations()) {
    if (file === TARGET) break;
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

function apply0084(db: DatabaseSync): void {
  db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, TARGET), 'utf8'));
}

let counter = 0;
function insertItem(db: DatabaseSync, extra: Record<string, string | number> = {}): number {
  counter += 1;
  const cols: Record<string, string | number> = {
    candidate_id: `cand-${counter}`,
    input_stream: 'public_research',
    title: `Item ${counter}`,
    source_url: `https://example.org/item-${counter}`,
    source_name: 'Example',
    source_domain: 'example.org',
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
    ...extra,
  };
  const names = Object.keys(cols);
  const info = db
    .prepare(`INSERT INTO content_items (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
    .run(...Object.values(cols));
  return Number(info.lastInsertRowid);
}

function insertEvidence(db: DatabaseSync, contentItemId: number, extra: Record<string, string | number> = {}): number {
  const cols: Record<string, string | number> = {
    content_item_id: contentItemId,
    evidence_type: 'other',
    usage_decision: 'hold',
    ...extra,
  };
  const names = Object.keys(cols);
  const info = db
    .prepare(`INSERT INTO rights_evidence (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
    .run(...Object.values(cols));
  return Number(info.lastInsertRowid);
}

const ALL_CLEAR: PermissionLayers = { origin: 'permitted', cmg: 'permitted', mlb: 'not_applicable', yankees: 'permitted', privacy: 'not_applicable' };

describe('computeFinalStatus', () => {
  it('starts not usable: defaults are never permitted', () => {
    expect(computeFinalStatus(DEFAULT_PERMISSION_LAYERS)).toBe('not_permitted');
  });

  it('is permitted only when origin is permitted and every other layer is permitted or not_applicable', () => {
    expect(computeFinalStatus(ALL_CLEAR)).toBe('permitted');
  });

  it('keeps a record out while any other party still needs review', () => {
    expect(computeFinalStatus({ ...ALL_CLEAR, cmg: 'for_admin_review' })).toBe('for_admin_review');
    expect(computeFinalStatus({ ...ALL_CLEAR, privacy: 'for_admin_review' })).toBe('for_admin_review');
  });

  it('is not permitted when any layer says no', () => {
    expect(computeFinalStatus({ ...ALL_CLEAR, yankees: 'not_permitted' })).toBe('not_permitted');
    expect(computeFinalStatus({ ...ALL_CLEAR, origin: 'not_permitted' })).toBe('not_permitted');
  });

  it('needs the origin layer itself to be permitted, not merely not_applicable', () => {
    expect(computeFinalStatus({ ...ALL_CLEAR, origin: 'not_applicable' })).toBe('for_admin_review');
  });

  it('a fee-required outcome is never permitted', () => {
    expect(computeFinalStatus(ALL_CLEAR, 'fee_required')).toBe('not_permitted');
  });

  it('only a permitted status is usable on the website', () => {
    expect(isUsableOnWebsite('permitted')).toBe(true);
    for (const status of ['not_permitted', 'for_admin_review', '', null, undefined, 'PERMITTED']) {
      expect(isUsableOnWebsite(status as string | null | undefined)).toBe(false);
    }
  });

  it('maps usage basis to an evidence decision, fee to deny', () => {
    expect(usageDecisionForBasis('fee_required')).toBe('deny');
    expect(usageDecisionForBasis('free_use_credit')).toBe('permit');
    expect(usageDecisionForBasis('unknown')).toBe('hold');
  });
});

describe('migration 0084 (scratch database)', () => {
  it('applies cleanly on top of the earlier migrations and passes the integrity check', () => {
    const db = dbBefore0084();
    expect(() => apply0084(db)).not.toThrow();
    expect(db.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('gives new and existing records safe defaults: not permitted, other parties awaiting review', () => {
    const db = dbBefore0084();
    const existing = insertItem(db);
    apply0084(db);
    const later = insertItem(db);
    for (const id of [existing, later]) {
      expect(db.prepare('SELECT * FROM content_items WHERE id = ?').get(id)).toMatchObject({
        origin_permission: 'not_permitted',
        cmg_permission: 'for_admin_review',
        mlb_permission: 'for_admin_review',
        yankees_permission: 'for_admin_review',
        privacy_status: 'for_admin_review',
        final_status: 'not_permitted',
        outcome_basis: 'pending',
        superseded_at: null,
      });
    }
  });

  it('backfills origin permission from existing permit evidence without making anything permitted overall', () => {
    const db = dbBefore0084();
    const publicDomain = insertItem(db);
    insertEvidence(db, publicDomain, { usage_decision: 'permit', conclusion: 'public_domain_confirmed', evidence_type: 'loc_statement' });
    const openLicense = insertItem(db);
    insertEvidence(db, openLicense, { usage_decision: 'permit', conclusion: 'permission_granted', evidence_type: 'commons_license' });
    const manual = insertItem(db);
    insertEvidence(db, manual, { usage_decision: 'permit', conclusion: 'permission_granted', evidence_type: 'cmg_grant' });
    const held = insertItem(db);
    insertEvidence(db, held, { usage_decision: 'hold' });
    const denied = insertItem(db);
    insertEvidence(db, denied, { usage_decision: 'deny', conclusion: 'permission_granted' });
    apply0084(db);

    const row = (id: number) => db.prepare('SELECT origin_permission, outcome_basis, final_status FROM content_items WHERE id = ?').get(id);
    expect(row(publicDomain)).toEqual({ origin_permission: 'permitted', outcome_basis: 'public_domain', final_status: 'not_permitted' });
    expect(row(openLicense)).toEqual({ origin_permission: 'permitted', outcome_basis: 'origin_statement', final_status: 'not_permitted' });
    expect(row(manual)).toEqual({ origin_permission: 'permitted', outcome_basis: 'manual_lgfc_decision', final_status: 'not_permitted' });
    expect(row(held)).toEqual({ origin_permission: 'not_permitted', outcome_basis: 'pending', final_status: 'not_permitted' });
    expect(row(denied)).toEqual({ origin_permission: 'not_permitted', outcome_basis: 'pending', final_status: 'not_permitted' });
  });

  it('rejects final_status permitted unless the layers allow it (insert and update)', () => {
    const db = dbBefore0084();
    apply0084(db);
    expect(() => insertItem(db, { final_status: 'permitted' })).toThrow(/final_status permitted requires/);

    const id = insertItem(db);
    expect(() => db.prepare("UPDATE content_items SET final_status = 'permitted' WHERE id = ?").run(id)).toThrow(/final_status permitted requires/);

    db.prepare(
      "UPDATE content_items SET origin_permission = 'permitted', cmg_permission = 'permitted', mlb_permission = 'not_applicable', yankees_permission = 'permitted', privacy_status = 'not_applicable' WHERE id = ?",
    ).run(id);
    expect(() => db.prepare("UPDATE content_items SET final_status = 'permitted' WHERE id = ?").run(id)).not.toThrow();

    // A layer cannot be pulled back while the record still says permitted: the status must change with it.
    expect(() => db.prepare("UPDATE content_items SET yankees_permission = 'for_admin_review' WHERE id = ?").run(id)).toThrow(
      /final_status permitted requires/,
    );
    expect(() =>
      db.prepare("UPDATE content_items SET yankees_permission = 'for_admin_review', final_status = 'for_admin_review' WHERE id = ?").run(id),
    ).not.toThrow();
  });

  it('never allows a fee-required outcome to be permitted', () => {
    const db = dbBefore0084();
    apply0084(db);
    const id = insertItem(db);
    db.prepare(
      "UPDATE content_items SET origin_permission = 'permitted', cmg_permission = 'permitted', mlb_permission = 'permitted', yankees_permission = 'permitted', privacy_status = 'permitted', outcome_basis = 'fee_required' WHERE id = ?",
    ).run(id);
    expect(() => db.prepare("UPDATE content_items SET final_status = 'permitted' WHERE id = ?").run(id)).toThrow(/final_status permitted requires/);
  });

  it('forces fee-required evidence to be recorded as a denial', () => {
    const db = dbBefore0084();
    apply0084(db);
    const id = insertItem(db);
    expect(() => insertEvidence(db, id, { usage_basis: 'fee_required', usage_decision: 'permit' })).toThrow(/fee-required evidence/);
    expect(() => insertEvidence(db, id, { fee_required: 1, usage_decision: 'hold' })).toThrow(/fee-required evidence/);
    expect(() => insertEvidence(db, id, { fee_required: 1, usage_basis: 'fee_required', usage_decision: 'deny' })).not.toThrow();

    const ok = insertEvidence(db, id, { usage_basis: 'free_use_credit', usage_decision: 'permit' });
    expect(() => db.prepare('UPDATE rights_evidence SET fee_required = 1 WHERE id = ?').run(ok)).toThrow(/fee-required evidence/);
  });

  it('rejects values outside the allowed sets', () => {
    const db = dbBefore0084();
    apply0084(db);
    expect(() => insertItem(db, { cmg_permission: 'maybe' })).toThrow(/CHECK/);
    expect(() => insertItem(db, { outcome_basis: 'guess' })).toThrow(/CHECK/);
    const id = insertItem(db);
    expect(() => insertEvidence(db, id, { usage_basis: 'sort_of' })).toThrow(/CHECK/);
  });

  it('keeps superseded records out of the active view but never deletes them or their evidence', () => {
    const db = dbBefore0084();
    apply0084(db);
    const older = insertItem(db, { source_url: 'https://example.org/same' });
    insertEvidence(db, older);
    const newer = insertItem(db, { source_url: 'https://example.org/same' });
    db.prepare("UPDATE content_items SET superseded_at = '2026-10-12T00:00:00Z', superseded_by = 'cand-new' WHERE id = ?").run(older);

    const active = (db.prepare('SELECT id FROM active_content_items WHERE source_url = ?').all('https://example.org/same') as Array<{ id: number }>).map((r) => r.id);
    expect(active).toEqual([newer]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM content_items WHERE source_url = ?').get('https://example.org/same')).toEqual({ n: 2 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM rights_evidence WHERE content_item_id = ?').get(older)).toEqual({ n: 1 });
  });

  it('keeps the 0084 columns, view and triggers when the 0065 emergency rollback rebuilds the tables', () => {
    const db = new DatabaseSync(':memory:');
    for (const file of migrations()) db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    const id = insertItem(db);
    insertEvidence(db, id, { usage_basis: 'free_use_credit', usage_decision: 'permit' });
    db.exec(fs.readFileSync(path.join(process.cwd(), 'scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql'), 'utf8'));

    expect(db.prepare('SELECT final_status, cmg_permission FROM content_items WHERE id = ?').get(id)).toEqual({
      final_status: 'not_permitted',
      cmg_permission: 'for_admin_review',
    });
    expect(db.prepare('SELECT usage_basis FROM rights_evidence WHERE content_item_id = ?').get(id)).toEqual({ usage_basis: 'free_use_credit' });
    expect((db.prepare('SELECT COUNT(*) AS n FROM active_content_items').get() as { n: number }).n).toBe(1);
    expect(() => db.prepare("UPDATE content_items SET final_status = 'permitted' WHERE id = ?").run(id)).toThrow(/final_status permitted requires/);
    expect(() => insertEvidence(db, id, { fee_required: 1, usage_decision: 'permit' })).toThrow(/fee-required evidence/);
  });

  it('adds the source cost and standing columns with safe defaults', () => {
    const db = dbBefore0084();
    apply0084(db);
    db.exec("INSERT INTO sources (source_domain, source_name, source_type) VALUES ('example.org', 'Example', 'archive')");
    expect(db.prepare('SELECT cost_model, search_enabled, standing FROM sources').get()).toEqual({
      cost_model: 'unknown',
      search_enabled: 1,
      standing: 'unknown',
    });
    expect(() => db.exec("UPDATE sources SET cost_model = 'fee', search_enabled = 0, cost_flagged_at = '2026-10-12T00:00:00Z'")).not.toThrow();
    expect(() => db.exec("UPDATE sources SET cost_model = 'barter'")).toThrow(/CHECK/);
  });
});
