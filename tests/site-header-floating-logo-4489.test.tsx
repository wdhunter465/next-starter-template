import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: pathnameMock,
}));

vi.mock('@/components/FloatingLogo', () => ({
  default: () => <div data-testid="floating-logo" />,
}));

vi.mock('@/components/Header', () => ({
  default: ({ showLogo }: { showLogo?: boolean }) => (
    <div data-testid="public-header" data-show-logo={String(showLogo)} />
  ),
}));

vi.mock('@/components/FanClubHeader', () => ({
  default: ({ showLogo }: { showLogo?: boolean }) => (
    <div data-testid="fanclub-header" data-show-logo={String(showLogo)} />
  ),
}));

import SiteHeader from '@/components/SiteHeader';

describe('#4489 one floating logo under every header', () => {
  beforeEach(() => {
    pathnameMock.mockReset();
  });

  it.each(['/', '/about/', '/join/', '/events/', '/admin/'])(
    'mounts the floating logo once and hides the small logo on the public header for %s',
    (path) => {
      pathnameMock.mockReturnValue(path);
      render(<SiteHeader />);
      expect(screen.getAllByTestId('floating-logo')).toHaveLength(1);
      expect(screen.getByTestId('public-header').getAttribute('data-show-logo')).toBe('false');
      expect(screen.queryByTestId('fanclub-header')).toBeNull();
    },
  );

  it.each(['/fanclub', '/fanclub/', '/fanclub/photo/', '/fanclub/myprofile/'])(
    'mounts the floating logo once and hides the small logo on the Fan Club header for %s',
    (path) => {
      pathnameMock.mockReturnValue(path);
      render(<SiteHeader />);
      expect(screen.getAllByTestId('floating-logo')).toHaveLength(1);
      expect(screen.getByTestId('fanclub-header').getAttribute('data-show-logo')).toBe('false');
      expect(screen.queryByTestId('public-header')).toBeNull();
    },
  );
});
