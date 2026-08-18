import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import {
  CONTENT_PIPELINE_MEDIA_REFERENCE_TABLES,
  parseAdminMediaReferenceUpdate,
  serializeCandidateForAdminReview,
  validateContentPipelineMediaReference,
} from '../functions/_lib/content-pipeline-media-reference';
import {
  CONTENT_PIPELINE_MEDIA_REFERENCE_EVENT_TYPE,
  getUploadedMediaReferenceForCandidate,
  isMemberSubmissionMediaReferenceMissingError,
  MemberSubmissionMediaReferenceMissingError,
  updateCandidateMediaReferences,
} from '../functions/_lib/content-pipeline-candidate-repository';
import { parseMemberSubmissionIntakeBody, persistMemberSubmissionIntake } from '../functions/_lib/content-pipeline-member-submission-intake';
import { onRequestGet as candidatesGet } from '../functions/api/admin/content-pipeline/candidates/index';
import { onRequestPost as mediaReferencePost } from '../functions/api/admin/content-pipeline/candidates/media-reference';
import { onRequestPost as memberSubmitPost } from '../functions/api/library/content-pipeline/submit';

const ADMIN_TOKEN = 'test-admin-token';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
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

function seedMemberSession(db: DatabaseSync, sessionId = 'session-2319', email = 'member@example.com') {
  db.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('${sessionId}', '${email}', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function validIntakeBody(overrides: Record<string, unknown> = {}) {
  return {
    submitter_name: 'Jane Member',
    title: 'Family photo lead',
    summary: 'Photo from a family album.',
    submission_type: 'photo',
    rights_choice: 'member_owns_full_grant',
    credit_preference: 'public_credit',
    ...overrides,
  };
}

function adminGetRequest(path: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { 'x-admin-token': ADMIN_TOKEN },
  });
}

function adminPostRequest(path: string, body: unknown): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
    body: JSON.stringify(body),
  });
}

function memberPostRequest(body: unknown): Request {
  return new Request('https://www.lougehrigfanclub.com/api/library/content-pipeline/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: 'lgfc_session=session-2319',
    },
    body: JSON.stringify(body),
  });
}

