// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RIGHTS_AUDIT_COLUMNS,
  RIGHTS_AUDIT_MAX_ROWS,
  RightsAuditQueryError,
  buildRightsAuditReport,
  neutraliseFormula,
  parseRightsAuditQuery,
  rightsAuditCsv,
  rightsAuditFilename,
} from '../functions/_lib/rights-audit-report';

const authMock = vi.hoisted(() => ({ deny: null as Response | null }));
vi.mock('../functions/_lib/auth', () => ({
  requireAdmin: async () => authMock.deny,
}));

import { onRequestGet } from '../functions/api/admin/rights-audit-report';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/** Minimal D1-shaped adapter over node:sqlite: prepare(sql).bind(...).all() -> { results }. */
function d1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return { all: async () => ({ results: db.prepare(sql).all(...(params as any[])) }) };
        },
      };
    },
  };
}

interface ItemOptions {
  candidateId: string;
  sourceUrl: string | null;
  domain?: string;
  title?: string;
  createdAt: string;
  creditLine?: string;
  adminNotes?: string;
}

function insertItem(db: DatabaseSync, o: ItemOptions): number {
  const info = db
    .prepare(
      `INSERT INTO content_items (
        candidate_id, input_stream, title, source_url, source_name, source_domain, source_type,
        content_type, summary, rights_status, source_trust_status, relevance_status, review_status,
        publication_status, privacy_flag, privacy_review_status, review_priority, credit_line,
        admin_notes, created_at
      ) VALUES (
        ?, 'public_research', ?, ?, 'Library of Congress', ?, 'archive',
        'photo', 'summary', 'unknown', 'pending', 'pending', 'pending_review',
        'not_ready', 'none', 'not_applicable', 'normal', ?, ?, ?
      )`,
    )
    .run(
      o.candidateId,
      o.title ?? 'Gehrig at bat',
      o.sourceUrl,
      o.domain ?? 'loc.gov',
      o.creditLine ?? 'Library of Congress',
      o.adminNotes ?? 'INTERNAL NOTE do not share',
      o.createdAt,
    );
  return Number(info.lastInsertRowid);
}

function insertEvidence(db: DatabaseSync, itemId: number, text: string, recordedAt: string) {
  db.prepare(
    `INSERT INTO rights_evidence (
       content_item_id, evidence_type, evidence_text, reviewer, recorded_at, contact_info, usage_decision
     ) VALUES (?, 'loc_statement', ?, 'Reviewer Person', ?, 'person@example.org', 'hold')`,
  ).run(itemId, text, recordedAt);
}

describe('parseRightsAuditQuery', () => {
  const now = new Date('2026-11-03T12:00:00.000Z');

  it('defaults to every source as of now', () => {
    expect(parseRightsAuditQuery(null, null, now)).toEqual({ domain: null, asOf: '2026-11-03T12:00:00.000Z' });
  });

  it('lowercases the domain and extends a date-only as_of to the end of that day', () => {
    expect(parseRightsAuditQuery(' LOC.gov ', '2026-10-31', now)).toEqual({
      domain: 'loc.gov',
      asOf: '2026-10-31T23:59:59.999Z',
    });
  });

  it('accepts a UTC timestamp', () => {
    expect(parseRightsAuditQuery(null, '2026-10-31T08:30:00Z', now).asOf).toBe('2026-10-31T08:30:00Z');
  });

  it.each([
    ["loc.gov' OR 1=1 --", null],
    ['loc gov', null],
    ['-bad.example', null],
    [null, 'yesterday'],
    [null, '2026-13-45'],
    [null, '2026-10-31T08:30:00+05:00'],
  ])('rejects %s / %s', (domain, asOf) => {
    expect(() => parseRightsAuditQuery(domain, asOf, now)).toThrow(RightsAuditQueryError);
  });
});

