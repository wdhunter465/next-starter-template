import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  allocateMemberSubmissionCandidateId,
  buildMemberSubmissionCandidateRecord,
  candidateAllocationYearFromIso,
  deriveMemberIntakeContentType,
  deriveRightsOutcome,
  isCandidateIdUniqueConflict,
  parseMemberSubmissionIntakeBody,
  persistMemberSubmissionIntake,
  serializeMemberSubmissionIntakeResponse,
} from '../functions/_lib/content-pipeline-member-submission-intake';
import { onRequestPost as memberSubmitPost } from '../functions/api/library/content-pipeline/submit';

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

function seedMemberSession(db: DatabaseSync, sessionId = 'session-2316', email = 'member@example.com') {
  db.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('${sessionId}', '${email}', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function insertContentItemRow(sqlite: DatabaseSync, candidateId: string) {
  sqlite.exec(`
    INSERT INTO content_items (
      candidate_id, input_stream, title, source_name, source_type, content_type, summary,
      rights_status, source_trust_status, relevance_status, review_status, publication_status,
      privacy_flag, privacy_review_status, review_priority, source_metadata, created_at, updated_at
    ) VALUES (
      '${candidateId}', 'admin_seed', 'Existing', 'LGFC', 'operator', 'story', 'Existing summary',
      'unknown', 'pending', 'pending', 'pending_review', 'not_ready',
      'none', 'not_applicable', 'normal', '{}', '2026-07-06T19:00:00.000Z', '2026-07-06T19:00:00.000Z'
    );
  `);
}

function validIntakeBody(overrides: Record<string, unknown> = {}) {
  return {
    submitter_name: 'Jane Member',
    title: 'Grandpa at Yankee Stadium',
    summary: 'My grandfather attended a Gehrig game in 1938.',
    submission_type: 'story',
    rights_choice: 'member_owns_full_grant',
    credit_preference: 'public_credit',
    ...overrides,
  };
}

function externalSourceBody(overrides: Record<string, unknown> = {}) {
  return validIntakeBody({
    rights_choice: 'external_source_needs_evaluation',
    source_url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    ...overrides,
  });
}

function memberPostRequest(body: unknown, sessionId = 'session-2316'): Request {
  return new Request('https://www.lougehrigfanclub.com/api/library/content-pipeline/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `lgfc_session=${sessionId}`,
    },
    body: JSON.stringify(body),
  });
}

