import { describe, expect, it, vi } from 'vitest';

import { onRequestGet as searchGet } from '../functions/api/search';
import { fetchRotationEligibleRows } from '../functions/_lib/content-inventory-rotation';
import { BOOK_RECORDS, buildCanonicalFields } from '../scripts/ci/library_books_content_load_3451.mjs';
import {
  TARGET_SECTIONS_JSON,
  buildRollbackSql,
  buildUpdateAllowedSectionsStatement,
  planSearchEligibility,
} from '../scripts/ci/library_books_search_eligibility_3455.mjs';
import {
  BACKUP_EVIDENCE_COMMENT,
  BACKUP_EVIDENCE_ISSUE,
  BACKUP_R2_BUCKET,
  buildResultMarkdown,
  parseTarget,
  refuseDevelopmentTarget,
  requireEnv,
} from '../scripts/ci/library_books_search_eligibility_3456.mjs';

function inventoryFromBooks(allowedSections = '["library"]') {
  return BOOK_RECORDS.map((book, index) => ({
    id: index + 1,
    ...buildCanonicalFields(book),
    allowed_sections: allowedSections,
    updated_at: '2026-08-14T00:00:00Z',
  }));
}

function request(path, member = false) {
  const headers = member ? { Cookie: 'lgfc_session=session-1' } : {};
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers });
}

function makeBookDb(allowedSections = '["library","search"]') {
  const inventory = inventoryFromBooks(allowedSections);
  const tableNames = [
    'content_inventory',
    'library_entries',
    'member_sessions',
    'members',
    'faq_entries',
    'events',
    'milestones',
    'friends',
    'discussions',
    'photos',
  ];

  function rowMatches(row, needle) {
    return [
      row.title,
      row.text,
      row.summary,
      row.search_text,
      row.tag,
      row.source_name,
      row.credit_line,
      row.perspective_label,
    ].some((field) => String(field ?? '').toLowerCase().includes(needle));
  }

  const db = {
    prepare: vi.fn((sql) => {
      const allFn = async (args = []) => {
        if (sql.includes('sqlite_master')) {
          return { results: tableNames.map((name) => ({ name })) };
        }
        if (
          sql.includes('FROM faq_entries') ||
          sql.includes('FROM events') ||
          sql.includes('FROM milestones') ||
          sql.includes('FROM friends') ||
          sql.includes('FROM discussions') ||
          sql.includes('FROM photos')
        ) {
          return { results: [] };
        }
        if (sql.includes('FROM content_inventory')) {
          const needleArg = args.find((arg) => typeof arg === 'string' && String(arg).includes('%'));
          const needle =
            typeof needleArg === 'string' ? needleArg.replace(/%/g, '').toLowerCase() : '';
          let results = inventory.filter((row) => {
            if (sql.includes("status = 'published'") && row.status !== 'published') return false;
            if (sql.includes("LIKE '%library%'") && !String(row.allowed_sections || '').includes('library')) {
              return false;
            }
            if (sql.includes("LIKE '%search%'") && !String(row.allowed_sections || '').includes('search')) {
              return false;
            }
            if (
              sql.includes("!= ''") &&
              (!String(row.source_name || '').trim() || !String(row.credit_line || '').trim())
            ) {
              return false;
            }
            if (needle && !rowMatches(row, needle)) return false;
            return true;
          });
          const limit = args[args.length - 1];
          if (typeof limit === 'number') results = results.slice(0, limit);
          return { results };
        }
        return { results: [] };
      };

      const firstFn = async (args = []) => {
        if (sql.includes('sqlite_master')) {
          const table = String(args[0] || '');
          return tableNames.includes(table) ? { name: table } : null;
        }
        if (sql.includes('FROM member_sessions')) return { email: 'member@example.com' };
        if (sql.includes('COUNT(1)') && sql.includes('FROM content_inventory')) {
          const { results } = await allFn(args);
          return { n: results.length };
        }
        const { results } = await allFn(args);
        return results[0] || null;
      };

      return {
        all: () => allFn(),
        first: () => firstFn(),
        bind: (...bindArgs) => ({
          all: () => allFn(bindArgs),
          first: () => firstFn(bindArgs),
        }),
      };
    }),
  };

  return { db, inventory };
}

