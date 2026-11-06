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

  it('hides the fail-safe list if Elfsight paints after the fail timer (Chromebook-slow path)', () => {
    render(<SocialWall />);

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByRole('region', { name: /Follow the Lou Gehrig Fan Club/i })).toBeInTheDocument();

    const widget = document.querySelector(`.${SOCIAL_WALL_WIDGET_ID}`);
    widget!.appendChild(document.createElement('iframe'));

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('region', { name: /Follow the Lou Gehrig Fan Club/i })).not.toBeInTheDocument();
  });

  describe('fallback log (#5116)', () => {
    it('tells the site once when the fallback is shown, sending no data', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      render(<SocialWall />);
      expect(fetchMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/api/social-wall-event', { method: 'POST', keepalive: true });

      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });

    it('sends nothing when the widget renders', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      render(<SocialWall />);
      document.querySelector(`.${SOCIAL_WALL_WIDGET_ID}`)!.appendChild(document.createElement('iframe'));
      act(() => {
        vi.advanceTimersByTime(20000);
      });
      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('still shows the fallback links if the log request fails', () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      render(<SocialWall />);
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(screen.getByRole('link', { name: /Facebook/i })).toBeInTheDocument();
      vi.unstubAllGlobals();
    });
  });
});
