import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClubHomeRecognitionModule from '@/components/fanclub/ClubHomeRecognitionModule';

describe('#2859 Club Home Recognition & Partners module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders posted partners from /api/friends/list instead of a deferred placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          items: [
            { id: 1, name: 'I AM ALS', blurb: 'Fighting to end ALS.', url: 'https://www.iamals.org/' },
          ],
        }),
      }),
    );

    render(<ClubHomeRecognitionModule />);

    await waitFor(() => expect(screen.getByRole('link', { name: 'I AM ALS' })).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/friends/list?surface=club-home', { cache: 'no-store' });
    expect(screen.getByRole('link', { name: 'I AM ALS' })).toHaveAttribute('href', 'https://www.iamals.org/');
    expect(screen.getByText('Fighting to end ALS.')).toBeInTheDocument();
  });

  it('keeps LouGehrig.com when The Lou Gehrig Society is inserted second after ALS Cure Project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          items: [
            { id: 3, name: 'ALS Cure Project', url: 'https://www.alscure.org' },
            { id: 8, name: 'The Lou Gehrig Society', url: 'https://www.thelougehrigsociety.org/' },
            { id: 6, name: 'I AM ALS', url: 'https://www.iamals.org/' },
            { id: 2, name: 'Live Like Lou Foundation', url: 'https://www.livelikelou.org' },
            { id: 7, name: 'LouGehrig.com', url: 'https://lougehrig.com/' },
          ],
        }),
      }),
    );

    render(<ClubHomeRecognitionModule />);

    await waitFor(() => expect(screen.getByRole('link', { name: 'The Lou Gehrig Society' })).toBeInTheDocument());
    const links = screen.getAllByRole('link').map((node) => node.textContent);
    expect(links.slice(0, 5)).toEqual([
      'ALS Cure Project',
      'The Lou Gehrig Society',
      'I AM ALS',
      'Live Like Lou Foundation',
      'LouGehrig.com',
    ]);
  });

  it('shows a not-yet-posted fallback (never a deferred/unconfigured message) when there are no partners', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, items: [] }) }),
    );

    render(<ClubHomeRecognitionModule />);

    await waitFor(() => expect(screen.getByText(/will appear here once posted/)).toBeInTheDocument());
    expect(screen.queryByText(/when new display features are enabled/)).not.toBeInTheDocument();
  });

  it('fails closed to the empty state (not an error) when the friends API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<ClubHomeRecognitionModule />);

    await waitFor(() => expect(screen.getByText(/will appear here once posted/)).toBeInTheDocument());
  });
});

