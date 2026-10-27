import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FundraiserDailyDetailsFeed from '@/components/fundraiser/FundraiserDailyDetailsFeed';
import FundraiserDailyDetailsTeaser from '@/components/home/FundraiserDailyDetailsTeaser';

const item = {
  key: 'home.fundraiser-daily-details.2027-03-25',
  title: 'Opening day note',
  body_md: 'A public update.',
  image_url: null,
  image_alt: null,
  published_at: '2027-03-25T12:00:00Z',
};

function listResponse(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fundraiser hidden when inactive (#4470)', () => {
  it('hides the home teaser when no fundraiser update is published', async () => {
    vi.stubGlobal('fetch', listResponse({ ok: true, items: [] }));

    const { container } = render(<FundraiserDailyDetailsTeaser />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('fundraiser-daily-details-teaser')).not.toBeInTheDocument();
  });
});

describe('fundraiser degraded and fail-closed (#4470)', () => {
  it('hides the home teaser when the list request fails', async () => {
    vi.stubGlobal('fetch', listResponse({ ok: false }, false));

    const { container } = render(<FundraiserDailyDetailsTeaser />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('hides the home teaser when the list request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { container } = render(<FundraiserDailyDetailsTeaser />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the feed error and no items when the list request fails', async () => {
    vi.stubGlobal('fetch', listResponse({ ok: false }, false));

    render(<FundraiserDailyDetailsFeed />);

    expect(await screen.findByText('Error loading fundraiser updates.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(item.title)).not.toBeInTheDocument();
  });

  it('shows the feed error and no items when the list request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<FundraiserDailyDetailsFeed />);

    expect(await screen.findByText('Error loading fundraiser updates.')).toBeInTheDocument();
    expect(screen.queryByText(item.title)).not.toBeInTheDocument();
  });

  it('shows the empty message when the campaign has no updates', async () => {
    vi.stubGlobal('fetch', listResponse({ ok: true, items: [] }));

    render(<FundraiserDailyDetailsFeed />);

    expect(await screen.findByText('No fundraiser updates posted yet — check back soon.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a published update when the list succeeds', async () => {
    vi.stubGlobal('fetch', listResponse({ ok: true, items: [item] }));

    render(<FundraiserDailyDetailsTeaser />);

    expect(await screen.findByTestId('fundraiser-daily-details-teaser')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: item.title })).toBeInTheDocument();
    expect(screen.queryByText(/donor/i)).not.toBeInTheDocument();
  });
});
