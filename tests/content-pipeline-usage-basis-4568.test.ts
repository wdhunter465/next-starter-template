// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  buildCandidateImportPlan,
  validateCandidateRegistry,
  type CandidateRecord,
  type CandidateRegistry,
  type DiscoveryRightsEvidence,
} from '../functions/_lib/content-pipeline-candidate-import';
import {
  FEE_TERMS_PATTERN,
  permissionFieldsForDiscovery,
  usageBasisForDiscovery,
} from '../functions/_lib/content-pipeline-usage-basis';
import { FeeRequiredEvidenceMustDenyError, recordRightsEvidence } from '../functions/_lib/rights-evidence-repository';
import { withOriginTerms } from '../scripts/content-pipeline/discovery-evidence-terms.mjs';

// #4568: collectors and the import path write usage_basis, the permission layers, the fee flag
// and supersession (columns added by migration 0084, #4523).

const PD: DiscoveryRightsEvidence = {
  evidence_type: 'openverse_license',
  evidence_text: 'License: cc0.',
  conclusion: 'public_domain_confirmed',
};
const CC_BY: DiscoveryRightsEvidence = {
  evidence_type: 'commons_license',
  evidence_text: 'License template: CC BY-SA 4.0. Uploader assertion.',
  conclusion: 'permission_granted',
};
const FEE: DiscoveryRightsEvidence = {
  evidence_type: 'other',
  evidence_text: 'Rights-managed image. A licensing fee is required for any reproduction.',
};
const UNKNOWN: DiscoveryRightsEvidence = {
  evidence_type: 'loc_statement',
  evidence_text: 'Rights advisory: No known restrictions on publication.',
};

describe('usage basis mapping (#4568)', () => {
  it('maps a public-domain conclusion to free_use with the origin layer permitted', () => {
    const fields = permissionFieldsForDiscovery(PD);
    expect(fields).toMatchObject({
      usage_basis: 'free_use',
      fee_required: 0,
      usage_decision: 'permit',
      conclusion: 'public_domain_confirmed',
      outcome_basis: 'public_domain',
      final_status: 'for_admin_review',
    });
    expect(fields.layers).toEqual({
      origin: 'permitted',
      cmg: 'for_admin_review',
      mlb: 'for_admin_review',
      yankees: 'for_admin_review',
      privacy: 'for_admin_review',
    });
  });

  it('maps an attribution-only license to free_use_credit from the origin statement', () => {
    expect(permissionFieldsForDiscovery(CC_BY)).toMatchObject({
      usage_basis: 'free_use_credit',
      usage_decision: 'permit',
      outcome_basis: 'origin_statement',
      final_status: 'for_admin_review',
    });
  });

  it('records fee wording as fee_required and deny, and drops any auto-conclusion', () => {
    const fields = permissionFieldsForDiscovery({ ...FEE, conclusion: 'permission_granted' });
    expect(fields).toMatchObject({
      usage_basis: 'fee_required',
      fee_required: 1,
      usage_decision: 'deny',
      conclusion: null,
      outcome_basis: 'fee_required',
      final_status: 'not_permitted',
    });
    expect(fields.layers.origin).toBe('not_permitted');
  });

  it("honors a collector's explicit fee flag", () => {
    expect(usageBasisForDiscovery({ evidence_text: 'See terms.', usage_basis: 'fee_required' })).toBe('fee_required');
    expect(usageBasisForDiscovery({ evidence_text: 'See terms.', fee_required: true })).toBe('fee_required');
  });

  it('defaults unknown terms to unknown, hold and not permitted', () => {
    for (const evidence of [UNKNOWN, undefined, null]) {
      expect(permissionFieldsForDiscovery(evidence)).toMatchObject({
        usage_basis: 'unknown',
        fee_required: 0,
        usage_decision: 'hold',
        conclusion: null,
        outcome_basis: 'pending',
        final_status: 'not_permitted',
      });
    }
  });

  it('never lets a claimed usage_basis grant more than the conclusion does', () => {
    expect(usageBasisForDiscovery({ evidence_text: 'Free to use.', usage_basis: 'free_use' })).toBe('unknown');
    expect(usageBasisForDiscovery({ evidence_text: 'x', usage_basis: 'free_use_permission' })).toBe('unknown');
  });

  it('never makes a collected item permitted on its own', () => {
    for (const evidence of [PD, CC_BY, FEE, UNKNOWN, undefined]) {
      expect(permissionFieldsForDiscovery(evidence).final_status).not.toBe('permitted');
    }
  });

  it('keeps the fee pattern narrow', () => {
    for (const text of [
      'Free to use with credit.',
      'Creative Commons Attribution-ShareAlike license.',
      'No known restrictions on publication.',
      'License: cc-by 4.0.',
      'Public domain in the United States.',
    ]) {
      expect(FEE_TERMS_PATTERN.test(text), text).toBe(false);
    }
    for (const text of ['Licensing fees apply.', 'Available for a fee.', 'Purchase a license to use.', 'Rights managed']) {
      expect(FEE_TERMS_PATTERN.test(text), text).toBe(true);
    }
  });
});

