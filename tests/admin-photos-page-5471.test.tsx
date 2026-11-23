import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AdminPhotosPage from '../src/app/admin/photos/page';

// #5471: block / restore page.

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/photos' }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Admin photos page (#5471)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requires a reason, then blocks a photo and reloads', async () => {
    let blocked = false;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (path.startsWith('/api/admin/photos/list') && method === 'GET') {
        return Promise.resolve(
          json({
            ok: true,
            total: 1,
            items: [{ id: 7, url: '/p/7.jpg', title: 'Gehrig', rights_status: blocked ? 'blocked' : 'unreviewed' }],
          }),
        );
      }
      if (path === '/api/admin/photos/block' && method === 'POST') {
        blocked = true;
        return Promise.resolve(json({ ok: true, id: 7, rights_status: 'blocked' }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${method} ${path}`));
    });

    render(<AdminPhotosPage />);
    const button = await screen.findByRole('button', { name: 'Block photo' });

    fireEvent.click(button);
    await screen.findByText(/enter a reason for photo 7 first/);
    expect(fetchMock.mock.calls.some(([u]) => String(u) === '/api/admin/photos/block')).toBe(false);

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Removal requested' } });
    fireEvent.click(screen.getByRole('button', { name: 'Block photo' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/photos/block',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: 7, blocked: true, reason: 'Removal requested' }) }),
      ),
    );
    await screen.findByRole('button', { name: 'Restore photo' });
  });

  it('shows no restore control for a copyright-restricted photo', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(json({ ok: true, total: 1, items: [{ id: 8, url: '/p/8.jpg', rights_status: 'copyright_restricted' }] })),
    );
    render(<AdminPhotosPage />);
    await screen.findByText(/cannot be restored here/);
    expect(screen.queryByRole('button', { name: /Restore photo|Block photo/ })).toBeNull();
  });
});
