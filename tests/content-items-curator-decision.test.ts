import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

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

function insertMinimalContentItem(db: DatabaseSync, candidateId: string) {
  db.prepare(
    `INSERT INTO content_items (
      candidate_id, input_stream, title, source_name, source_type, content_type,
      summary, rights_status, source_trust_status, relevance_status, review_status,
      publication_status, privacy_flag, privacy_review_status, review_priority
    ) VALUES (?, 'scheduled_discovery', 'Test title', 'Wikimedia Commons', 'archive', 'photo',
      'Test summary', 'unknown', 'trusted', 'pending', 'pending_review',
      'not_ready', 'none', 'not_applicable', 'normal')`,
  ).run(candidateId);
}

describe('content_items curator_decision (#3552 migration 0057)', () => {
  it('defaults new rows to pending', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    insertMinimalContentItem(db, 'lgfc-gehrig-2026-901');

    const row = db
      .prepare('SELECT curator_decision, curator_decision_by, curator_decision_at FROM content_items WHERE candidate_id = ?')
      .get('lgfc-gehrig-2026-901') as Record<string, unknown>;

    expect(row.curator_decision).toBe('pending');
    expect(row.curator_decision_by).toBeNull();
    expect(row.curator_decision_at).toBeNull();
  });

  it('accepts each of the four valid decision values', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    insertMinimalContentItem(db, 'lgfc-gehrig-2026-902');

    for (const decision of ['pending', 'approved', 'disapproved', 'delete']) {
      expect(() =>
        db
          .prepare('UPDATE content_items SET curator_decision = ? WHERE candidate_id = ?')
          .run(decision, 'lgfc-gehrig-2026-902'),
      ).not.toThrow();
    }
  });

  it('rejects a curator_decision value outside the allowed set', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    insertMinimalContentItem(db, 'lgfc-gehrig-2026-903');

    expect(() =>
      db
        .prepare('UPDATE content_items SET curator_decision = ? WHERE candidate_id = ?')
        .run('maybe', 'lgfc-gehrig-2026-903'),
    ).toThrow();
  });

  it('records who decided and when, alongside optional notes', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    insertMinimalContentItem(db, 'lgfc-gehrig-2026-904');

    db.prepare(
      `UPDATE content_items
       SET curator_decision = 'approved', curator_decision_by = 'Bill Hunter',
           curator_decision_at = '2026-08-17T21:00:00.000Z', curator_decision_notes = 'Reviewed license evidence directly.'
       WHERE candidate_id = ?`,
    ).run('lgfc-gehrig-2026-904');

    const row = db
      .prepare(
        'SELECT curator_decision, curator_decision_by, curator_decision_at, curator_decision_notes FROM content_items WHERE candidate_id = ?',
      )
      .get('lgfc-gehrig-2026-904') as Record<string, unknown>;

    expect(row.curator_decision).toBe('approved');
    expect(row.curator_decision_by).toBe('Bill Hunter');
    expect(row.curator_decision_at).toBe('2026-08-17T21:00:00.000Z');
    expect(row.curator_decision_notes).toBe('Reviewed license evidence directly.');
  });
});
