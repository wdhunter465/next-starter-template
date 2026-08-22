import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminFaqPage from '@/app/admin/faq/page';
import AdminModerationPage from '@/app/admin/moderation/page';
import { onRequestPost as approveFaq } from '../functions/api/admin/faq/approve';
import { onRequestPost as closeReport } from '../functions/api/reports/close';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/moderation'));

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

function adminRequest(path: string, body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('admin moderation review hub', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/moderation');
  });

  it('loads report, ask, and FAQ queues on mount for a signed-in admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/reports/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 7,
                kind: 'discussion',
                target_id: 42,
                reporter_email: 'reader@example.com',
                reason: 'Needs review',
                status: 'open',
                created_at: '2026-06-01T20:00:00Z',
              },
            ],
          }),
        );
      }

      if (path.startsWith('/api/admin/ask/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 9,
                first_name: 'Lou',
                last_name: 'Fan',
                email: 'fan@example.com',
                question: 'How can I help?',
                status: 'pending',
              },
            ],
          }),
        );
      }

      if (path.startsWith('/api/admin/faq/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 11,
                question: 'Pending FAQ?',
                answer: 'Draft answer',
                status: 'pending',
                view_count: 0,
              },
            ],
          }),
        );
      }

      return Promise.resolve(jsonResponse({ ok: true, changed: 1 }));
    });

    render(<AdminModerationPage />);

    expect(await screen.findByRole('heading', { name: 'Report #7' })).toBeInTheDocument();
    expect(screen.getByText('How can I help?')).toBeInTheDocument();
    expect(screen.getByText('Pending FAQ?')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/reports/list?status=open&limit=200',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/ask/list?status=pending',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/faq/list?status=pending',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('submits close, approve, and FAQ review transitions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);

      if (path.startsWith('/api/admin/reports/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 7,
                kind: 'discussion',
                target_id: 42,
                reason: 'Needs review',
                status: 'open',
                created_at: '2026-06-01T20:00:00Z',
              },
            ],
          }),
        );
      }

      if (path.startsWith('/api/admin/ask/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 9,
                first_name: 'Lou',
                last_name: 'Fan',
                email: 'fan@example.com',
                question: 'How can I help?',
                status: 'pending',
              },
            ],
          }),
        );
      }

      if (path.startsWith('/api/admin/faq/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 11,
                question: 'Pending FAQ?',
                answer: 'Draft answer',
                status: 'pending',
                view_count: 0,
              },
            ],
          }),
        );
      }

      return Promise.resolve(jsonResponse({ ok: true, changed: 1 }));
    });

    render(<AdminModerationPage />);

    const report = (await screen.findByRole('heading', { name: 'Report #7' })).closest('article');
    expect(report).not.toBeNull();
    fireEvent.change(within(report as HTMLElement).getByLabelText('Admin note'), {
      target: { value: 'Reviewed and closed' },
    });
    fireEvent.click(within(report as HTMLElement).getByRole('button', { name: 'Close report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/reports/close',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const ask = screen.getByText('How can I help?').closest('article');
    expect(ask).not.toBeNull();
    fireEvent.change(within(ask as HTMLElement).getByLabelText('Published answer'), {
      target: { value: 'Volunteer through the contact page.' },
    });
    fireEvent.change(within(ask as HTMLElement).getByLabelText('Moderation note'), {
      target: { value: 'Good public question.' },
    });
    fireEvent.click(within(ask as HTMLElement).getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/ask/approve',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const faq = screen.getByText('Pending FAQ?').closest('article');
    expect(faq).not.toBeNull();
    fireEvent.click(within(faq as HTMLElement).getByRole('button', { name: 'Approve FAQ' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/faq/approve',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const closeCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/reports/close');
    expect(JSON.parse(String(closeCall?.[1]?.body))).toMatchObject({
      id: 7,
      admin_note: 'Reviewed and closed',
    });

    const askCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/ask/approve');
    expect(JSON.parse(String(askCall?.[1]?.body))).toMatchObject({
      id: 9,
      answer: 'Volunteer through the contact page.',
      moderation_note: 'Good public question.',
      create_faq: true,
    });

    const faqCall = fetchMock.mock.calls.find(([path]) => path === '/api/admin/faq/approve');
    expect(JSON.parse(String(faqCall?.[1]?.body))).toMatchObject({
      id: 11,
      answer: 'Draft answer',
    });
  });

  it('announces moderation queue API failures to assistive technology', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: false, error: 'Unauthorized.' }, 401) as never);

    render(<AdminModerationPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/error: unauthorized/i);
  });
});

describe('admin FAQ moderation page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/faq');
  });

  it('loads ask inbox on mount and announces API failures', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ ok: false, error: 'Unauthorized.' }, 401) as never);

    render(<AdminFaqPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/ask/list?status=pending',
        expect.objectContaining({ cache: 'no-store' }),
      );
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/error: unauthorized/i);
  });
});

describe('moderation API transitions', () => {
  it('fails closed when a report close does not update a row', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          run: async () => ({ meta: { changes: 0 } }),
        }),
      })),
    };

    const response = await closeReport({
      request: adminRequest('/api/reports/close', { id: 7, admin_note: 'Already handled' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'report_not_found_or_closed' });
  });

  it('returns auditable FAQ approval state when a pending FAQ changes', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } }),
        }),
      })),
    };

    const response = await approveFaq({
      request: adminRequest('/api/admin/faq/approve', { id: 11, answer: 'Approved answer' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, id: 11, status: 'approved' });
  });
});
