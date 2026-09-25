import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { upsertCandidate } from '../../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../../functions/_lib/content-pipeline-candidate-import';
import { recordGovernedRightsEvidence, recordUndeterminedRightsEvidence } from '../../functions/_lib/rights-evidence-repository';
import { onRequestGet as queueGet } from '../../functions/api/admin/content-pipeline/rights-evidence/queue';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from '../helpers/adminSqliteSession';

function minimalCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-999',
    input_stream: 'scheduled_discovery',
    title: 'Test candidate',
    source_name: 'Library of Congress',
    source_type: 'library',
    content_type: 'photo',
    summary: 'Test summary',
    rights_status: 'unknown',
    source_trust_status: 'trusted',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    created_at: '2026-08-17T16:00:00.000Z',
    updated_at: '2026-08-17T16:00:00.000Z',
    ...overrides,
  };
}

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

function wrapSqliteAsD1(sqlite: DatabaseSync) {
  return {
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      });

      return {
        bind: bound,
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          const info = stmt.run();
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      };
    },
  };
}

function adminGetRequest(path: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers: { Cookie: ADMIN_SESSION_COOKIE } });
}

describe('GET /api/admin/content-pipeline/rights-evidence/queue (#4374 Q3)', () => {
  it('separates the never-reviewed backlog from the hold queue', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    // Never touched at all -- zero rights_evidence rows.
    const untouched = await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-901', title: 'Untouched candidate' }));

    // Explicitly held after a human looked at it once.
    const held = await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-902', title: 'Held candidate' }));
    await recordGovernedRightsEvidence(db, {
      content_item_id: held.id,
      evidence_type: 'other',
      reviewer: 'Curator',
      conclusion_rationale: 'Needs a second look.',
      usage_decision: 'hold',
    });

    // Auto-flagged undetermined by discovery import (also usage_decision='hold').
    const undetermined = await upsertCandidate(db, minimalCandidate({ candidate_id: 'lgfc-gehrig-2026-903', title: 'Undetermined candidate' }));
    await recordUndeterminedRightsEvidence(db, {
      content_item_id: undetermined.id,
      evidence_type: 'other',
      reviewer: 'automated:discovery-import',
      conclusion_rationale: 'Rights could not be determined automatically at discovery time.',
    });

    const response = await queueGet({ env: { DB: db }, request: adminGetRequest('/api/admin/content-pipeline/rights-evidence/queue?limit=100') });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const heldTitles = body.items.map((item: { title: string }) => item.title);
    expect(heldTitles).toEqual(expect.arrayContaining(['Held candidate', 'Undetermined candidate']));
    expect(heldTitles).not.toContain('Untouched candidate');
    expect(body.count).toBe(2);

    const unreviewedTitles = body.unreviewed_items.map((item: { title: string }) => item.title);
    expect(unreviewedTitles).toEqual(['Untouched candidate']);
    expect(body.unreviewed_count).toBe(1);
  });

  it('requires an admin session', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await queueGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: new Request('https://www.lougehrigfanclub.com/api/admin/content-pipeline/rights-evidence/queue'),
    });
    expect(response.status).toBe(401);
  });
});
