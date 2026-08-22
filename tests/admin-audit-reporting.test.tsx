import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminAuditPage from '@/app/admin/audit/page';
import AdminNav from '@/components/admin/AdminNav';
import { onRequestGet as exportGet } from '../functions/api/admin/export';
import { onRequestGet as statsGet } from '../functions/api/admin/stats';
import { onRequestPost as createReport } from '../functions/api/reports/create';
import { onRequestPost as closeReport } from '../functions/api/reports/close';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/audit'));

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

function csvResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="join_requests.csv"',
    },
  });
}

function adminRequest(path: string, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers });
}

function adminPostRequest(path: string, body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('admin audit reporting page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/audit');
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn(() => 'blob:export'),
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: vi.fn(),
      });
    }
  });

  it('exposes audit navigation without public route leakage', () => {
    render(<AdminNav />);
    expect(screen.getByRole('link', { name: 'Audit & Reporting' })).toHaveAttribute(
      'href',
      '/admin/audit',
    );
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
  });

  it('renders masked report evidence, stats, and export controls', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/stats')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            counts: { reports: 3, join_requests: 12, library_entries: 0 },
            unavailable: { photos: 'no such table: photos' },
          }),
        );
      }

      if (path.startsWith('/api/admin/reports/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 4,
                kind: 'discussion',
                target_id: 99,
                reporter_email: 'reader@example.com',
                reason: 'Spam link',
                status: 'open',
                created_at: '2026-06-02T10:00:00Z',
              },
            ],
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminAuditPage />);

    expect(await screen.findByText('Operational snapshot')).toBeInTheDocument();
    expect(await screen.findByText('Reporter: r***@example.com')).toBeInTheDocument();
    expect(screen.getByText('Unavailable tables: photos')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  });

  it('announces stats errors via AdminStatusText alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/admin/stats')) {
        return Promise.resolve(jsonResponse({ ok: false, error: 'Database unavailable' }, 503));
      }
      if (path.startsWith('/api/admin/reports/list')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [] }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminAuditPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: Stats failed — Database unavailable');
    });
  });

  it('closes a report and downloads CSV exports', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/stats')) {
        return Promise.resolve(jsonResponse({ ok: true, counts: { reports: 1 } }));
      }

      if (path.startsWith('/api/admin/reports/list?status=open')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 8,
                kind: 'photo',
                target_id: 3,
                reporter_email: 'fan@example.com',
                reason: 'Off-topic',
                status: 'open',
                created_at: '2026-06-03T08:00:00Z',
              },
            ],
          }),
        );
      }

      if (path === '/api/admin/reports/close') {
        return Promise.resolve(jsonResponse({ ok: true, changed: 1 }));
      }

      if (path.startsWith('/api/admin/reports/list?status=closed')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [] }));
      }

      if (path.startsWith('/api/admin/export?')) {
        return Promise.resolve(csvResponse('id,name\n1,Lou\n'));
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<AdminAuditPage />);

    expect(await screen.findByText('#8 · photo · target 3')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Admin note for closeout'), {
      target: { value: 'Reviewed in audit lane' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/reports/close',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/export?table=join_requests&limit=5000',
        expect.any(Object),
      );
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  it('renders empty report and stats failure states safely', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/admin/stats')) {
        return Promise.resolve(jsonResponse({ ok: false, error: 'unauthorized' }, 401));
      }
      if (path.startsWith('/api/admin/reports/list')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [] }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminAuditPage />);

    expect(await screen.findByText('Error: Stats failed — unauthorized')).toBeInTheDocument();
    expect(await screen.findByText('No open reports in this queue.')).toBeInTheDocument();
  });
});

describe('audit and reporting APIs', () => {
  it('includes reports in admin stats and fails closed without D1', async () => {
    const db = {
      prepare: vi.fn((sql: string) => ({
        all: async () => {
          if (sql.includes('reports')) return { results: [{ n: 5 }] };
          return { results: [{ n: 0 }] };
        },
      })),
    };

    const response = await statsGet({
      request: adminRequest('/api/admin/stats'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      counts: expect.objectContaining({ reports: 5 }),
    });

    const missingDb = await exportGet({
      request: adminRequest('/api/admin/export?table=join_requests', null),
      env: {},
    });

    expect(missingDb.status).toBe(503);
  });

  it('returns CSV headers for empty export tables', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          all: async () => ({ results: [] }),
        }),
      })),
    };

    const response = await exportGet({
      request: adminRequest('/api/admin/export?table=library_entries'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    await expect(response.text()).resolves.toContain('id,name,email,title,content,created_at');
  });

  it('accepts member report creation for supported kinds', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } }),
        }),
      })),
    };

    const response = await createReport({
      request: new Request('https://www.lougehrigfanclub.com/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'library',
          target_id: 12,
          reporter_email: 'member@example.com',
          reason: 'Needs review',
        }),
      }),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it('fails closed when report close does not update a row', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          run: async () => ({ meta: { changes: 0 } }),
        }),
      })),
    };

    const response = await closeReport({
      request: adminPostRequest('/api/admin/reports/close', { id: 2, admin_note: 'done' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'report_not_found_or_closed' });
  });
});
