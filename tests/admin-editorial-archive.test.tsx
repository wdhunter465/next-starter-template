import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminEditorialArchivePage from '@/app/admin/editorial/page';
import { onRequestGet as editorialListGet } from '../functions/api/admin/editorial/list';
import { onRequestPost as editorialReviewPost } from '../functions/api/admin/editorial/review';
import { onRequestPost as editorialPublishPost } from '../functions/api/admin/editorial/publish';
import { onRequestPost as editorialInventoryPost } from '../functions/api/admin/editorial/inventory';
import { onRequestPost as librarySubmitPost } from '../functions/api/library/submit';
import { onRequestGet as fanclubLibraryGet } from '../functions/api/fanclub/library';
import { onRequestGet as searchGet } from '../functions/api/search';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/editorial'));

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function adminGetRequest(path: string, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: { 'x-admin-token': token },
  });
}

function adminPostRequest(path: string, body: unknown, token = 'secret'): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify(body),
  });
}

function memberRequest(path: string, body?: unknown): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body
      ? { Cookie: 'lgfc_session=session-1', 'Content-Type': 'application/json' }
      : { Cookie: 'lgfc_session=session-1' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeEditorialDb(options?: {
  submissions?: Array<Record<string, unknown>>;
  inventory?: Array<Record<string, unknown>>;
  library?: Array<Record<string, unknown>>;
  sessionEmail?: string;
}) {
  const submissions = options?.submissions ?? [];
  const inventory = options?.inventory ?? [];
  const library = options?.library ?? [];
  const sessionEmail = options?.sessionEmail ?? 'member@example.com';
  const runs: Array<{ sql: string; args: unknown[] }> = [];
  const tableNames = ['submission_queue', 'content_inventory', 'library_entries', 'member_sessions', 'members'];

  function filterRows(sql: string, rows: Array<Record<string, unknown>>, args: unknown[]) {
    let filtered = rows;
    if (sql.includes("status = 'published'")) {
      filtered = filtered.filter((row) => row.status === 'published');
    }
    if (sql.includes("LIKE '%library%'")) {
      filtered = filtered.filter((row) => String(row.allowed_sections || '').includes('library'));
    }
    if (sql.includes("LIKE '%search%'")) {
      filtered = filtered.filter((row) => String(row.allowed_sections || '').includes('search'));
    }

    const likeArg = args.find((arg) => typeof arg === 'string' && arg.includes('%'));
    if (typeof likeArg === 'string') {
      const needle = likeArg.replace(/%/g, '').toLowerCase();
      if (needle) {
        const fields = sql.includes('FROM library_entries')
          ? ['title', 'content']
          : ['title', 'text', 'summary', 'search_text', 'credit_line', 'source_name', 'perspective_label'];
        filtered = filtered.filter((row) =>
          fields.some((field) => String(row[field] || '').toLowerCase().includes(needle)),
        );
      }
    }

    return filtered;
  }

  function filterSubmissions(sql: string, rows: Array<Record<string, unknown>>, args: unknown[]) {
    if (sql.includes('WHERE status = ?') && typeof args[0] === 'string') {
      return rows.filter((row) => row.status === args[0]);
    }
    return rows;
  }

  const db = {
    prepare: vi.fn((sql: string) => {
      const allFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const requested = args.length ? tableNames.filter((name) => args.includes(name)) : tableNames;
          return { results: requested.map((name) => ({ name })) };
        }
        if (sql.includes('FROM submission_queue')) return { results: filterSubmissions(sql, submissions, args) };
        if (sql.includes('FROM content_inventory')) {
          let filtered = inventory;
          if (sql.includes('WHERE status = ?') && typeof args[0] === 'string') {
            filtered = filtered.filter((row) => row.status === args[0]);
          }
          return { results: filterRows(sql, filtered, args) };
        }
        if (sql.includes('FROM library_entries')) return { results: filterRows(sql, library, args) };
        return { results: [] };
      };

      const firstFn = async (args: unknown[] = []) => {
        if (sql.includes('sqlite_master')) {
          const table = String(args[0] || '');
          return tableNames.includes(table) ? { name: table } : null;
        }
        if (sql.includes('FROM member_sessions')) return { email: sessionEmail };
        if (sql.includes("SELECT datetime('now')")) {
          return { now: '2026-06-02T12:00:00Z', purge_eligible_at: '2026-08-31T12:00:00Z' };
        }
        if (sql.includes('COUNT(1)') && sql.includes('FROM content_inventory')) {
          return { n: filterRows(sql, inventory, args).length };
        }
        if (sql.includes('COUNT(1)') && sql.includes('FROM library_entries')) {
          return { n: filterRows(sql, library, args).length };
        }
        if (sql.includes('FROM submission_queue') && sql.includes('WHERE submission_id = ?')) {
          return submissions.find((row) => row.submission_id === args[0]) ?? null;
        }
        if (sql.includes('FROM submission_queue')) return submissions[0] ?? null;
        if (sql.includes('FROM content_inventory') && sql.includes('WHERE id = ?')) {
          return inventory.find((row) => row.id === args[0]) ?? null;
        }
        if (sql.includes('FROM content_inventory')) return inventory[0] ?? null;
        return null;
      };

      const runFn = async (...args: unknown[]) => {
        runs.push({ sql, args });
        return { meta: { changes: 1, last_row_id: 44 } };
      };

      return {
        all: () => allFn(),
        first: () => firstFn(),
        run: () => runFn(),
        bind: (...args: unknown[]) => ({
          all: () => allFn(args),
          first: () => firstFn(args),
          run: () => runFn(...args),
        }),
      };
    }),
  };

  return { db, runs };
}

