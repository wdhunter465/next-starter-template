import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemberHomePage from '@/app/fanclub/page';
import ArchivesTiles from '@/components/fanclub/ArchivesTiles';
import {
  clubHomePageLayoutCss,
  clubHomePageStackClassName,
  clubHomeZoneClassName,
} from '@/components/fanclub/clubHomeStyles';

const mockUseMemberSession = vi.fn();

vi.mock('@/hooks/useMemberSession', () => ({
  useMemberSession: (...args: unknown[]) => mockUseMemberSession(...args),
}));

vi.mock('@/components/FloatingLogo', () => ({
  default: () => <div data-testid="floating-logo" />,
}));

vi.mock('@/components/fanclub/AdminLink', () => ({
  default: () => null,
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      source: 'static',
      lead_story: null,
      rail_stories: [],
      archive_spotlight: null,
      media_feature: null,
    }),
  });
  vi.stubGlobal('fetch', mockFetch);
});

describe('Fan Club home newspaper shell (#1688 Task 003)', () => {
  beforeEach(() => {
    mockUseMemberSession.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      email: 'member@example.com',
      role: 'member',
    });
  });

  it('renders newspaper sections in canonical order with static fallbacks', () => {
    render(<MemberHomePage />);

    expect(screen.getByLabelText('Club Home masthead')).toBeInTheDocument();
    expect(screen.getByLabelText('Lead story')).toBeInTheDocument();
    expect(screen.getByLabelText('Secondary story rail')).toBeInTheDocument();
    expect(screen.getByLabelText('Feature link cards')).toBeInTheDocument();
    expect(screen.getByLabelText('Photo and memorabilia feature')).toBeInTheDocument();
    expect(screen.getByLabelText('Member prompt')).toBeInTheDocument();
    expect(screen.getByLabelText('Archive spotlight')).toBeInTheDocument();
    expect(screen.getByLabelText('Campaign module')).toBeInTheDocument();
    expect(screen.getByLabelText('Events callout')).toBeInTheDocument();
    expect(screen.getByLabelText('Recognition tile')).toBeInTheDocument();
    expect(screen.getByLabelText('Submission call to action')).toBeInTheDocument();
  });

  it('uses Gallery, Library, and Memorabilia feature link labels', () => {
    render(<ArchivesTiles />);

    expect(screen.getByRole('link', { name: /Gallery/ })).toHaveAttribute('href', '/fanclub/photo');
    expect(screen.getByRole('link', { name: /Library/ })).toHaveAttribute('href', '/fanclub/library');
    expect(screen.getByRole('link', { name: /Memorabilia/ })).toHaveAttribute('href', '/fanclub/memorabilia');
  });

  it('does not render when the session gate is loading', () => {
    mockUseMemberSession.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      email: null,
      role: null,
    });

    const { container } = render(<MemberHomePage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps numbered zone DOM order and applies responsive composition classes (#3383 P1-01)', () => {
    const { container } = render(<MemberHomePage />);
    const stack = screen.getByLabelText('FanClubHomeSections');
    expect(stack).toHaveClass(clubHomePageStackClassName);

    const zoneLabels = [
      'Club Home masthead',
      'Lead story',
      'Secondary story rail',
      'Feature link cards',
      'Photo and memorabilia feature',
      'Member prompt',
      'Archive spotlight',
      'Campaign module',
      'Events callout',
      'Recognition tile',
      'Submission call to action',
    ];
    const children = Array.from(stack.children);
    const labeledOrder = children
      .map((child) => child.querySelector('[aria-label]')?.getAttribute('aria-label') ?? null)
      .filter((label): label is string => Boolean(label));
    expect(labeledOrder).toEqual(zoneLabels);
    expect(children[0]).toHaveClass('club-home-zone--masthead');
    expect(children[1]).toHaveClass('club-home-zone--lead-story');
    expect(children[2]).toHaveClass('club-home-zone--story-rail');
    expect(children[3]).toHaveClass('club-home-zone--feature-links');
    expect(children[4]).toHaveClass('club-home-zone--media-feature');
    expect(children[5]).toHaveClass('club-home-zone--member-prompt');
    expect(children[11]).toHaveClass(clubHomeZoneClassName.adminLink.split(' ').pop()!);

    const styleTag = container.querySelector('style');
    expect(styleTag?.textContent).toContain('@media (min-width: 768px)');
    expect(styleTag?.textContent).toContain('@media (min-width: 920px)');
    expect(styleTag?.textContent).toContain('grid-template-areas');
    expect(styleTag?.textContent).toContain('"masthead rail"');
    expect(clubHomePageLayoutCss).not.toMatch(/(^|[^a-zA-Z-])order\s*:/);
  });
});
