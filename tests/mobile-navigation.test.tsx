import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import Header from '@/components/Header';
import FanClubHeader from '@/components/FanClubHeader';
import HamburgerMenu, {
  HAMBURGER_MENU_ITEMS,
} from '@/components/HamburgerMenu';
import { STORE_URL } from '@/lib/auth-routes';
import Footer from '@/components/Footer';
import { createRef } from 'react';

function mockSession(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => payload,
    }),
  );
}

describe('HamburgerMenu variants', () => {
  const toggleRef = createRef<HTMLButtonElement>();

  beforeEach(() => {
    toggleRef.current = document.createElement('button');
  });

  it('renders public guest drawer items in canonical order', () => {
    render(
      <HamburgerMenu
        variant="public-guest"
        menuId="test-menu"
        onClose={() => {}}
        toggleRef={toggleRef}
      />,
    );

    const labels = HAMBURGER_MENU_ITEMS['public-guest'].map((item) => item.label);
    const links = screen.getAllByRole('link').map((node) => node.textContent?.trim());
    expect(links).toEqual(labels);
    expect(screen.getByRole('link', { name: 'Store' })).toHaveAttribute('href', STORE_URL);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/join?mode=login');
  });

  it('renders public member drawer items in canonical order', () => {
    render(
      <HamburgerMenu
        variant="public-member"
        menuId="test-menu"
        onClose={() => {}}
        toggleRef={toggleRef}
      />,
    );

    const labels = HAMBURGER_MENU_ITEMS['public-member'].map((item) => item.label);
    const links = screen.getAllByRole('link').map((node) => node.textContent?.trim());
    expect(links).toEqual(labels);
  });

  it('renders fanclub drawer items in canonical order', () => {
    render(
      <HamburgerMenu
        variant="fanclub"
        menuId="test-menu"
        onClose={() => {}}
        toggleRef={toggleRef}
      />,
    );

    const labels = HAMBURGER_MENU_ITEMS.fanclub.map((item) => item.label);
    const links = screen.getAllByRole('link').map((node) => node.textContent?.trim());
    expect(links).toEqual(labels);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Support' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('uses external target attributes for Store links', () => {
    render(
      <HamburgerMenu
        variant="public-guest"
        menuId="test-menu"
        onClose={() => {}}
        toggleRef={toggleRef}
      />,
    );

    const storeLink = screen.getByRole('link', { name: 'Store' });
    expect(storeLink).toHaveAttribute('target', '_blank');
    expect(storeLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps every drawer variant free of forbidden mobile items', () => {
    (Object.keys(HAMBURGER_MENU_ITEMS) as Array<keyof typeof HAMBURGER_MENU_ITEMS>).forEach((variant) => {
      const labels = HAMBURGER_MENU_ITEMS[variant].map((item) => item.label);

      expect(labels).not.toContain('Admin');
      expect(labels).not.toContain('Support');
      expect(labels).not.toContain('Members');
      expect(labels).not.toContain('Home');
    });
  });
});

describe('Header mobile navigation wiring', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides Join and Login while the session is still loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(<Header showLogo={false} />);

    expect(screen.queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Store' })).toBeInTheDocument();
  });

  it('opens guest hamburger drawer when logged out', async () => {
    mockSession({ ok: false });

    render(<Header showLogo={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'Join' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(within(menu).getAllByRole('link').map((node) => node.textContent?.trim())).toEqual(
      HAMBURGER_MENU_ITEMS['public-guest'].map((item) => item.label),
    );
  });

  it('opens member hamburger drawer when logged in', async () => {
    mockSession({ ok: true, email: 'fan@example.com', role: 'member' });

    render(<Header showLogo={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'Club Home' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Logout' })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Join' })).not.toBeInTheDocument();
    expect(within(menu).getAllByRole('link').map((node) => node.textContent?.trim())).toEqual(
      HAMBURGER_MENU_ITEMS['public-member'].map((item) => item.label),
    );
  });

  it('closes the open drawer with Escape and restores hamburger focus', async () => {
    mockSession({ ok: false });

    render(<Header showLogo={false} />);

    const button = screen.getByRole('button', { name: 'Open menu' });
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});

describe('FanClubHeader mobile navigation wiring', () => {
  it('opens fanclub hamburger drawer with member navigation items', async () => {
    render(<FanClubHeader showLogo={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'My Profile' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Club Home' })).toBeInTheDocument();
    expect(within(menu).getAllByRole('link').map((node) => node.textContent?.trim())).toEqual(
      HAMBURGER_MENU_ITEMS.fanclub.map((item) => item.label),
    );
  });

  it('keeps the drawer open and scoped to the dialog after activation', async () => {
    render(<FanClubHeader showLogo={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'Club Home' })).toBeInTheDocument();
  });
});

describe('Footer invariants', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ quote: { quote: 'Heroism is endurance for one more day.', source: 'LGFC' } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps locked footer link set only', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Support' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();
  });
});
