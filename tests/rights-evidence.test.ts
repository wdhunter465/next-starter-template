import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { parseRecordRightsEvidenceRequest } from '../functions/_lib/rights-evidence-admin';
import {
  getCurrentConclusionForCandidate,
  getCurrentConclusionForCandidateChannel,
  listRightsEvidenceForCandidate,
  recordRightsEvidence,
} from '../functions/_lib/rights-evidence-repository';
import { onRequestGet as rightsEvidenceGet, onRequestPost as rightsEvidencePost } from '../functions/api/admin/content-pipeline/rights-evidence/index';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

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
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) {
          await statement.run();
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return statements.map(() => ({ success: true }));
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

function adminGetRequest(path: string, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers });
}

function adminPostRequest(path: string, body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('rights evidence request parsing (#3552)', () => {
  it('rejects an invalid candidate_id', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'bad-id',
      evidence_type: 'loc_statement',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown evidence_type', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'not_a_real_type',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown conclusion value', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'probably_fine',
    });
    expect(result.ok).toBe(false);
  });

  it('requires reviewer and rationale whenever a conclusion is recorded', () => {
    const missingReviewer = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
    });
    expect(missingReviewer.ok).toBe(false);

    const missingRationale = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
    });
    expect(missingRationale.ok).toBe(false);

    const complete = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
      // #3657 / #3551 2026-08-18: channel is also required whenever a
      // conclusion is recorded -- covered on its own by the dedicated
      // channel-requirement tests below, included here too so this test
      // keeps exercising a request that is actually complete.
      channel: 'website',
    });
    expect(complete.ok).toBe(true);
  });

  it('accepts evidence without a conclusion (metadata-only research record)', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'openverse_license',
      evidence_text: 'CC0 per Openverse record',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.conclusion).toBeUndefined();
    }
  });

  // #3551's 2026-08-18 channel-scoping directive: no blanket approval.
  it('rejects recording a conclusion without a channel', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('channel is required');
    }
  });

  it('rejects recording a conclusion with an invalid channel string', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
      channel: 'carrier_pigeon',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('channel');
    }
  });

  it('accepts a conclusion recorded with a valid channel', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'loc_statement',
      conclusion: 'public_domain_confirmed',
      reviewer: 'Bill',
      conclusion_rationale: 'LOC advisory + pre-1931 publication',
      channel: 'website',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.channel).toBe('website');
    }
  });

  it('accepts rights_holder / repository_or_collection without a conclusion', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'member_ownership',
      rights_holder: 'Jane Q. Member',
      repository_or_collection: 'LGFC member donation archive',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.rights_holder).toBe('Jane Q. Member');
      expect(result.request.repository_or_collection).toBe('LGFC member donation archive');
      expect(result.request.conclusion).toBeUndefined();
    }
  });

  it('rejects pre_1931_publication evidence missing any structured field', () => {
    const missingAll = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'pre_1931_publication',
    });
    expect(missingAll.ok).toBe(false);
    if (!missingAll.ok) {
      expect(missingAll.error).toContain('publication_established');
      expect(missingAll.error).toContain('us_publication_or_uraa_confirmed');
      expect(missingAll.error).toContain('publication_date_source');
    }

    const missingOne = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'pre_1931_publication',
      publication_established: true,
      us_publication_or_uraa_confirmed: true,
    });
    expect(missingOne.ok).toBe(false);
    if (!missingOne.ok) {
      expect(missingOne.error).toContain('publication_date_source');
      expect(missingOne.error).not.toMatch(/publication_established|us_publication_or_uraa_confirmed/);
    }
  });

  it('accepts pre_1931_publication evidence with all three structured fields present', () => {
    const result = parseRecordRightsEvidenceRequest({
      candidate_id: 'lgfc-gehrig-2026-999',
      evidence_type: 'pre_1931_publication',
      publication_established: true,
      us_publication_or_uraa_confirmed: '1',
      publication_date_source: '1928 Daily News archive',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.publication_established).toBe(1);
      expect(result.request.us_publication_or_uraa_confirmed).toBe(1);
      expect(result.request.publication_date_source).toBe('1928 Daily News archive');
    }
  });
});

