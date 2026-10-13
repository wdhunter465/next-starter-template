// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  BACKFILL_SQL,
  FEE_NOT_DENY_SQL,
  PROPOSAL_SQL,
  proposalTable,
} from '../scripts/content-pipeline/backfill-usage-basis-4572.mjs';

// #4572: backfill rights_evidence.usage_basis on rows written before migration 0084.

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const MIGRATION_0084 = '0084_content_permission_layers_4523.sql';
const SCRIPT = path.join(process.cwd(), 'scripts/content-pipeline/backfill-usage-basis-4572.mjs');

type Row = Record<string, unknown>;
type EvidenceSpec = Record<string, string | number>;

function migrations(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

let counter = 0;
function insertItem(db: DatabaseSync): number {
  counter += 1;
  const cols: Record<string, string> = {
    candidate_id: `cand-4572-${counter}`,
    input_stream: 'scheduled_discovery',
    title: `Item ${counter}`,
    source_url: `https://example.org/item-4572-${counter}`,
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
  };
  const names = Object.keys(cols);
  const info = db
    .prepare(`INSERT INTO content_items (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
    .run(...Object.values(cols));
  return Number(info.lastInsertRowid);
}

function insertEvidence(db: DatabaseSync, spec: EvidenceSpec) {
  const cols: EvidenceSpec = { content_item_id: insertItem(db), evidence_type: 'other', usage_decision: 'hold', ...spec };
  const names = Object.keys(cols);
  db.prepare(`INSERT INTO rights_evidence (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).run(
    ...Object.values(cols),
  );
}

const CASES: Array<{ spec: EvidenceSpec; basis: string; fee: number }> = [
  { spec: { evidence_type: 'pre_1931_publication', conclusion: 'public_domain_confirmed', usage_decision: 'permit' }, basis: 'free_use', fee: 0 },
  { spec: { evidence_type: 'commons_license', conclusion: 'permission_granted', usage_decision: 'permit' }, basis: 'free_use_credit', fee: 0 },
  { spec: { evidence_type: 'loc_statement', conclusion: 'permission_granted', usage_decision: 'permit' }, basis: 'free_use_credit', fee: 0 },
  { spec: { evidence_type: 'cmg_grant', conclusion: 'permission_granted', usage_decision: 'permit' }, basis: 'free_use_permission', fee: 0 },
  { spec: { evidence_type: 'donor_agreement', conclusion: 'permission_granted', usage_decision: 'permit' }, basis: 'free_use_permission', fee: 0 },
  { spec: { evidence_type: 'other', evidence_text: 'A licensing fee is required for reproduction.', usage_decision: 'deny' }, basis: 'fee_required', fee: 1 },
  { spec: { evidence_type: 'member_ownership', conclusion: 'lgfc_member_owned_item_photo', usage_decision: 'permit' }, basis: 'unknown', fee: 0 },
  { spec: { evidence_type: 'usco_search', conclusion: 'permission_granted', usage_decision: 'permit' }, basis: 'unknown', fee: 0 },
  { spec: { evidence_type: 'openverse_license', conclusion: 'public_domain_confirmed', usage_decision: 'hold' }, basis: 'unknown', fee: 0 },
  { spec: { evidence_type: 'other', evidence_text: 'Free to use. License: CC BY 4.0.', usage_decision: 'deny' }, basis: 'unknown', fee: 0 },
  { spec: { evidence_type: 'loc_statement', evidence_text: 'No known restrictions on publication.', usage_decision: 'hold' }, basis: 'unknown', fee: 0 },
];

/** Rows written before 0084, then 0084 and every later migration applied, as on Production. */
function dbWithLegacyRows(specs: EvidenceSpec[]): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const files = migrations();
  const split = files.indexOf(MIGRATION_0084);
  for (const file of files.slice(0, split)) db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  for (const spec of specs) insertEvidence(db, spec);
  for (const file of files.slice(split)) db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  return db;
}

const all = (db: DatabaseSync, table: string) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[];
const without = (row: Row, keys: string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));

