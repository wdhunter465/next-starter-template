import { describe, expect, it, vi } from 'vitest';

import { onRequestGet as searchGet } from '../functions/api/search';
import { fetchRotationEligibleRows } from '../functions/_lib/content-inventory-rotation';
import { BOOK_RECORDS, buildCanonicalFields } from '../scripts/ci/library_books_content_load_3451.mjs';
import {
  TARGET_SECTIONS_JSON,
  buildRollbackSql,
  buildStatementsForPlan,
  buildUpdateAllowedSectionsStatement,
  isApplyMode,
  mergeLibraryAndSearch,
  parseAllowedSections,
  planSearchEligibility,
  refuseProductionTarget,
  requireEnv,
  searchEligibleCountQuery,
} from '../scripts/ci/library_books_search_eligibility_3455.mjs';

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
        if (sql.includes('FROM faq_entries') || sql.includes('FROM events') || sql.includes('FROM milestones') || sql.includes('FROM friends') || sql.includes('FROM discussions') || sql.includes('FROM photos')) {
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
            if (sql.includes("!= ''") && (!String(row.source_name || '').trim() || !String(row.credit_line || '').trim())) {
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

describe('#3455 Dev search eligibility helpers', () => {
  it('refuses Production target and requires only Dev credentials', () => {
    expect(refuseProductionTarget({ TARGET: 'prod' })).toBe(true);
    expect(refuseProductionTarget({ TARGET: 'dev' })).toBe(false);
    expect(refuseProductionTarget({})).toBe(false);
    expect(requireEnv({})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'D1_DEV_DATABASE_NAME',
      'D1_DEV_DATABASE_ID',
    ]);
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'confirm' })).toBe(true);
    expect(isApplyMode({ MODE: 'apply' })).toBe(false);
  });

  it('adds search while preserving library and rejects club_home', () => {
    expect(parseAllowedSections('["library"]').ok).toBe(true);
    const merged = mergeLibraryAndSearch(['library']);
    expect(merged).toEqual({
      ok: true,
      next: TARGET_SECTIONS_JSON,
      changed: true,
      previous: '["library"]',
    });
    expect(mergeLibraryAndSearch(['library', 'search']).changed).toBe(false);
    expect(mergeLibraryAndSearch(['library', 'club_home']).ok).toBe(false);
    expect(mergeLibraryAndSearch(['search']).code).toBe('MISSING_LIBRARY_ELIGIBILITY');
  });

  it('plans updates for library-only rows and noops when search is already present', () => {
    const libraryOnly = inventoryFromBooks('["library"]');
    const planned = planSearchEligibility(libraryOnly);
    expect(planned.summary).toEqual({ insert: 0, update: 6, noop: 0, conflict: 0 });
    expect(planned.plans.every((item) => item.next === TARGET_SECTIONS_JSON)).toBe(true);

    const alreadySearch = inventoryFromBooks(TARGET_SECTIONS_JSON);
    const noop = planSearchEligibility(alreadySearch);
    expect(noop.summary).toEqual({ insert: 0, update: 0, noop: 6, conflict: 0 });
  });

  it('fail-closes on missing records, title collision, and unexpected status', () => {
    const rows = inventoryFromBooks('["library"]').slice(1);
    expect(planSearchEligibility(rows).summary.conflict).toBe(1);
    expect(planSearchEligibility(rows).plans[0].exceptionCode).toBe('MISSING_RECORD');

    const collided = inventoryFromBooks('["library"]');
    collided[0].title = 'Wrong title';
    expect(planSearchEligibility(collided).plans[0].exceptionCode).toBe('TAG_COLLISION_NON_MATCHING_TITLE');

    const draft = inventoryFromBooks('["library"]');
    draft[0].status = 'draft';
    expect(planSearchEligibility(draft).plans[0].exceptionCode).toBe('UNEXPECTED_STATUS');

    const duplicates = inventoryFromBooks('["library"]');
    duplicates.push({ ...duplicates[0], id: 99 });
    expect(planSearchEligibility(duplicates).plans[0].exceptionCode).toBe('DUPLICATE_CANONICAL_TAG');
  });

  it('builds id/tag/title-scoped UPDATE statements and rollback that restore prior allowed_sections', () => {
    const planned = planSearchEligibility(inventoryFromBooks('["library"]'));
    const sql = buildUpdateAllowedSectionsStatement(planned.plans[0], new Set(['allowed_sections', 'updated_at']));
    expect(sql).toContain("allowed_sections = '[\"library\",\"search\"]'");
    expect(sql).toContain("tag = 'library-book-luckiest-man-eig'");
    expect(sql).toContain('canonical = 1');
    expect(sql).toContain("status = 'published'");
    expect(sql).toContain("AND allowed_sections = '[\"library\"]'");
    expect(buildStatementsForPlan(planned, new Set(['allowed_sections']))).toHaveLength(6);

    const rollback = buildRollbackSql(planned);
    expect(rollback).toContain("allowed_sections = '[\"library\"]'");
    expect(rollback).not.toContain('DELETE FROM content_inventory');
    expect(searchEligibleCountQuery()).toContain('%search%');
    expect(searchEligibleCountQuery()).toContain('%library%');
  });
});

describe('#3455 public Archive search after Dev eligibility', () => {
  it('does not return Archive hits for library-only books', async () => {
    const { db } = makeBookDb('["library"]');
    const response = await searchGet({
      request: request('/api/search?q=gehrig'),
      env: { DB: db },
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.results.filter((result) => result.type === 'Archive')).toHaveLength(0);
  });

  it('finds all six books on the public Archive/search path after search eligibility is added', async () => {
    const { db } = makeBookDb(TARGET_SECTIONS_JSON);
    const gehrig = await searchGet({
      request: request('/api/search?q=gehrig'),
      env: { DB: db },
    });
    const gehrigPayload = await gehrig.json();
    const archiveHits = gehrigPayload.results.filter((result) => result.type === 'Archive');
    expect(archiveHits).toHaveLength(6);
    expect(archiveHits.every((hit) => hit.url === '/fanclub/library?q=gehrig')).toBe(true);

    const eig = await searchGet({
      request: request('/api/search?q=eig'),
      env: { DB: db },
    });
    const eigPayload = await eig.json();
    expect(eigPayload.results.some((result) => result.title.includes('Luckiest Man'))).toBe(true);

    const kashatus = await searchGet({
      request: request('/api/search?q=kashatus'),
      env: { DB: db },
    });
    const kashatusPayload = await kashatus.json();
    expect(kashatusPayload.results.some((result) => String(result.title).includes('Kashatus') || String(result.title).includes('Biography'))).toBe(true);

    const iron = await searchGet({
      request: request('/api/search?q=iron%20horse'),
      env: { DB: db },
    });
    const ironPayload = await iron.json();
    expect(ironPayload.results.some((result) => result.title.includes('Iron Horse'))).toBe(true);
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
