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

  const entries = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    year: 1900 + index,
    event_date: null,
    event_type: 'career',
    title: `Entry ${index + 1}`,
    description: `Short summary ${index + 1}.`,
    detail_body: `Longer narrative ${index + 1}.`,
    source_url: 'https://sabr.org/bioproj/person/lou-gehrig/',
  }));

  it('shows a short teaser spread across the timeline, without narrative or source links', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: entries } as never);

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByText('Entry 1')).toBeInTheDocument();
    });

    // Four entries spread evenly: first, last and two between.
    expect(screen.getByText('Entry 1')).toBeInTheDocument();
    expect(screen.getByText('Entry 4')).toBeInTheDocument();
    expect(screen.getByText('Entry 7')).toBeInTheDocument();
    expect(screen.getByText('Entry 10')).toBeInTheDocument();
    expect(screen.queryByText('Entry 2')).not.toBeInTheDocument();
    expect(screen.queryByText(/Longer narrative/)).not.toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(screen.getByText(/Open the full timeline \(10 entries\)/)).toBeInTheDocument();
    expect(mockedApiGet).toHaveBeenCalledWith('/api/fanclub/timeline?limit=100');
  });

  it('links the whole section to the full timeline page', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: entries } as never);

    render(<GehrigTimeline />);

    const link = await screen.findByRole('link', { name: 'Open the full Gehrig timeline (10 entries)' });
    expect(link).toHaveAttribute('href', '/fanclub/timeline');
    expect(screen.getByLabelText('Gehrig timeline')).toContainElement(link);
  });

  it('shows every entry when there are four or fewer', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: entries.slice(0, 3) } as never);

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByText('Entry 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Entry 2')).toBeInTheDocument();
    expect(screen.getByText('Entry 3')).toBeInTheDocument();
  });

  it('shows fail-closed empty copy when no rows are returned', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: [] } as never);

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByText('No timeline entries are available yet.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows fail-closed error copy when the API is unavailable', async () => {
    mockedApiGet.mockRejectedValue(new Error('api_error_503'));

    render(<GehrigTimeline />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load Gehrig timeline entries right now.')).toBeInTheDocument();
    });
  });
});