describe('collector origin terms (#4568)', () => {
  it('adds usage_basis and a SHA-256 of the captured statement', () => {
    const result = withOriginTerms(PD);
    expect(result.usage_basis).toBe('free_use');
    expect(result.evidence_text_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.conclusion).toBe('public_domain_confirmed');
  });

  it('flags fee terms and removes the conclusion', () => {
    const result = withOriginTerms({ ...FEE, conclusion: 'permission_granted' });
    expect(result).toMatchObject({ usage_basis: 'fee_required', fee_required: true });
    expect(result.conclusion).toBeUndefined();
  });

  it('passes through a missing evidence object', () => {
    expect(withOriginTerms(undefined)).toBeUndefined();
  });
});

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  applyRepoMigrations(db);
  return db;
}

function discovered(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-4568',
    input_stream: 'scheduled_discovery',
    title: 'Discovered item',
    source_url: 'https://commons.wikimedia.org/wiki/File:Gehrig4568.jpg',
    source_name: 'Wikimedia Commons',
    source_type: 'archive',
    content_type: 'photo',
    summary: 'Discovered via search.',
    rights_status: 'unknown',
    source_trust_status: 'trusted',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    created_at: '2026-10-01T12:00:00.000Z',
    updated_at: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

function importCandidates(db: DatabaseSync, candidates: CandidateRecord[]) {
  const registry: CandidateRegistry = { schema_version: '1', registry_class: 'fixture', candidates };
  for (const statement of buildCandidateImportPlan(registry).statements) {
    db.exec(statement.sql);
  }
}

type ItemRow = Record<string, string | number | null>;

function item(db: DatabaseSync, candidateId: string): ItemRow | undefined {
  return db.prepare('SELECT * FROM content_items WHERE candidate_id = ?').get(candidateId) as ItemRow | undefined;
}

function evidence(db: DatabaseSync, candidateId: string): ItemRow[] {
  return db
    .prepare(
      `SELECT re.* FROM rights_evidence re JOIN content_items ci ON ci.id = re.content_item_id
       WHERE ci.candidate_id = ? ORDER BY re.id`,
    )
    .all(candidateId) as ItemRow[];
}

describe('import writes permission columns (#4568)', () => {
  it('writes layers, outcome, final status, usage_basis and the hash for a public-domain item', () => {
    const db = freshDb();
    importCandidates(db, [discovered({ rights_evidence: withOriginTerms(PD) })]);

    expect(item(db, 'lgfc-gehrig-2026-4568')).toMatchObject({
      origin_permission: 'permitted',
      cmg_permission: 'for_admin_review',
      mlb_permission: 'for_admin_review',
      yankees_permission: 'for_admin_review',
      privacy_status: 'for_admin_review',
      final_status: 'for_admin_review',
      outcome_basis: 'public_domain',
      outcome_set_at: '2026-10-01T12:00:00.000Z',
      outcome_set_by: 'automated:discovery-classifier',
      superseded_at: null,
    });
    const [row] = evidence(db, 'lgfc-gehrig-2026-4568');
    expect(row).toMatchObject({
      usage_basis: 'free_use',
      fee_required: 0,
      usage_decision: 'permit',
      conclusion: 'public_domain_confirmed',
    });
    expect(row.evidence_text_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('records a fee-required item as deny and never permitted', () => {
    const db = freshDb();
    importCandidates(db, [discovered({ rights_evidence: withOriginTerms(FEE) })]);

    expect(item(db, 'lgfc-gehrig-2026-4568')).toMatchObject({
      origin_permission: 'not_permitted',
      final_status: 'not_permitted',
      outcome_basis: 'fee_required',
    });
    expect(evidence(db, 'lgfc-gehrig-2026-4568')[0]).toMatchObject({
      usage_basis: 'fee_required',
      fee_required: 1,
      usage_decision: 'deny',
      conclusion: null,
      channel: 'internal_archive_only',
    });
  });

  it('records a fee even when the registry lacks the collector fields (older registry files)', () => {
    const db = freshDb();
    importCandidates(db, [discovered({ rights_evidence: FEE })]);
    expect(evidence(db, 'lgfc-gehrig-2026-4568')[0]).toMatchObject({ usage_basis: 'fee_required', usage_decision: 'deny' });
  });

  it('leaves unknown terms unknown and not permitted, with no outcome time', () => {
    const db = freshDb();
    importCandidates(db, [discovered({ rights_evidence: withOriginTerms(UNKNOWN) })]);

    expect(item(db, 'lgfc-gehrig-2026-4568')).toMatchObject({
      origin_permission: 'not_permitted',
      final_status: 'not_permitted',
      outcome_basis: 'pending',
      outcome_set_at: null,
      outcome_set_by: null,
    });
    expect(evidence(db, 'lgfc-gehrig-2026-4568')[0]).toMatchObject({ usage_basis: 'unknown', usage_decision: 'hold' });
  });

  it('records the no-evidence placeholder as unknown', () => {
    const db = freshDb();
    importCandidates(db, [discovered()]);
    expect(item(db, 'lgfc-gehrig-2026-4568')).toMatchObject({ final_status: 'not_permitted', outcome_basis: 'pending' });
    expect(evidence(db, 'lgfc-gehrig-2026-4568')[0]).toMatchObject({
      usage_basis: 'unknown',
      conclusion: 'rights_undetermined',
    });
  });

  it('does not overwrite a person’s later decision on re-import', () => {
    const db = freshDb();
    const candidate = discovered({ rights_evidence: withOriginTerms(PD) });
    importCandidates(db, [candidate]);
    db.exec(
      `UPDATE content_items SET cmg_permission = 'not_permitted', final_status = 'not_permitted',
         outcome_basis = 'manual_lgfc_decision' WHERE candidate_id = 'lgfc-gehrig-2026-4568'`,
    );

    importCandidates(db, [{ ...candidate, title: 'Renamed' }]);

    expect(item(db, 'lgfc-gehrig-2026-4568')).toMatchObject({
      title: 'Renamed',
      cmg_permission: 'not_permitted',
      final_status: 'not_permitted',
      outcome_basis: 'manual_lgfc_decision',
    });
  });

  it('leaves member submissions at the database defaults', () => {
    const db = freshDb();
    importCandidates(db, [
      discovered({
        candidate_id: 'lgfc-gehrig-2026-4569',
        input_stream: 'admin_seed',
        source_type: 'operator',
        source_url: undefined,
        rights_evidence: withOriginTerms(PD),
      }),
    ]);
    expect(item(db, 'lgfc-gehrig-2026-4569')).toMatchObject({
      origin_permission: 'not_permitted',
      final_status: 'not_permitted',
      outcome_basis: 'pending',
    });
  });

  it('rejects an invalid usage_basis in the registry', () => {
    const result = validateCandidateRegistry({
      schema_version: '1',
      registry_class: 'fixture',
      candidates: [discovered({ rights_evidence: { ...PD, usage_basis: 'cheap' } })],
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join(' ')).toMatch(/usage_basis must be one of/);
  });
});

describe('supersession (#4568)', () => {
  const URL = 'https://commons.wikimedia.org/wiki/File:Gehrig4568.jpg';
  const older = discovered({
    candidate_id: 'lgfc-gehrig-2026-4601',
    rights_evidence: withOriginTerms(CC_BY),
    created_at: '2026-10-01T12:00:00.000Z',
  });
  const changedTerms = {
    evidence_type: 'commons_license',
    evidence_text: 'License template: CC BY-NC 4.0. Uploader assertion.',
  };

  it('a newer record with changed terms supersedes the older one; both rows stay', () => {
    const db = freshDb();
    importCandidates(db, [older]);
    importCandidates(db, [
      discovered({
        candidate_id: 'lgfc-gehrig-2026-4602',
        rights_evidence: withOriginTerms(changedTerms),
        created_at: '2026-10-10T12:00:00.000Z',
      }),
    ]);

    expect(item(db, 'lgfc-gehrig-2026-4601')).toMatchObject({
      superseded_at: '2026-10-10T12:00:00.000Z',
      superseded_by: 'lgfc-gehrig-2026-4602',
      origin_permission: 'permitted',
    });
    expect(item(db, 'lgfc-gehrig-2026-4602')).toMatchObject({ superseded_at: null, origin_permission: 'not_permitted' });
    expect(evidence(db, 'lgfc-gehrig-2026-4601')).toHaveLength(1);
    const active = db.prepare('SELECT candidate_id FROM active_content_items WHERE source_url = ?').all(URL);
    expect(active).toEqual([{ candidate_id: 'lgfc-gehrig-2026-4602' }]);
  });

  it('skips a rediscovery with unchanged terms (no new record)', () => {
    const db = freshDb();
    importCandidates(db, [older]);
    importCandidates(db, [
      discovered({ candidate_id: 'lgfc-gehrig-2026-4603', rights_evidence: withOriginTerms(CC_BY), created_at: '2026-10-10T12:00:00.000Z' }),
    ]);

    expect(item(db, 'lgfc-gehrig-2026-4603')).toBeUndefined();
    expect(item(db, 'lgfc-gehrig-2026-4601')).toMatchObject({ superseded_at: null });
  });

  it('an older capture never supersedes a newer record', () => {
    const db = freshDb();
    importCandidates(db, [{ ...older, candidate_id: 'lgfc-gehrig-2026-4604', created_at: '2026-10-10T12:00:00.000Z' }]);
    importCandidates(db, [
      discovered({ candidate_id: 'lgfc-gehrig-2026-4605', rights_evidence: withOriginTerms(changedTerms), created_at: '2026-10-01T12:00:00.000Z' }),
    ]);

    expect(item(db, 'lgfc-gehrig-2026-4605')).toBeUndefined();
    expect(item(db, 'lgfc-gehrig-2026-4604')).toMatchObject({ superseded_at: null });
  });

  it('does not compare against human-recorded evidence', () => {
    const db = freshDb();
    importCandidates(db, [older]);
    const id = item(db, 'lgfc-gehrig-2026-4601')!.id;
    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text, reviewer, usage_decision)
       VALUES (?, 'commons_license', 'CC BY-SA 4.0', 'admin:bill', 'permit')`,
    ).run(id as SQLInputValue);

    importCandidates(db, [
      discovered({ candidate_id: 'lgfc-gehrig-2026-4606', rights_evidence: withOriginTerms(CC_BY), created_at: '2026-10-10T12:00:00.000Z' }),
    ]);

    expect(item(db, 'lgfc-gehrig-2026-4606')).toBeUndefined();
    expect(item(db, 'lgfc-gehrig-2026-4601')).toMatchObject({ superseded_at: null });
  });

  it('re-importing either record changes nothing and deletes nothing', () => {
    const db = freshDb();
    const newer = discovered({
      candidate_id: 'lgfc-gehrig-2026-4602',
      rights_evidence: withOriginTerms(changedTerms),
      created_at: '2026-10-10T12:00:00.000Z',
    });
    importCandidates(db, [older]);
    importCandidates(db, [newer]);
    importCandidates(db, [older, newer]);

    const rows = db.prepare('SELECT candidate_id, superseded_by FROM content_items ORDER BY candidate_id').all();
    expect(rows).toEqual([
      { candidate_id: 'lgfc-gehrig-2026-4601', superseded_by: 'lgfc-gehrig-2026-4602' },
      { candidate_id: 'lgfc-gehrig-2026-4602', superseded_by: null },
    ]);
  });
});

describe('rights evidence repository (#4568)', () => {
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

  it('stores usage_basis and the fee flag', async () => {
    const sqlite = freshDb();
    importCandidates(sqlite, [discovered()]);
    const id = Number(item(sqlite, 'lgfc-gehrig-2026-4568')!.id);

    const stored = await recordRightsEvidence(d1(sqlite), {
      content_item_id: id,
      evidence_type: 'other',
      evidence_text: 'The owner asks a reproduction fee.',
      fee_required: true,
      usage_decision: 'deny',
    });
    expect(stored).toMatchObject({ usage_basis: 'fee_required', fee_required: 1, usage_decision: 'deny' });

    const credit = await recordRightsEvidence(d1(sqlite), {
      content_item_id: id,
      evidence_type: 'commons_license',
      usage_basis: 'free_use_credit',
      usage_decision: 'permit',
    });
    expect(credit).toMatchObject({ usage_basis: 'free_use_credit', fee_required: 0 });
  });

  it('refuses a fee-required row that is not a denial', async () => {
    const sqlite = freshDb();
    importCandidates(sqlite, [discovered()]);
    const id = Number(item(sqlite, 'lgfc-gehrig-2026-4568')!.id);

    await expect(
      recordRightsEvidence(d1(sqlite), { content_item_id: id, evidence_type: 'other', fee_required: true }),
    ).rejects.toBeInstanceOf(FeeRequiredEvidenceMustDenyError);
  });
});
