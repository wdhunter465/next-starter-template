import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SocialWall from '@/components/SocialWall';
import { SOCIAL_WALL_WIDGET_ID } from '@/lib/socialFallbacks';

describe('SocialWall (#2044 / #4346)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows loading copy before the widget resolves', () => {
    render(<SocialWall />);
    expect(screen.getByText('Loading social wall content...')).toBeInTheDocument();
  });

  it('shows platform fallback links when the widget never renders', () => {
    render(<SocialWall />);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByRole('region', { name: /Follow the Lou Gehrig Fan Club/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Facebook/i })).toHaveAttribute('href', 'https://www.facebook.com/');
    expect(screen.getByRole('link', { name: /Instagram/i })).toHaveAttribute('href', 'https://www.instagram.com/');
    expect(screen.getByRole('link', { name: /X \(Twitter\)/i })).toHaveAttribute('href', 'https://x.com/');
    expect(screen.getByRole('link', { name: /Pinterest/i })).toHaveAttribute('href', 'https://www.pinterest.com/');
  });

  it('does not keep the fail-safe list up after Elfsight paints late', () => {
    render(<SocialWall />);

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    const widget = document.querySelector(`.${SOCIAL_WALL_WIDGET_ID}`);
    expect(widget).not.toBeNull();
    widget!.appendChild(document.createElement('iframe'));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByRole('region', { name: /Follow the Lou Gehrig Fan Club/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Loading social wall content...')).not.toBeInTheDocument();
  });
});
