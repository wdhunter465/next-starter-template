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
});
