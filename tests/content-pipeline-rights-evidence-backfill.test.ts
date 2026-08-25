import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { buildCandidateImportPlan, buildImportSqlBatch, validateCandidateRegistry } from '../functions/_lib/content-pipeline-candidate-import';
import { buildBatchRightsApprovalSql } from '../functions/_lib/content-pipeline-batch-rights-approval';
import { buildRightsEvidenceProvenanceBackfillSql } from '../functions/_lib/content-pipeline-rights-evidence-backfill';

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

function licenseNotesMap() {
  const licenseNotesData = loadFixtureLicenseNotes();
  return new Map(
    licenseNotesData.license_notes.map((note: { candidate_id: string }) => [note.candidate_id, note]),
  );
}

// Simulates the OLD (pre-fix) writer that left rights_holder/
// repository_or_collection NULL and wrote a synthesized evidence_text, so
// the backfill has real gap rows to correct against a real D1 schema.
function importAndApproveWithPreFixWriter(db: DatabaseSync) {
  const registry = loadFixtureRegistry();
  const validation = validateCandidateRegistry(registry);
  expect(validation.ok).toBe(true);

  const plan = buildCandidateImportPlan(registry);
  db.exec(buildImportSqlBatch(plan));

  const notesByCandidateId = licenseNotesMap();
  const { sqlBatch } = buildBatchRightsApprovalSql(
    registry.candidates,
    notesByCandidateId as Map<string, never>,
    'Bill Hunter',
    '2026-08-17T21:30:00.000Z',
  );
  db.exec(sqlBatch);

  // Revert this run's fix so the row looks like the pre-fix writer's output.
  db.exec(
    `UPDATE rights_evidence SET rights_holder = NULL, repository_or_collection = NULL, evidence_text = 'synthesized sentence, not raw source text';`,
  );

  return { registry, notesByCandidateId };
}

describe('buildRightsEvidenceProvenanceBackfillSql (#3552 phase 3)', () => {
  it('fills rights_holder/repository_or_collection and replaces the synthesized evidence_text with the raw license string', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    const { registry, notesByCandidateId } = importAndApproveWithPreFixWriter(db);

    const { sqlBatch } = buildRightsEvidenceProvenanceBackfillSql(
      registry.candidates,
      notesByCandidateId as Map<string, never>,
    );
    db.exec(sqlBatch);

    const row511 = db
      .prepare(
        `SELECT evidence_text, rights_holder, repository_or_collection
         FROM rights_evidence
         WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)`,
      )
      .get('lgfc-gehrig-2026-511') as Record<string, unknown>;

    expect(row511.evidence_text).toBe('Public domain');
    expect(row511.rights_holder).toBe('University Archives—Columbiana Library, Columbia University.');
    expect(row511.repository_or_collection).toBe('Wikimedia Commons');
  });

  it('is idempotent: a second run is a no-op once rights_holder is populated', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    const { registry, notesByCandidateId } = importAndApproveWithPreFixWriter(db);

    const { sqlBatch } = buildRightsEvidenceProvenanceBackfillSql(
      registry.candidates,
      notesByCandidateId as Map<string, never>,
    );
    db.exec(sqlBatch);
    db.exec(sqlBatch); // second run must not error and must not alter anything

    const row511 = db
      .prepare(
        `SELECT rights_holder FROM rights_evidence
         WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)`,
      )
      .get('lgfc-gehrig-2026-511') as Record<string, unknown>;
    expect(row511.rights_holder).toBe('University Archives—Columbiana Library, Columbia University.');
  });

  it('never overwrites a row a human has already backfilled/edited (guarded by rights_holder IS NULL)', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    const { registry, notesByCandidateId } = importAndApproveWithPreFixWriter(db);

    db.exec(
      `UPDATE rights_evidence SET rights_holder = 'Manually corrected by admin' WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = 'lgfc-gehrig-2026-511');`,
    );

    const { sqlBatch } = buildRightsEvidenceProvenanceBackfillSql(
      registry.candidates,
      notesByCandidateId as Map<string, never>,
    );
    db.exec(sqlBatch);

    const row511 = db
      .prepare(
        `SELECT rights_holder FROM rights_evidence
         WHERE content_item_id = (SELECT id FROM content_items WHERE candidate_id = ?)`,
      )
      .get('lgfc-gehrig-2026-511') as Record<string, unknown>;
    expect(row511.rights_holder).toBe('Manually corrected by admin');
  });
});
