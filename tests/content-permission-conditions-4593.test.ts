// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  CONDITIONAL_EVIDENCE_DENIAL_MESSAGE,
  computeFinalStatus,
  type PermissionLayers,
} from '../functions/_lib/content-permission-status';
import { parseRecordRightsEvidenceRequest } from '../functions/_lib/rights-evidence-admin';
import {
  ConditionalEvidenceMustDenyError,
  recordRightsEvidence,
} from '../functions/_lib/rights-evidence-repository';

// #4593: conditions are a denial. Credit wording is not a condition.

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const TARGET = '0087_rights_evidence_conditions_4593.sql';
const ALL_CLEAR: PermissionLayers = {
  origin: 'permitted',
  cmg: 'permitted',
  mlb: 'not_applicable',
  yankees: 'permitted',
  privacy: 'not_applicable',
};

function migrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();
}

function applyMigrations(db: DatabaseSync, files: string[]): void {
  for (const file of files) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

function dbWithAllMigrations(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db, migrationFiles());
  return db;
}

function dbBefore0086(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  applyMigrations(db, migrationFiles().filter((file) => file !== TARGET));
  return db;
}

let counter = 0;
function insertItem(db: DatabaseSync): number {
  counter += 1;
  const info = db
    .prepare(
      `INSERT INTO content_items (
        candidate_id, input_stream, title, source_url, source_name, source_domain, source_type,
        content_type, summary, rights_status, source_trust_status, relevance_status, review_status,
        publication_status, privacy_flag, privacy_review_status, review_priority
      ) VALUES (?, 'public_research', ?, ?, 'Example', 'example.org', 'archive', 'photo', 'summary',
        'unknown', 'pending', 'pending', 'pending_review', 'not_ready', 'none', 'not_applicable', 'normal')`,
    )
    .run(`cand-4593-${counter}`, `Item ${counter}`, `https://example.org/item-${counter}`);
  return Number(info.lastInsertRowid);
}

function clearLayers(db: DatabaseSync, id: number): void {
  db.prepare(
    `UPDATE content_items
     SET origin_permission = 'permitted', cmg_permission = 'permitted', mlb_permission = 'not_applicable',
         yankees_permission = 'permitted', privacy_status = 'not_applicable', outcome_basis = 'origin_statement'
     WHERE id = ?`,
  ).run(id);
}

function d1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind: (...args: SQLInputValue[]) => ({
          async first() {
            return stmt.get(...args) ?? null;
          },
          async run() {
            const info = stmt.run(...args);
            return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
          },
        }),
      };
    },
  };
}

