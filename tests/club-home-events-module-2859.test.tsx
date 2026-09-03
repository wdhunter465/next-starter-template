import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClubHomeEventsModule from '@/components/fanclub/ClubHomeEventsModule';

describe('#2859 Club Home Events & Calendar module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders posted upcoming events from /api/events/next instead of a deferred placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          items: [
            { id: 1, title: 'Lou Gehrig Day', start_date: '2027-06-02', end_date: '2027-06-02', location: 'Yankee Stadium' },
          ],
        }),
      }),
    );

    render(<ClubHomeEventsModule />);

    await waitFor(() => expect(screen.getByText('Lou Gehrig Day')).toBeInTheDocument());
    expect(screen.getByText(/June 2, 2027/)).toBeInTheDocument();
    expect(screen.getByText(/Yankee Stadium/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View full calendar' })).toHaveAttribute('href', '/events');
  });

  it('shows a not-yet-posted fallback (never a deferred/unconfigured message) when there are no upcoming events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, items: [] }) }),
    );

    render(<ClubHomeEventsModule />);

    await waitFor(() => expect(screen.getByText(/will appear here once posted/)).toBeInTheDocument());
    expect(screen.queryByText(/when the calendar is connected/)).not.toBeInTheDocument();
  });

  it('fails closed to the empty state (not an error) when the events API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<ClubHomeEventsModule />);

    await waitFor(() => expect(screen.getByText(/will appear here once posted/)).toBeInTheDocument());
  });
});
