import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemberHomePage from '@/app/fanclub/page';

const mockUseMemberSession = vi.fn();
const mockFetch = vi.fn();

vi.mock('@/hooks/useMemberSession', () => ({
  useMemberSession: (...args: unknown[]) => mockUseMemberSession(...args),
}));

vi.mock('@/components/FloatingLogo', () => ({
  default: () => <div data-testid="floating-logo" />,
}));

vi.mock('@/components/fanclub/AdminLink', () => ({
  default: () => null,
}));

describe('Fan Club home dynamic content (#1690 Task 005)', () => {
  beforeEach(() => {
    mockUseMemberSession.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      email: 'member@example.com',
      role: 'member',
    });
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('renders dynamic lead story credit when club home API returns inventory', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        source: 'content_inventory',
        lead_story: {
          id: 9,
          title: 'Dynamic lead',
          headline: 'Dynamic lead',
          summary: 'Published club home lead summary.',
          credit: 'Lou Gehrig Society',
          source_name: 'LGFC Archive',
          year: 1939,
          tag: 'iron-horse',
          perspective_label: null,
          canonical: true,
          story_type: 'primary',
        },
        rail_stories: [],
        archive_spotlight: null,
        media_feature: null,
      }),
    });

    render(<MemberHomePage />);

    await waitFor(() => {
      expect(screen.getByText('Dynamic lead')).toBeInTheDocument();
      expect(screen.getByText(/Credit: Lou Gehrig Society/)).toBeInTheDocument();
      expect(screen.getByText(/Source: LGFC Archive/)).toBeInTheDocument();
    });
  });

  // #4180: the lead-story hero slot must only ever show the lead story's own
  // associated image, never the Featured Photo block's unrelated fallback photo
  // (resolveMediaFeature() can fall back to an arbitrary recent photos row when
  // the lead story has no media association of its own).
  it('does not show the Featured Photo fallback image in the lead-story slot when the lead story has no image of its own', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        source: 'content_inventory',
        lead_story: {
          id: 9,
          title: 'Dynamic lead',
          headline: 'Dynamic lead',
          summary: 'Published club home lead summary.',
          credit: 'Lou Gehrig Society',
          source_name: 'LGFC Archive',
          year: 1939,
          tag: 'iron-horse',
          perspective_label: null,
          canonical: true,
          story_type: 'primary',
          image: null,
        },
        rail_stories: [],
        archive_spotlight: null,
        media_feature: {
          thumbnail_url: 'https://cdn.example.com/fallback-photo.jpg',
          media_rendition: 'medium',
          title: 'Unrelated fallback photo',
          description: null,
          credit_line: null,
          source_name: null,
          href: '/fanclub/photo',
          is_memorabilia: false,
        },
      }),
    });

    render(<MemberHomePage />);

    await waitFor(() => {
      expect(screen.getByText('Dynamic lead')).toBeInTheDocument();
    });

    const leadStory = screen.getByLabelText('Lead story');
    expect(within(leadStory).queryByRole('img')).not.toBeInTheDocument();
    // The Featured Photo block itself still renders the fallback photo — only the lead headline slot must not.
    expect(screen.getByRole('img', { name: 'Unrelated fallback photo' })).toBeInTheDocument();
  });

  it('shows the lead story image in the lead-story slot when the lead story has its own associated image', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        source: 'content_inventory',
        lead_story: {
          id: 9,
          title: 'Dynamic lead',
          headline: 'Dynamic lead',
          summary: 'Published club home lead summary.',
          credit: 'Lou Gehrig Society',
          source_name: 'LGFC Archive',
          year: 1939,
          tag: 'iron-horse',
          perspective_label: null,
          canonical: true,
          story_type: 'primary',
          image: {
            url: 'https://cdn.example.com/lead-story.jpg',
            alt: 'Lead story photo',
            credit_line: null,
            source_name: null,
            rendition_size: 'medium',
          },
        },
        rail_stories: [],
        archive_spotlight: null,
        media_feature: null,
      }),
    });

    render(<MemberHomePage />);

    await waitFor(() => {
      const leadStory = screen.getByLabelText('Lead story');
      expect(within(leadStory).getByRole('img', { name: 'Lead story photo' })).toHaveAttribute(
        'src',
        'https://cdn.example.com/lead-story.jpg',
      );
    });
  });

  it('renders the random Gehrig box score and matching AL standings from one API payload', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('/api/fanclub/gehrig-box-score')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            game: {
              game_id: 'NYA192706150',
              game_date: '1927-06-15',
              vis_team: 'BOS',
              home_team: 'NYA',
              vis_score: 3,
              home_score: 7,
              site: 'NYC16',
              batting: [
                {
                  player_id: 'gehrl101',
                  player_label: 'Gehrig',
                  team: 'NYA',
                  batting_order: 4,
                  is_gehrig: true,
                  ab: 4,
                  r: 2,
                  h: 3,
                  hr: 1,
                  rbi: 2,
                },
              ],
              standings: [
                {
                  team: 'NYA',
                  team_label: 'New York',
                  wins: 40,
                  losses: 15,
                  ties: 0,
                  win_pct: 0.7273,
                  games_back: 0,
                  league_rank: 1,
                  is_yankees: true,
                },
              ],
              source_credit: 'The information used here was obtained free of charge from and is copyrighted by Retrosheet.',
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          source: 'static',
          lead_story: null,
          rail_stories: [],
          archive_spotlight: null,
          media_feature: null,
        }),
      };
    });

    render(<MemberHomePage />);

    await waitFor(() => {
      expect(screen.getByText('Gehrig')).toBeInTheDocument();
      expect(screen.getByText('Boston 3 at New York 7')).toBeInTheDocument();
    });
    const standings = screen.getByLabelText('American League standings');
    expect(within(standings).getByText('New York')).toBeInTheDocument();
    expect(screen.getByLabelText('Lead story')).toBeInTheDocument();
    expect(screen.getByLabelText('Secondary story rail')).toBeInTheDocument();
  });
});