describe('buildRightsAuditReport', () => {
  it('returns only the share-safe columns, never notes, reviewer or contact details', async () => {
    const db = migratedDb();
    const id = insertItem(db, { candidateId: 'a', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    insertEvidence(db, id, 'No known restrictions on publication.', '2026-10-14T11:00:00.000Z');

    const report = await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'));
    expect(report.rows).toHaveLength(1);
    expect(Object.keys(report.rows[0])).toEqual([...RIGHTS_AUDIT_COLUMNS]);

    const serialised = JSON.stringify(report.rows);
    expect(serialised).not.toContain('INTERNAL NOTE');
    expect(serialised).not.toContain('Reviewer Person');
    expect(serialised).not.toContain('person@example.org');
    expect(report.rows[0]).toMatchObject({
      candidate_id: 'a',
      date_collected: '2026-10-14T10:00:00.000Z',
      origin_statement: 'No known restrictions on publication.',
      statement_captured_at: '2026-10-14T11:00:00.000Z',
      credit_line: 'Library of Congress',
    });
  });

  it('shows the layer defaults: nothing is permitted until CMG, MLB and the Yankees confirm', async () => {
    const db = migratedDb();
    insertItem(db, { candidateId: 'a', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    const [row] = (await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'))).rows;
    expect(row).toMatchObject({
      origin_permission: 'not_permitted',
      cmg_permission: 'for_admin_review',
      mlb_permission: 'for_admin_review',
      yankees_permission: 'for_admin_review',
      privacy_status: 'for_admin_review',
      final_status: 'not_permitted',
    });
  });

  it('uses the latest evidence row for a record', async () => {
    const db = migratedDb();
    const id = insertItem(db, { candidateId: 'a', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    insertEvidence(db, id, 'first statement', '2026-10-14T11:00:00.000Z');
    insertEvidence(db, id, 'second statement', '2026-10-20T11:00:00.000Z');
    const [row] = (await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'))).rows;
    expect(row.origin_statement).toBe('second statement');
  });

  it('filters by source domain', async () => {
    const db = migratedDb();
    insertItem(db, { candidateId: 'a', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    insertItem(db, { candidateId: 'b', sourceUrl: 'https://archive.org/b', domain: 'archive.org', createdAt: '2026-10-15T10:00:00.000Z' });
    const loc = await buildRightsAuditReport(d1(db), parseRightsAuditQuery('loc.gov', '2026-11-03'));
    expect(loc.rows.map((r) => r.candidate_id)).toEqual(['a']);
    const all = await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'));
    expect(all.rows.map((r) => r.candidate_id)).toEqual(['a', 'b']);
  });

  it('honors the as-of date: later records are left out and a later replacement does not hide the earlier one', async () => {
    const db = migratedDb();
    insertItem(db, { candidateId: 'old', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    insertItem(db, { candidateId: 'new', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-25T10:00:00.000Z' });

    const before = await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-10-20'));
    expect(before.rows.map((r) => r.candidate_id)).toEqual(['old']);

    const after = await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'));
    expect(after.rows.map((r) => r.candidate_id)).toEqual(['new']);
  });

  it('keeps a record that has no origin URL', async () => {
    const db = migratedDb();
    insertItem(db, { candidateId: 'n', sourceUrl: null, createdAt: '2026-10-14T10:00:00.000Z' });
    const report = await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'));
    expect(report.rows.map((r) => r.candidate_id)).toEqual(['n']);
  });

  it('flags truncation instead of silently dropping rows', async () => {
    const fake = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: Array.from({ length: RIGHTS_AUDIT_MAX_ROWS + 1 }, (_, i) => ({ candidate_id: `c${i}` })),
          }),
        }),
      }),
    };
    const report = await buildRightsAuditReport(fake, parseRightsAuditQuery(null, '2026-11-03'));
    expect(report.truncated).toBe(true);
    expect(report.rows).toHaveLength(RIGHTS_AUDIT_MAX_ROWS);
  });
});

describe('CSV output', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(neutraliseFormula('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(neutraliseFormula('+1')).toBe("'+1");
    expect(neutraliseFormula('-2')).toBe("'-2");
    expect(neutraliseFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutraliseFormula('Gehrig')).toBe('Gehrig');
    expect(neutraliseFormula('2026-10-14T10:00:00.000Z')).toBe('2026-10-14T10:00:00.000Z');
  });

  it('writes the header, quotes commas, quotes and newlines, and neutralises formulas', async () => {
    const db = migratedDb();
    const id = insertItem(db, {
      candidateId: 'a',
      sourceUrl: 'https://www.loc.gov/item/a',
      title: '=cmd|\' /C calc\'!A0',
      createdAt: '2026-10-14T10:00:00.000Z',
    });
    insertEvidence(db, id, 'Line one,\nline "two"', '2026-10-14T11:00:00.000Z');
    const report = await buildRightsAuditReport(d1(db), parseRightsAuditQuery(null, '2026-11-03'));
    const csv = rightsAuditCsv(report.rows);
    expect(csv.split('\n')[0]).toBe(RIGHTS_AUDIT_COLUMNS.join(','));
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).not.toMatch(/(^|,)=cmd/);
    expect(csv).toContain('"Line one,\nline ""two"""');
  });

  it('writes only the header for an empty report', () => {
    expect(rightsAuditCsv([])).toBe(`${RIGHTS_AUDIT_COLUMNS.join(',')}\n`);
  });

  it('names the file by source and as-of date', () => {
    expect(rightsAuditFilename({ domain: 'loc.gov', asOf: '2026-10-31T23:59:59.999Z' }, 'csv')).toBe('rights-audit-loc.gov-2026-10-31.csv');
    expect(rightsAuditFilename({ domain: null, asOf: '2026-10-31T23:59:59.999Z' }, 'json')).toBe('rights-audit-all-sources-2026-10-31.json');
  });
});

describe('GET /api/admin/rights-audit-report', () => {
  beforeEach(() => {
    authMock.deny = null;
  });

  function request(query = '') {
    return new Request(`https://example.test/api/admin/rights-audit-report${query}`);
  }

  it('fails closed without an admin session', async () => {
    authMock.deny = new Response('{"ok":false}', { status: 401 });
    const res = await onRequestGet({ request: request(), env: { DB: d1(migratedDb()) } });
    expect(res.status).toBe(401);
  });

  it('returns 503 when D1 is not bound', async () => {
    const res = await onRequestGet({ request: request(), env: {} });
    expect(res.status).toBe(503);
  });

  it('rejects a bad format, domain and date with 400', async () => {
    const env = { DB: d1(migratedDb()) };
    expect((await onRequestGet({ request: request('?format=xml'), env })).status).toBe(400);
    expect((await onRequestGet({ request: request("?domain=a';DROP TABLE x"), env })).status).toBe(400);
    expect((await onRequestGet({ request: request('?as_of=soon'), env })).status).toBe(400);
  });

  it('serves a private, non-cached CSV attachment', async () => {
    const db = migratedDb();
    insertItem(db, { candidateId: 'a', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    const res = await onRequestGet({ request: request('?domain=loc.gov&as_of=2026-11-03'), env: { DB: d1(db) } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="rights-audit-loc.gov-2026-11-03.csv"');
    expect(res.headers.get('X-Report-Truncated')).toBe('false');
    const text = await res.text();
    expect(text.split('\n')[0]).toBe(RIGHTS_AUDIT_COLUMNS.join(','));
    expect(text).toContain('Gehrig at bat');
    expect(text).not.toContain('INTERNAL NOTE');
  });

  it('serves JSON with the column list and as-of metadata', async () => {
    const db = migratedDb();
    insertItem(db, { candidateId: 'a', sourceUrl: 'https://www.loc.gov/item/a', createdAt: '2026-10-14T10:00:00.000Z' });
    const res = await onRequestGet({ request: request('?format=json&as_of=2026-11-03'), env: { DB: d1(db) } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, domain: null, as_of: '2026-11-03T23:59:59.999Z', truncated: false });
    expect(body.columns).toEqual([...RIGHTS_AUDIT_COLUMNS]);
    expect(body.rows).toHaveLength(1);
  });
});
