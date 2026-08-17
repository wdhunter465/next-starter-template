import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { buildCandidateImportPlan, buildImportSqlBatch, validateCandidateRegistry } from '../functions/_lib/content-pipeline-candidate-import';
import { buildBatchRightsApprovalSql } from '../functions/_lib/content-pipeline-batch-rights-approval';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

const CANDIDATES_FILE = path.join(process.cwd(), 'data/research/lou-gehrig-wikimedia-approved-batch-2026-08-17.json');
const LICENSE_NOTES_FILE = path.join(
  process.cwd(),
  'data/research/lou-gehrig-wikimedia-approved-batch-2026-08-17.license-notes.json',
);

function loadFixtureRegistry() {
  return JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
}

function loadFixtureLicenseNotes() {
  return JSON.parse(fs.readFileSync(LICENSE_NOTES_FILE, 'utf8'));
}

describe('the checked-in approved-batch fixture (#3552)', () => {
  it('validates against the candidate registry schema', () => {
    const registry = loadFixtureRegistry();
    const result = validateCandidateRegistry(registry);
    expect(result.ok).toBe(true);
  });

  it('has exactly 10 candidates, all lgfc-gehrig-2026-51x, all Wikimedia Commons', () => {
    const registry = loadFixtureRegistry();
    expect(registry.candidates).toHaveLength(10);
    for (const candidate of registry.candidates) {
      expect(candidate.candidate_id).toMatch(/^lgfc-gehrig-2026-5(1[1-9]|20)$/);
      expect(candidate.source_name).toBe('Wikimedia Commons');
      expect(candidate.source_domain).toBe('commons.wikimedia.org');
    }
  });

  it('has a matching license note for every candidate', () => {
    const registry = loadFixtureRegistry();
    const licenseNotesData = loadFixtureLicenseNotes();
    const noteIds = new Set(licenseNotesData.license_notes.map((n: { candidate_id: string }) => n.candidate_id));
    for (const candidate of registry.candidates) {
      expect(noteIds.has(candidate.candidate_id)).toBe(true);
    }
  });
});

describe('buildBatchRightsApprovalSql against a real D1 schema (#3552)', () => {
  function importCandidatesAndRunApproval(db: DatabaseSync) {
    const registry = loadFixtureRegistry();
    const licenseNotesData = loadFixtureLicenseNotes();

    const validation = validateCandidateRegistry(registry);
    expect(validation.ok).toBe(true);

    const plan = buildCandidateImportPlan(registry);
    const importSql = buildImportSqlBatch(plan);
    db.exec(importSql);

    const licenseNotesByCandidateId = new Map(
      licenseNotesData.license_notes.map((note: { candidate_id: string }) => [note.candidate_id, note]),
    );
    const nowIso = '2026-08-17T21:30:00.000Z';
    const { rows, sqlBatch } = buildBatchRightsApprovalSql(
      registry.candidates,
      licenseNotesByCandidateId as Map<string, never>,
      'Bill Hunter',
      nowIso,
    );
    db.exec(sqlBatch);

    return { rows, candidateIds: registry.candidates.map((c: { candidate_id: string }) => c.candidate_id) };
  }

  it('records exactly one rights_evidence row per candidate with a recorded conclusion', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    const { candidateIds } = importCandidatesAndRunApproval(db);

    for (const candidateId of candidateIds) {
      const row = db
        .prepare(
          `SELECT re.conclusion, re.reviewer, re.evidence_type
           FROM rights_evidence re
           JOIN content_items ci ON ci.id = re.content_item_id
           WHERE ci.candidate_id = ?`,
        )
        .get(candidateId) as Record<string, unknown> | undefined;

      expect(row, `missing rights_evidence for ${candidateId}`).toBeDefined();
      expect(row!.reviewer).toBe('Bill Hunter');
      expect(row!.evidence_type).toBe('commons_license');
      expect(['public_domain_confirmed', 'permission_granted']).toContain(row!.conclusion);
    }
  });

  it('maps the CC BY 1.0 item (513) to permission_granted and the rest to public_domain_confirmed', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    importCandidatesAndRunApproval(db);

    const row513 = db
      .prepare('SELECT conclusion FROM rights_evidence WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)')
      .get('lgfc-gehrig-2026-513') as Record<string, unknown>;
    expect(row513.conclusion).toBe('permission_granted');

    const row511 = db
      .prepare('SELECT conclusion FROM rights_evidence WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)')
      .get('lgfc-gehrig-2026-511') as Record<string, unknown>;
    expect(row511.conclusion).toBe('public_domain_confirmed');

    const row514 = db
      .prepare('SELECT conclusion FROM rights_evidence WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)')
      .get('lgfc-gehrig-2026-514') as Record<string, unknown>;
    expect(row514.conclusion).toBe('public_domain_confirmed');
  });

  it('sets curator_decision=approved and a consistent rights_status for every candidate', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    const { candidateIds } = importCandidatesAndRunApproval(db);

    for (const candidateId of candidateIds) {
      const row = db
        .prepare(
          'SELECT curator_decision, curator_decision_by, curator_decision_at, rights_status FROM content_items WHERE candidate_id = ?',
        )
        .get(candidateId) as Record<string, unknown>;

      expect(row.curator_decision).toBe('approved');
      expect(row.curator_decision_by).toBe('Bill Hunter');
      expect(row.curator_decision_at).toBe('2026-08-17T21:30:00.000Z');
      expect(['public_domain_candidate', 'permission_granted']).toContain(row.rights_status);
    }
  });

  it('getCurrentConclusionForCandidate-style query returns the recorded conclusion (rights_evidence is queryable per #3567 ingestion gate)', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    importCandidatesAndRunApproval(db);

    const row = db
      .prepare(
        `SELECT conclusion FROM rights_evidence
         WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?) AND conclusion IS NOT NULL
         ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      )
      .get('lgfc-gehrig-2026-520') as Record<string, unknown>;

    expect(row.conclusion).toBe('public_domain_confirmed');
  });
});
