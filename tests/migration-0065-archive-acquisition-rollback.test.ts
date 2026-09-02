// #2073 Work Package item 6 (#4063): exercises the hand-authored emergency
// schema reversal for migration 0065
// (scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql), rather
// than just describing it in a runbook. Two things must both be proven:
//   1. When the new surface is genuinely unused, the reversal cleanly
//      restores the pre-0065 schema and loses zero pre-existing #3551 data.
//   2. When the new surface HAS been used, the reversal's guard refuses to
//      run at all (rather than silently discarding archive/donor data or
//      aborting mid-rebuild in a half-applied state).

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

function migrationFiles(): string[] {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

function applyMigrations(db: DatabaseSync, files: string[]) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

const ROLLBACK_SQL_PATH = path.join(
  process.cwd(),
  'scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql',
);

function applyRollback(db: DatabaseSync) {
  db.exec(fs.readFileSync(ROLLBACK_SQL_PATH, 'utf8'));
}

function seedBaselineContentItem(db: DatabaseSync, candidateId: string) {
  db.prepare(
    `INSERT INTO content_items (
      candidate_id, input_stream, title, source_name, source_type, content_type,
      summary, rights_status, source_trust_status, relevance_status, review_status,
      publication_status, privacy_flag, privacy_review_status, review_priority
    ) VALUES (
      ?, 'public_research', 'Pre-existing #3551 item', 'Test Source', 'archive', 'photo',
      'Test summary', 'unknown', 'trusted', 'pending', 'pending_review',
      'not_ready', 'none', 'not_applicable', 'normal'
    )`,
  ).run(candidateId);
  return (db.prepare('SELECT id FROM content_items WHERE candidate_id = ?').get(candidateId) as { id: number }).id;
}

describe('migration 0065 rollback (scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql)', () => {
  it('cleanly reverses the schema and preserves pre-existing #3551 data when the new surface is unused', () => {
    const db = new DatabaseSync(':memory:');
    applyMigrations(db, migrationFiles());

    const contentItemId = seedBaselineContentItem(db, 'lgfc-rollback-clean-0001');
    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text)
       VALUES (?, 'loc_statement', 'pre-existing evidence, unrelated to archive acquisition')`,
    ).run(contentItemId);

    // Sanity: the archive-acquisition surface exists and is empty (the
    // realistic rollback window -- right after deploy, before first use).
    expect((db.prepare('SELECT COUNT(*) AS n FROM archive_items').get() as { n: number }).n).toBe(0);

    expect(() => applyRollback(db)).not.toThrow();

    // The two tables migration 0065 added are gone.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('archive_items', 'archive_item_custody_events')")
      .all();
    expect(tables).toEqual([]);

    // Pre-existing #3551 data survived, untouched, under its original id.
    const survived = db.prepare('SELECT id, candidate_id FROM content_items WHERE candidate_id = ?').get('lgfc-rollback-clean-0001') as
      | { id: number; candidate_id: string }
      | undefined;
    expect(survived).toBeDefined();
    expect(survived!.id).toBe(contentItemId);

    const evidence = db.prepare('SELECT evidence_type FROM rights_evidence WHERE content_item_id = ?').get(contentItemId) as
      | { evidence_type: string }
      | undefined;
    expect(evidence?.evidence_type).toBe('loc_statement');

    // The widened CHECK values are rejected again -- the reversal is real,
    // not cosmetic.
    expect(() =>
      db.exec(
        `INSERT INTO content_items (
          candidate_id, input_stream, title, source_name, source_type, content_type,
          summary, rights_status, source_trust_status, relevance_status, review_status,
          publication_status, privacy_flag, privacy_review_status, review_priority
        ) VALUES (
          'lgfc-post-rollback', 'physical_acquisition', 'x', 'x', 'archive', 'photo',
          'x', 'unknown', 'trusted', 'pending', 'pending_review',
          'not_ready', 'none', 'not_applicable', 'normal'
        );`,
      ),
    ).toThrow();

    expect(() =>
      db
        .prepare(
          `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text)
           VALUES (?, 'donor_agreement', 'x')`,
        )
        .run(contentItemId),
    ).toThrow();
  });

  it('refuses to run (and touches nothing) when an archive_items row exists', () => {
    const db = new DatabaseSync(':memory:');
    applyMigrations(db, migrationFiles());

    const contentItemId = seedBaselineContentItem(db, 'lgfc-rollback-guard-archive-0001');
    db.prepare(
      `INSERT INTO archive_items (content_item_id, item_type, custody_type)
       VALUES (?, 'photograph', 'donation')`,
    ).run(contentItemId);

    expect(() => applyRollback(db)).toThrow();

    // Refused cleanly -- the guard scratch table never survives a failed
    // transaction, and the real tables are untouched.
    expect((db.prepare('SELECT COUNT(*) AS n FROM archive_items').get() as { n: number }).n).toBe(1);
    const stillThere = db.prepare('SELECT id FROM content_items WHERE candidate_id = ?').get('lgfc-rollback-guard-archive-0001');
    expect(stillThere).toBeDefined();
  });

  it('refuses to run when a content_items row uses input_stream = physical_acquisition', () => {
    const db = new DatabaseSync(':memory:');
    applyMigrations(db, migrationFiles());

    db.exec(`
      INSERT INTO content_items (
        candidate_id, input_stream, title, source_name, source_type, content_type,
        summary, rights_status, source_trust_status, relevance_status, review_status,
        publication_status, privacy_flag, privacy_review_status, review_priority
      ) VALUES (
        'lgfc-rollback-guard-stream-0001', 'physical_acquisition', 'x', 'x', 'archive', 'photo',
        'x', 'unknown', 'trusted', 'pending', 'pending_review',
        'not_ready', 'none', 'not_applicable', 'normal'
      );
    `);

    expect(() => applyRollback(db)).toThrow();
    const stillThere = db.prepare('SELECT id FROM content_items WHERE candidate_id = ?').get('lgfc-rollback-guard-stream-0001');
    expect(stillThere).toBeDefined();
  });

  it('refuses to run when a rights_evidence row uses evidence_type = donor_agreement', () => {
    const db = new DatabaseSync(':memory:');
    applyMigrations(db, migrationFiles());

    const contentItemId = seedBaselineContentItem(db, 'lgfc-rollback-guard-evidence-0001');
    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text, reviewer)
       VALUES (?, 'donor_agreement', 'Signed donor agreement on file', 'Bill')`,
    ).run(contentItemId);

    expect(() => applyRollback(db)).toThrow();
    const evidence = db.prepare('SELECT evidence_type FROM rights_evidence WHERE content_item_id = ?').get(contentItemId) as
      | { evidence_type: string }
      | undefined;
    expect(evidence?.evidence_type).toBe('donor_agreement');
  });
});
