import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PhotoCreditEditor from '@/components/admin/PhotoCreditEditor';

// #4166: admin-only photo credit editor backing the Weekly Matchup
// "Credit: ..." line.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PhotoCreditEditor (#4166)', () => {
  it('loads and pre-fills the current credit, then saves an edited value', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      const method = String(init?.method || 'GET').toUpperCase();

      if (path === '/api/admin/photos/get?id=42' && method === 'GET') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            item: { id: 42, url: '/photos/42.jpg', title: 'Gehrig portrait', source: 'Old Credit' },
          }),
        );
      }
      if (path === '/api/admin/photos/update' && method === 'POST') {
        return Promise.resolve(jsonResponse({ ok: true, id: 42, source: 'New Credit', changed: 1 }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${method} ${path}`));
    });

    render(<PhotoCreditEditor photoId={42} label="Photo A" />);

    const input = await screen.findByDisplayValue('Old Credit');
    fireEvent.change(input, { target: { value: 'New Credit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save credit' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/photos/update',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: 42, source: 'New Credit' }) }),
      );
    });

    await screen.findByText('Saved: "New Credit"');
  });

  it('shows an error status when the load fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path === '/api/admin/photos/get?id=99') {
        return Promise.resolve(jsonResponse({ ok: false, error: 'not_found' }, 404));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<PhotoCreditEditor photoId={99} label="Photo B" />);

    await screen.findByText('Error: not_found');
  });
});