describe('rights evidence repository + admin API (#3552)', () => {
  it('records evidence as an append-only trail and tracks the current conclusion', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate = await upsertCandidate(db, minimalCandidate());

    // First pass: metadata-only research record, no conclusion yet.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      evidence_text: 'No known restrictions on publication.',
      evidence_url: 'https://loc.gov/item/example',
    });

    expect(await getCurrentConclusionForCandidate(db, candidate.id)).toBeNull();

    // Second pass: reviewer records a conclusion.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'pre_1931_publication',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'Confirmed 1928 newspaper publication, US, no URAA restoration.',
    });

    const trail = await listRightsEvidenceForCandidate(db, candidate.id);
    expect(trail).toHaveLength(2);
    // Most recent first.
    expect(trail[0].conclusion).toBe('public_domain_confirmed');
    expect(trail[1].conclusion).toBeNull();

    const current = await getCurrentConclusionForCandidate(db, candidate.id);
    expect(current?.conclusion).toBe('public_domain_confirmed');
    expect(current?.reviewer).toBe('Bill');
  });

  it('returns 401 without admin authorization', async () => {
    const response = await rightsEvidenceGet({
      env: { DB: {} },
      request: adminGetRequest(
        '/api/admin/content-pipeline/rights-evidence?candidate_id=lgfc-gehrig-2026-999',
        null,
      ),
    });

    expect(response.status).toBe(401);
  });

  it('rejects recording evidence for a candidate that does not exist', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const response = await rightsEvidencePost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/rights-evidence', {
        candidate_id: 'lgfc-gehrig-2026-404',
        evidence_type: 'loc_statement',
      }),
    });

    expect(response.status).toBe(404);
  });

  it('records evidence through the admin API and resolves source_domain to source_id', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const postResponse = await rightsEvidencePost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/rights-evidence', {
        candidate_id: 'lgfc-gehrig-2026-999',
        evidence_type: 'loc_statement',
        evidence_text: 'No known restrictions on publication.',
        source_domain: 'loc.gov',
      }),
    });

    expect(postResponse.status).toBe(201);
    const postBody = await postResponse.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.evidence.source_id).toEqual(expect.any(Number));

    const getResponse = await rightsEvidenceGet({
      env: { DB: db },
      request: adminGetRequest(
        '/api/admin/content-pipeline/rights-evidence?candidate_id=lgfc-gehrig-2026-999',
      ),
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.evidence).toHaveLength(1);
    expect(getBody.current_conclusion).toBeNull();
  });

  it('rejects an unknown source_domain', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    await upsertCandidate(db, minimalCandidate());

    const response = await rightsEvidencePost({
      env: { DB: db },
      request: adminPostRequest('/api/admin/content-pipeline/rights-evidence', {
        candidate_id: 'lgfc-gehrig-2026-999',
        evidence_type: 'loc_statement',
        source_domain: 'not-a-real-source.example',
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe('per-channel rights conclusion resolution (#3657 / #3551 2026-08-18 channel-scoping directive)', () => {
  it('a conclusion recorded for one channel does not authorize a different channel', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const candidate = await upsertCandidate(db, minimalCandidate());

    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC advisory + pre-1931 publication.',
      channel: 'website',
    });

    const websiteConclusion = await getCurrentConclusionForCandidateChannel(db, candidate.id, 'website');
    expect(websiteConclusion?.conclusion).toBe('public_domain_confirmed');

    // No conclusion was ever recorded for social_media -- a website clearance
    // must not silently cover it.
    const socialConclusion = await getCurrentConclusionForCandidateChannel(db, candidate.id, 'social_media');
    expect(socialConclusion).toBeNull();
  });

  it('resolves independently per channel once multiple channels have conclusions', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const candidate = await upsertCandidate(db, minimalCandidate());

    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'loc_statement',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'LOC advisory + pre-1931 publication.',
      channel: 'website',
    });
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'cmg_grant',
      reviewer: 'Bill',
      conclusion: 'permission_granted',
      conclusion_rationale: 'CMG Worldwide newsletter usage grant.',
      channel: 'newsletter_email',
    });

    expect((await getCurrentConclusionForCandidateChannel(db, candidate.id, 'website'))?.conclusion).toBe(
      'public_domain_confirmed',
    );
    expect((await getCurrentConclusionForCandidateChannel(db, candidate.id, 'newsletter_email'))?.conclusion).toBe(
      'permission_granted',
    );
    expect(await getCurrentConclusionForCandidateChannel(db, candidate.id, 'fundraiser_campaign')).toBeNull();
  });

  // #3552's audit-flagged "revoked permission" scenario. The append-only
  // evidence model only ever supersedes a conclusion with a NEWER row that
  // itself carries a non-null conclusion (see
  // getCurrentConclusionForCandidateChannel's WHERE clause) -- and the fixed
  // conclusion vocabulary (RIGHTS_EVIDENCE_CONCLUSIONS) has no value meaning
  // "revoked" or "denied". #3657's scope explicitly forbids inventing new
  // conclusion vocabulary without Bill's authorization, so full revocation
  // (a later row that un-authorizes an earlier granted conclusion) is a
  // known, pre-existing gap in the append-only model, NOT solved here --
  // it is a candidate for a dedicated follow-up issue. This test documents
  // the actual current behavior precisely so that gap is visible rather than
  // silently assumed away.
  it('documents current supersession semantics: a later evidence row without a conclusion does not revoke an earlier channel conclusion (known gap -- not solved in #3657, see comment above)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const candidate = await upsertCandidate(db, minimalCandidate());

    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'cmg_grant',
      reviewer: 'Bill',
      conclusion: 'permission_granted',
      conclusion_rationale: 'CMG Worldwide website usage grant.',
      channel: 'website',
    });
    expect((await getCurrentConclusionForCandidateChannel(db, candidate.id, 'website'))?.conclusion).toBe(
      'permission_granted',
    );

    // A reviewer later learns the grant was revoked and records that fact as
    // a new evidence row -- but cannot record a conclusion value that means
    // "revoked" because no such value exists in the fixed vocabulary.
    await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'other',
      reviewer: 'Bill',
      evidence_text: 'CMG Worldwide revoked the website usage grant via email dated 2026-08-20.',
      channel: 'website',
      // conclusion intentionally omitted -- see comment above.
    });

    // Known gap: the resolver still finds the earlier 'permission_granted'
    // row, because it only ever considers rows with a non-null conclusion.
    // A caller relying on this resolver for a publication gate would
    // currently NOT see the revocation. This is the exact behavior to fix
    // in a dedicated follow-up, not a regression introduced by #3657.
    const stillFound = await getCurrentConclusionForCandidateChannel(db, candidate.id, 'website');
    expect(stillFound?.conclusion).toBe('permission_granted');

    // The revocation note is nonetheless preserved in the append-only trail
    // for a human reviewer to see.
    const trail = await listRightsEvidenceForCandidate(db, candidate.id);
    expect(trail[0].evidence_text).toContain('revoked');
    expect(trail[0].conclusion).toBeNull();
  });
});

