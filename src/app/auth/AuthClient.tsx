'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { isValidEmail, JOIN_ROUTE, POST_LOGIN_ROUTE } from '@/lib/auth-routes';

type Mode = 'login' | 'join';

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickServerMsg(json: unknown, fallback: string): string {
  if (!isRecord(json)) return fallback;
  const error = json.error;
  const status = json.status;
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof status === 'string' && status.trim()) return status;
  return fallback;
}

function pickErrMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && typeof err.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}

function InnerAuthClient({ defaultMode }: { defaultMode?: Mode }) {
  const sp = useSearchParams();

  const initialMode = useMemo<Mode>(() => {
    const queryMode = (sp.get('mode') || '').toLowerCase();
    if (queryMode === 'login') return 'login';
    if (queryMode === 'join') return 'join';
    return defaultMode ?? 'join';
  }, [sp, defaultMode]);

  const [mode, setMode] = useState<Mode>(initialMode);

  const [screenName, setScreenName] = useState('');
  const [fullName, setFullName] = useState('');
  const [emailJoin, setEmailJoin] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(true);

  const [emailLogin, setEmailLogin] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

    async function redirectIfAuthenticated() {
      try {
        const res = await fetch('/api/session/me', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        const json: unknown = await res.json().catch(() => null);
        const ok = isRecord(json) && json.ok === true;
        const email = isRecord(json) && typeof json.email === 'string' ? json.email.trim() : '';

        if (!cancelled && ok && email) {
          window.location.replace(POST_LOGIN_ROUTE);
        }
      } catch {
        // Fail closed to guest join/login surface — keep form visible (#3305).
      }
    }

    redirectIfAuthenticated();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  async function doJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    if (!screenName.trim()) {
      setMsg('Screen name is required.');
      return;
    }

    if (!fullName.trim()) {
      setMsg('Full name is required.');
      return;
    }

    if (!isValidEmail(emailJoin)) {
      setMsg('Enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      const { first, last } = splitName(fullName);

      const res = await fetch('/api/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          screen_name: screenName,
          email: emailJoin,
          email_opt_in: emailOptIn,
        }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setMsg(pickServerMsg(data, 'Join failed.'));
        return;
      }

      setMsg('Joined. Logging you in…');

      const res2 = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailJoin }),
      });

      const data2: unknown = await res2.json().catch(() => null);

      if (!res2.ok) {
        setMsg(pickServerMsg(data2, 'Joined, but login failed. Try the Login tab.'));
        setMode('login');
        setEmailLogin(emailJoin);
        return;
      }

      window.location.href = POST_LOGIN_ROUTE;
    } catch (err: unknown) {
      setMsg(pickErrMsg(err, 'Join failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    if (!isValidEmail(emailLogin)) {
      setMsg('Enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailLogin }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setMsg(pickServerMsg(data, 'Login failed.'));
        return;
      }

      window.location.href = POST_LOGIN_ROUTE;
    } catch (err: unknown) {
      setMsg(pickErrMsg(err, 'Login failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 20 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Join / Login</h1>
      <p style={{ textAlign: 'center', margin: '0 0 16px 0', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>
        The public Lou Gehrig Fan Club site is open to everyone. Join or log in to access the member Fan Club area with archives,
        discussions, and club-only content.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }} role="tablist" aria-label="Join or Login">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'join'}
          tabIndex={mode === 'join' ? 0 : -1}
          onClick={() => {
            setMode('join');
            setMsg(null);
            window.history.replaceState(null, '', JOIN_ROUTE);
          }}
          style={{ flex: 1 }}
        >
          Join
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          tabIndex={mode === 'login' ? 0 : -1}
          onClick={() => {
            setMode('login');
            setMsg(null);
            window.history.replaceState(null, '', `${JOIN_ROUTE}?mode=login`);
          }}
          style={{ flex: 1 }}
        >
          Login
        </button>
      </div>

      {msg && (
        <div role="alert" style={{ marginBottom: 14, padding: 10, border: '1px solid #ccc', borderRadius: 8 }}>
          {msg}
        </div>
      )}

      {mode === 'login' && (
        <form onSubmit={doLogin} noValidate>
          <label style={{ display: 'block', marginBottom: 6 }} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            value={emailLogin}
            onChange={(e) => setEmailLogin(e.target.value)}
            placeholder="you@example.com"
            required
            style={{ width: '100%', marginBottom: 12, padding: 10 }}
            autoComplete="email"
            inputMode="email"
            type="email"
          />
          <button type="submit" disabled={busy} style={{ width: '100%', padding: 10 }}>
            {busy ? 'Working…' : 'Login'}
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={doJoin} noValidate>
          <label style={{ display: 'block', marginBottom: 6 }} htmlFor="join-screen-name">
            Screen name / alias
          </label>
          <input
            id="join-screen-name"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            placeholder="Your public name"
            required
            style={{ width: '100%', marginBottom: 12, padding: 10 }}
            autoComplete="nickname"
          />

          <label style={{ display: 'block', marginBottom: 6 }} htmlFor="join-full-name">
            Full name
          </label>
          <input
            id="join-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="First Last"
            required
            style={{ width: '100%', marginBottom: 12, padding: 10 }}
            autoComplete="name"
          />

          <label style={{ display: 'block', marginBottom: 6 }} htmlFor="join-email">
            Email
          </label>
          <input
            id="join-email"
            value={emailJoin}
            onChange={(e) => setEmailJoin(e.target.value)}
            placeholder="you@example.com"
            required
            style={{ width: '100%', marginBottom: 10, padding: 10 }}
            autoComplete="email"
            inputMode="email"
            type="email"
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={(e) => setEmailOptIn(e.target.checked)}
            />
            Receive emails about updates (optional)
          </label>

          <button type="submit" disabled={busy} style={{ width: '100%', padding: 10 }}>
            {busy ? 'Working…' : 'Join'}
          </button>
        </form>
      )}
    </main>
  );
}

export default function AuthClient(props: { defaultMode?: Mode }) {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 560, margin: '40px auto', padding: 20 }}>
          <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Join / Login</h1>
          <p style={{ textAlign: 'center', margin: '0 0 16px 0', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>
            The public Lou Gehrig Fan Club site is open to everyone. Join or log in to access the member Fan Club area with
            archives, discussions, and club-only content.
          </p>
        </main>
      }
    >
      <InnerAuthClient defaultMode={props.defaultMode} />
    </Suspense>
  );
}
