// #5122: the header says which account is signed in.

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FanClubHeader from '@/components/FanClubHeader';
import Header from '@/components/Header';
import SignedInAs from '@/components/SignedInAs';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function stubSession(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => body }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignedInAs (#5122)', () => {
  it('names the account', () => {
    render(<SignedInAs email="beats@example.com" />);
    expect(screen.getByTestId('signed-in-as')).toHaveTextContent('Signed in as beats@example.com');
  });

  it('shows nothing without an email', () => {
    const { container, rerender } = render(<SignedInAs email="" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SignedInAs email={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SignedInAs email="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prints the address as text, never as markup', () => {
    render(<SignedInAs email={'<img src=x onerror=alert(1)>@example.com'} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByTestId('signed-in-as')).toHaveTextContent('<img src=x onerror=alert(1)>@example.com');
  });
});

describe('public header (#5122)', () => {
  it('shows who is signed in', async () => {
    stubSession({ ok: true, email: 'beats@example.com', role: 'member' });
    render(<Header showLogo={false} />);
    expect(await screen.findByTestId('signed-in-as')).toHaveTextContent('Signed in as beats@example.com');
    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
  });

  it('shows nothing extra to a guest', async () => {
    stubSession({ ok: false });
    render(<Header showLogo={false} />);
    await screen.findByRole('link', { name: 'Join' });
    expect(screen.queryByTestId('signed-in-as')).not.toBeInTheDocument();
  });
});

describe('member-area header (#5122)', () => {
  it('shows who is signed in', async () => {
    stubSession({ ok: true, email: 'beats@example.com', role: 'member' });
    render(<FanClubHeader showLogo={false} />);
    expect(await screen.findByTestId('signed-in-as')).toHaveTextContent('Signed in as beats@example.com');
    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
  });

  it('shows nothing when the session check says no, fails or throws', async () => {
    stubSession({ ok: false });
    const { unmount } = render(<FanClubHeader showLogo={false} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('signed-in-as')).not.toBeInTheDocument();
    unmount();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<FanClubHeader showLogo={false} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('signed-in-as')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Logout' })).toBeInTheDocument();
  });
});
