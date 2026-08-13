import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WeeklyMatchup, { weeklyVoteStorageKey } from '@/components/WeeklyMatchup';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const currentWeek = '2026-06-01';

function mockVotedMatchupFetch(lastWeek: Record<string, unknown> | null) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = String(input);

    if (path === '/api/matchup/current') {
      return Promise.resolve(
        jsonResponse({
          ok: true,
          week_start: currentWeek,
          matchup_id: 2,
          items: [
            { id: 10, url: '/photos/10.jpg', title: 'Current A' },
            { id: 11, url: '/photos/11.jpg', title: 'Current B' },
          ],
        }),
      );
    }

    if (path.startsWith('/api/matchup/results')) {
      return Promise.resolve(
        jsonResponse({
          ok: true,
          week_start: currentWeek,
          totals: { a: 4, b: 2 },
          last_week: lastWeek,
        }),
      );
    }

    return Promise.reject(new Error(`Unexpected fetch: ${path}`));
  });
}

describe('WeeklyMatchup last closed week winner thumbnail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(weeklyVoteStorageKey(currentWeek, 10, 11), '1');
  });

  it('unlocks voting when the current pair changes mid-week', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(weeklyVoteStorageKey(currentWeek, 10, 11), '1');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path === '/api/matchup/current') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: currentWeek,
            matchup_id: 2,
            items: [
              { id: 20, url: '/photos/20.jpg', title: 'Replacement A' },
              { id: 21, url: '/photos/21.jpg', title: 'Replacement B' },
            ],
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vote A' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vote B' })).toBeInTheDocument();
    });
  });

  it('unlocks when server vote totals were reset to zero for the current pair', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(weeklyVoteStorageKey(currentWeek, 10, 11), '1');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path === '/api/matchup/current') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: currentWeek,
            matchup_id: 2,
            items: [
              { id: 10, url: '/photos/10.jpg', title: 'Current A' },
              { id: 11, url: '/photos/11.jpg', title: 'Current B' },
            ],
          }),
        );
      }
      if (path.startsWith('/api/matchup/results')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: currentWeek,
            totals: { a: 0, b: 0 },
            last_week: null,
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vote A' })).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(weeklyVoteStorageKey(currentWeek, 10, 11))).toBeNull();
  });

  it('clears the legacy week-only vote lock when a replacement pair loads', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(`lgfc_weekly_vote_${currentWeek}`, '1');

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path === '/api/matchup/current') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: currentWeek,
            matchup_id: 2,
            items: [
              { id: 20, url: '/photos/20.jpg', title: 'Replacement A' },
              { id: 21, url: '/photos/21.jpg', title: 'Replacement B' },
            ],
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vote A' })).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(`lgfc_weekly_vote_${currentWeek}`)).toBeNull();
  });

  it('reports broken photo for audit without expecting mid-week pair mutation (#3028)', async () => {
    window.localStorage.clear();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);
      const method = String(init?.method || 'GET').toUpperCase();

      if (path === '/api/matchup/current') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: currentWeek,
            matchup_id: 2,
            items: [
              { id: 10, url: '/photos/10.jpg', title: 'Current A' },
              { id: 11, url: '/photos/broken.jpg', title: 'Broken B' },
            ],
          }),
        );
      }

      if (path === '/api/matchup/repair' && method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: currentWeek,
            matchup_id: 2,
            repaired: false,
            mutated: false,
            mutation_blocked: true,
            items: [
              { id: 10, url: '/photos/10.jpg', title: 'Current A' },
              { id: 11, url: '/photos/broken.jpg', title: 'Broken B' },
            ],
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${method} ${path}`));
    });

    render(<WeeklyMatchup />);

    await screen.findByText('Broken B');
    const images = screen.getAllByRole('img', { name: 'Lou Gehrig' });
    const brokenImg = images.find((img) => img.getAttribute('src') === '/photos/broken.jpg');
    expect(brokenImg).toBeTruthy();
    fireEvent.error(brokenImg!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/matchup/repair',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ broken_photo_id: 11 }),
        }),
      );
    });
    expect(screen.getByText('Broken B')).toBeInTheDocument();
    expect(screen.queryByText('Replacement B')).not.toBeInTheDocument();
  });

  it('renders winner A thumbnail and keeps result text', async () => {
    mockVotedMatchupFetch({
      week_start: '2026-05-25',
      totals: { a: 5, b: 2 },
      winner: 'a',
      winner_photo: { id: 10, url: 'https://cdn.example/winner-a.jpg', alt: 'Winner A' },
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByText(/Last closed week \(2026-05-25\): A 5 · B 2 · Winner: A/i)).toBeInTheDocument();
    });

    const thumb = screen.getByRole('img', { name: 'Winner A' });
    expect(thumb).toHaveAttribute('src', 'https://cdn.example/winner-a.jpg');
  });

  it('renders winner B thumbnail', async () => {
    mockVotedMatchupFetch({
      week_start: '2026-05-25',
      totals: { a: 1, b: 7 },
      winner: 'b',
      winner_photo: { id: 11, url: 'https://cdn.example/winner-b.jpg', alt: 'Winner B' },
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Winner B' })).toHaveAttribute('src', 'https://cdn.example/winner-b.jpg');
    });
  });

  it('does not render a thumbnail for tie results', async () => {
    mockVotedMatchupFetch({
      week_start: '2026-05-25',
      totals: { a: 3, b: 3 },
      winner: 'tie',
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByText(/Winner: TIE/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('img', { name: /last week winning photo/i })).not.toBeInTheDocument();
  });

  it('fails closed when winner photo metadata is missing', async () => {
    mockVotedMatchupFetch({
      week_start: '2026-05-25',
      totals: { a: 6, b: 1 },
      winner: 'a',
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByText(/Winner: A/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('img', { name: /last week winning photo/i })).not.toBeInTheDocument();
  });

  it('hides thumbnail when image load fails', async () => {
    mockVotedMatchupFetch({
      week_start: '2026-05-25',
      totals: { a: 6, b: 1 },
      winner: 'a',
      winner_photo: { id: 10, url: 'https://cdn.example/broken.jpg', alt: 'Broken winner' },
    });

    render(<WeeklyMatchup />);

    const thumb = await screen.findByRole('img', { name: 'Broken winner' });
    fireEvent.error(thumb);

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Broken winner' })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Winner: A/i)).toBeInTheDocument();
  });
});