describe('usage_basis backfill (#4572)', () => {
  it('proposes a value and a reason for every row', () => {
    const db = dbWithLegacyRows(CASES.map((c) => c.spec));
    const proposal = db.prepare(PROPOSAL_SQL).all() as Row[];

    expect(proposal).toHaveLength(CASES.length);
    expect(proposal.map((r) => [r.proposed_usage_basis, r.proposed_fee_required])).toEqual(
      CASES.map((c) => [c.basis, c.fee]),
    );
    for (const row of proposal) {
      expect(row.current_usage_basis).toBe('unknown');
      expect(String(row.reason).length).toBeGreaterThan(0);
      expect(row.stop_fee_not_deny).toBe(0);
    }
    expect(proposalTable(proposal).split('\n')).toHaveLength(CASES.length + 2);
  });

  it('changes only usage_basis and fee_required, to the proposed values', () => {
    const db = dbWithLegacyRows(CASES.map((c) => c.spec));
    const evidenceBefore = all(db, 'rights_evidence');
    const itemsBefore = all(db, 'content_items');
    const proposal = db.prepare(PROPOSAL_SQL).all() as Row[];

    db.exec(BACKFILL_SQL);

    const evidenceAfter = all(db, 'rights_evidence');
    expect(evidenceAfter.map((r) => without(r, ['usage_basis', 'fee_required']))).toEqual(
      evidenceBefore.map((r) => without(r, ['usage_basis', 'fee_required'])),
    );
    expect(evidenceAfter.map((r) => [r.usage_basis, r.fee_required])).toEqual(
      proposal.map((r) => [r.proposed_usage_basis, r.proposed_fee_required]),
    );
    expect(all(db, 'content_items')).toEqual(itemsBefore);
  });

  it('is idempotent and leaves rows that already carry a basis alone', () => {
    const db = dbWithLegacyRows(CASES.map((c) => c.spec));
    db.exec(BACKFILL_SQL);
    db.exec("UPDATE rights_evidence SET usage_basis = 'free_use' WHERE evidence_type = 'usco_search'");
    const afterFirst = all(db, 'rights_evidence');

    db.exec(BACKFILL_SQL);

    expect(all(db, 'rights_evidence')).toEqual(afterFirst);
  });

  it('finds a fee row that is not deny, and the backfill writes nothing for it', () => {
    const db = dbWithLegacyRows([
      ...CASES.map((c) => c.spec),
      { evidence_type: 'other', evidence_text: 'Rights-managed. Reproduction fees apply.', usage_decision: 'hold' },
    ]);
    const before = all(db, 'rights_evidence');

    const blocked = db.prepare(FEE_NOT_DENY_SQL).all() as Row[];
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ usage_decision: 'hold' });
    expect((db.prepare(PROPOSAL_SQL).all() as Row[]).filter((r) => r.stop_fee_not_deny === 1)).toHaveLength(1);

    expect(() => db.exec(BACKFILL_SQL)).toThrow(/fee-required evidence must have usage_decision deny/);
    expect(all(db, 'rights_evidence')).toEqual(before);
  });

  it('contains no delete and never sets usage_decision or final_status', () => {
    for (const sql of [PROPOSAL_SQL, FEE_NOT_DENY_SQL, BACKFILL_SQL]) {
      expect(sql).not.toMatch(/\b(DELETE|DROP|INSERT)\b/i);
    }
    const setClause = BACKFILL_SQL.slice(BACKFILL_SQL.indexOf('SET'), BACKFILL_SQL.indexOf('WHERE re.usage_basis'));
    expect(setClause).not.toMatch(/^\s*(SET\s+)?(usage_decision|final_status)\s*=/im);
    expect(BACKFILL_SQL).not.toMatch(/final_status/);
    expect(PROPOSAL_SQL).not.toMatch(/\bUPDATE\b/i);
    expect(FEE_NOT_DENY_SQL).not.toMatch(/\bUPDATE\b/i);
  });

  it('refuses a Production apply without --confirm-production', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--apply', '--database', 'lgfc_lite'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--confirm-production/);
  });
});
