// Verifies migration 0065's content_items/rights_evidence rebuild does not
// lose data from any of the five existing dependent tables (repeating the
// verification 0059 itself required before it was finalized -- see that
// migration's own extensive comment on why a naive PRAGMA foreign_keys
// toggle silently wipes every FK-dependent table under D1's implicit
// per-migration transaction), and that the new archive-acquisition tables
// and CHECK values actually work.

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

const TARGET_MIGRATION = '0065_archive_acquisition_core.sql';

describe('migration 0065 (archive acquisition core)', () => {
  it('preserves every row in all five content_items-dependent tables across the rebuild', () => {
    const files = migrationFiles();
    const targetIndex = files.indexOf(TARGET_MIGRATION);
    expect(targetIndex).toBeGreaterThan(-1);

    const before = files.slice(0, targetIndex);
    expect(before).not.toContain(TARGET_MIGRATION);

    const db = new DatabaseSync(':memory:');
    applyMigrations(db, before);

    // Seed one real row in content_items and each of its five dependents,
    // using the exact column list/order each table had immediately before
    // migration 0065 runs.
    db.exec(`
      INSERT INTO content_items (
        candidate_id, input_stream, title, source_name, source_type, content_type,
        summary, rights_status, source_trust_status, relevance_status, review_status,
        publication_status, privacy_flag, privacy_review_status, review_priority
      ) VALUES (
        'lgfc-pretest-0001', 'public_research', 'Pre-migration item', 'Test Source', 'archive', 'photo',
        'Test summary', 'unknown', 'trusted', 'pending', 'pending_review',
        'not_ready', 'none', 'not_applicable', 'normal'
      );
    `);
    const contentItemId = db.prepare('SELECT id FROM content_items WHERE candidate_id = ?').get('lgfc-pretest-0001') as { id: number };
    expect(contentItemId.id).toEqual(expect.any(Number));

    db.exec(`INSERT INTO tags (tag_name, tag_category) VALUES ('Lou Gehrig', 'people');`);
    const tagId = db.prepare("SELECT id FROM tags WHERE tag_name = 'Lou Gehrig'").get() as { id: number };
    db.prepare('INSERT INTO content_item_tags (content_item_id, tag_id) VALUES (?, ?)').run(contentItemId.id, tagId.id);

    db.prepare(
      `INSERT INTO member_submissions (
        content_item_id, submission_type, ownership_statement, permission_statement,
        credit_preference, consent_status, admin_followup_required
      ) VALUES (?, 'photo', 'I own this', 'I grant permission', 'public_credit', 'granted', 0)`,
    ).run(contentItemId.id);

    db.prepare(
      `INSERT INTO publication_candidates (content_item_id, publication_target, status)
       VALUES (?, 'gallery', 'staging')`,
    ).run(contentItemId.id);

    db.prepare(
      `INSERT INTO moderation_events (content_item_id, event_type, actor, notes)
       VALUES (?, 'review_state_change', 'tester', 'pre-migration event')`,
    ).run(contentItemId.id);

    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text)
       VALUES (?, 'loc_statement', 'pre-migration evidence')`,
    ).run(contentItemId.id);

    // Sanity: every seeded row actually exists before the migration runs.
    expect((db.prepare('SELECT COUNT(*) AS n FROM content_items').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM content_item_tags').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM member_submissions').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM publication_candidates').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM moderation_events').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM rights_evidence').get() as { n: number }).n).toBe(1);

    // Apply the migration under test.
    applyMigrations(db, [TARGET_MIGRATION]);

    // Every row must have survived, with FK linkage intact.
    const survivedItem = db.prepare('SELECT id, candidate_id FROM content_items WHERE candidate_id = ?').get('lgfc-pretest-0001') as
      | { id: number; candidate_id: string }
      | undefined;
    expect(survivedItem).toBeDefined();
    expect(survivedItem!.id).toBe(contentItemId.id);

    expect((db.prepare('SELECT COUNT(*) AS n FROM content_item_tags WHERE content_item_id = ?').get(contentItemId.id) as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM member_submissions WHERE content_item_id = ?').get(contentItemId.id) as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM publication_candidates WHERE content_item_id = ?').get(contentItemId.id) as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM moderation_events WHERE content_item_id = ?').get(contentItemId.id) as { n: number }).n).toBe(1);

    const evidenceRow = db.prepare('SELECT content_item_id, evidence_type, usage_decision FROM rights_evidence WHERE content_item_id = ?').get(contentItemId.id) as
      | { content_item_id: number; evidence_type: string; usage_decision: string }
      | undefined;
    expect(evidenceRow).toBeDefined();
    expect(evidenceRow!.evidence_type).toBe('loc_statement');
    // usage_decision (added by migration 0061, long before 0065) must have
    // survived the rebuild along with its column default.
    expect(evidenceRow!.usage_decision).toBe('hold');
  });

  it('accepts the new input_stream and evidence_type CHECK values after the rebuild', () => {
    const db = new DatabaseSync(':memory:');
    applyMigrations(db, migrationFiles());

    db.exec(`
      INSERT INTO content_items (
        candidate_id, input_stream, title, source_name, source_type, content_type,
        summary, rights_status, source_trust_status, relevance_status, review_status,
        publication_status, privacy_flag, privacy_review_status, review_priority
      ) VALUES (
        'lgfc-archive-0001', 'physical_acquisition', 'Donated photograph', 'Donor', 'member', 'photo',
        'Test summary', 'unknown', 'trusted', 'pending', 'pending_review',
        'not_ready', 'none', 'not_applicable', 'normal'
      );
    `);
    const contentItemId = (db.prepare('SELECT id FROM content_items WHERE candidate_id = ?').get('lgfc-archive-0001') as { id: number }).id;

    expect(() =>
      db
        .prepare(
          `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text, reviewer)
           VALUES (?, 'donor_agreement', 'Signed donor agreement on file', 'Bill')`,
        )
        .run(contentItemId),
    ).not.toThrow();

    // A non-archive-stream row still rejects the new evidence_type... no --
    // evidence_type isn't scoped by input_stream at the DB layer; that's
    // intentionally left to application logic (see archive-items-repository.ts).
    // What the DB layer must still reject is an unknown input_stream/evidence_type.
    expect(() =>
      db.exec(
        `INSERT INTO content_items (
          candidate_id, input_stream, title, source_name, source_type, content_type,
          summary, rights_status, source_trust_status, relevance_status, review_status,
          publication_status, privacy_flag, privacy_review_status, review_priority
        ) VALUES (
          'lgfc-bad-stream', 'not_a_real_stream', 'x', 'x', 'archive', 'photo',
          'x', 'unknown', 'trusted', 'pending', 'pending_review',
          'not_ready', 'none', 'not_applicable', 'normal'
        );`,
      ),
    ).toThrow();
  });
});