describe('content pipeline member submission intake -- two-choice rights UX (#3552/#3553)', () => {
  it('parses a valid member_owns_full_grant submission and derives statement text server-side', () => {
    const parsed = parseMemberSubmissionIntakeBody(validIntakeBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.consent_status).toBe('granted');
    expect(parsed.request.rights_status).toBe('permission_granted');
    expect(parsed.request.review_status).toBe('approved_public_candidate');
    expect(parsed.request.publication_status).toBe('approved_for_publish');
    expect(parsed.request.admin_followup_required).toBe(false);
    expect(parsed.request.ownership_statement.length).toBeGreaterThan(0);
    expect(parsed.request.permission_statement.length).toBeGreaterThan(0);
  });

  it('parses a valid external_source_needs_evaluation submission and queues it pending', () => {
    const parsed = parseMemberSubmissionIntakeBody(externalSourceBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.request.consent_status).toBe('pending');
    expect(parsed.request.rights_status).toBe('permission_needed');
    expect(parsed.request.review_status).toBe('pending_review');
    expect(parsed.request.publication_status).toBe('not_ready');
    expect(parsed.request.admin_followup_required).toBe(true);
    expect(parsed.request.source_url).toBe('https://commons.wikimedia.org/wiki/File:Example.jpg');
  });

  it('rejects external_source_needs_evaluation without a source_url', () => {
    const parsed = parseMemberSubmissionIntakeBody(
      validIntakeBody({ rights_choice: 'external_source_needs_evaluation' }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('source_url is required');
  });

  it('rejects a missing or invalid rights_choice', () => {
    const missing = parseMemberSubmissionIntakeBody(validIntakeBody({ rights_choice: '' }));
    expect(missing.ok).toBe(false);

    const invalid = parseMemberSubmissionIntakeBody(validIntakeBody({ rights_choice: 'something_else' }));
    expect(invalid.ok).toBe(false);
  });

  it('rejects the old free-text ownership_statement/permission_statement fields', () => {
    const parsed = parseMemberSubmissionIntakeBody(
      validIntakeBody({ ownership_statement: 'I wrote this myself.' }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('rights_choice instead');
  });

  it('rejects other member-controlled classification fields', () => {
    const missingTitle = parseMemberSubmissionIntakeBody(validIntakeBody({ title: '   ' }));
    expect(missingTitle.ok).toBe(false);

    const suppliedSourceType = parseMemberSubmissionIntakeBody(validIntakeBody({ source_type: 'member' }));
    expect(suppliedSourceType.ok).toBe(false);
    if (!suppliedSourceType.ok) {
      expect(suppliedSourceType.error).toContain('source_type is not accepted');
    }

    const suppliedContentType = parseMemberSubmissionIntakeBody(validIntakeBody({ content_type: 'story' }));
    expect(suppliedContentType.ok).toBe(false);
    if (!suppliedContentType.ok) {
      expect(suppliedContentType.error).toContain('content_type is not accepted');
    }
  });

  it('derives candidate classification server-side from submission_type', () => {
    expect(deriveMemberIntakeContentType('memorabilia')).toBe('artifact');
    expect(candidateAllocationYearFromIso('2025-03-01T00:00:00.000Z')).toBe(2025);

    const parsed = parseMemberSubmissionIntakeBody(validIntakeBody({ submission_type: 'photo' }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const candidate = buildMemberSubmissionCandidateRecord(parsed.request, {
      candidateId: 'lgfc-gehrig-2025-101',
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2025-03-01T00:00:00.000Z',
    });

    expect(candidate.source_type).toBe('member');
    expect(candidate.content_type).toBe('photo');
  });

  it('deriveRightsOutcome: privacy follow-up still applies even on a fully-granted submission', () => {
    const grantedNoPrivacy = deriveRightsOutcome('member_owns_full_grant', 'none');
    expect(grantedNoPrivacy.admin_followup_required).toBe(false);
    expect(grantedNoPrivacy.publication_status).toBe('approved_for_publish');

    const grantedLivingPerson = deriveRightsOutcome('member_owns_full_grant', 'living_person');
    expect(grantedLivingPerson.admin_followup_required).toBe(true);
    expect(grantedLivingPerson.publication_status).toBe('not_ready');
    // Rights are still fully cleared -- only publication readiness is held back.
    expect(grantedLivingPerson.rights_status).toBe('permission_granted');
    // review_status must not claim approved_public_candidate while privacy
    // is still pending -- docs/how-to/website/member-submission-review.md:
    // "Do not set approved_public_candidate until rights and privacy both
    // acceptable."
    expect(grantedLivingPerson.review_status).toBe('pending_review');

    const evaluationNeeded = deriveRightsOutcome('external_source_needs_evaluation', 'none');
    expect(evaluationNeeded.admin_followup_required).toBe(true);
    expect(evaluationNeeded.rights_status).toBe('permission_needed');
  });

  it('builds member_submission candidates reflecting the fully-granted outcome', () => {
    const parsed = parseMemberSubmissionIntakeBody(validIntakeBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const candidate = buildMemberSubmissionCandidateRecord(parsed.request, {
      candidateId: 'lgfc-gehrig-2026-101',
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2026-07-06T19:00:00.000Z',
    });

    expect(candidate.input_stream).toBe('member_submission');
    expect(candidate.publication_status).toBe('approved_for_publish');
    expect(candidate.review_status).toBe('approved_public_candidate');
    expect(candidate.rights_status).toBe('permission_granted');
    expect(candidate.member_submission?.consent_status).toBe('granted');
    expect(candidate.member_submission?.submitter_contact).toBe('member@example.com');
  });

  it('persists a fully-granted submission with a matching rights_evidence conclusion', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const parsed = parseMemberSubmissionIntakeBody(
      validIntakeBody({
        people_tags: ['Lou Gehrig'],
        topic_tags: ['1938 season'],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await persistMemberSubmissionIntake(db, parsed.request, {
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2026-07-06T19:00:00.000Z',
    });

    expect(result.publication_status).toBe('approved_for_publish');
    expect(result.rights_status).toBe('permission_granted');
    expect(result.candidate_id).toBe('lgfc-gehrig-2026-001');

    const contentItem = sqlite
      .prepare(`SELECT * FROM content_items WHERE candidate_id = ?`)
      .get(result.candidate_id) as Record<string, unknown>;
    expect(contentItem.publication_status).toBe('approved_for_publish');
    expect(contentItem.rights_status).toBe('permission_granted');
    expect(contentItem.content_inventory_id).toBeNull();

    const memberSubmission = sqlite
      .prepare(
        `SELECT ms.*, s.submitter_contact
         FROM member_submissions ms
         JOIN content_items ci ON ci.id = ms.content_item_id
         JOIN submitters s ON s.id = ms.submitter_id
         WHERE ci.candidate_id = ?`,
      )
      .get(result.candidate_id) as Record<string, unknown>;
    expect(memberSubmission.consent_status).toBe('granted');
    expect(memberSubmission.admin_followup_required).toBe(0);

    const evidence = sqlite
      .prepare(
        `SELECT re.evidence_type, re.conclusion, re.reviewer
         FROM rights_evidence re
         JOIN content_items ci ON ci.id = re.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(result.candidate_id) as Record<string, unknown>;
    expect(evidence.evidence_type).toBe('member_ownership');
    expect(evidence.conclusion).toBe('permission_granted');
    expect(evidence.reviewer).toBe('Jane Member');

    const tagCount = sqlite
      .prepare(
        `SELECT COUNT(*) AS n FROM content_item_tags cit
         JOIN content_items ci ON ci.id = cit.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(result.candidate_id) as { n: number };
    expect(tagCount.n).toBe(2);

    // Fully-granted submissions are staged into publication_candidates so
    // "no separate admin step for rights" doesn't leave them approved but
    // invisible to the normal promotion workflow.
    const publicationCandidate = sqlite
      .prepare(
        `SELECT pc.publication_target, pc.status, pc.credit_line
         FROM publication_candidates pc
         JOIN content_items ci ON ci.id = pc.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(result.candidate_id) as Record<string, unknown>;
    expect(publicationCandidate.publication_target).toBe('library');
    expect(publicationCandidate.status).toBe('staging');
    expect(publicationCandidate.credit_line).toBe('Jane Member');

    const inventoryCount = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM content_inventory`)
      .get() as { count: number };
    expect(inventoryCount.count).toBe(0);
  });

  it('persists an external-source submission with a no-conclusion rights_evidence row awaiting evaluation', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const parsed = parseMemberSubmissionIntakeBody(externalSourceBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await persistMemberSubmissionIntake(db, parsed.request, {
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2026-07-06T19:00:00.000Z',
    });

    expect(result.publication_status).toBe('not_ready');
    expect(result.rights_status).toBe('permission_needed');

    const evidence = sqlite
      .prepare(
        `SELECT re.evidence_type, re.conclusion, re.evidence_url
         FROM rights_evidence re
         JOIN content_items ci ON ci.id = re.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(result.candidate_id) as Record<string, unknown>;
    expect(evidence.evidence_type).toBe('other');
    expect(evidence.conclusion).toBeNull();
    expect(evidence.evidence_url).toBe('https://commons.wikimedia.org/wiki/File:Example.jpg');

    const publicationCount = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM publication_candidates`)
      .get() as { count: number };
    expect(publicationCount.count).toBe(0);
  });

  it('allocates sequential candidate IDs within an explicit allocation year', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    insertContentItemRow(sqlite, 'lgfc-gehrig-2026-005');

    await expect(allocateMemberSubmissionCandidateId(db, 2026)).resolves.toBe('lgfc-gehrig-2026-006');
  });

  it('uses options.now year for candidate ID allocation', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const parsed = parseMemberSubmissionIntakeBody(validIntakeBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await persistMemberSubmissionIntake(db, parsed.request, {
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2025-12-31T23:59:59.000Z',
    });

    expect(result.candidate_id).toBe('lgfc-gehrig-2025-001');
  });

  it('detects candidate_id unique constraint conflicts for retry handling', () => {
    expect(isCandidateIdUniqueConflict(new Error('UNIQUE constraint failed: content_items.candidate_id'))).toBe(
      true,
    );
    expect(isCandidateIdUniqueConflict(new Error('some other failure'))).toBe(false);
  });

  it('allocates the next free candidate ID when lower sequence numbers are occupied', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    insertContentItemRow(sqlite, 'lgfc-gehrig-2026-006');
    insertContentItemRow(sqlite, 'lgfc-gehrig-2026-007');

    const parsed = parseMemberSubmissionIntakeBody(validIntakeBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await persistMemberSubmissionIntake(db, parsed.request, {
      submitterContact: 'member@example.com',
      memberSubmitterId: 'member@example.com',
      now: '2026-07-06T19:00:00.000Z',
    });

    expect(result.candidate_id).toBe('lgfc-gehrig-2026-008');
  });

  it('returns 401 without member authentication and 400 for invalid payloads', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const unauthenticated = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(validIntakeBody(), 'missing-session'),
    });
    expect(unauthenticated.status).toBe(401);

    const invalid = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(validIntakeBody({ submission_type: 'not_real' })),
    });
    expect(invalid.status).toBe(400);

    const invalidSourceType = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(validIntakeBody({ source_type: 'archive' })),
    });
    expect(invalidSourceType.status).toBe(400);

    const invalidContentType = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(validIntakeBody({ content_type: 'article' })),
    });
    expect(invalidContentType.status).toBe(400);
  });

  it('ignores any client-supplied admin_followup_required and derives it server-side', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const response = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(externalSourceBody({ admin_followup_required: false })),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.admin_followup_required).toBe(true);

    const memberSubmission = sqlite
      .prepare(
        `SELECT ms.admin_followup_required
         FROM member_submissions ms
         JOIN content_items ci ON ci.id = ms.content_item_id
         WHERE ci.candidate_id = ?`,
      )
      .get(body.candidate_id) as { admin_followup_required: number };
    expect(memberSubmission.admin_followup_required).toBe(1);
  });

  it('accepts authenticated intake and omits private fields from the response', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const response = await memberSubmitPost({
      env: { DB: db },
      request: memberPostRequest(validIntakeBody()),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.publication_status).toBe('approved_for_publish');
    expect(body.candidate_id).toMatch(/^lgfc-gehrig-\d{4}-\d{3,}$/);
    expect(body.submitter_contact).toBeUndefined();
    expect(body.ownership_statement).toBeUndefined();
    expect(body.permission_statement).toBeUndefined();
    expect(body.privacy_notes).toBeUndefined();

    const serialized = serializeMemberSubmissionIntakeResponse({
      candidate_id: body.candidate_id,
      input_stream: 'member_submission',
      publication_status: 'approved_for_publish',
      review_status: 'approved_public_candidate',
      rights_status: 'permission_granted',
      admin_followup_required: false,
    });
    expect(JSON.stringify(serialized)).not.toContain('member@example.com');
  });

  it('does not expose intake persistence on public admin-only candidate routes', () => {
    expect(fs.existsSync('functions/api/library/content-pipeline/submit.ts')).toBe(true);
    expect(fs.existsSync('functions/api/content-pipeline/member-submissions.ts')).toBe(false);
    expect(fs.existsSync('functions/api/admin/content-pipeline/member-submissions.ts')).toBe(false);
  });
});
