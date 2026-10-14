// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

function applyAll(db: DatabaseSync) {
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

function insertItem(db: DatabaseSync, candidateId: string, sourceUrl: string): number {
  const info = db
    .prepare(
      `INSERT INTO content_items (
        candidate_id, input_stream, title, source_url, source_name, source_domain, source_type,
        content_type, summary, rights_status, source_trust_status, relevance_status, review_status,
        publication_status, privacy_flag, privacy_review_status, review_priority
      ) VALUES (
        ?, 'public_research', 'Item', ?, 'Library of Congress', 'loc.gov', 'archive',
        'photo', 'summary', 'unknown', 'pending', 'pending', 'pending_review',
        'not_ready', 'none', 'not_applicable', 'normal'
      )`,
    )
    .run(candidateId, sourceUrl);
  return Number(info.lastInsertRowid);
}

describe('permission exchange archive (#4526)', () => {
  it('keeps messages append-only, covers many assets from one exchange, and links a later find', () => {
    const db = new DatabaseSync(':memory:');
    applyAll(db);

    const first = insertItem(db, 'lgfc-4526-a', 'https://www.loc.gov/item/a');
    const second = insertItem(db, 'lgfc-4526-b', 'https://www.loc.gov/item/b');

    const exchange = db
      .prepare(
        `INSERT INTO permission_exchanges (source_domain, scope_requested, status, credit_wording)
         VALUES ('loc.gov', 'Gehrig and Gehrig-related content', 'granted', 'Library of Congress')`,
      )
      .run();
    const exchangeId = Number(exchange.lastInsertRowid);

    db.prepare(
      `INSERT INTO permission_messages (exchange_id, direction, sent_or_received_at, body, sender)
       VALUES (?, 'outbound', '2026-10-01T00:00:00Z', 'Please confirm free use with credit.', 'lgfc@example.org')`,
    ).run(exchangeId);
    db.prepare(
      `INSERT INTO permission_messages (exchange_id, direction, sent_or_received_at, body, sender)
       VALUES (?, 'inbound', '2026-10-02T00:00:00Z', 'Granted for Gehrig-related content with credit.', 'loc@loc.gov')`,
    ).run(exchangeId);

    expect(() => db.prepare('UPDATE permission_messages SET body = ? WHERE exchange_id = ?').run('edited', exchangeId)).toThrow(
      /append-only/,
    );
    expect(() => db.prepare('DELETE FROM permission_messages WHERE exchange_id = ?').run(exchangeId)).toThrow(/append-only/);

    db.prepare('UPDATE content_items SET permission_exchange_id = ? WHERE id IN (?, ?)').run(exchangeId, first, second);
    const linked = db.prepare('SELECT COUNT(*) AS n FROM content_items WHERE permission_exchange_id = ?').get(exchangeId) as {
      n: number;
    };
    expect(linked.n).toBe(2);

    const later = db
      .prepare(
        `SELECT id FROM permission_exchanges
         WHERE source_domain = 'loc.gov' AND status NOT IN ('closed')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get() as { id: number };
    expect(later.id).toBe(exchangeId);

    const messages = db.prepare('SELECT body FROM permission_messages WHERE exchange_id = ? ORDER BY id').all(exchangeId) as {
      body: string;
    }[];
    expect(messages.map((row) => row.body)).toEqual([
      'Please confirm free use with credit.',
      'Granted for Gehrig-related content with credit.',
    ]);
  });

  it('leaves the archive tables in place when the 0065 rollback rebuilds content_items', () => {
    const db = new DatabaseSync(':memory:');
    applyAll(db);
    db.exec(fs.readFileSync(path.join(process.cwd(), 'scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql'), 'utf8'));
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('permission_exchanges', 'permission_messages')")
      .all() as { name: string }[];
    expect(tables.map((row) => row.name).sort()).toEqual(['permission_exchanges', 'permission_messages']);
    const columns = db.prepare('PRAGMA table_info(content_items)').all() as { name: string }[];
    expect(columns.some((column) => column.name === 'permission_exchange_id')).toBe(true);
  });
});
