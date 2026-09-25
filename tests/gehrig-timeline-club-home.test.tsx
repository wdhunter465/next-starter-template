import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GehrigTimeline from '@/components/fanclub/GehrigTimeline';
import { apiGet } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

describe('Club Home GehrigTimeline (#4349)', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('renders milestone rows from the milestones list API', async () => {
    mockedApiGet.mockResolvedValue({
      ok: true,
      items: [
        { id: 1, year: 1925, title: 'Yankees debut', description: 'First game in pinstripes.' },
        { id: 2, year: 1939, title: 'Farewell', description: null },
      ],
    } as never);

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByLabelText('Gehrig timeline')).toBeInTheDocument();
      expect(screen.getByText(/1925: Yankees debut/)).toBeInTheDocument();
      expect(screen.getByText('First game in pinstripes.')).toBeInTheDocument();
      expect(screen.getByText(/1939: Farewell/)).toBeInTheDocument();
    });

    expect(mockedApiGet).toHaveBeenCalledWith('/api/milestones/list?limit=12');
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
