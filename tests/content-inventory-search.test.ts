import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildInventorySearchBody,
  fetchSearchInventoryResults,
  formatSearchInventoryTitle,
  publishedInventoryWhere,
  resolveMemberLibrarySearchResults,
  SEARCH_SECTION,
} from '../functions/_lib/content-inventory-public';
import { onRequestGet as searchGet } from '../functions/api/search';

function publicRequest(path: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`);
}

function memberRequest(path: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { Cookie: 'lgfc_session=session-1' },
  });
}

function makeSearchDb(options?: {
  inventory?: Array<Record<string, unknown>>;
  library?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  sessionEmail?: string | null;
}) {
  const inventory = options?.inventory ?? [];
  const library = options?.library ?? [];
  const media = options?.media ?? [];
  const photos = options?.photos ?? [];
  const sessionEmail = options?.sessionEmail ?? 'member@example.com';
  const tableNames = [
    'content_inventory',
    'content_inventory_media',
    'library_entries',
    'photos',
    'member_sessions',
    'members',
    'faq_entries',
    'events',
    'milestones',
    'friends',
    'discussions',
  ];

  function matchesPublishedInventory(sql: string, row: Record<string, unknown>): boolean {
    if (sql.includes("ci.status = 'published'") && row.status !== 'published') return false;
    if (sql.includes("status = 'published'") && row.status !== 'published') return false;
    if (sql.includes("LIKE '%search%'") && !String(row.allowed_sections || '').includes('search')) return false;
    if (sql.includes("LIKE '%library%'") && !String(row.allowed_sections || '').includes('library')) return false;
    if (sql.includes('source_name') && sql.includes("!= ''") && !String(row.source_name || '').trim()) {
      return false;
    }
    if (sql.includes('credit_line') && sql.includes("!= ''") && !String(row.credit_line || '').trim()) {
      return false;
    }
    return true;
  }

  function rowMatchesNeedle(row: Record<string, unknown>, needle: string, mediaText = ''): boolean {
    const fields = [
      row.title,
      row.text,
      row.summary,
      row.search_text,
      row.tag,
      row.source_name,
      row.credit_line,
      row.perspective_label,
      row.event_date,
      row.event_year,
      mediaText,
    ];
    return fields.some((field) => String(field ?? '').toLowerCase().includes(needle));
  }

  function mediaTextForStory(storyId: number): string {
    const associations = media.filter((row) => Number(row.story_id) === storyId);
    return associations
      .map((association) => {
        const photo = photos.find((row) => Number(row.id) === Number(association.media_id));
        return [
          association.caption,
          association.alt_text,
          photo?.description,
          photo?.title,
        ]
          .map((part) => String(part ?? ''))
          .join(' ');
      })
      .join(' ');
  }

  function filterInventory(sql: string, args: unknown[] = []) {
    const needleArg = args.find((arg) => typeof arg === 'string' && String(arg).includes('%'));
    const needle =
      typeof needleArg === 'string' ? needleArg.replace(/%/g, '').toLowerCase() : '';

    let filtered = inventory.filter((row) => matchesPublishedInventory(sql, row));
    if (needle) {
      filtered = filtered.filter((row) =>
        rowMatchesNeedle(row, needle, mediaTextForStory(Number(row.id))),
      );
    }

    if (sql.includes('ORDER BY ci.canonical DESC')) {
      filtered = [...filtered].sort((a, b) => {
        const canonicalDelta = Number(b.canonical ?? 0) - Number(a.canonical ?? 0);
        if (canonicalDelta !== 0) return canonicalDelta;
        const priorityDelta = Number(b.priority ?? 0) - Number(a.priority ?? 0);
        if (priorityDelta !== 0) return priorityDelta;
        return Number(b.id ?? 0) - Number(a.id ?? 0);
      });
    }

    return filtered;
  }

  const db = {
    prepare: vi.fn((sql: string) => {
      const allFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const requested = args.length ? tableNames.filter((name) => args.includes(name)) : tableNames;
          return { results: requested.map((name) => ({ name })) };
        }
        if (sql.includes('FROM content_inventory')) {
          let results = filterInventory(sql, args);
          if (sql.includes('GROUP BY ci.id')) {
            results = results.map((row) => ({
              ...row,
              media_search_text: mediaTextForStory(Number(row.id)),
            }));
          }
          const limit = args[args.length - 1];
          if (typeof limit === 'number') results = results.slice(0, limit);
          return { results };
        }
        if (sql.includes('FROM library_entries')) {
          const needleArg = args.find((arg) => typeof arg === 'string' && String(arg).includes('%'));
          const needle =
            typeof needleArg === 'string' ? needleArg.replace(/%/g, '').toLowerCase() : '';
          let results = library;
          if (needle) {
            results = library.filter((row) =>
              [row.title, row.content].some((field) =>
                String(field ?? '').toLowerCase().includes(needle),
              ),
            );
          }
          const limit = args[args.length - 1];
          if (typeof limit === 'number') results = results.slice(0, limit);
          return { results };
        }
        if (sql.includes('FROM faq_entries')) return { results: [] };
        if (sql.includes('FROM events')) return { results: [] };
        if (sql.includes('FROM milestones')) return { results: [] };
        if (sql.includes('FROM friends')) return { results: [] };
        if (sql.includes('FROM discussions')) return { results: [] };
        if (sql.includes('FROM photos')) return { results: [] };
        return { results: [] };
      };

      const firstFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const table = String(args[0] || '');
          return tableNames.includes(table) ? { name: table } : null;
        }
        if (sql.includes('FROM member_sessions')) {
          return sessionEmail ? { email: sessionEmail } : null;
        }
        if (sql.includes('COUNT(1)') && sql.includes('FROM content_inventory')) {
          return { n: filterInventory(sql, args).length };
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

  return { db };
}

describe('content-inventory search helpers', () => {
  it('requires search section and attribution in published inventory where clause', () => {
    expect(publishedInventoryWhere(SEARCH_SECTION)).toContain("status = 'published'");
    expect(publishedInventoryWhere(SEARCH_SECTION)).toContain('search');
    expect(publishedInventoryWhere(SEARCH_SECTION, 'ci')).toContain('ci.status');
  });

  it('labels canonical and alternate inventory titles for discoverability', () => {
    expect(
      formatSearchInventoryTitle({
        title: 'Luckiest Man',
        canonical: 1,
        perspective_label: null,
      }),
    ).toBe('Luckiest Man');

    expect(
      formatSearchInventoryTitle({
        title: 'Luckiest Man',
        canonical: 0,
        perspective_label: 'Alternate account',
      }),
    ).toBe('Luckiest Man (Alternate account)');

    expect(
      formatSearchInventoryTitle({
        title: 'Luckiest Man',
        canonical: 0,
        perspective_label: null,
      }),
    ).toBe('Luckiest Man (Alternate perspective)');
  });

  it('builds searchable inventory body text from metadata fields', () => {
    const body = buildInventorySearchBody(
      {
        text: 'Speech body',
        summary: 'Summary line',
        search_text: 'luckiest man',
        tag: 'farewell',
        source_name: 'Yankee Stadium',
        credit_line: 'Lou Gehrig',
        perspective_label: 'Primary account',
        event_date: '1939-07-04',
        event_year: 1939,
      },
      'Caption OCR text',
    );

    expect(body).toContain('Speech body');
    expect(body).toContain('Lou Gehrig');
    expect(body).toContain('Caption OCR text');
  });

  it('returns published search-section inventory hits with source and credit metadata', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 1,
          title: 'Luckiest Man',
          text: 'Today I consider myself the luckiest man on the face of the earth.',
          summary: 'Farewell speech summary',
          search_text: 'luckiest man speech',
          tag: 'farewell',
          status: 'published',
          allowed_sections: '["search"]',
          source_name: 'Yankee Stadium',
          credit_line: 'Lou Gehrig',
          event_year: 1939,
          canonical: 1,
          priority: 5,
          updated_at: '2026-06-01T00:00:00Z',
        },
        {
          id: 2,
          title: 'Draft speech',
          text: 'Hidden draft text',
          status: 'draft',
          allowed_sections: '["search"]',
          source_name: 'Hidden',
          credit_line: 'Hidden',
          canonical: 1,
          priority: 1,
          updated_at: '2026-06-01T00:00:00Z',
        },
      ],
    });

    const hits = await fetchSearchInventoryResults(db, {
      sectionKey: SEARCH_SECTION,
      q: 'luckiest',
      limit: 10,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      id: 1,
      title: 'Luckiest Man',
      canonical: true,
      year: 1939,
      tag: 'farewell',
    });
    expect(hits[0]?.body).toContain('Lou Gehrig');
  });

  it('indexes associated media captions and photo descriptions in search hits', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 3,
          title: 'Newspaper clipping',
          text: 'Body text',
          status: 'published',
          allowed_sections: '["search"]',
          source_name: 'Daily News',
          credit_line: 'Archive team',
          canonical: 1,
          priority: 2,
          updated_at: '2026-06-02T00:00:00Z',
        },
      ],
      media: [
        {
          id: 10,
          story_id: 3,
          media_id: 7,
          caption: 'OCR transcript from clipping',
          alt_text: 'Scanned article',
        },
      ],
      photos: [
        {
          id: 7,
          title: 'Clipping scan',
          description: 'Readable OCR text from the newspaper image',
        },
      ],
    });

    const hits = await fetchSearchInventoryResults(db, {
      sectionKey: SEARCH_SECTION,
      q: 'ocr',
      limit: 10,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.body.toLowerCase()).toContain('ocr');
  });

  it('prefers inventory library search results over legacy library_entries when eligible', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 4,
          title: 'Published archive story',
          text: 'Inventory library body',
          status: 'published',
          allowed_sections: '["library"]',
          source_name: 'LGFC Archive',
          credit_line: 'Archive team',
          canonical: 1,
          priority: 3,
          updated_at: '2026-06-03T00:00:00Z',
        },
      ],
      library: [
        {
          id: 12,
          title: 'Legacy library story',
          content: 'Legacy library body',
          created_at: '2020-01-01T00:00:00Z',
        },
      ],
    });

    const resolved = await resolveMemberLibrarySearchResults(db, { q: 'archive', limit: 10 });
    expect(resolved.source).toBe('content_inventory');
    expect(resolved.items[0]?.title).toBe('Published archive story');
  });

  it('falls back to library_entries when no eligible inventory library rows exist', async () => {
    const { db } = makeSearchDb({
      inventory: [],
      library: [
        {
          id: 15,
          title: 'Legacy library story',
          content: 'Legacy library body for members.',
          created_at: '2019-05-01T00:00:00Z',
        },
      ],
    });

    const resolved = await resolveMemberLibrarySearchResults(db, { q: 'legacy', limit: 10 });
    expect(resolved.source).toBe('library_entries');
    expect(resolved.items[0]?.title).toBe('Legacy library story');
  });
});

describe('search API inventory integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns canonical and alternate archive results for public search queries', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 20,
          title: 'Canonical farewell',
          text: 'Canonical body',
          status: 'published',
          allowed_sections: '["search"]',
          source_name: 'LGFC',
          credit_line: 'Editorial',
          canonical: 1,
          priority: 5,
          updated_at: '2026-06-04T00:00:00Z',
        },
        {
          id: 21,
          title: 'Alternate farewell',
          text: 'Alternate body',
          status: 'published',
          allowed_sections: '["search"]',
          source_name: 'LGFC',
          credit_line: 'Contributor',
          canonical: 0,
          perspective_label: 'Alternate account',
          priority: 4,
          updated_at: '2026-06-04T00:00:00Z',
        },
      ],
    });

    const response = await searchGet({
      request: publicRequest('/api/search?q=farewell'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: true, total: 2 });
    expect(payload.results).toEqual(
      expect.arrayContaining([
        { type: 'Archive', title: 'Canonical farewell', excerpt: expect.any(String), url: '/fanclub/library?q=farewell', score: expect.any(Number) },
        {
          type: 'Archive',
          title: 'Alternate farewell (Alternate account)',
          excerpt: expect.any(String),
          url: '/fanclub/library?q=farewell',
          score: expect.any(Number),
        },
      ]),
    );
  });

  it('matches source and credit metadata in public archive search results', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 22,
          title: 'Farewell speech',
          text: 'Speech body',
          source_name: 'Yankee Stadium program',
          credit_line: 'Lou Gehrig',
          status: 'published',
          allowed_sections: '["search"]',
          canonical: 1,
          priority: 2,
          updated_at: '2026-06-05T00:00:00Z',
        },
      ],
    });

    const response = await searchGet({
      request: publicRequest('/api/search?q=yankee'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 1,
      results: [{ type: 'Archive', title: 'Farewell speech' }],
    });
  });

  it('excludes draft inventory rows from public archive search results', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 23,
          title: 'Under review story',
          text: 'This draft text must not appear in search.',
          status: 'draft',
          allowed_sections: '["search"]',
          source_name: 'LGFC',
          credit_line: 'Editorial',
          canonical: 1,
          priority: 1,
          updated_at: '2026-06-05T00:00:00Z',
        },
      ],
    });

    const response = await searchGet({
      request: publicRequest('/api/search?q=draft'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 0,
      results: [],
    });
  });

  it('uses inventory library results for members instead of legacy library_entries when eligible', async () => {
    const { db } = makeSearchDb({
      inventory: [
        {
          id: 24,
          title: 'Inventory library match',
          text: 'Inventory library searchable body',
          status: 'published',
          allowed_sections: '["library"]',
          source_name: 'LGFC Archive',
          credit_line: 'Archive team',
          canonical: 1,
          priority: 2,
          updated_at: '2026-06-06T00:00:00Z',
        },
      ],
      library: [
        {
          id: 30,
          title: 'Legacy library match',
          content: 'Legacy library searchable body',
          created_at: '2020-01-01T00:00:00Z',
        },
      ],
    });

    const response = await searchGet({
      request: memberRequest('/api/search?q=searchable'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      isMember: true,
      results: [{ type: 'Library', title: 'Inventory library match' }],
    });
    expect(
      payload.results.some((result: { title: string }) => result.title.includes('Legacy library match')),
    ).toBe(false);
  });
});
