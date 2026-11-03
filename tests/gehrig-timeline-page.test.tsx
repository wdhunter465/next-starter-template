import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FanclubTimelinePage from '@/app/fanclub/timeline/page';
import { apiGet } from '@/lib/api';
import { useMemberSession } from '@/hooks/useMemberSession';

vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));
vi.mock('@/hooks/useMemberSession', () => ({ useMemberSession: vi.fn() }));

const mockedApiGet = vi.mocked(apiGet);
const mockedSession = vi.mocked(useMemberSession);

describe('/fanclub/timeline full timeline page (#5068)', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
    mockedSession.mockReset();
    mockedSession.mockReturnValue({ isLoading: false, isAuthenticated: true, email: 'm@example.com', role: 'member' } as never);
  });

  it('shows every entry with narrative, type label and source link', async () => {
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

    render(<FanclubTimelinePage />);

    await waitFor(() => {
      expect(screen.getByText(/June 1, 1925: Begins the historic consecutive-games streak/)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Gehrig Timeline' })).toBeInTheDocument();
    expect(screen.getByText('Longer, well-researched narrative for members.')).toBeInTheDocument();
    expect(screen.getByText(/· Career/)).toBeInTheDocument();
    expect(screen.getByText('Source')).toHaveAttribute('href', 'https://sabr.org/bioproj/person/lou-gehrig/');
    expect(screen.getByText(/1939: Farewell/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Club Home/ })).toHaveAttribute('href', '/fanclub');
  });

  it('shows fail-closed copy when the API is unavailable', async () => {
    mockedApiGet.mockRejectedValue(new Error('api_error_503'));

    render(<FanclubTimelinePage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load Gehrig timeline entries right now.')).toBeInTheDocument();
    });
  });

  it('renders nothing for a non-member', () => {
    mockedSession.mockReturnValue({ isLoading: false, isAuthenticated: false, email: null, role: null } as never);

    const { container } = render(<FanclubTimelinePage />);

    expect(container).toBeEmptyDOMElement();
    expect(mockedApiGet).not.toHaveBeenCalled();
  });
});
