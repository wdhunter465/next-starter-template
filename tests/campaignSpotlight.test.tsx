import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CampaignSpotlightCard from '@/components/home/CampaignSpotlightCard';
import CampaignSpotlightSlot from '@/components/home/CampaignSpotlightSlot';
import {
  CAMPAIGN_SPOTLIGHT_GIVEBUTTER_AUCTION_URL,
  CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL,
  CAMPAIGN_SPOTLIGHT_KEY,
  defaultCampaignSpotlightConfig,
  parseCampaignSpotlightConfig,
  serializeCampaignSpotlightConfig,
  buildPersistedCampaignConfig,
  getCampaignSpotlightLinkProps,
  getCampaignSpotlightPrimaryCtaForDisplay,
  getCampaignSpotlightSecondaryCtaForDisplay,
  snapshotLeaderboardFromFundraiser,
  validateCampaignSpotlightConfig,
  type CampaignSpotlightConfig,
  type CampaignSpotlightLeaderboardEntry,
} from '@/lib/campaignSpotlight';

function sampleLeaderboard(): CampaignSpotlightLeaderboardEntry[] {
  return [
    { name: 'New York Yankees', type: 'team', funds: 1200, supporters: 4, points: 4800 },
    { name: 'Detroit Tigers', type: 'team', funds: 900, supporters: 3, points: 2700 },
    { name: 'Cleveland Guardians', type: 'team', funds: 750, supporters: 2, points: 1500 },
  ];
}

function validConfig(overrides: Partial<CampaignSpotlightConfig> = {}): CampaignSpotlightConfig {
  return {
    ...defaultCampaignSpotlightConfig,
    enabled: true,
    eyebrow: 'ALS Fundraiser 2026',
    badge: '',
    title: 'Support the Campaign',
    description: 'Help fund ALS research and patient support.',
    primaryCtaLabel: 'Donate Now',
    primaryCtaHref: CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL,
    secondaryCtaLabel: 'View Auction',
    secondaryCtaHref: CAMPAIGN_SPOTLIGHT_GIVEBUTTER_AUCTION_URL,
    progressLabel: 'Campaign Progress',
    goalAmount: '$25,000',
    raisedAmount: '$1,000',
    supporterCount: '12 supporters',
    deadlineLabel: 'Closes June 2, 2026',
    note: 'Published snapshot for homepage display.',
    archiveLabel: '',
    leaderboard: sampleLeaderboard(),
    ...overrides,
  };
}

function mockCmsGetResponse(payload: {
  httpOk?: boolean;
  cmsOk?: boolean;
  publishedBodyMd?: string | null;
  block?: null;
  jsonError?: boolean;
}) {
  const {
    httpOk = true,
    cmsOk = true,
    publishedBodyMd,
    block,
    jsonError = false,
  } = payload;

  return vi.fn().mockResolvedValue({
    ok: httpOk,
    json: async () => {
      if (jsonError) {
        throw new Error('invalid json');
      }

      if (block === null) {
        return { ok: cmsOk, block: null };
      }

      return {
        ok: cmsOk,
        block: {
          published_body_md: publishedBodyMd ?? null,
        },
      };
    },
  });
}

