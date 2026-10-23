import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  buildCandidateImportPlan,
  type CandidateRecord,
  type CandidateRegistry,
} from '../functions/_lib/content-pipeline-candidate-import';
import { withOriginTerms } from '../scripts/content-pipeline/discovery-evidence-terms.mjs';
import { normalizeSourceUrl, normalizedSourceUrlSql, sourceUrlsMatch } from '../functions/_lib/content-pipeline-url-normalize';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function discovered(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-4592',
    input_stream: 'scheduled_discovery',
    title: 'Discovered item',
    source_url: 'https://example.com/photo',
    source_name: 'Example',
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
    rights_evidence: withOriginTerms({
      evidence_type: 'commons_license',
      evidence_text: 'License template: CC BY 4.0.',
    }),
    ...overrides,
  };
}

function importOne(db: DatabaseSync, candidate: CandidateRecord) {
  const registry: CandidateRegistry = { schema_version: '1', registry_class: 'fixture', candidates: [candidate] };
  for (const statement of buildCandidateImportPlan(registry).statements) db.exec(statement.sql);
}

describe('normalizeSourceUrl (#4592)', () => {
  it('lowercases the host, strips www, forces https, and drops the fragment', () => {
    expect(normalizeSourceUrl('HTTP://WWW.Example.COM/Photo#top')).toBe('https://example.com/Photo');
  });

  it('drops tracking parameters and sorts the rest', () => {
    expect(normalizeSourceUrl('https://example.com/a?utm_source=x&id=2&fbclid=z&gclid=q')).toBe('https://example.com/a?id=2');
    expect(normalizeSourceUrl('https://example.com/a?b=1&a=2')).toBe('https://example.com/a?a=2&b=1');
  });

  it('strips a trailing slash and a default port', () => {
    expect(normalizeSourceUrl('https://example.com/a/')).toBe('https://example.com/a');
    expect(normalizeSourceUrl('https://example.com:443/a')).toBe('https://example.com/a');
    expect(normalizeSourceUrl('https://example.com/')).toBe('https://example.com');
  });

  it('treats two spellings of one page as the same URL', () => {
    expect(
      sourceUrlsMatch(
        'http://www.example.com/photo/?utm_campaign=spring',
        'https://example.com/photo',
      ),
    ).toBe(true);
  });

  it('does not merge two different pages', () => {
    expect(sourceUrlsMatch('https://example.com/a', 'https://example.com/b')).toBe(false);
    expect(sourceUrlsMatch('https://example.com/a?id=1', 'https://example.com/a?id=2')).toBe(false);
    expect(sourceUrlsMatch('https://example.com:8443/a', 'https://example.com/a')).toBe(false);
  });

  it('rejects a non-http URL', () => {
    expect(normalizeSourceUrl('not a url')).toBeNull();
    expect(normalizeSourceUrl('mailto:archive@example.com')).toBeNull();
  });
});

describe('normalizedSourceUrlSql matches the JavaScript rules (#4592)', () => {
  const samples = [
    'HTTP://WWW.Example.COM/Photo#top',
    'https://example.com/a?utm_source=x&id=2&fbclid=z',
    'https://example.com/a?b=1&a=2',
    'http://example.com/a/',
    'https://example.com:443/a',
    'https://example.com/',
    'https://example.com/a',
    'https://example.com/b',
    'https://example.com/a?id=1',
    'https://example.com/a?id=2',
  ];

  it('returns the same value as normalizeSourceUrl for each sample', () => {
    const db = new DatabaseSync(':memory:');
    const sql = `SELECT ${normalizedSourceUrlSql('?')} AS normalized`;
    for (const sample of samples) {
      const row = db.prepare(sql).get(sample) as { normalized: string | null };
      expect(row.normalized).toBe(normalizeSourceUrl(sample));
    }
  });
});

describe('import uses the normalized URL (#4592)', () => {
  it('does not insert a second row for another spelling of the same page', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    importOne(db, discovered({ candidate_id: 'lgfc-gehrig-2026-4701', source_url: 'http://www.example.com/photo/' }));
    importOne(
      db,
      discovered({
        candidate_id: 'lgfc-gehrig-2026-4702',
        source_url: 'https://example.com/photo?utm_source=newsletter',
        created_at: '2026-10-02T12:00:00.000Z',
      }),
    );
    const count = db.prepare('SELECT COUNT(*) AS count FROM content_items').get() as { count: number };
    expect(count.count).toBe(1);
    expect(db.prepare('SELECT source_url FROM content_items').get()).toEqual({
      source_url: 'http://www.example.com/photo/',
    });
  });

  it('imports two different pages', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    importOne(db, discovered({ candidate_id: 'lgfc-gehrig-2026-4711', source_url: 'https://example.com/a' }));
    importOne(db, discovered({ candidate_id: 'lgfc-gehrig-2026-4712', source_url: 'https://example.com/b' }));
    const count = db.prepare('SELECT COUNT(*) AS count FROM content_items').get() as { count: number };
    expect(count.count).toBe(2);
  });

  it('does not re-add a denied URL under another spelling, even when the terms changed', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    importOne(db, discovered({ candidate_id: 'lgfc-gehrig-2026-4721', source_url: 'http://www.example.com/denied/' }));
    const existing = db.prepare('SELECT id FROM content_items WHERE candidate_id = ?').get('lgfc-gehrig-2026-4721') as { id: number };
    db.prepare(`UPDATE content_items SET final_status = 'for_admin_review' WHERE id = ?`).run(existing.id);
    db.prepare(
      `INSERT INTO rights_evidence (content_item_id, evidence_type, evidence_text, reviewer, usage_decision, fee_required)
       VALUES (?, 'other', 'Use is denied.', 'admin:test', 'deny', 0)`,
    ).run(existing.id);

    importOne(
      db,
      discovered({
        candidate_id: 'lgfc-gehrig-2026-4722',
        source_url: 'https://example.com/denied?fbclid=abc',
        created_at: '2026-10-11T12:00:00.000Z',
        rights_evidence: withOriginTerms({
          evidence_type: 'commons_license',
          evidence_text: 'License template: CC BY-NC 4.0. Different wording.',
        }),
      }),
    );

    const ids = db.prepare('SELECT candidate_id FROM content_items ORDER BY candidate_id').all() as Array<{ candidate_id: string }>;
    expect(ids).toEqual([{ candidate_id: 'lgfc-gehrig-2026-4721' }]);
    expect(db.prepare('SELECT source_url FROM content_items').get()).toEqual({ source_url: 'http://www.example.com/denied/' });
  });
});
