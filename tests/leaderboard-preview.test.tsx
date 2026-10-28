import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LeaderboardPreview from '@/app/admin/fundraiser-preview/LeaderboardPreview';
import {
  SAMPLE_LEADERBOARD_SNAPSHOT,
  progressPercent,
  rankParticipants,
  type SnapshotParticipant,
} from '@/lib/givebutterSnapshot';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('leaderboard ranking (#4415: plain totals)', () => {
  const p = (id: string, raised: number, supporters: number, displayName = id): SnapshotParticipant => ({
    id, displayName, raised, goal: null, supporters, pageUrl: null,
  });

  it('ranks by amount raised, then supporters, then name', () => {
    const ranked = rankParticipants([p('b', 100, 2), p('a', 100, 2), p('c', 100, 5), p('d', 300, 1)]);
    expect(ranked.map((x) => x.id)).toEqual(['d', 'c', 'a', 'b']);
  });

  it('computes progress and handles a missing goal', () => {
    expect(progressPercent(2500, 10000)).toBe(25);
    expect(progressPercent(20000, 10000)).toBe(100);
    expect(progressPercent(10, null)).toBeNull();
  });
});

describe('LeaderboardPreview', () => {
  it('shows labeled sample data first, with progress, top participants and teams', () => {
    render(<LeaderboardPreview />);
    expect(screen.getByText('Sample data')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('41');
    expect(screen.getAllByRole('listitem').length).toBe(SAMPLE_LEADERBOARD_SNAPSHOT.participants.length + SAMPLE_LEADERBOARD_SNAPSHOT.teams.length);
  });

  it('says not configured when the endpoint reports so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, configured: false })));
    render(<LeaderboardPreview />);
    fireEvent.click(screen.getByText('Check Givebutter connection'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Not configured'));
    expect(screen.getByText('Sample data')).toBeTruthy();
  });

  it('switches to live data and limits the list to ten participants', async () => {
    const participants = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`, displayName: `Live ${i}`, raised: 1000 - i, goal: null, supporters: 1, pageUrl: null,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          configured: true,
          snapshot: {
            capturedAt: '2027-04-01T12:00:00.000Z',
            campaign: { title: 'Live Campaign', status: 'active', raised: 5000, goal: 10000, supporters: 40 },
            participants,
            teams: [],
          },
        }),
      ),
    );
    render(<LeaderboardPreview />);
    fireEvent.click(screen.getByText('Check Givebutter connection'));
    await waitFor(() => expect(screen.getByText('Live data')).toBeTruthy());
    expect(screen.getByText('Live Campaign')).toBeTruthy();
    expect(screen.getByLabelText('Top participants').querySelectorAll('li').length).toBe(10);
    expect(screen.queryByText('Teams')).toBeNull();
  });

  it('keeps the last good live snapshot and shows an error when a refresh fails', async () => {
    const live = {
      ok: true,
      configured: true,
      snapshot: {
        capturedAt: '2027-04-01T12:00:00.000Z',
        campaign: { title: 'Live Campaign', status: 'active', raised: 5000, goal: 10000, supporters: 40 },
        participants: [{ id: 'x', displayName: 'Live X', raised: 5000, goal: null, supporters: 40, pageUrl: null }],
        teams: [],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(live))
      .mockResolvedValueOnce(jsonResponse({ ok: false, configured: true, error: 'http_error' }, 502));
    vi.stubGlobal('fetch', fetchMock);

    render(<LeaderboardPreview />);
    fireEvent.click(screen.getByText('Check Givebutter connection'));
    await waitFor(() => expect(screen.getByText('Live X', { exact: false })).toBeTruthy());

    fireEvent.click(screen.getByText('Check Givebutter connection'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Live X', { exact: false })).toBeTruthy();
    expect(screen.getByText('Live data')).toBeTruthy();
  });
});
