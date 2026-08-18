import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// This suite verifies the break-glass hold mechanism itself still fails
// closed correctly, independent of whatever the flag is currently set to
// in src/lib/matchup-hold.ts (active: false since 2026-08-18, #3552 --
// Product Authority approved reactivation once legacy photos cleared
// rights review). Forcing active: true here keeps this regression
// coverage meaningful without depending on the live flag value.
const HELD = Object.freeze({
  active: true,
  reason: 'media_rights_review',
  message: 'Weekly Matchup is temporarily paused.',
});

vi.mock('@/lib/matchup-hold', () => ({
  WEEKLY_MATCHUP_HOLD: HELD,
  isWeeklyMatchupHeld: () => HELD.active,
}));

const WEEKLY_MATCHUP_HOLD = HELD;

const { default: WeeklyMatchup } = await import('@/components/WeeklyMatchup');
const { onRequest: publicMatchupMiddleware } = await import('../functions/api/matchup/_middleware');
const { onRequest: adminMatchupMiddleware } = await import('../functions/api/admin/matchup/_middleware');

describe('Weekly Matchup break-glass hold (#3548)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the paused message and makes no media request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<WeeklyMatchup />);

    expect(screen.getByText(WEEKLY_MATCHUP_HOLD.message)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['public', publicMatchupMiddleware],
    ['admin', adminMatchupMiddleware],
  ])('fails closed for every %s route before the handler runs', async (_name, middleware) => {
    const next = vi.fn(() => {
      throw new Error('downstream handler must not run while matchup is paused');
    });

    const response = await middleware({ next });

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      paused: true,
      error: 'weekly_matchup_paused',
      reason: 'media_rights_review',
      items: [],
    });
    expect(next).not.toHaveBeenCalled();
  });
});
