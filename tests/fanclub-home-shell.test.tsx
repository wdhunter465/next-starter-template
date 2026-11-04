import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemberHomePage from '@/app/fanclub/page';
import ArchivesTiles from '@/components/fanclub/ArchivesTiles';

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
    expect(screen.getByLabelText('Events & Calendar')).toBeInTheDocument();
    expect(screen.getByLabelText('Gehrig timeline')).toBeInTheDocument();
    expect(screen.getByLabelText('Recognition & Partners')).toBeInTheDocument();
    expect(screen.getByLabelText('Lou Gehrig box score')).toBeInTheDocument();
    expect(screen.getByLabelText('American League standings')).toBeInTheDocument();
    expect(screen.getByLabelText('Submission call to action')).toBeInTheDocument();
  });

  it('places Gehrig timeline in the center column below the media feature (#4349, moved by #5066)', () => {
    render(<MemberHomePage />);

    const timeline = screen.getByLabelText('Gehrig timeline');
    const lead = screen.getByLabelText('Lead story');
    const media = screen.getByLabelText('Photo and memorabilia feature');
    const center = timeline.closest('.club-home-col--center');

    expect(center).not.toBeNull();
    expect(center).toContainElement(lead);
    expect(center).toContainElement(media);
    expect(media.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Archive spotlight, Recognition and the box score in the left column in order', () => {
    render(<MemberHomePage />);

    const archive = screen.getByLabelText('Archive spotlight');
    const recognition = screen.getByLabelText('Recognition & Partners');
    const boxScore = screen.getByLabelText('Lou Gehrig box score');

    for (const section of [archive, recognition, boxScore]) {
      expect(section.closest('.club-home-col--left')).not.toBeNull();
    }
    expect(archive.compareDocumentPosition(recognition) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recognition.compareDocumentPosition(boxScore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts Events & Calendar at the bottom of the right column, after AL standings (#5070)', () => {
    render(<MemberHomePage />);

    const events = screen.getByLabelText('Events & Calendar');
    const standings = screen.getByLabelText('American League standings');
    const right = events.closest('.club-home-col--right');

    expect(right).not.toBeNull();
    expect(right).toContainElement(standings);
    expect(standings.compareDocumentPosition(events) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(events.closest('.club-home-col--left')).toBeNull();
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
});
