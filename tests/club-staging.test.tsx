import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminLayout from '@/app/admin/layout';
import AdminClubStagingPage from '@/app/admin/clubstaging/page';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminNav from '@/components/admin/AdminNav';
import { CLUB_STAGING_BOUNDARY_COPY } from '@/app/admin/clubstaging/clubStagingSamples';

const mockUseMemberSession = vi.hoisted(() => vi.fn());
const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/clubstaging'));

vi.mock('@/hooks/useMemberSession', () => ({
  useMemberSession: mockUseMemberSession,
}));

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

describe('admin club staging (#2043)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    mockUsePathname.mockReturnValue('/admin/clubstaging');
    mockUseMemberSession.mockReturnValue({ isLoading: false, isAuthenticated: true, role: 'admin' });
  });

  it('keeps /admin/clubstaging behind the admin layout gate', () => {
    mockUseMemberSession.mockReturnValue({ isLoading: false, isAuthenticated: false, role: null });
    const { rerender } = render(
      <AdminLayout>
        <AdminClubStagingPage />
      </AdminLayout>,
    );

    expect(screen.queryByRole('heading', { name: /Club Staging/i })).not.toBeInTheDocument();

    mockUseMemberSession.mockReturnValue({ isLoading: false, isAuthenticated: true, role: 'admin' });
    rerender(
      <AdminLayout>
        <AdminClubStagingPage />
      </AdminLayout>,
    );

    expect(screen.getByRole('heading', { name: /Club Staging/i })).toBeInTheDocument();
  });

  it('exposes Club Staging in admin navigation without public nav leakage', () => {
    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Club Staging' })).toHaveAttribute('href', '/admin/clubstaging');
    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Store' })).not.toBeInTheDocument();
  });

  it('exposes Club Staging on the admin dashboard card grid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, counts: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never,
    );

    const { container } = render(<AdminDashboard />);

    const dashboardLink = container.querySelector('a[href="/admin/clubstaging"]');
    expect(dashboardLink).not.toBeNull();
    expect(dashboardLink).toHaveTextContent(/Club Staging/i);
    expect(dashboardLink).toHaveTextContent(/Preview staged club content/i);
  });

  it('labels staged content as non-public and includes rotation preview controls', async () => {
    const user = userEvent.setup();
    render(<AdminClubStagingPage />);

    expect(screen.getByRole('status')).toHaveTextContent(CLUB_STAGING_BOUNDARY_COPY);
    expect(screen.getByRole('region', { name: 'Club staging rotation preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next rotation item' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next rotation item' }));
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('does not expose a public /clubstaging route from the staging preview surface', () => {
    render(<AdminClubStagingPage />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/clubstaging');
  });

  it('exposes a review workspace without a publish control', () => {
    render(<AdminClubStagingPage />);

    expect(screen.getByRole('region', { name: 'Staged content review workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staged content review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark reviewed' })).not.toBeInTheDocument();
  });

  it('binds a staged inventory row into the existing preview frame without calling it published', async () => {
    window.localStorage.setItem('lgfc_admin_token', 'secret');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          submissions: [],
          inventory: [
            {
              id: 12,
              title: 'Staged club spotlight',
              summary: 'Preview-only inventory row.',
              status: 'draft',
              operational_state: 'staged',
              source_name: 'Archive',
              credit_line: 'LGFC Archive',
              rights_status: 'owned',
              privacy_flag: 'none',
              allowed_sections: '["club_home"]',
              story_type: 'primary',
              priority: 1,
              canonical: 1,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as never,
    );

    render(<AdminClubStagingPage />);

    expect(await screen.findByRole('button', { name: 'Staged club spotlight' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/selected inventory row is shown/i);
    });
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeEnabled();
  });

  it('disables Mark reviewed when source, credit, rights, or privacy is missing', async () => {
    window.localStorage.setItem('lgfc_admin_token', 'secret');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          submissions: [],
          inventory: [
            {
              id: 13,
              title: 'Incomplete staged row',
              summary: 'Missing rights metadata.',
              status: 'draft',
              operational_state: 'staged',
              source_name: 'Archive',
              credit_line: 'LGFC Archive',
              allowed_sections: '["club_home"]',
              story_type: 'primary',
              priority: 1,
              canonical: 1,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as never,
    );

    render(<AdminClubStagingPage />);

    expect(await screen.findByRole('button', { name: 'Incomplete staged row' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeDisabled();
      expect(
        screen.getAllByRole('status').some((node) => /Mark reviewed is refused/i.test(node.textContent || '')),
      ).toBe(true);
    });
  });

  it('publishes an approved inventory row from club staging without treating the preview as public', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('lgfc_admin_token', 'secret');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('/api/admin/editorial/publish') && init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true, id: 12, status: 'published', operational_state: 'published' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }) as never;
      }
      return new Response(
        JSON.stringify({
          ok: true,
          submissions: [],
          inventory: [
            {
              id: 12,
              title: 'Approved club spotlight',
              summary: 'Ready to publish from club staging.',
              status: 'draft',
              operational_state: 'approved',
              approved_by: 'Bill',
              source_name: 'Archive',
              credit_line: 'LGFC Archive',
              rights_status: 'owned',
              privacy_flag: 'none',
              allowed_sections: '["club_home"]',
              story_type: 'primary',
              priority: 1,
              canonical: 1,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as never;
    });

    render(<AdminClubStagingPage />);

    expect(await screen.findByRole('button', { name: 'Approved club spotlight' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      const publishCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url).includes('/api/admin/editorial/publish') && (init as RequestInit)?.method === 'POST',
      );
      expect(publishCall).toBeTruthy();
      expect(JSON.parse(String((publishCall?.[1] as RequestInit)?.body))).toMatchObject({
        id: 12,
        action: 'publish',
      });
    });
    expect(screen.getByRole('region', { name: 'Club staging production-like preview' })).toBeInTheDocument();
  });

  it('saves rotation order through the editorial inventory API', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('lgfc_admin_token', 'secret');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('/api/admin/editorial/inventory') && init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true, id: 12, action: 'update' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }) as never;
      }
      return new Response(
        JSON.stringify({
          ok: true,
          submissions: [],
          inventory: [
            {
              id: 12,
              tag: 'club-spotlight',
              title: 'Staged club spotlight',
              text: 'Preview-only inventory row.',
              summary: 'Preview-only inventory row.',
              status: 'draft',
              operational_state: 'staged',
              source_name: 'Archive',
              credit_line: 'LGFC Archive',
              rights_status: 'owned',
              privacy_flag: 'none',
              allowed_sections: '["club_home"]',
              story_type: 'primary',
              priority: 1,
              canonical: 1,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ) as never;
    });

    render(<AdminClubStagingPage />);

    expect(await screen.findByRole('button', { name: 'Save rotation order' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Priority'));
    await user.type(screen.getByLabelText('Priority'), '9');
    await user.selectOptions(screen.getByLabelText('Story type'), 'secondary');
    await user.click(screen.getByRole('button', { name: 'Save rotation order' }));

    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/admin/editorial/inventory') && (init as RequestInit)?.method === 'POST',
      );
      expect(saveCall).toBeTruthy();
      expect(JSON.parse(String((saveCall?.[1] as RequestInit)?.body))).toMatchObject({
        id: 12,
        priority: 9,
        story_type: 'secondary',
        canonical: true,
      });
    });
  });

  it('previews a future published rotation set without treating it as a public route', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('lgfc_admin_token', 'secret');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/admin/editorial/rotation-preview')) {
        return new Response(
          JSON.stringify({
            ok: true,
            section: 'club_home',
            as_of: '2026-09-01T00:00:00.000Z',
            total: 1,
            items: [{ id: 21, title: 'September anniversary lead', score: 180, event_date: '1939-09-01' }],
            note: 'Admin preview of the published rotation ranking. Does not write last_featured or publish.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ) as never;
      }
      return new Response(JSON.stringify({ ok: true, submissions: [], inventory: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as never;
    });

    render(<AdminClubStagingPage />);

    expect(screen.getByRole('heading', { name: 'Future rotation set' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview future rotation set' }));

    expect(await screen.findByRole('list', { name: 'Ranked future rotation set' })).toBeInTheDocument();
    expect(screen.getByText(/September anniversary lead/)).toBeInTheDocument();
    const previewCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/admin/editorial/rotation-preview'));
    expect(previewCall).toBeTruthy();
    expect(String(previewCall?.[0])).toContain('section=club_home');
    expect(screen.getByRole('region', { name: 'Club staging production-like preview' })).toBeInTheDocument();
  });
});
