import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

import AuthClient from '@/app/auth/AuthClient';
import AuthLegacyRedirectPage from '@/app/auth/page';
import LoginLegacyRedirectPage from '@/app/login/page';
import Header from '@/components/Header';
import JoinCTA from '@/components/JoinCTA';
import { isValidEmail, LOGIN_TAB_ROUTE, POST_LOGOUT_ROUTE } from '@/lib/auth-routes';

const mockSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams('')));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

describe('auth route helpers', () => {
  it('validates email format', () => {
    expect(isValidEmail('fan@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });
});

describe('legacy auth redirects', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { replace: vi.fn(), href: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects /login to public home', () => {
    render(<LoginLegacyRedirectPage />);
    expect(window.location.replace).toHaveBeenCalledWith(POST_LOGOUT_ROUTE);
  });

  it('redirects /auth to canonical /join', () => {
    render(<AuthLegacyRedirectPage />);
    expect(window.location.replace).toHaveBeenCalledWith('/join');
  });
});

describe('AuthClient auth-state behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { replace: vi.fn(), href: '' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects authenticated users to /fanclub', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, email: 'fan@example.com', role: 'member' }),
      }),
    );

    render(<AuthClient defaultMode="join" />);

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('/fanclub');
    });
  });

  it('opens login tab when /join?mode=login even with join defaultMode', async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams('mode=login'));

    render(<AuthClient defaultMode="join" />);

    await waitFor(() => {
      expect(screen.queryByText(/Checking session/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: 'Login' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows inline validation before login submit', async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams('mode=login'));

    render(<AuthClient defaultMode="login" />);

    await waitFor(() => {
      expect(screen.queryByText(/Checking session/i)).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('tab', { name: 'Login' }));
    await userEvent.type(screen.getByLabelText(/^Email/i), 'bad-email');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });
});

describe('navigation auth links', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes header Login to canonical join login tab', () => {
    render(<Header showLogo={false} />);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', LOGIN_TAB_ROUTE);
  });

  it('routes homepage CTA Login to canonical join login tab', () => {
    render(<JoinCTA />);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', LOGIN_TAB_ROUTE);
  });

  it('shows FREE as line 2 under the heading and keeps Join and Login (#4460)', () => {
    render(<JoinCTA />);
    const heading = screen.getByRole('heading', { name: 'Join the Lou Gehrig Fan Club' });
    const free = screen.getByText('FREE');
    expect(free).toHaveClass('join-banner__free');
    expect(heading.compareDocumentPosition(free) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const body = screen.getByText(/Join the Fan Club for member archives/);
    expect(free.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', LOGIN_TAB_ROUTE);
  });
});

describe('LGFC header auth invariants', () => {
  it('keeps public header button order and canonical login route', () => {
    const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
    const idxJoin = header.indexOf('href="/join"');
    const idxSearch = header.indexOf('href="/search"');
    const idxStore = header.indexOf('bonfire.com/store/lou-gehrig-fan-club');
    const idxLogin = header.indexOf('href={LOGIN_TAB_ROUTE}');

    expect(idxJoin).toBeGreaterThan(-1);
    expect(idxSearch).toBeGreaterThan(-1);
    expect(idxStore).toBeGreaterThan(-1);
    expect(idxLogin).toBeGreaterThan(-1);
    expect(idxJoin).toBeLessThan(idxSearch);
    expect(idxSearch).toBeLessThan(idxStore);
    expect(idxStore).toBeLessThan(idxLogin);
  });
});
