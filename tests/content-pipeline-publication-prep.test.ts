import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { CandidateRecord } from '../functions/_lib/content-pipeline-candidate-import';
import { PUBLICATION_STATUSES, REVIEW_STATUSES } from '../functions/_lib/content-pipeline-candidate-constants';
import { upsertCandidate } from '../functions/_lib/content-pipeline-candidate-repository';
import {
  buildPublicationPrepViewForCandidate,
  channelForPublicationTarget,
  evaluatePublicationPrepEligibility,
  MEMBER_SUBMISSION_PREP_SOURCE_NAME,
  parsePublicationPrepListQuery,
  resolvePublicationPrepSourceName,
  serializePublicationPrepView,
} from '../functions/_lib/content-pipeline-publication-prep';
import { serializeAdminMediaReferences } from '../functions/_lib/content-pipeline-media-reference';
import { recordRightsEvidence } from '../functions/_lib/rights-evidence-repository';
import { onRequestGet as publicationPrepGet } from '../functions/api/admin/content-pipeline/publication-prep/index';
import { ADMIN_SESSION_COOKIE, seedAdminSession } from './helpers/adminSqliteSession';

function eligibleCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    candidate_id: 'lgfc-gehrig-2026-901',
    input_stream: 'admin_seed',
    title: 'Prep-ready candidate',
    source_name: 'LGFC Operator',
    source_type: 'operator',
    content_type: 'story',
    summary: 'Eligible summary',
    rights_status: 'permission_granted',
    source_trust_status: 'trusted',
    relevance_status: 'relevant',
    review_status: 'approved_public_candidate',
    publication_status: 'draft_candidate',
    publication_target: 'library',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    credit_line: 'LGFC Archives',
    review_priority: 'normal',
    created_at: '2026-07-07T08:00:00.000Z',
    updated_at: '2026-07-07T08:00:00.000Z',
    ...overrides,
  };
}

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

