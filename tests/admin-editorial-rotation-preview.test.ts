import { describe, expect, it, vi } from 'vitest';

import { onRequestGet as rotationPreviewGet } from '../functions/api/admin/editorial/rotation-preview';

function jsonRequest(path: string, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { 'x-admin-token': token },
  });
}

function makeDb(inventory: Array<Record<string, unknown>>) {
  const tableNames = ['content_inventory'];
  return {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async () => {
          if (sql.includes('sqlite_master')) {
            const requested = args.length ? tableNames.filter((name) => args.includes(name)) : tableNames;
            return { results: requested.map((name) => ({ name })) };
          }
          if (sql.includes('FROM content_inventory')) {
            const filtered = inventory.filter((row) => {
              if (sql.includes("status = 'published'") && row.status !== 'published') return false;
              if (sql.includes("LIKE '%club_home%'") && !String(row.allowed_sections).includes('club_home')) {
                return false;
              }
              if (sql.includes('source_name') && !String(row.source_name || '').trim()) return false;
              if (sql.includes('credit_line') && !String(row.credit_line || '').trim()) return false;
              return true;
            });
            return { results: filtered };
          }
          return { results: [] };
        },
      }),
    })),
  };
}

function publishedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Story A',
    summary: 'Summary A',
    priority: 1,
    canonical: 1,
    feature_weight: 1,
    allowed_sections: '["club_home"]',
    status: 'published',
    source_name: 'Archive',
    credit_line: 'LGFC Archive',
    event_date: null,
    event_year: null,
    rotation_group: null,
    last_featured: null,
    ...overrides,
  };
}

describe('admin editorial rotation preview (#3508)', () => {
  it('refuses unauthenticated preview', async () => {
    const response = await rotationPreviewGet({
      request: jsonRequest('/api/admin/editorial/rotation-preview', ''),
      env: { ADMIN_TOKEN: 'secret', DB: makeDb([]) },
    });
    expect(response.status).toBe(401);
  });

  it('rejects unknown sections and invalid as_of values', async () => {
    const env = { ADMIN_TOKEN: 'secret', DB: makeDb([publishedRow()]) };

    const badSection = await rotationPreviewGet({
      request: jsonRequest('/api/admin/editorial/rotation-preview?section=not_a_section'),
      env,
    });
    expect(badSection.status).toBe(400);
    expect(await badSection.json()).toMatchObject({ ok: false, error: 'Invalid section.' });

    const badDate = await rotationPreviewGet({
      request: jsonRequest('/api/admin/editorial/rotation-preview?section=club_home&as_of=not-a-date'),
      env,
    });
    expect(badDate.status).toBe(400);
    expect(await badDate.json()).toMatchObject({ ok: false, error: 'Invalid as_of; use YYYY-MM-DD or ISO-8601.' });
  });

  it('returns the published club_home ranking for a future as_of date without writing last_featured', async () => {
    const inventory = [
      publishedRow({
        id: 1,
        title: 'Far anniversary',
        event_date: '1939-12-25',
        priority: 1,
      }),
      publishedRow({
        id: 2,
        title: 'Near anniversary',
        event_date: '1939-06-04',
        priority: 1,
      }),
      publishedRow({
        id: 3,
        title: 'Draft must not appear',
        status: 'draft',
      }),
    ];
    const db = makeDb(inventory);

    const response = await rotationPreviewGet({
      request: jsonRequest('/api/admin/editorial/rotation-preview?section=club_home&as_of=2026-06-04&limit=8'),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.section).toBe('club_home');
    expect(body.as_of).toBe('2026-06-04T00:00:00.000Z');
    expect(body.total).toBe(2);
    expect(body.items.map((item: { id: number }) => item.id)).toEqual([2, 1]);
    expect(body.items[0].title).toBe('Near anniversary');
    expect(body.note).toMatch(/Does not write last_featured/);
    expect(JSON.stringify(db.prepare.mock.calls)).not.toContain('last_featured =');
  });
});
