import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GehrigTimeline from '@/components/fanclub/GehrigTimeline';
import { apiGet } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

describe('Club Home GehrigTimeline (#3161)', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('renders the full detailed timeline from the members-only endpoint', async () => {
    mockedApiGet.mockResolvedValue({
      ok: true,
      items: [
        {
          id: 1,
          year: 1925,
          event_date: '1925-06-01',
          event_type: 'career',
          title: 'Begins the historic consecutive-games streak',
          description: 'Short summary.',
          detail_body: 'Longer, well-researched narrative for members.',
          source_url: 'https://sabr.org/bioproj/person/lou-gehrig/',
        },
        { id: 2, year: 1939, title: 'Farewell', description: null },
      ],
    } as never);

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByLabelText('Gehrig timeline')).toBeInTheDocument();
      expect(screen.getByText(/June 1, 1925: Begins the historic consecutive-games streak/)).toBeInTheDocument();
      expect(screen.getByText('Longer, well-researched narrative for members.')).toBeInTheDocument();
      expect(screen.getByText('Source')).toBeInTheDocument();
      expect(screen.getByText(/1939: Farewell/)).toBeInTheDocument();
    });

    expect(mockedApiGet).toHaveBeenCalledWith('/api/fanclub/timeline?limit=100');
  });

  it('shows fail-closed empty copy when no rows are returned', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: [] } as never);

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByText('No timeline entries are available yet.')).toBeInTheDocument();
    });
  });

  it('shows fail-closed error copy when the API is unavailable', async () => {
    mockedApiGet.mockRejectedValue(new Error('api_error_503'));

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load Gehrig timeline entries right now.')).toBeInTheDocument();
    });
  });
});
