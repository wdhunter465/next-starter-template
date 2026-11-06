'use client';

import { useEffect, useRef, useState } from 'react';
import { CHECK_EMAIL_ROUTE, POST_LOGIN_ROUTE, VERIFIED_PAGE_DELAY_MS } from '@/lib/auth-routes';

type State = 'verifying' | 'done' | 'failed';

export const VERIFIED_MESSAGE = 'Email address verification completed. Thank you and welcome to the Lou Gehrig Fan Club.';

// #5112: the emailed link opens this page with a single-use token. The token is sent to the server by
// this page (not by the link itself), so a mail scanner that only fetches the address cannot use it up.
export default function VerifiedClient() {
  const [state, setState] = useState<State>('verifying');
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (!token) {
      setError('This verification link is incomplete.');
      setState('failed');
      return;
    }

    let timer: number | undefined;
    (async () => {
      try {
        const res = await fetch('/api/verify-email', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const message = typeof data === 'object' && data !== null && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'We could not verify this link.';
          setError(message);
          setState('failed');
          return;
        }
        // The token is no longer needed; keep it out of the address bar and history.
        window.history.replaceState(null, '', window.location.pathname);
        setState('done');
        timer = window.setTimeout(() => window.location.replace(POST_LOGIN_ROUTE), VERIFIED_PAGE_DELAY_MS);
      } catch {
        setError('We could not verify this link. Check your connection and try again.');
        setState('failed');
      }
    })();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 20, textAlign: 'center' }}>
      {state === 'verifying' && (
        <>
          <h1 style={{ marginBottom: 8 }}>Verifying your email</h1>
          <p role="status">One moment…</p>
        </>
      )}
      {state === 'done' && (
        <>
          <h1 style={{ marginBottom: 8 }}>Email verified</h1>
          <p role="status" style={{ lineHeight: 1.55 }}>
            {VERIFIED_MESSAGE}
          </p>
          <p style={{ color: 'rgba(0,0,0,0.72)' }}>Taking you to the member page…</p>
        </>
      )}
      {state === 'failed' && (
        <>
          <h1 style={{ marginBottom: 8 }}>We could not verify your email</h1>
          <p role="alert" style={{ lineHeight: 1.55 }}>
            {error}
          </p>
          <p>
            <a href={CHECK_EMAIL_ROUTE}>Send me a new link</a>
          </p>
        </>
      )}
    </main>
  );
}