describe('admin editorial archive page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('lgfc_admin_token', 'secret');
    mockUsePathname.mockReturnValue('/admin/editorial');
  });

  it('loads pending submissions and archive publication state with admin token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        submissions: [
          {
            submission_id: 9,
            submitted_by: 'Member <member@example.com>',
            title: 'Gehrig memory',
            description: 'A submitted memory for review.',
            proposed_tag: 'gehrig-memory',
            status: 'pending',
          },
        ],
        inventory: [
          {
            id: 4,
            tag: 'luckiest-man',
            title: 'Luckiest Man',
            text: 'Published text',
            story_type: 'brief',
            allowed_sections: '["library"]',
            priority: 1,
            canonical: 1,
            credit_line: 'Archive',
            status: 'draft',
          },
        ],
      }),
    );

    render(<AdminEditorialArchivePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Gehrig memory' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Luckiest Man' })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/editorial/list?limit=100&submission_status=pending&inventory_status=all',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('approves a submission into a content_inventory draft', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      if (path.startsWith('/api/admin/editorial/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            submissions: [
              {
                submission_id: 9,
                submitted_by: 'Member <member@example.com>',
                title: 'Gehrig memory',
                description: 'A submitted memory for review.',
                proposed_tag: 'gehrig-memory',
                status: 'pending',
              },
            ],
            inventory: [],
          }),
        );
      }
      expect(path).toBe('/api/admin/editorial/review');
      expect(init?.method).toBe('POST');
      return Promise.resolve(jsonResponse({ ok: true, inventory_id: 44 }));
    });

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'Gehrig memory' });
    fireEvent.click(screen.getByRole('button', { name: 'Approve as Draft' }));

    await waitFor(() => {
      const reviewCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/editorial/review');
      expect(reviewCall).toBeDefined();
      expect(JSON.parse(String(reviewCall?.[1]?.body))).toMatchObject({
        submission_id: 9,
        action: 'approve',
        tag: 'gehrig-memory',
        allowed_sections: ['library'],
      });
    });
  });

  it('loads queue records by selected submission status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        submissions: [],
        inventory: [],
      }),
    );

    render(<AdminEditorialArchivePage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/editorial/list?limit=100&submission_status=pending&inventory_status=all',
        expect.objectContaining({ cache: 'no-store' }),
      );
    });

    fireEvent.change(screen.getByLabelText('Queue status'), { target: { value: 'rejected' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/editorial/list?limit=100&submission_status=rejected&inventory_status=all',
        expect.objectContaining({ cache: 'no-store' }),
      );
    });
  });

  it('does not fetch editorial records until a token is stored', async () => {
    window.localStorage.removeItem('lgfc_admin_token');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(<AdminEditorialArchivePage />);

    expect(screen.getByText('Save an admin API token above to load editorial records.')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('announces editorial list API failures to assistive technology', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: false, error: 'Database unavailable' }, 503) as never,
    );

    render(<AdminEditorialArchivePage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/error: database unavailable/i);
  });

  it('clears editorial state when the admin token is removed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        submissions: [
          {
            submission_id: 9,
            submitted_by: 'Member',
            title: 'Gehrig memory',
            description: 'A submitted memory for review.',
            status: 'pending',
          },
        ],
        inventory: [],
      }),
    );

    render(<AdminEditorialArchivePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Gehrig memory' })).toBeInTheDocument();
    });

    const tokenInput = screen.getByLabelText('Admin token');
    await userEvent.clear(tokenInput);
    await userEvent.click(screen.getByRole('button', { name: 'Save token' }));

    await waitFor(() => {
      expect(window.localStorage.getItem('lgfc_admin_token')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Gehrig memory' })).not.toBeInTheDocument();
    });
  });

  it('loads inventory records by selected publication status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        submissions: [],
        inventory: [],
      }),
    );

    render(<AdminEditorialArchivePage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/editorial/list?limit=100&submission_status=pending&inventory_status=all',
        expect.objectContaining({ cache: 'no-store' }),
      );
    });

    fireEvent.change(screen.getByLabelText('Inventory status'), { target: { value: 'published' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/editorial/list?limit=100&submission_status=pending&inventory_status=published',
        expect.objectContaining({ cache: 'no-store' }),
      );
    });
  });

  it('uses submitter names without email addresses as default credit values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        submissions: [
          {
            submission_id: 11,
            submitted_by: 'Member Name <member@example.com>',
            title: 'PII-safe credit',
            description: 'A queue item with submitter email hidden from credit defaults.',
            proposed_tag: 'pii-safe-credit',
            status: 'pending',
          },
        ],
        inventory: [],
      }),
    );

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'PII-safe credit' });
    expect(screen.getByDisplayValue('Member Name')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Member Name <member@example.com>')).not.toBeInTheDocument();
  });

  it('preserves existing review notes in the queue form', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        submissions: [
          {
            submission_id: 12,
            submitted_by: 'Member <member@example.com>',
            title: 'Existing notes',
            description: 'A queue item with notes.',
            proposed_tag: 'existing-notes',
            status: 'triaged',
            review_notes: 'Existing editorial note.',
          },
        ],
        inventory: [],
      }),
    );

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'Existing notes' });
    expect(screen.getByDisplayValue('Existing editorial note.')).toBeInTheDocument();
  });

  it('treats whitespace-only retention reasons as purge eligible on reject', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      if (path.startsWith('/api/admin/editorial/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            submissions: [
              {
                submission_id: 14,
                submitted_by: 'Member <member@example.com>',
                title: 'Whitespace retention',
                description: 'A queue item with blank retention input.',
                proposed_tag: 'whitespace-retention',
                status: 'pending',
              },
            ],
            inventory: [],
          }),
        );
      }
      expect(path).toBe('/api/admin/editorial/review');
      expect(init?.method).toBe('POST');
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'Whitespace retention' });
    fireEvent.change(screen.getByLabelText('Retention reason'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject + Purge Eligible' }));

    await waitFor(() => {
      const reviewCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/editorial/review');
      expect(JSON.parse(String(reviewCall?.[1]?.body))).toMatchObject({
        action: 'reject',
        retention_reason: '',
      });
    });
  });

  it('uses the retained default when stored retention reason is whitespace only', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      if (path.startsWith('/api/admin/editorial/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            submissions: [
              {
                submission_id: 15,
                submitted_by: 'Member <member@example.com>',
                title: 'Whitespace stored retention',
                description: 'A queue item with whitespace-only stored retention.',
                proposed_tag: 'whitespace-stored',
                status: 'triaged',
                retention_reason: '   ',
              },
            ],
            inventory: [],
          }),
        );
      }
      expect(path).toBe('/api/admin/editorial/review');
      expect(init?.method).toBe('POST');
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'Whitespace stored retention' });
    fireEvent.click(screen.getByRole('button', { name: 'Retain Rejected' }));

    await waitFor(() => {
      const reviewCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/editorial/review');
      expect(JSON.parse(String(reviewCall?.[1]?.body))).toMatchObject({
        action: 'reject',
        retention_reason: 'Retained for editorial follow-up.',
      });
    });
  });

  it('disables purge when stored retention reason is only whitespace after trimming', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.includes('submission_status=rejected')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            submissions: [
              {
                submission_id: 16,
                submitted_by: 'Member <member@example.com>',
                title: 'Whitespace purge guard',
                description: 'Rejected item that should remain purge eligible.',
                status: 'rejected',
                retention_reason: '   ',
              },
            ],
            inventory: [],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true, submissions: [], inventory: [] }));
    });

    render(<AdminEditorialArchivePage />);

    fireEvent.change(screen.getByLabelText('Queue status'), { target: { value: 'rejected' } });
    await screen.findByRole('heading', { name: 'Whitespace purge guard' });
    expect(screen.getByRole('button', { name: 'Mark Purged' })).not.toBeDisabled();
  });

  it('prefers custom retention reasons typed by editors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      if (path.startsWith('/api/admin/editorial/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            submissions: [
              {
                submission_id: 13,
                submitted_by: 'Member <member@example.com>',
                title: 'Retain with custom reason',
                description: 'A queue item that should be retained.',
                proposed_tag: 'retain-custom',
                status: 'pending',
              },
            ],
            inventory: [],
          }),
        );
      }
      expect(path).toBe('/api/admin/editorial/review');
      expect(init?.method).toBe('POST');
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'Retain with custom reason' });
    fireEvent.change(screen.getByLabelText('Retention reason'), {
      target: { value: 'Custom legal hold.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retain Rejected' }));

    await waitFor(() => {
      const reviewCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/editorial/review');
      expect(JSON.parse(String(reviewCall?.[1]?.body))).toMatchObject({
        action: 'reject',
        retention_reason: 'Custom legal hold.',
      });
    });
  });

  it('records triage actions from the review queue', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      if (path.startsWith('/api/admin/editorial/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            submissions: [
              {
                submission_id: 10,
                submitted_by: 'Member <member@example.com>',
                title: 'Possible duplicate',
                description: 'A queue item that needs objective triage.',
                proposed_tag: 'possible-duplicate',
                status: 'pending',
              },
            ],
            inventory: [],
          }),
        );
      }
      expect(path).toBe('/api/admin/editorial/review');
      expect(init?.method).toBe('POST');
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminEditorialArchivePage />);

    await screen.findByRole('heading', { name: 'Possible duplicate' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Triaged' }));

    await waitFor(() => {
      const reviewCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/editorial/review');
      expect(reviewCall).toBeDefined();
      expect(JSON.parse(String(reviewCall?.[1]?.body))).toMatchObject({
        submission_id: 10,
        action: 'triage',
        triage_flags: '[]',
      });
    });
  });
});

