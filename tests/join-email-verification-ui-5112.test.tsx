// #5112: the join, check-your-email and verified pages.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthClient from '@/app/auth/AuthClient';
import CheckEmailClient from '@/app/join/check-email/CheckEmailClient';
import VerifiedClient, { VERIFIED_MESSAGE } from '@/app/join/verified/VerifiedClient';
import { CHECK_EMAIL_ROUTE, PENDING_EMAIL_STORAGE_KEY, POST_LOGIN_ROUTE, VERIFIED_PAGE_DELAY_MS } from '@/lib/auth-routes';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

function stubLocation(search = '') {
  const location = { replace: vi.fn(), href: '', search, pathname: '/join/verified/' };
  vi.stubGlobal('location', location);
  return location;
}

function jsonResponse(ok: boolean, body: unknown) {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('Join drops the new member on the check-your-email page (#5112)', () => {
  it('does not call /api/login after a successful join, and goes to the check-email page', async () => {
    const location = stubLocation();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/session/me') return jsonResponse(true, { ok: false });
      if (url === '/api/join') return jsonResponse(true, { ok: true, status: 'joined', verification_required: true });
      throw new Error(`unexpected request to ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AuthClient defaultMode="join" />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/screen name/i), 'jd');
    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => expect(location.href).toBe(CHECK_EMAIL_ROUTE));
    expect(fetchMock.mock.calls.map((call) => call[0])).not.toContain('/api/login');
    expect(location.href).not.toBe(POST_LOGIN_ROUTE);
    expect(window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY)).toBe('jane@example.com');
  });

  it('sends an unverified member who tries to log in to the check-email page', async () => {
    const location = stubLocation();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/session/me') return jsonResponse(true, { ok: false });
        if (url === '/api/login') return jsonResponse(false, { ok: false, code: 'email_not_verified', error: 'Please verify your email address first.' });
        throw new Error(`unexpected request to ${url}`);
      }),
    );

    render(<AuthClient defaultMode="login" />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/^email$/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(location.href).toBe(CHECK_EMAIL_ROUTE));
    expect(window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY)).toBe('jane@example.com');
  });
});

describe('check-your-email page (#5112)', () => {
  beforeEach(() => stubLocation());

  it('tells the member to open the email and names the address', async () => {
    window.sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, 'jane@example.com');
    render(<CheckEmailClient />);
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(await screen.findByText('jane@example.com', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/You will not be able to enter the member area until you do/)).toBeInTheDocument();
  });

  it('asks the server for a new link and answers without revealing whether the address is a member', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(true, { ok: true, status: 'sent_if_pending' }));
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, 'jane@example.com');
    render(<CheckEmailClient />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Send a new link' }));
    expect(await screen.findByText(/If that address is waiting to be verified/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/verify-email-resend', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'jane@example.com' }) }));
  });

  it('does not call the server for an invalid address', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckEmailClient />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(screen.getByText('Enter the email address you joined with.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('verified page (#5112)', () => {
  it('shows the welcome message, waits 3 seconds, then opens the member page', async () => {
    const token = 'a'.repeat(64);
    const location = stubLocation(`?token=${token}`);
    const fetchMock = vi.fn(async () => jsonResponse(true, { ok: true, status: 'verified' }));
    vi.stubGlobal('fetch', fetchMock);
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const realSetTimeout = window.setTimeout;
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: () => void, delay?: number) => {
      if (delay === VERIFIED_PAGE_DELAY_MS) {
        timers.push({ callback, delay });
        return 0 as unknown as number;
      }
      return realSetTimeout(callback, delay);
    }) as typeof window.setTimeout);

    render(<VerifiedClient />);
    expect(await screen.findByText(VERIFIED_MESSAGE)).toBeInTheDocument();
    expect(VERIFIED_MESSAGE).toBe('Email address verification completed. Thank you and welcome to the Lou Gehrig Fan Club.');
    expect(fetchMock).toHaveBeenCalledWith('/api/verify-email', expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ token }) }));

    // The member page opens after exactly one 3-second pause, not before.
    expect(VERIFIED_PAGE_DELAY_MS).toBe(3000);
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(3000);
    expect(location.replace).not.toHaveBeenCalled();
    timers[0].callback();
    expect(location.replace).toHaveBeenCalledWith(POST_LOGIN_ROUTE);
    vi.restoreAllMocks();
  });

  it('shows the error and a way to get a new link for a used or expired link, and does not redirect', async () => {
    const location = stubLocation(`?token=${'b'.repeat(64)}`);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(false, { ok: false, code: 'invalid_token', error: 'This verification link has expired or was already used.' })));
    render(<VerifiedClient />);
    expect(await screen.findByText('This verification link has expired or was already used.')).toBeInTheDocument();
    expect(screen.queryByText(VERIFIED_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute('href', CHECK_EMAIL_ROUTE);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('does not call the server when the link has no token', async () => {
    stubLocation('');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<VerifiedClient />);
    expect(await screen.findByText('This verification link is incomplete.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