describe('campaignSpotlight config helpers', () => {
  it('returns null for empty or invalid JSON payloads', () => {
    expect(parseCampaignSpotlightConfig(null)).toBeNull();
    expect(parseCampaignSpotlightConfig(undefined)).toBeNull();
    expect(parseCampaignSpotlightConfig('   ')).toBeNull();
    expect(parseCampaignSpotlightConfig('not-json')).toBeNull();
    expect(parseCampaignSpotlightConfig('123')).toBeNull();
    expect(parseCampaignSpotlightConfig('"campaign"')).toBeNull();
  });

  it('parses a valid config and applies defaults for missing fields', () => {
    const parsed = parseCampaignSpotlightConfig(
      JSON.stringify({
        enabled: true,
        title: 'ALS Fundraiser 2026',
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.enabled).toBe(true);
    expect(parsed?.title).toBe('ALS Fundraiser 2026');
    expect(parsed?.eyebrow).toBe(defaultCampaignSpotlightConfig.eyebrow);
    expect(parsed?.primaryCtaHref).toBe(defaultCampaignSpotlightConfig.primaryCtaHref);
  });

  it('reports validation errors for missing required fields', () => {
    const parsed = parseCampaignSpotlightConfig(
      JSON.stringify({
        enabled: true,
        title: '',
        description: '',
      }),
    );

    const errors = validateCampaignSpotlightConfig(parsed);
    expect(errors).toContain('title is required.');
    expect(errors).toContain('description is required.');
  });

  it('rejects href values that are not relative or absolute URLs', () => {
    const parsed = parseCampaignSpotlightConfig(
      JSON.stringify(
        validConfig({
          primaryCtaHref: 'givebutter.com/campaign',
          secondaryCtaHref: 'ftp://example.com',
        }),
      ),
    );

    const errors = validateCampaignSpotlightConfig(parsed);
    expect(errors).toContain('primaryCtaHref must start with / or http(s)://.');
    expect(errors).toContain('secondaryCtaHref must start with / or http(s)://.');
  });

  it('accepts a fully valid enabled config', () => {
    const config = validConfig();
    expect(validateCampaignSpotlightConfig(config)).toEqual([]);
    expect(validateCampaignSpotlightConfig(parseCampaignSpotlightConfig(serializeCampaignSpotlightConfig(config)))).toEqual(
      [],
    );
  });

  it('allows an empty secondary CTA href', () => {
    const config = validConfig({ secondaryCtaHref: '', secondaryCtaLabel: '' });
    expect(validateCampaignSpotlightConfig(config)).toEqual([]);
  });

  it('requires a complete leaderboard when the campaign is enabled', () => {
    const config = validConfig({ leaderboard: [] });
    expect(validateCampaignSpotlightConfig(config)).toContain(
      'leaderboard must include at least 3 entries.',
    );
  });

  it('rejects malformed leaderboard payloads during parse', () => {
    expect(
      parseCampaignSpotlightConfig(
        JSON.stringify(
          validConfig({
            leaderboard: [{ name: 'Broken', type: 'team', funds: -1, supporters: 1, points: 0 }],
          }),
        ),
      ),
    ).toBeNull();
  });

  it('snapshots the top three fundraiser teams for published snapshots', () => {
    expect(snapshotLeaderboardFromFundraiser()).toEqual([
      { name: 'New York Yankees', type: 'team', funds: 0, supporters: 0, points: 0 },
      { name: 'Detroit Tigers', type: 'team', funds: 0, supporters: 0, points: 0 },
      { name: 'Cleveland Guardians', type: 'team', funds: 0, supporters: 0, points: 0 },
    ]);
  });

  it('preserves a valid leaderboard and snapshots only when missing or invalid', () => {
    const valid = validConfig();
    expect(buildPersistedCampaignConfig(valid)).toBe(valid);

    const missing = validConfig({ leaderboard: [] });
    const snapshotted = buildPersistedCampaignConfig(missing);
    expect(validateCampaignSpotlightConfig(snapshotted)).toEqual([]);
    expect(snapshotted.leaderboard).toHaveLength(3);

    const disabled = validConfig({ enabled: false, leaderboard: [] });
    expect(buildPersistedCampaignConfig(disabled)).toEqual(disabled);
  });

  it('uses Givebutter campaign URLs in the default config', () => {
    expect(defaultCampaignSpotlightConfig.primaryCtaHref).toBe(CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL);
    expect(defaultCampaignSpotlightConfig.secondaryCtaHref).toBe(CAMPAIGN_SPOTLIGHT_GIVEBUTTER_AUCTION_URL);
    expect(defaultCampaignSpotlightConfig.goalAmount).toBe('$10,000');
    expect(defaultCampaignSpotlightConfig.deadlineLabel).toBe(
      'Opens 2027-03-25. Closes 2027-06-07 at 12:00 PM Eastern.',
    );
    expect(defaultCampaignSpotlightConfig.enabled).toBe(false);
    expect(defaultCampaignSpotlightConfig.primaryCtaHref).not.toContain('/charities');
    expect(defaultCampaignSpotlightConfig.secondaryCtaHref).not.toContain('/charities');
  });

  it('rejects placeholder /charities CTAs for enabled campaigns', () => {
    const config = validConfig({
      primaryCtaHref: '/charities',
      secondaryCtaHref: '/charities',
    });

    const errors = validateCampaignSpotlightConfig(config);
    expect(errors).toContain('primaryCtaHref must not use the placeholder /charities route when enabled.');
    expect(errors).toContain('secondaryCtaHref must not use the placeholder /charities route when enabled.');
  });

  it('normalizes placeholder CTAs to Givebutter URLs when persisting enabled campaigns', () => {
    const persisted = buildPersistedCampaignConfig(
      validConfig({
        primaryCtaHref: '/charities',
        secondaryCtaHref: '/charities',
        leaderboard: [],
      }),
    );

    expect(persisted.primaryCtaHref).toBe(CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL);
    expect(persisted.secondaryCtaHref).toBe(CAMPAIGN_SPOTLIGHT_GIVEBUTTER_AUCTION_URL);
    expect(validateCampaignSpotlightConfig(persisted)).toEqual([]);
  });

  it('exposes external link props for Givebutter CTAs', () => {
    expect(getCampaignSpotlightLinkProps(CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL)).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(getCampaignSpotlightLinkProps('HTTPS://givebutter.com/LouGehrigFanClub2026')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(getCampaignSpotlightLinkProps('//givebutter.com/LouGehrigFanClub2026')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(getCampaignSpotlightLinkProps('/join')).toEqual({});
    expect(getCampaignSpotlightLinkProps(CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL, 'Donate Now')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': 'Donate Now (opens in new tab)',
    });
  });

  it('does not emit duplicate primary CTA required errors', () => {
    const config = validConfig({ primaryCtaHref: '' });
    const errors = validateCampaignSpotlightConfig(config);
    expect(errors.filter((error) => error === 'primaryCtaHref is required.')).toHaveLength(1);
  });

  it('preserves intentionally blank secondary CTAs when persisting enabled campaigns', () => {
    const persisted = buildPersistedCampaignConfig(
      validConfig({
        secondaryCtaLabel: 'View Auction',
        secondaryCtaHref: '',
        leaderboard: [],
      }),
    );

    expect(persisted.secondaryCtaHref).toBe('');
    expect(validateCampaignSpotlightConfig(persisted)).toEqual([]);
  });
});

describe('CampaignSpotlightCard CTA rendering', () => {
  it('renders Givebutter CTAs with safe external link handling', () => {
    render(<CampaignSpotlightCard config={validConfig()} />);

    const primary = screen.getByTestId('campaign-spotlight-primary-cta');
    const secondary = screen.getByTestId('campaign-spotlight-secondary-cta');

    expect(primary).toHaveAttribute('href', CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL);
    expect(primary).toHaveAttribute('target', '_blank');
    expect(primary).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Donate Now (opens in new tab)' })).toBe(primary);

    expect(secondary).toHaveAttribute('href', CAMPAIGN_SPOTLIGHT_GIVEBUTTER_AUCTION_URL);
    expect(secondary).toHaveAttribute('target', '_blank');
    expect(secondary).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'View Auction (opens in new tab)' })).toBe(secondary);
  });

  it('suppresses malformed primary CTA links without breaking the card', () => {
    render(
      <CampaignSpotlightCard
        config={validConfig({
          primaryCtaHref: 'givebutter.com/campaign',
        })}
      />,
    );

    expect(screen.queryByTestId('campaign-spotlight-primary-cta')).not.toBeInTheDocument();
    expect(screen.getByTestId('campaign-spotlight-secondary-cta')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Support the Campaign' })).toBeInTheDocument();
  });

  it('suppresses placeholder /charities CTAs on the card', () => {
    render(
      <CampaignSpotlightCard
        config={validConfig({
          primaryCtaHref: '/charities',
          secondaryCtaHref: '/charities',
        })}
      />,
    );

    expect(screen.queryByTestId('campaign-spotlight-primary-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('campaign-spotlight-secondary-cta')).not.toBeInTheDocument();
    expect(getCampaignSpotlightPrimaryCtaForDisplay(validConfig({ primaryCtaHref: '/charities' }))).toBeNull();
    expect(getCampaignSpotlightSecondaryCtaForDisplay(validConfig({ secondaryCtaHref: '/charities' }))).toBeNull();
  });
});

describe('CampaignSpotlightCard leaderboard rendering', () => {
  it('renders the top three leaderboard rows for a valid snapshot', () => {
    render(<CampaignSpotlightCard config={validConfig()} />);

    expect(screen.getByTestId('campaign-spotlight-leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Top Teams')).toBeInTheDocument();
    expect(screen.getByText('New York Yankees')).toBeInTheDocument();
    expect(screen.getByText('Detroit Tigers')).toBeInTheDocument();
    expect(screen.getByText('Cleveland Guardians')).toBeInTheDocument();
    expect(screen.getByText('4,800 points')).toBeInTheDocument();
  });

  it('suppresses leaderboard rendering when the snapshot is incomplete', () => {
    render(<CampaignSpotlightCard config={validConfig({ leaderboard: sampleLeaderboard().slice(0, 2) })} />);

    expect(screen.queryByTestId('campaign-spotlight-leaderboard')).not.toBeInTheDocument();
  });

  it('suppresses leaderboard rendering when leaderboard entries are malformed', () => {
    render(
      <CampaignSpotlightCard
        config={validConfig({
          leaderboard: [
            { name: 'Broken', type: 'team', funds: Number.NaN, supporters: 1, points: 0 },
            ...sampleLeaderboard(),
          ],
        })}
      />,
    );

    expect(screen.queryByTestId('campaign-spotlight-leaderboard')).not.toBeInTheDocument();
  });
});

describe('CampaignSpotlightCard operational rendering', () => {
  it('keeps campaign content visible when leaderboard data is incomplete', () => {
    render(<CampaignSpotlightCard config={validConfig({ leaderboard: sampleLeaderboard().slice(0, 2) })} />);

    expect(screen.getByRole('heading', { name: 'Support the Campaign' })).toBeInTheDocument();
    expect(screen.getByTestId('campaign-spotlight-primary-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-spotlight-leaderboard')).not.toBeInTheDocument();
  });

  it('renders a single primary CTA when the optional secondary CTA is intentionally blank', () => {
    render(
      <CampaignSpotlightCard
        config={validConfig({
          secondaryCtaLabel: '',
          secondaryCtaHref: '',
        })}
      />,
    );

    expect(screen.getByTestId('campaign-spotlight-primary-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-spotlight-secondary-cta')).not.toBeInTheDocument();
  });

  it('renders long fundraiser labels without collapsing the card shell', () => {
    render(
      <CampaignSpotlightCard
        config={validConfig({
          title: 'ALS Fundraiser 2026 Community Championship Weekend Spotlight',
          description:
            'Support Lou Gehrig Fan Club members and teams competing across the full Givebutter campaign weekend with every donation and registration.',
          leaderboard: [
            {
              name: 'New York Yankees Community All-Stars and Families Fundraising Collective',
              type: 'team',
              funds: 1200,
              supporters: 4,
              points: 4800,
            },
            ...sampleLeaderboard().slice(1),
          ],
        })}
      />,
    );

    expect(screen.getByRole('region', { name: 'Campaign spotlight' })).toBeInTheDocument();
    expect(
      screen.getByText('New York Yankees Community All-Stars and Families Fundraising Collective'),
    ).toBeInTheDocument();
  });

  it('applies accessible labels to external Givebutter CTAs', () => {
    render(<CampaignSpotlightCard config={validConfig()} />);

    expect(screen.getByTestId('campaign-spotlight-primary-cta')).toHaveAttribute(
      'aria-label',
      'Donate Now (opens in new tab)',
    );
    expect(screen.getByTestId('campaign-spotlight-secondary-cta')).toHaveAttribute(
      'aria-label',
      'View Auction (opens in new tab)',
    );
  });
});

describe('CampaignSpotlightSlot fail-closed behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests the published CMS block for the campaign spotlight key', async () => {
    const fetchMock = mockCmsGetResponse({
      publishedBodyMd: serializeCampaignSpotlightConfig(validConfig()),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/cms/get?key=${encodeURIComponent(CAMPAIGN_SPOTLIGHT_KEY)}`,
        { cache: 'no-store' },
      );
    });
  });

  it('renders nothing when the CMS request fails', async () => {
    vi.stubGlobal('fetch', mockCmsGetResponse({ httpOk: false, publishedBodyMd: null }));

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when CMS responds without a published body', async () => {
    vi.stubGlobal('fetch', mockCmsGetResponse({ publishedBodyMd: null }));

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when CMS ok is false', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        cmsOk: false,
        publishedBodyMd: serializeCampaignSpotlightConfig(validConfig()),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when published JSON is invalid', async () => {
    vi.stubGlobal('fetch', mockCmsGetResponse({ publishedBodyMd: '{not-json' }));

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when validation fails', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: serializeCampaignSpotlightConfig(
          validConfig({
            title: '',
          }),
        ),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when leaderboard data is missing for an enabled campaign', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: serializeCampaignSpotlightConfig(validConfig({ leaderboard: [] })),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when leaderboard data is malformed in the published snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: JSON.stringify({
          ...validConfig(),
          leaderboard: [{ name: 'Broken', type: 'team', funds: -5, supporters: 1, points: 0 }],
        }),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when published config is enabled but missing required CTA label', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: serializeCampaignSpotlightConfig(
          validConfig({
            primaryCtaLabel: '',
          }),
        ),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when primary CTA uses the placeholder /charities route', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: serializeCampaignSpotlightConfig(
          validConfig({
            primaryCtaHref: '/charities',
          }),
        ),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when enabled is false', async () => {
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: serializeCampaignSpotlightConfig(validConfig({ enabled: false })),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders nothing when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network failure')),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('campaign-spotlight')).not.toBeInTheDocument();
  });

  it('renders the spotlight section when published config is valid and enabled', async () => {
    const config = validConfig({ title: 'Support the Campaign' });
    vi.stubGlobal(
      'fetch',
      mockCmsGetResponse({
        publishedBodyMd: serializeCampaignSpotlightConfig(config),
      }),
    );

    render(<CampaignSpotlightSlot />);

    await waitFor(() => {
      expect(screen.getByTestId('campaign-spotlight')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Support the Campaign' })).toBeInTheDocument();
    const primary = screen.getByTestId('campaign-spotlight-primary-cta');
    expect(primary).toHaveAttribute('href', CAMPAIGN_SPOTLIGHT_GIVEBUTTER_CAMPAIGN_URL);
    expect(primary).toHaveAttribute('target', '_blank');
    expect(primary).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByTestId('campaign-spotlight-leaderboard')).toBeInTheDocument();
    expect(screen.getByText('New York Yankees')).toBeInTheDocument();
  });
});
