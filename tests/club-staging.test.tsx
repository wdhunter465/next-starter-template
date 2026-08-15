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
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeDisabled();
    expect(
      screen.getAllByRole('status').some((node) => /Mark reviewed is refused/i.test(node.textContent || '')),
    ).toBe(true);
  });
});