describe('rights_holder / repository_or_collection / pre_1931 structured fields (#3657)', () => {
  it('stores channel, rights_holder, and repository_or_collection as first-class columns', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const candidate = await upsertCandidate(db, minimalCandidate());

    const stored = await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'member_ownership',
      channel: 'website',
      rights_holder: 'Jane Q. Member',
      repository_or_collection: 'LGFC member donation archive',
    });

    expect(stored.rights_holder).toBe('Jane Q. Member');
    expect(stored.repository_or_collection).toBe('LGFC member donation archive');

    const row = sqlite
      .prepare('SELECT rights_holder, repository_or_collection FROM rights_evidence WHERE id = ?')
      .get(stored.id) as { rights_holder: string; repository_or_collection: string };
    expect(row.rights_holder).toBe('Jane Q. Member');
    expect(row.repository_or_collection).toBe('LGFC member donation archive');
  });

  it('stores pre_1931_publication structured fields', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);
    const candidate = await upsertCandidate(db, minimalCandidate());

    const stored = await recordRightsEvidence(db, {
      content_item_id: candidate.id,
      evidence_type: 'pre_1931_publication',
      reviewer: 'Bill',
      conclusion: 'public_domain_confirmed',
      conclusion_rationale: 'Confirmed 1928 publication.',
      channel: 'website',
      publication_established: 1,
      us_publication_or_uraa_confirmed: 1,
      publication_date_source: '1928 Daily News archive',
    });

    expect(stored.publication_established).toBe(1);
    expect(stored.us_publication_or_uraa_confirmed).toBe(1);
    expect(stored.publication_date_source).toBe('1928 Daily News archive');
  });
});