function adminGetRequest(pathname: string, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${pathname}`, { headers });
}

function publicApiFiles(): string[] {
  const apiRoot = path.join(process.cwd(), 'functions/api');
  const results: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'admin') {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
  }

  walk(apiRoot);
  return results;
}

function collectNonAdminApiRouteSegments(dir: string, relParts: string[] = []): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (relParts.length === 0 && entry.name === 'admin') {
        continue;
      }
      results.push(
        ...collectNonAdminApiRouteSegments(path.join(dir, entry.name), [...relParts, entry.name]),
      );
      continue;
    }

    if (entry.name.endsWith('.ts')) {
      results.push([...relParts, entry.name.replace(/\.ts$/, '')].join('/'));
    }
  }

  return results;
}

function importsProtectedModule(source: string, moduleName: string): boolean {
  const patterns = [
    new RegExp(`\\bfrom\\s+['"][^'"]*${moduleName}['"]`, 'm'),
    new RegExp(`\\bimport\\s*\\(\\s*['"][^'"]*${moduleName}['"]`, 'm'),
    new RegExp(`\\bexport\\s+[^;\\n]*\\bfrom\\s+['"][^'"]*${moduleName}['"]`, 'm'),
  ];
  return patterns.some((pattern) => pattern.test(source));
}

describe('content pipeline publication prep (#2324)', () => {
  it('marks fully reviewed candidates as eligible', () => {
    const eligibility = evaluatePublicationPrepEligibility(eligibleCandidate());
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasons).toEqual([]);
  });

  it('blocks ineligible review, rights, privacy, duplicate, and publication states with rationale', () => {
    const rejected = evaluatePublicationPrepEligibility(
      eligibleCandidate({ review_status: 'rejected' }),
    );
    expect(rejected.eligible).toBe(false);
    expect(rejected.reasons).toContain('review_status must be an approved review state');

    const rights = evaluatePublicationPrepEligibility(
      eligibleCandidate({ rights_status: 'permission_needed' }),
    );
    expect(rights.eligible).toBe(false);
    expect(rights.reasons).toContain(
      'rights_status must be permission_granted or public_domain_candidate',
    );

    const privacy = evaluatePublicationPrepEligibility(
      eligibleCandidate({ privacy_review_status: 'pending_review' }),
    );
    expect(privacy.eligible).toBe(false);
    expect(privacy.reasons).toContain('privacy_review_status must be approved or not_applicable');

    const duplicate = evaluatePublicationPrepEligibility(
      eligibleCandidate({ duplicate_of: 'lgfc-gehrig-2026-001' }),
    );
    expect(duplicate.eligible).toBe(false);
    expect(duplicate.reasons).toContain('duplicate_of must be unset before publication prep');

    const notReady = evaluatePublicationPrepEligibility(
      eligibleCandidate({ publication_status: 'not_ready' }),
    );
    expect(notReady.eligible).toBe(false);
    expect(notReady.reasons).toContain(
      'publication_status must be draft_candidate, staged, or approved_for_publish',
    );

    const unpublished = evaluatePublicationPrepEligibility(
      eligibleCandidate({ publication_status: 'unpublished' }),
    );
    expect(unpublished.eligible).toBe(false);
    expect(unpublished.reasons).toContain(
      'publication_status must be draft_candidate, staged, or approved_for_publish',
    );

    const published = evaluatePublicationPrepEligibility(
      eligibleCandidate({ publication_status: 'published', content_inventory_id: 42 }),
    );
    expect(published.eligible).toBe(false);
    expect(published.reasons).toContain(
      'publication_status must be draft_candidate, staged, or approved_for_publish',
    );

    const archived = evaluatePublicationPrepEligibility(
      eligibleCandidate({ publication_status: 'archived' }),
    );
    expect(archived.eligible).toBe(false);
    expect(archived.reasons).toContain(
      'publication_status must be draft_candidate, staged, or approved_for_publish',
    );
  });

  it('blocks member submissions without granted consent', () => {
    const eligibility = evaluatePublicationPrepEligibility(
      eligibleCandidate({ input_stream: 'member_submission' }),
      {
        submission_type: 'story',
        consent_status: 'pending',
        credit_preference: 'public_credit',
        admin_followup_required: true,
      },
    );

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain('member submissions require consent_status granted');
  });

  it('serializes admin-safe publication prep views without private member fields or PII source_name', () => {
    const candidate = eligibleCandidate({
      input_stream: 'member_submission',
      source_name: 'Jane Q. Submitter',
      provenance_notes: 'private operator notes',
      admin_notes: 'internal only',
    });
    const eligibility = evaluatePublicationPrepEligibility(candidate, {
      submission_type: 'story',
      consent_status: 'granted',
      credit_preference: 'anonymous',
      admin_followup_required: false,
    });
    const view = serializePublicationPrepView({
      candidate: {
        ...candidate,
        id: 1,
        tags: { people: ['Lou Gehrig'], topics: [], places: [] },
        submitter_name: 'Jane Q. Submitter',
        submitter_contact: 'jane@example.com',
        privacy_notes: 'do not publish donor address',
      } as typeof candidate & {
        id: number;
        tags: { people: string[]; topics: string[]; places: string[] };
        submitter_name: string;
        submitter_contact: string;
        privacy_notes: string;
      },
      mediaReferences: serializeAdminMediaReferences(candidate),
      eligibility,
      memberSubmission: {
        submission_type: 'story',
        consent_status: 'granted',
        credit_preference: 'anonymous',
        admin_followup_required: false,
      },
    });

    expect(view.candidate_id).toBe('lgfc-gehrig-2026-901');
    expect(view.source_name).toBe(MEMBER_SUBMISSION_PREP_SOURCE_NAME);
    expect(view.source_name).not.toBe('Jane Q. Submitter');
    expect(resolvePublicationPrepSourceName(candidate)).toBe(MEMBER_SUBMISSION_PREP_SOURCE_NAME);
    expect(view.member_submission?.consent_status).toBe('granted');
    expect(view).not.toHaveProperty('admin_notes');
    expect(view).not.toHaveProperty('provenance_notes');
    expect(view).not.toHaveProperty('submitter_name');
    expect(view).not.toHaveProperty('submitter_contact');
    expect(view).not.toHaveProperty('privacy_notes');
  });

  it('parses publication prep list query, defaults to eligible_only, and rejects invalid filters', () => {
    const parsed = parsePublicationPrepListQuery(
      new URL('https://example.com/api/admin/content-pipeline/publication-prep?limit=25'),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.filter.limit).toBe(25);
      expect(parsed.filter.eligible_only).toBe(true);
    }

    const invalidReview = parsePublicationPrepListQuery(
      new URL('https://example.com/api/admin/content-pipeline/publication-prep?review_status=not_real'),
    );
    expect(invalidReview.ok).toBe(false);
    if (!invalidReview.ok) {
      expect(invalidReview.error).toBe('Invalid review_status filter.');
    }

    const invalidPublication = parsePublicationPrepListQuery(
      new URL(
        'https://example.com/api/admin/content-pipeline/publication-prep?publication_status=not_real',
      ),
    );
    expect(invalidPublication.ok).toBe(false);
    if (!invalidPublication.ok) {
      expect(invalidPublication.error).toBe('Invalid publication_status filter.');
    }

    expect(REVIEW_STATUSES.has('approved_public_candidate')).toBe(true);
    expect(PUBLICATION_STATUSES.has('draft_candidate')).toBe(true);
  });

  it('returns 401 without admin authorization', async () => {
    const response = await publicationPrepGet({
      env: { DB: {} },
      request: adminGetRequest('/api/admin/content-pipeline/publication-prep', null),
    });

    expect(response.status).toBe(401);
  });

  it('lists eligible candidates and returns ineligible detail with rationale', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(db, eligibleCandidate({ candidate_id: 'lgfc-gehrig-2026-911' }));
    await upsertCandidate(
      db,
      eligibleCandidate({
        candidate_id: 'lgfc-gehrig-2026-912',
        review_status: 'pending_review',
        publication_status: 'not_ready',
      }),
    );

    const listResponse = await publicationPrepGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/publication-prep'),
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.ok).toBe(true);
    expect(listBody.count).toBe(1);
    expect(listBody.publication_prep[0].candidate_id).toBe('lgfc-gehrig-2026-911');
    expect(listBody.publication_prep[0].eligibility.eligible).toBe(true);

    const detailResponse = await publicationPrepGet({
      env: { DB: db },
      request: adminGetRequest(
        '/api/admin/content-pipeline/publication-prep?candidate_id=lgfc-gehrig-2026-912',
      ),
    });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.publication_prep.eligibility.eligible).toBe(false);
    expect(detailBody.publication_prep.eligibility.reasons.length).toBeGreaterThan(0);
  });

  it('paginates eligible-only results after eligibility filtering', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(
      db,
      eligibleCandidate({
        candidate_id: 'lgfc-gehrig-2026-921',
        review_status: 'pending_review',
        publication_status: 'not_ready',
        updated_at: '2026-07-07T08:03:00.000Z',
      }),
    );
    await upsertCandidate(
      db,
      eligibleCandidate({
        candidate_id: 'lgfc-gehrig-2026-922',
        updated_at: '2026-07-07T08:02:00.000Z',
      }),
    );
    await upsertCandidate(
      db,
      eligibleCandidate({
        candidate_id: 'lgfc-gehrig-2026-923',
        updated_at: '2026-07-07T08:01:00.000Z',
      }),
    );

    const pageOne = await publicationPrepGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/publication-prep?limit=1&offset=0'),
    });
    expect(pageOne.status).toBe(200);
    const pageOneBody = await pageOne.json();
    expect(pageOneBody.count).toBe(1);
    expect(pageOneBody.publication_prep[0].candidate_id).toBe('lgfc-gehrig-2026-922');

    const pageTwo = await publicationPrepGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/publication-prep?limit=1&offset=1'),
    });
    const pageTwoBody = await pageTwo.json();
    expect(pageTwoBody.count).toBe(1);
    expect(pageTwoBody.publication_prep[0].candidate_id).toBe('lgfc-gehrig-2026-923');
  });

  it('does not expose publication prep routes on public API surfaces', () => {
    for (const filePath of publicApiFiles()) {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(importsProtectedModule(source, 'content-pipeline-publication-prep')).toBe(false);
    }
  });

  it('does not write moderation events when publication prep views are listed or fetched', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedAdminSession(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    await upsertCandidate(db, eligibleCandidate({ candidate_id: 'lgfc-gehrig-2026-931' }));

    const beforeCount = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM moderation_events`)
      .get() as { count: number };

    const listResponse = await publicationPrepGet({
      env: { DB: db },
      request: adminGetRequest('/api/admin/content-pipeline/publication-prep'),
    });
    expect(listResponse.status).toBe(200);

    const detailResponse = await publicationPrepGet({
      env: { DB: db },
      request: adminGetRequest(
        '/api/admin/content-pipeline/publication-prep?candidate_id=lgfc-gehrig-2026-931',
      ),
    });
    expect(detailResponse.status).toBe(200);

    const afterCount = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM moderation_events`)
      .get() as { count: number };
    expect(afterCount.count).toBe(beforeCount.count);
  });

  it('channelForPublicationTarget maps #3552 targets to #3551 channels', () => {
    expect(channelForPublicationTarget('social')).toBe('social_media');
    expect(channelForPublicationTarget('newsletter')).toBe('newsletter_email');
    expect(channelForPublicationTarget('lou_gehrig_day')).toBe('fundraiser_campaign');
    expect(channelForPublicationTarget('internal_reference_only')).toBe('internal_archive_only');
    for (const websiteTarget of [
      'biography',
      'timeline',
      'gallery',
      'library',
      'memorabilia',
      'article',
      'homepage_feature',
    ]) {
      expect(channelForPublicationTarget(websiteTarget)).toBe('website');
    }
    expect(channelForPublicationTarget(null)).toBeNull();
    expect(channelForPublicationTarget('not_a_real_target')).toBeNull();
  });

  describe('channel-scoped rights gate for scheduled_discovery candidates (#3657 / #3551 2026-08-18)', () => {
    function discoveryCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
      return eligibleCandidate({
        input_stream: 'scheduled_discovery',
        source_type: 'library',
        rights_status: 'permission_granted',
        ...overrides,
      });
    }

    it('denies the gate directly when the conclusion covers a different channel than publication_target', () => {
      // publication_target='social' maps to channel 'social_media', but only
      // a 'website' conclusion was found -- channelConclusionFound reflects
      // that mismatch as false.
      const eligibility = evaluatePublicationPrepEligibility(
        discoveryCandidate({ publication_target: 'social' }),
        null,
        false,
      );
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.gates.channel_rights_evidence.pass).toBe(false);
      expect(eligibility.reasons).toContain(
        "rights_evidence must carry a conclusion for the candidate's specific publication_target channel (scheduled_discovery only)",
      );
    });

    it('passes the gate directly when publication_target maps to a channel with a found conclusion', () => {
      const eligibility = evaluatePublicationPrepEligibility(
        discoveryCandidate({ publication_target: 'library' }),
        null,
        true,
      );
      expect(eligibility.gates.channel_rights_evidence.pass).toBe(true);
      expect(eligibility.eligible).toBe(true);
    });

    it('is a no-op for member_submission candidates regardless of channelConclusionFound', () => {
      const memberContext = {
        submission_type: 'story' as const,
        consent_status: 'granted',
        credit_preference: 'public_credit',
        admin_followup_required: false,
      };
      const withFalse = evaluatePublicationPrepEligibility(
        eligibleCandidate({ input_stream: 'member_submission', publication_target: 'social' }),
        memberContext,
        false,
      );
      expect(withFalse.gates.channel_rights_evidence.pass).toBe(true);

      const withNull = evaluatePublicationPrepEligibility(
        eligibleCandidate({ input_stream: 'member_submission', publication_target: 'social' }),
        memberContext,
        null,
      );
      expect(withNull.gates.channel_rights_evidence.pass).toBe(true);
    });

    it('is a no-op for admin_seed and public_research candidates regardless of channelConclusionFound', () => {
      for (const inputStream of ['admin_seed', 'public_research'] as const) {
        const eligibility = evaluatePublicationPrepEligibility(
          eligibleCandidate({ input_stream: inputStream, publication_target: 'social' }),
          null,
          false,
        );
        expect(eligibility.gates.channel_rights_evidence.pass).toBe(true);
      }
    });

    it('end-to-end: a scheduled_discovery candidate with a conclusion recorded only for website fails when publication_target is social, and passes when publication_target maps to website', async () => {
      const sqlite = new DatabaseSync(':memory:');
      applyRepoMigrations(sqlite);
      const db = wrapSqliteAsD1(sqlite);

      const candidate = await upsertCandidate(
        db,
        discoveryCandidate({ candidate_id: 'lgfc-gehrig-2026-941', publication_target: 'social' }),
      );
      await recordRightsEvidence(db, {
        content_item_id: candidate.id,
        evidence_type: 'loc_statement',
        reviewer: 'Bill',
        conclusion: 'public_domain_confirmed',
        conclusion_rationale: 'LOC advisory + pre-1931 publication.',
        channel: 'website',
      });

      const socialView = await buildPublicationPrepViewForCandidate(db, candidate);
      expect(socialView.eligibility.gates.channel_rights_evidence.pass).toBe(false);
      expect(socialView.eligibility.eligible).toBe(false);

      // Same candidate, but re-targeted at a publication_target that maps to
      // the 'website' channel the conclusion actually covers.
      const websiteCandidate = { ...candidate, publication_target: 'library' };
      const websiteView = await buildPublicationPrepViewForCandidate(db, websiteCandidate);
      expect(websiteView.eligibility.gates.channel_rights_evidence.pass).toBe(true);
      expect(websiteView.eligibility.eligible).toBe(true);
    });

    it('regression safety: a member_submission candidate with no rights_evidence rows at all is unaffected by the new gate', async () => {
      const sqlite = new DatabaseSync(':memory:');
      applyRepoMigrations(sqlite);
      const db = wrapSqliteAsD1(sqlite);

      const candidate = await upsertCandidate(
        db,
        eligibleCandidate({
          candidate_id: 'lgfc-gehrig-2026-942',
          input_stream: 'member_submission',
          publication_target: 'social',
        }),
      );
      sqlite
        .prepare(
          `INSERT INTO member_submissions (
            content_item_id, submission_type, ownership_statement, permission_statement,
            credit_preference, consent_status, admin_followup_required
          ) VALUES (?, 'story', 'I own this', 'granted for LGFC use', 'public_credit', 'granted', 0)`,
        )
        .run(candidate.id);

      const view = await buildPublicationPrepViewForCandidate(db, candidate);
      // Governed purely by the pre-existing rights_status-based gate, as
      // before -- the new channel gate must not add or change any reason.
      expect(view.eligibility.gates.channel_rights_evidence.pass).toBe(true);
      expect(view.eligibility.eligible).toBe(true);
    });
  });

  it('does not register publication-prep route segments under non-admin API paths', () => {
    const apiRoot = path.join(process.cwd(), 'functions/api');
    const nonAdminRoutes = collectNonAdminApiRouteSegments(apiRoot);

    for (const routeSegment of nonAdminRoutes) {
      expect(routeSegment).not.toMatch(/publication-prep/i);
    }

    expect(fs.existsSync('functions/api/admin/content-pipeline/publication-prep/index.ts')).toBe(true);
    expect(fs.existsSync('functions/api/content-pipeline/publication-prep.ts')).toBe(false);
    expect(fs.existsSync('functions/api/content-pipeline/publication-prep/index.ts')).toBe(false);
  });
});
