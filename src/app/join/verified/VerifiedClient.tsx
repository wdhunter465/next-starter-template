'use client';

import { useEffect, useRef, useState } from 'react';
import { CHECK_EMAIL_LINK_USED_ROUTE, POST_LOGIN_ROUTE, VERIFIED_PAGE_DELAY_MS } from '@/lib/auth-routes';

type State = 'verifying' | 'done';

export const VERIFIED_MESSAGE = 'Email address verification completed. Thank you and welcome to the Lou Gehrig Fan Club.';

// #5112 / #5120: the emailed link opens this page with a single-use token. The token is sent to the server by
// this page (not by the link itself), so a mail scanner that only fetches the address cannot use it up.
export default function VerifiedClient() {
  const [state, setState] = useState<State>('verifying');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    // A link with no token, or one that is expired or already used, is not an error page: the member
    // goes to the check-your-email page, which explains in one line and offers a new link.
    if (!token) {
      window.location.replace(CHECK_EMAIL_LINK_USED_ROUTE);
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
        if (!res.ok) {
          window.location.replace(CHECK_EMAIL_LINK_USED_ROUTE);
          return;
        }
        // The token is no longer needed; keep it out of the address bar and history.
        window.history.replaceState(null, '', window.location.pathname);
        setState('done');
        timer = window.setTimeout(() => window.location.replace(POST_LOGIN_ROUTE), VERIFIED_PAGE_DELAY_MS);
      } catch {
        window.location.replace(CHECK_EMAIL_LINK_USED_ROUTE);
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
          <p>
            <a href={POST_LOGIN_ROUTE}>Go to the member page now</a>
          </p>
        </>
      )}
    </main>
  );
}
