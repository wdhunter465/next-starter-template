import { describe, expect, it, vi } from 'vitest';

import {
  librarySearchDestination,
  mapLibraryInventoryItem,
  sanitizePublicHttpUrl,
} from '../functions/_lib/content-inventory-public';
import { fetchRotationEligibleRows } from '../functions/_lib/content-inventory-rotation';
import { onRequestGet as searchGet } from '../functions/api/search';
import { BOOK_RECORDS, buildCanonicalFields } from '../scripts/ci/library_books_content_load_3451.mjs';

function inventoryFromBooks() {
  return BOOK_RECORDS.map((book: Record<string, unknown>, index: number) => ({
    id: index + 1,
    ...buildCanonicalFields(book),
    updated_at: '2026-08-14T00:00:00Z',
  }));
}

function memberRequest(path: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { Cookie: 'lgfc_session=session-1' },
  });
}

function makeBookDb() {
  const inventory = inventoryFromBooks();
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

  function rowMatches(row: Record<string, unknown>, needle: string): boolean {
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
    prepare: vi.fn((sql: string) => {
      const allFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          return { results: tableNames.map((name) => ({ name })) };
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

      const firstFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const table = String(args[0] || '');
          return tableNames.includes(table) ? { name: table } : null;
        }
        if (sql.includes('FROM member_sessions')) return { email: 'member@example.com' };
        if (sql.includes('COUNT(1)') && sql.includes('FROM content_inventory')) {
          const { results } = await allFn(args);
          return { n: results.length };
        }
        return null;
      };

      return {
        all: () => allFn(),
        first: () => firstFn(),
        bind: (...bindArgs: unknown[]) => ({
          all: () => allFn(bindArgs),
          first: () => firstFn(bindArgs),
        }),
      };
    }),
  };

  return { db, inventory };
}

describe('#3453 populated six-book Library QA', () => {
  it('maps all six canonical books with credit, source, and https bibliographic URLs', () => {
    const items = inventoryFromBooks().map((row: Record<string, unknown>) => mapLibraryInventoryItem(row));
    expect(items).toHaveLength(6);
    expect(items.map((item) => item.title)).toEqual(BOOK_RECORDS.map((book: { title: string }) => book.title));
    for (const item of items) {
      expect(item.author).toBeTruthy();
      expect(item.source_name).toBeTruthy();
      expect(item.source_url).toMatch(/^https:\/\//);
      expect(item.content).toBeTruthy();
    }
  });

  it('rejects unsafe source URLs instead of rendering them', () => {
    expect(sanitizePublicHttpUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizePublicHttpUrl('data:text/html,hi')).toBeNull();
    expect(sanitizePublicHttpUrl('/relative')).toBeNull();
    expect(sanitizePublicHttpUrl('https://www.simonandschuster.com/books/Lou-Gehrig/Alan-D-Gaff/9781982132392')).toBe(
      'https://www.simonandschuster.com/books/Lou-Gehrig/Alan-D-Gaff/9781982132392',
    );
    expect(sanitizePublicHttpUrl('https://user:pass@example.com/secret')).toBeNull();
    expect(sanitizePublicHttpUrl('https://trusted.com@evil.example/phishing')).toBeNull();
  });

  it('keeps Library credit strictly on credit_line now that source_name is its own field', () => {
    const mapped = mapLibraryInventoryItem({
      id: 9,
      title: 'Untitled story',
      text: 'Body',
      source_name: 'Publisher record',
      credit_line: '   ',
      source_url: 'https://example.com/book',
      event_year: 2005,
    });
    expect(mapped.author).toBeNull();
    expect(mapped.source_name).toBe('Publisher record');
    expect(mapped.source_url).toBe('https://example.com/book');
  });

  it('points search destinations at the Library query so results are not a generic empty landing', () => {
    expect(librarySearchDestination('Gehrig')).toBe('/fanclub/library?q=Gehrig');
    expect(librarySearchDestination('')).toBe('/fanclub/library');
  });

  it('discovers all six books through Library rotation search by Gehrig, author surname, and title fragment', async () => {
    const { db } = makeBookDb();
    const gehrig = await fetchRotationEligibleRows(db, { sectionKey: 'library', q: 'gehrig' });
    expect(gehrig).toHaveLength(6);

    const eig = await fetchRotationEligibleRows(db, { sectionKey: 'library', q: 'eig' });
    expect(eig.map((row) => row.title)).toContain('Luckiest Man: The Life and Death of Lou Gehrig');

    const iron = await fetchRotationEligibleRows(db, { sectionKey: 'library', q: 'iron horse' });
    expect(iron).toHaveLength(1);
    expect(iron[0]?.title).toBe('Iron Horse: Lou Gehrig in His Time');
  });

  it('returns member search Library hits with query destinations for the populated books', async () => {
    const { db } = makeBookDb();
    const response = await searchGet({
      request: memberRequest('/api/search?q=gehrig'),
      env: { DB: db },
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    const libraryHits = payload.results.filter((result: { type: string }) => result.type === 'Library');
    expect(libraryHits).toHaveLength(6);
    expect(libraryHits.every((hit: { url: string }) => hit.url === '/fanclub/library?q=gehrig')).toBe(true);
  });
});
