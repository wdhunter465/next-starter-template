import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WeeklyMatchup from '@/components/WeeklyMatchup';
import { onRequest as publicMatchupMiddleware } from '../functions/api/matchup/_middleware';
import { onRequest as adminMatchupMiddleware } from '../functions/api/admin/matchup/_middleware';

describe('Weekly Matchup break-glass hold (#3548)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the paused message and makes no media request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<WeeklyMatchup />);

    expect(screen.getByText('Weekly Matchup is temporarily paused.')).toBeInTheDocument();
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