describe('permission conditions (#4593)', () => {
  it('rejects conditional evidence from a permitted final status', () => {
    expect(computeFinalStatus(ALL_CLEAR, 'pending', { hasConditions: true })).toBe('not_permitted');
    expect(computeFinalStatus(ALL_CLEAR)).toBe('permitted');
    expect(computeFinalStatus(ALL_CLEAR, 'origin_statement', { hasConditions: false })).toBe('permitted');
  });

  it('rejects a conditional permit, accepts a conditional denial, and accepts credit-only', async () => {
    const db = dbWithAllMigrations();
    const id = insertItem(db);

    await expect(
      recordRightsEvidence(d1(db), {
        content_item_id: id,
        evidence_type: 'other',
        has_conditions: true,
        conditions_text: 'United States only, for one year',
        usage_decision: 'permit',
      }),
    ).rejects.toBeInstanceOf(ConditionalEvidenceMustDenyError);

    expect(() =>
      db.prepare(
        `INSERT INTO rights_evidence (content_item_id, evidence_type, has_conditions, usage_decision)
         VALUES (?, 'other', 1, 'permit')`,
      ).run(id),
    ).toThrow(/conditional evidence must have usage_decision deny/);

    const denied = await recordRightsEvidence(d1(db), {
      content_item_id: id,
      evidence_type: 'other',
      has_conditions: 1,
      conditions_text: 'United States only, for one year',
      usage_decision: 'deny',
    });
    expect(denied).toMatchObject({
      has_conditions: 1,
      conditions_text: 'United States only, for one year',
      usage_decision: 'deny',
    });

    const credit = await recordRightsEvidence(d1(db), {
      content_item_id: id,
      evidence_type: 'commons_license',
      usage_basis: 'free_use_credit',
      usage_decision: 'permit',
      evidence_text: 'Please credit the photographer.',
    });
    expect(credit).toMatchObject({
      usage_basis: 'free_use_credit',
      has_conditions: 0,
      conditions_text: null,
      usage_decision: 'permit',
    });

    clearLayers(db, id);
    expect(() => db.prepare(`UPDATE content_items SET final_status = 'permitted' WHERE id = ?`).run(id)).toThrow(
      /conditional evidence cannot support final_status permitted/,
    );
  });

  it('does not treat credit wording as a condition, and blocks a permitted item from gaining one', async () => {
    const db = dbWithAllMigrations();
    const id = insertItem(db);
    await recordRightsEvidence(d1(db), {
      content_item_id: id,
      evidence_type: 'commons_license',
      usage_basis: 'free_use_credit',
      usage_decision: 'permit',
    });
    clearLayers(db, id);
    expect(() => db.prepare(`UPDATE content_items SET final_status = 'permitted' WHERE id = ?`).run(id)).not.toThrow();

    expect(() =>
      db.prepare(
        `INSERT INTO rights_evidence (content_item_id, evidence_type, has_conditions, conditions_text, usage_decision)
         VALUES (?, 'other', 1, 'Web only', 'deny')`,
      ).run(id),
    ).toThrow(/conditional evidence cannot support final_status permitted/);
  });

  it('leaves existing rows unchanged when 0087 is applied', () => {
    const db = dbBefore0086();
    const id = insertItem(db);
    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text, usage_basis, usage_decision)
       VALUES (?, 'other', 'Please credit the source.', 'free_use_credit', 'permit')`,
    ).run(id);
    const before = db.prepare('SELECT * FROM rights_evidence WHERE content_item_id = ?').get(id) as Record<string, unknown>;

    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, TARGET), 'utf8'));

    const after = db.prepare('SELECT * FROM rights_evidence WHERE content_item_id = ?').get(id) as Record<string, unknown>;
    expect(after.has_conditions).toBe(0);
    expect(after.conditions_text).toBeNull();
    const { has_conditions: _has, conditions_text: _text, ...unchanged } = after;
    expect(unchanged).toEqual(before);
  });

  it('keeps the condition columns and triggers through the 0065 rollback rebuild', () => {
    const db = dbWithAllMigrations();
    const id = insertItem(db);
    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, usage_basis, usage_decision)
       VALUES (?, 'commons_license', 'free_use_credit', 'permit')`,
    ).run(id);
    db.exec(fs.readFileSync(path.join(process.cwd(), 'scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql'), 'utf8'));

    expect(db.prepare('SELECT has_conditions, conditions_text FROM rights_evidence WHERE content_item_id = ?').get(id)).toEqual({
      has_conditions: 0,
      conditions_text: null,
    });
    expect(() =>
      db.prepare(
        `INSERT INTO rights_evidence (content_item_id, evidence_type, has_conditions, usage_decision)
         VALUES (?, 'other', 1, 'permit')`,
      ).run(id),
    ).toThrow(/conditional evidence must have usage_decision deny/);
  });

  it('tells the admin API to record a denial, and leaves credit-only permits alone', () => {
    const conditionalPermit = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-4593',
      evidence_type: 'other',
      has_conditions: 1,
      conditions_text: 'North America only',
      usage_decision: 'permit',
    });
    expect(conditionalPermit).toEqual({ ok: false, error: CONDITIONAL_EVIDENCE_DENIAL_MESSAGE });

    const textWithoutFlag = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-4593',
      evidence_type: 'other',
      conditions_text: 'For one year',
      usage_decision: 'hold',
    });
    expect(textWithoutFlag).toEqual({ ok: false, error: CONDITIONAL_EVIDENCE_DENIAL_MESSAGE });

    const denial = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-4593',
      evidence_type: 'other',
      conditions_text: 'For one year',
      usage_decision: 'deny',
    });
    expect(denial.ok).toBe(true);
    if (denial.ok) {
      expect(denial.request.has_conditions).toBe(1);
      expect(denial.request.conditions_text).toBe('For one year');
    }

    const credit = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-4593',
      evidence_type: 'commons_license',
      evidence_text: 'Credit the photographer.',
      usage_decision: 'permit',
    });
    expect(credit.ok).toBe(true);
    if (credit.ok) {
      expect(credit.request.has_conditions).toBeUndefined();
      expect(credit.request.conditions_text).toBeUndefined();
    }
  });
});
