// #2909 (#2859 Task 004) — cross-route QA: proves that homepage sections
// classified `missing-actionable` on the #2906 launch surface matrix render
// a safe, non-broken empty/fallback state when their backing D1 data is
// absent, rather than crashing, showing a placeholder lie, or leaking a raw
// error. Each test exercises the real component against a real empty/failed
// API response, not an assumption from reading the source.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WeeklyMatchup from '@/components/WeeklyMatchup';
import FAQSection from '@/components/FAQSection';
import FriendsOfFanClub from '@/components/FriendsOfFanClub';
import CalendarSection from '@/components/CalendarSection';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('#2909 matrix P-03 WeeklyMatchup: empty state when fewer than 2 current photos exist', () => {
  it('shows "No matchup available this week." instead of crashing or rendering a partial matchup', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path === '/api/matchup/current') {
        return Promise.resolve(jsonResponse({ ok: true, week_start: null, matchup_id: null, items: [] }));
      }
      return Promise.resolve(jsonResponse({ ok: false }, 404));
    });

    render(<WeeklyMatchup />);

    await waitFor(() => {
      expect(screen.getByText(/No matchup available this week\./i)).toBeInTheDocument();
    });
    // No broken vote UI renders when there's no matchup to vote on.
    expect(screen.queryByRole('button', { name: /vote/i })).not.toBeInTheDocument();
  });
});

describe('#2909 matrix P-11 FAQSection: empty state when zero FAQ rows exist', () => {
  it('shows a clean empty message instead of a broken/empty grid when the API returns zero items', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(jsonResponse({ ok: true, items: [] })));

    render(<FAQSection />);

    await waitFor(() => {
      expect(screen.getByText(/No matching FAQ answers found\./i)).toBeInTheDocument();
    });
  });
});

describe('#2909 matrix P-08 FriendsOfFanClub: falls back to approved default partners, never renders truly empty', () => {
  it('falls back to the three named default partners when the API returns zero items', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(jsonResponse({ ok: true, items: [] })));

    render(<FriendsOfFanClub />);

    await waitFor(() => {
      expect(screen.getByText('Live Like Lou Foundation')).toBeInTheDocument();
    });
    expect(screen.getByText('ALS Cure Project')).toBeInTheDocument();
    expect(screen.getByText('They Played In Color')).toBeInTheDocument();
  });

  it('falls back to the same default partners when the API request fails outright', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(jsonResponse({ ok: false }, 500)));

    render(<FriendsOfFanClub />);

    await waitFor(() => {
      expect(screen.getByText('Live Like Lou Foundation')).toBeInTheDocument();
    });
  });
});

describe('#2909 matrix P-10 CalendarSection: empty state when zero upcoming events exist', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a clean notice instead of a broken calendar grid when the API returns zero items', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/events/next')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [] }));
      }
      return Promise.resolve(jsonResponse({ ok: false }, 404));
    });

    render(<CalendarSection />);

    await waitFor(() => {
      expect(screen.getByText(/No posted events yet for the weeks ahead\. Check back soon\./i)).toBeInTheDocument();
    });
    // The month grid still renders (current month, no events) rather than crashing.
    expect(screen.getByRole('region', { name: /Fan Club Events Calendar/i })).toBeInTheDocument();
  });

  it('shows a clean notice instead of a broken calendar grid when the API request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(jsonResponse({ ok: false }, 500)));

    render(<CalendarSection />);

    await waitFor(() => {
      expect(screen.getByText(/Live schedule is temporarily unavailable\. Check back soon\./i)).toBeInTheDocument();
    });
  });
});