describe('editorial archive APIs', () => {
  it('rejects list requests without admin token', async () => {
    const response = await editorialListGet({
      request: adminGetRequest('/api/admin/editorial/list', ''),
      env: { ADMIN_TOKEN: 'secret', DB: makeEditorialDb().db },
    });

    expect(response.status).toBe(401);
  });

  it('lists submissions and content inventory records', async () => {
    const response = await editorialListGet({
      request: adminGetRequest('/api/admin/editorial/list'),
      env: {
        ADMIN_TOKEN: 'secret',
        DB: makeEditorialDb({
          submissions: [{ submission_id: 1, title: 'Pending story', status: 'pending' }],
          inventory: [{ id: 2, title: 'Draft story', status: 'draft' }],
        }).db,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      submissions: [{ title: 'Pending story' }],
      inventory: [{ title: 'Draft story' }],
    });
  });

  it('filters inventory records by inventory_status', async () => {
    const response = await editorialListGet({
      request: adminGetRequest('/api/admin/editorial/list?inventory_status=published'),
      env: {
        ADMIN_TOKEN: 'secret',
        DB: makeEditorialDb({
          inventory: [
            { id: 2, title: 'Draft story', status: 'draft' },
            { id: 3, title: 'Published story', status: 'published' },
          ],
        }).db,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      inventory: [{ id: 3, title: 'Published story' }],
    });
  });

  it('approves pending submissions as draft content_inventory records', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          status: 'pending',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'approve',
        summary: 'A concise summary for archives.',
        perspective_label: 'Member perspective',
        source_name: 'Member interview',
        credit_line: 'Member <member@example.com>',
        event_year: 1939,
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'approve',
      inventory_id: 44,
    });
    const insertRun = runs.find((run) => run.sql.includes('INSERT INTO content_inventory'));
    expect(insertRun).toBeDefined();
    expect(insertRun?.args).toEqual(
      expect.arrayContaining([
        'A concise summary for archives.',
        'Member perspective',
        'Member interview',
        1939,
      ]),
    );
    expect(runs.some((run) => run.sql.includes("status = 'approved'"))).toBe(true);
  });

  it('triages pending submissions with objective flags without a factual decision', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          status: 'pending',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'triage',
        triage_flags: ['missing_source'],
        duplicate_candidate: 'submitted-story',
        review_notes: 'Needs source follow-up.',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'triage',
    });
    const updateRun = runs.find((run) => run.sql.includes("status = 'triaged'"));
    expect(updateRun?.args).toEqual(
      expect.arrayContaining(['["missing_source"]', 'submitted-story', 'Needs source follow-up.']),
    );
    expect(runs.some((run) => run.sql.includes('decision_at'))).toBe(false);
  });

  it('does not move under-review submissions backward to triaged', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          status: 'under_review',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'triage',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(409);
    expect(runs.some((run) => run.sql.includes("status = 'triaged'"))).toBe(false);
  });

  it('merges reviewed submissions into an existing content_inventory record', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 8,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted merge detail',
          description: 'Additional detail for the existing story.',
          proposed_tag: 'existing-story',
          status: 'under_review',
        },
      ],
      inventory: [{ id: 22, title: 'Existing story', review_notes: 'Existing note', search_text: 'existing story' }],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 8,
        action: 'merge',
        target_inventory_id: 22,
        duplicate_candidate: 'existing-story',
        review_notes: 'Merged useful source detail.',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'merge',
      inventory_id: 22,
    });
    expect(runs.some((run) => run.sql.includes('UPDATE content_inventory'))).toBe(true);
    expect(runs.some((run) => run.sql.includes("status = 'merged'"))).toBe(true);
  });

  it('falls back to the default purge eligibility date when purge_eligible_at is invalid', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 9,
          submitted_by: 'Member <member@example.com>',
          title: 'Rejected story',
          description: 'Rejected text.',
          proposed_tag: 'rejected-story',
          status: 'triaged',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 9,
        action: 'reject',
        purge_eligible_at: 'not-a-real-date',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    const updateRun = runs.find((run) => run.sql.includes("status = 'rejected'"));
    expect(updateRun?.args[4]).toBe('2026-08-31T12:00:00Z');
    expect(updateRun?.args[5]).toBe(1);
  });

  it('rejects submissions with purge eligibility metadata', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 9,
          submitted_by: 'Member <member@example.com>',
          title: 'Rejected story',
          description: 'Rejected text.',
          proposed_tag: 'rejected-story',
          status: 'triaged',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 9,
        action: 'reject',
        review_notes: 'Out of scope after human review.',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'reject',
    });
    const updateRun = runs.find((run) => run.sql.includes("status = 'rejected'"));
    expect(updateRun?.args[2]).toBeNull();
    expect(updateRun?.args[4]).toBe('2026-08-31T12:00:00Z');
    expect(updateRun?.args[5]).toBe(1);
  });

  it('retains rejected submissions without marking them purge eligible', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 10,
          submitted_by: 'Member <member@example.com>',
          title: 'Retained story',
          description: 'Rejected but retained text.',
          status: 'under_review',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 10,
        action: 'reject',
        retention_reason: 'Retained for source follow-up.',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    const updateRun = runs.find((run) => run.sql.includes("status = 'rejected'"));
    expect(updateRun?.args[2]).toBe('Retained for source follow-up.');
    expect(updateRun?.args[4]).toBeNull();
    expect(updateRun?.args[5]).toBe(0);
  });

  it('marks eligible rejected submissions as purged without deleting the audit row', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 11,
          submitted_by: 'Member <member@example.com>',
          title: 'Purge-ready story',
          description: 'Purge-ready text.',
          status: 'rejected',
          retention_reason: '',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 11,
        action: 'purge',
        review_notes: 'Quarterly purge complete.',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'purge',
    });
    expect(runs.some((run) => run.sql.includes("status = 'purged'"))).toBe(true);
  });

  it('does not coerce blank event_year values to zero', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          status: 'pending',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'approve',
        source_name: 'Member interview',
        credit_line: 'Member <member@example.com>',
        event_year: '   ',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    const insertRun = runs.find((run) => run.sql.includes('INSERT INTO content_inventory'));
    expect(insertRun?.args[15]).toBeNull();
  });

  it('uses submitter names without email addresses as server-side default credit lines', async () => {
    const { db, runs } = makeEditorialDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member Name <member@example.com>',
          title: 'Submitted story',
          description: 'Story text for editorial review.',
          proposed_tag: 'submitted-story',
          status: 'pending',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'approve',
        source_name: 'Member interview',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    const insertRun = runs.find((run) => run.sql.includes('INSERT INTO content_inventory'));
    expect(insertRun?.args[9]).not.toContain('member@example.com');
    expect(insertRun?.args[13]).toBe('Member Name');
  });

  it('updates publication state for archive records', async () => {
    const { db, runs } = makeEditorialDb({
      inventory: [{ id: 4, status: 'draft', source_name: 'Archive', credit_line: 'LGFC Archive' }],
    });

    const response = await editorialPublishPost({
      request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      id: 4,
      status: 'published',
    });
    expect(runs.some((run) => run.sql.includes('UPDATE content_inventory'))).toBe(true);
  });

  it('rejects publishing content_inventory records without required attribution', async () => {
    const { db, runs } = makeEditorialDb({
      inventory: [{ id: 4, status: 'draft', source_name: '', credit_line: 'LGFC Archive' }],
    });

    const response = await editorialPublishPost({
      request: adminPostRequest('/api/admin/editorial/publish', { id: 4, status: 'published' }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Published content_inventory records require source_name and credit_line.',
    });
    expect(runs.some((run) => run.sql.includes('UPDATE content_inventory'))).toBe(false);
  });

  it('creates a draft content_inventory record through the inventory endpoint', async () => {
    const { db, runs } = makeEditorialDb();

    const response = await editorialInventoryPost({
      request: adminPostRequest('/api/admin/editorial/inventory', {
        tag: 'editor-draft',
        title: 'Editor draft story',
        text: 'Draft body text',
        credit_line: 'LGFC Editorial',
        allowed_sections: ['library', 'search'],
        canonical: true,
        feature_weight: 2,
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'create',
      id: 44,
      status: 'draft',
    });
    const insertRun = runs.find((run) => run.sql.includes('INSERT INTO content_inventory'));
    expect(insertRun?.args).toContain('["library","search"]');
  });

  it('updates an existing content_inventory record through the inventory endpoint', async () => {
    const { db, runs } = makeEditorialDb({
      inventory: [
        {
          id: 12,
          tag: 'luckiest-man',
          title: 'Luckiest Man',
          text: 'Speech text',
          credit_line: 'Archive',
          status: 'draft',
        },
      ],
    });

    const response = await editorialInventoryPost({
      request: adminPostRequest('/api/admin/editorial/inventory', {
        id: 12,
        tag: 'luckiest-man',
        title: 'Luckiest Man Updated',
        text: 'Updated speech text',
        credit_line: 'Archive',
        allowed_sections: ['library', 'archive'],
        canonical: false,
        perspective_label: 'Alternate account',
        rotation_group: 'speech-day',
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: 'update',
      id: 12,
      status: 'draft',
    });
    const updateRun = runs.find((run) => run.sql.includes('UPDATE content_inventory'));
    expect(updateRun?.args).toContain('Alternate account');
    expect(updateRun?.args).toContain('["library","archive"]');
  });

  it('requires perspective_label for alternate-perspective inventory records', async () => {
    const { db } = makeEditorialDb();

    const response = await editorialInventoryPost({
      request: adminPostRequest('/api/admin/editorial/inventory', {
        title: 'Alternate story',
        text: 'Body',
        credit_line: 'Archive',
        canonical: false,
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Alternate-perspective records require perspective_label.',
    });
  });

  it('requires perspective_label when approving alternate-perspective submissions', async () => {
    const { db } = makeEditorialDb({
      submissions: [
        {
          submission_id: 7,
          submitted_by: 'Member <member@example.com>',
          title: 'Alternate submission',
          description: 'Story text for editorial review.',
          proposed_tag: 'alternate-story',
          status: 'pending',
        },
      ],
    });

    const response = await editorialReviewPost({
      request: adminPostRequest('/api/admin/editorial/review', {
        submission_id: 7,
        action: 'approve',
        tag: 'alternate-story',
        title: 'Alternate submission',
        text: 'Story text for editorial review.',
        credit_line: 'Archive',
        canonical: false,
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Alternate-perspective records require perspective_label.',
    });
  });
});

describe('member submissions and library archive reads', () => {
  it('queues member library submissions for editorial review', async () => {
    const { db, runs } = makeEditorialDb();

    const response = await librarySubmitPost({
      request: memberRequest('/api/library/submit', {
        name: 'Member Name',
        title: 'A long submitted story',
        content: 'This is a submitted story with enough body text for review.',
        ownership_statement: 'I wrote this myself.',
        permission_statement: 'LGFC may use this submission.',
        credit_preference: 'public_credit',
      }),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      message: 'Submission queued for editorial review',
    });
    const insertRun = runs.find((run) => run.sql.includes('INSERT INTO submission_queue'));
    expect(insertRun).toBeDefined();
    expect(insertRun?.args[1]).toContain('"title":"A long submitted story"');
  });

  it('returns only published content_inventory records for member library reads', async () => {
    const response = await fanclubLibraryGet({
      request: memberRequest('/api/fanclub/library?page=1'),
      env: {
        DB: makeEditorialDb({
          inventory: [
            {
              id: 5,
              title: 'Published archive story',
              text: 'A published archive story for members.',
              summary: 'Published archive summary.',
              credit_line: 'LGFC Archive',
              event_date: '1939-07-04',
              event_year: 1939,
              status: 'published',
              allowed_sections: '["library"]',
              updated_at: '2026-06-02T12:00:00Z',
            },
          ],
        }).db,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          title: 'Published archive story',
          author: 'LGFC Archive',
          year: 1939,
          description: 'Published archive summary.',
        },
      ],
    });
  });

  it('falls back to event_date year when event_year is blank', async () => {
    const response = await fanclubLibraryGet({
      request: memberRequest('/api/fanclub/library?page=1'),
      env: {
        DB: makeEditorialDb({
          inventory: [
            {
              id: 5,
              title: 'Published archive story',
              text: 'A published archive story for members.',
              credit_line: 'LGFC Archive',
              event_date: '1939-07-04',
              event_year: '   ',
              status: 'published',
              allowed_sections: '["library"]',
              updated_at: '2026-06-02T12:00:00Z',
            },
          ],
        }).db,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          title: 'Published archive story',
          year: 1939,
        },
      ],
    });
  });

  it('falls back to legacy library_entries when no eligible inventory rows exist', async () => {
    const response = await fanclubLibraryGet({
      request: memberRequest('/api/fanclub/library?page=1'),
      env: {
        DB: makeEditorialDb({
          library: [
            {
              id: 12,
              title: 'Legacy library story',
              content: 'Legacy library content remains available.',
              created_at: '2020-01-02T00:00:00Z',
            },
          ],
        }).db,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 1,
      items: [
        {
          title: 'Legacy library story',
          content: 'Legacy library content remains available.',
          year: 2020,
        },
      ],
    });
  });

  it('does not fall back to library_entries for an empty inventory search when inventory is eligible', async () => {
    const response = await fanclubLibraryGet({
      request: memberRequest('/api/fanclub/library?q=nomatch&page=1'),
      env: {
        DB: makeEditorialDb({
          inventory: [
            {
              id: 5,
              title: 'Published archive story',
              text: 'A published archive story for members.',
              credit_line: 'LGFC Archive',
              status: 'published',
              allowed_sections: '["library"]',
              updated_at: '2026-06-02T12:00:00Z',
            },
          ],
          library: [
            {
              id: 12,
              title: 'Legacy library story',
              content: 'Legacy library content remains available.',
              created_at: '2020-01-02T00:00:00Z',
            },
          ],
        }).db,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 0,
      items: [],
    });
  });

  it('does not expose queue records through member search results', async () => {
    const { db } = makeEditorialDb({
      submissions: [
        {
          submission_id: 12,
          submitted_by: 'Member <member@example.com>',
          title: 'Hidden queue record',
          description: 'This under-review queue text must not appear in search.',
          status: 'under_review',
        },
        {
          submission_id: 13,
          submitted_by: 'Member <member@example.com>',
          title: 'Rejected queue record',
          description: 'This rejected queue text must not appear in search.',
          status: 'rejected',
        },
      ],
    });

    const response = await searchGet({
      request: memberRequest('/api/search?q=queue'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      total: 0,
      results: [],
    });
    expect(db.prepare).not.toHaveBeenCalledWith(expect.stringContaining('submission_queue'));
  });
});
