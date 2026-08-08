import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import FAQPage from '@/app/faq/page';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('q=events'),
}));

describe('FAQ legacy compatibility redirect (#3148)', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace: replaceMock },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals?.();
  });

  it('redirects to /ask/ preserving the query string', () => {
    render(<FAQPage />);

    expect(replaceMock).toHaveBeenCalledWith('/ask/?q=events');
    expect(screen.getByRole('link', { name: /Continue to FAQ/i })).toHaveAttribute(
      'href',
      '/ask/?q=events',
    );
  });
});