describe('#3456 Production search eligibility helpers', () => {
  it('requires TARGET=prod, refuses Development, and requires only Production credentials', () => {
    expect(parseTarget({ TARGET: 'prod' })).toBe('prod');
    expect(parseTarget({ TARGET: 'dev' })).toBe('');
    expect(parseTarget({})).toBe('');
    expect(refuseDevelopmentTarget({ TARGET: 'dev' })).toBe(true);
    expect(refuseDevelopmentTarget({ TARGET: 'preview' })).toBe(true);
    expect(refuseDevelopmentTarget({ TARGET: 'prod' })).toBe(false);
    expect(requireEnv({})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'D1_DATABASE_NAME',
      'D1_DATABASE_ID',
    ]);
  });

  it('cites #3268 backup evidence and does not emit DELETE rollback', () => {
    expect(BACKUP_EVIDENCE_ISSUE).toBe(3268);
    expect(BACKUP_EVIDENCE_COMMENT).toBe('5252882921');
    expect(BACKUP_R2_BUCKET).toBe('lgfc-d1-backups');
    const planned = planSearchEligibility(inventoryFromBooks('["library"]'));
    const sql = buildUpdateAllowedSectionsStatement(planned.plans[0], new Set(['allowed_sections', 'updated_at']));
    expect(sql).toContain("allowed_sections = '[\"library\",\"search\"]'");
    expect(sql).toContain("AND allowed_sections = '[\"library\"]'");
    const rollback = buildRollbackSql(planned);
    expect(rollback).not.toContain('DELETE FROM content_inventory');
    const markdown = buildResultMarkdown({
      checkedAt: '2026-08-14T21:55:00.000Z',
      target: 'prod',
      mode: 'dry-run',
      databaseName: 'lgfc_lite',
      databaseId: '22d0dc3e-ad34-43af-8e6a-2063df1a1e04',
      summary: planned.summary,
      preInventoryCount: 27,
      libraryEligibleCount: 6,
      searchEligibleCount: 0,
      rollbackSql: rollback,
    });
    expect(markdown).toContain('#3268');
    expect(markdown).toContain('lgfc-d1-backups');
    expect(markdown).toContain('Development D1: refused');
  });
});

describe('#3456 public Archive search after Production eligibility', () => {
  it('finds all six books on the public Archive/search path after search eligibility is added', async () => {
    const { db } = makeBookDb(TARGET_SECTIONS_JSON);
    const gehrig = await searchGet({
      request: request('/api/search?q=gehrig'),
      env: { DB: db },
    });
    const gehrigPayload = await gehrig.json();
    const archiveHits = gehrigPayload.results.filter((result) => result.type === 'Archive');
    expect(archiveHits).toHaveLength(6);

    const eig = await searchGet({
      request: request('/api/search?q=eig'),
      env: { DB: db },
    });
    const eigPayload = await eig.json();
    expect(eigPayload.results.some((result) => result.title.includes('Luckiest Man'))).toBe(true);
  });

  it('keeps member Library search green after search is added', async () => {
    const { db } = makeBookDb(TARGET_SECTIONS_JSON);
    const library = await fetchRotationEligibleRows(db, { sectionKey: 'library', q: 'gehrig' });
    expect(library).toHaveLength(6);

    const response = await searchGet({
      request: request('/api/search?q=gehrig', true),
      env: { DB: db },
    });
    const payload = await response.json();
    expect(payload.results.filter((result) => result.type === 'Library')).toHaveLength(6);
    expect(payload.results.filter((result) => result.type === 'Archive')).toHaveLength(6);
  });
});
