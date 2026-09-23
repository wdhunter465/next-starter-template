import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FriendsOfFanClub from '@/components/FriendsOfFanClub';
import { apiGet } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);

describe('FriendsOfFanClub', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('renders normalized B2-backed friend images from D1 rows', async () => {
    mockedApiGet.mockResolvedValue({
      ok: true,
      items: [
        {
          id: 1,
          name: 'Live Like Lou Foundation',
          kind: 'Partner',
          blurb: 'Supporting ALS awareness.',
          url: 'https://www.livelikelou.org',
          photo_url: 'https://cdn.example.com/lgfc/friends/live-like-lou.png',
        },
      ],
    } as never);

    render(<FriendsOfFanClub />);

    const image = await screen.findByRole('img', { name: 'Live Like Lou Foundation' });
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/lgfc/friends/live-like-lou.png');
    expect(screen.getByRole('link', { name: 'Visit Live Like Lou Foundation' })).toHaveAttribute(
      'href',
      'https://www.livelikelou.org',
    );
  });

  it('falls back to vetted partner entries when the D1 friends API is unavailable', async () => {
    mockedApiGet.mockRejectedValue(new Error('api_error_503'));

    render(<FriendsOfFanClub />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Live Like Lou Foundation' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'ALS Cure Project' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Lou Gehrig Society' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'LouGehrig.com' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('requests the homepage friends surface so LouGehrig.com is not a homepage Friend', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: [] } as never);
    render(<FriendsOfFanClub />);
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith('/api/friends/list?surface=homepage');
    });
  });
});