describe('content pipeline media reference integration (#2319)', () => {
  it('accepts safe b2 and media_uid references and rejects public URL-like values', () => {
    expect(validateContentPipelineMediaReference('b2://pending/family-photo.jpg', 'media_asset_id').ok).toBe(true);
    expect(validateContentPipelineMediaReference('media_uid:lgfc-photo-001', 'media_asset_id').ok).toBe(true);
    expect(validateContentPipelineMediaReference('lgfc-photo-001', 'media_asset_id').ok).toBe(true);

    expect(validateContentPipelineMediaReference('https://cdn.example.com/photo.jpg', 'media_asset_id').ok).toBe(false);
    expect(validateContentPipelineMediaReference('cdn.example.com/photo.jpg', 'media_asset_id').ok).toBe(false);
    expect(validateContentPipelineMediaReference('example.com/', 'media_asset_id').ok).toBe(false);
    expect(validateContentPipelineMediaReference('example.org/path/to/file.png', 'media_asset_id').ok).toBe(false);
    expect(validateContentPipelineMediaReference('www.example.com/image.jpg', 'media_asset_id').ok).toBe(false);
    expect(validateContentPipelineMediaReference('b2://../escape', 'media_asset_id').ok).toBe(false);
  });

  it('parses admin media reference updates and rejects invalid payloads', () => {
    const valid = parseAdminMediaReferenceUpdate({
      candidate_id: 'lgfc-gehrig-2026-999',
      media_asset_id: 'media_uid:lgfc-photo-001',
    });
    expect(valid.ok).toBe(true);

    const invalid = parseAdminMediaReferenceUpdate({
      candidate_id: 'lgfc-gehrig-2026-999',
      media_asset_id: 'https://public.example/photo.jpg',
    });
    expect(invalid.ok).toBe(false);
  });

  it('persists member uploaded_media_reference and exposes it only on admin detail serialization', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const memberResponse = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(
        validIntakeBody({ uploaded_media_reference: 'b2://pending/family-photo.jpg' }),
      ),
    });
    expect(memberResponse.status).toBe(200);
    const memberBody = await memberResponse.json();
    expect(memberBody.uploaded_media_reference).toBeUndefined();

    const adminResponse = await candidatesGet({
      env: { DB: db, ADMIN_TOKEN },
      request: adminGetRequest(
        `/api/admin/content-pipeline/candidates?candidate_id=${memberBody.candidate_id}`,
      ),
    });
    expect(adminResponse.status).toBe(200);
    const adminBody = await adminResponse.json();
    expect(adminBody.candidate.media_references.uploaded_media_reference).toBe(
      'b2://pending/family-photo.jpg',
    );
    expect(adminBody.candidate.media_references.media_asset_id).toBeNull();
  });

  it('rejects unsafe uploaded_media_reference values during member intake', async () => {
    const parsed = parseMemberSubmissionIntakeBody(
      validIntakeBody({ uploaded_media_reference: 'https://cdn.example.com/photo.jpg' }),
    );
    expect(parsed.ok).toBe(false);

    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const response = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(
        validIntakeBody({ uploaded_media_reference: 'https://cdn.example.com/photo.jpg' }),
      ),
    });
    expect(response.status).toBe(400);
  });

  it('updates candidate media references through the admin route and records moderation events', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const parsed = parseMemberSubmissionIntakeBody(
      validIntakeBody({ uploaded_media_reference: 'b2://pending/original.jpg' }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const persisted = await persistMemberSubmissionIntake(db, parsed.request, {
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2026-07-06T20:00:00.000Z',
    });

    const response = await mediaReferencePost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/candidates/media-reference', {
        candidate_id: persisted.candidate_id,
        media_asset_id: 'media_uid:lgfc-photo-001',
        uploaded_media_reference: 'b2://pending/reviewed.jpg',
        actor: 'operator@test',
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.candidate.media_references.media_asset_id).toBe('media_uid:lgfc-photo-001');
    expect(body.candidate.media_references.uploaded_media_reference).toBe('b2://pending/reviewed.jpg');

    const contentItemId = (
      sqlite
        .prepare(`SELECT id FROM content_items WHERE candidate_id = ?`)
        .get(persisted.candidate_id) as { id: number }
    ).id;
    const uploadedReference = await getUploadedMediaReferenceForCandidate(db, contentItemId);
    expect(uploadedReference).toBe('b2://pending/reviewed.jpg');

    const eventRow = sqlite
      .prepare(
        `SELECT me.event_type, me.from_state, me.to_state, me.notes
         FROM moderation_events me
         JOIN content_items ci ON ci.id = me.content_item_id
         WHERE ci.candidate_id = ?
           AND me.notes = 'media reference update'
         ORDER BY me.id DESC
         LIMIT 1`,
      )
      .get(persisted.candidate_id) as {
      event_type: string;
      from_state: string;
      to_state: string;
      notes: string;
    };
    expect(eventRow.event_type).toBe(CONTENT_PIPELINE_MEDIA_REFERENCE_EVENT_TYPE);
    expect(JSON.parse(eventRow.from_state)).toMatchObject({
      media_asset_id: null,
      uploaded_media_reference: 'b2://pending/original.jpg',
    });
    expect(JSON.parse(eventRow.to_state)).toMatchObject({
      media_asset_id: 'media_uid:lgfc-photo-001',
      uploaded_media_reference: 'b2://pending/reviewed.jpg',
    });
  });

  it('does not write a moderation event when media reference update is a no-op', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const parsed = parseMemberSubmissionIntakeBody(
      validIntakeBody({ uploaded_media_reference: 'b2://pending/original.jpg' }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const persisted = await persistMemberSubmissionIntake(db, parsed.request, {
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2026-07-06T20:00:00.000Z',
    });

    const beforeCount = sqlite
      .prepare(
        `SELECT COUNT(*) AS count
         FROM moderation_events me
         JOIN content_items ci ON ci.id = me.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(persisted.candidate_id) as { count: number };

    const response = await mediaReferencePost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/candidates/media-reference', {
        candidate_id: persisted.candidate_id,
        uploaded_media_reference: 'b2://pending/original.jpg',
      }),
    });

    expect(response.status).toBe(200);
    const afterCount = sqlite
      .prepare(
        `SELECT COUNT(*) AS count
         FROM moderation_events me
         JOIN content_items ci ON ci.id = me.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(persisted.candidate_id) as { count: number };
    expect(afterCount.count).toBe(beforeCount.count);
  });

  it('returns 400 when uploaded_media_reference update targets a candidate without member_submissions', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate: CandidateRecord = {
      candidate_id: 'lgfc-gehrig-2026-502',
      input_stream: 'admin_seed',
      title: 'Archive photo lead',
      source_name: 'LGFC Operator',
      source_type: 'operator',
      content_type: 'photo',
      summary: 'Operator media reference seed',
      rights_status: 'unknown',
      source_trust_status: 'pending',
      relevance_status: 'pending',
      review_status: 'pending_review',
      publication_status: 'not_ready',
      privacy_flag: 'none',
      privacy_review_status: 'not_applicable',
      review_priority: 'normal',
      created_at: '2026-07-06T20:00:00.000Z',
      updated_at: '2026-07-06T20:00:00.000Z',
    };
    await upsertCandidate(db, candidate);

    const response = await mediaReferencePost({
      env: { DB: db, ADMIN_TOKEN },
      request: adminPostRequest('/api/admin/content-pipeline/candidates/media-reference', {
        candidate_id: candidate.candidate_id,
        uploaded_media_reference: 'b2://pending/reviewed.jpg',
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('without a member_submissions row');
  });

  it('uses typed repository errors for missing member_submissions rows', () => {
    const error = new MemberSubmissionMediaReferenceMissingError('lgfc-gehrig-2026-502');
    expect(isMemberSubmissionMediaReferenceMissingError(error)).toBe(true);
    expect(error.code).toBe('member_submission_media_reference_missing');
  });

  it('includes tag tables in media-reference route table guard', () => {
    expect(CONTENT_PIPELINE_MEDIA_REFERENCE_TABLES).toEqual(
      expect.arrayContaining(['tags', 'content_item_tags', 'member_submissions', 'content_items']),
    );
  });

  it('shares admin and media-reference table constants from one source list', async () => {
    const { CONTENT_PIPELINE_ADMIN_CANDIDATE_MEDIA_TABLES } = await import(
      '../functions/_lib/content-pipeline-media-reference'
    );
    expect(CONTENT_PIPELINE_ADMIN_CANDIDATE_MEDIA_TABLES).toBe(CONTENT_PIPELINE_MEDIA_REFERENCE_TABLES);
  });

  it('updates media_asset_id on admin-seeded candidates without member_submissions rows', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const candidate: CandidateRecord = {
      candidate_id: 'lgfc-gehrig-2026-501',
      input_stream: 'admin_seed',
      title: 'Archive photo lead',
      source_name: 'LGFC Operator',
      source_type: 'operator',
      content_type: 'photo',
      summary: 'Operator media reference seed',
      rights_status: 'unknown',
      source_trust_status: 'pending',
      relevance_status: 'pending',
      review_status: 'pending_review',
      publication_status: 'not_ready',
      privacy_flag: 'none',
      privacy_review_status: 'not_applicable',
      review_priority: 'normal',
      created_at: '2026-07-06T20:00:00.000Z',
      updated_at: '2026-07-06T20:00:00.000Z',
    };
    await upsertCandidate(db, candidate);

    const updated = await updateCandidateMediaReferences(db, candidate.candidate_id, {
      media_asset_id: 'media_uid:archive-photo-501',
    });
    expect(updated?.media_asset_id).toBe('media_uid:archive-photo-501');

    const serialized = serializeCandidateForAdminReview(updated as unknown as Record<string, unknown>);
    expect(serialized.media_references.media_asset_id).toBe('media_uid:archive-photo-501');
  });

  it('does not expose media reference admin routes on public API surfaces', () => {
    expect(fs.existsSync('functions/api/admin/content-pipeline/candidates/media-reference.ts')).toBe(true);
    expect(fs.existsSync('functions/api/content-pipeline/media.ts')).toBe(false);
    expect(fs.existsSync('functions/api/library/content-pipeline/media.ts')).toBe(false);
  });
});
