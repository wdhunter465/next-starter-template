'use client';

import { useEffect, useState } from 'react';
import { isValidEmail, JOIN_ROUTE, PENDING_EMAIL_STORAGE_KEY } from '@/lib/auth-routes';

// #5112: where a new member lands after Join. They are not signed in until they use the link we email.
export default function CheckEmailClient() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkUsed, setLinkUsed] = useState(false);

  useEffect(() => {
    try {
      setEmail(window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY) ?? '');
    } catch {
      // Storage can be blocked; the member can type the address to ask for a new link.
    }
    setLinkUsed(new URLSearchParams(window.location.search).get('link') === 'used');
  }, []);

  async function resend() {
    setNote(null);
    if (!isValidEmail(email)) {
      setNote('Enter the email address you joined with.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/verify-email-resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setNote(res.ok ? 'If that address is waiting to be verified, we sent a new link. It can take a minute to arrive.' : 'We could not send a new link. Please try again in a minute.');
    } catch {
      setNote('We could not send a new link. Please try again in a minute.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 20 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Check your email</h1>
      {linkUsed && (
        <p role="status" style={{ textAlign: 'center', lineHeight: 1.55 }}>
          That link has expired or was already used. Enter your email below and we will send a new one.
        </p>
      )}
      <p style={{ textAlign: 'center', lineHeight: 1.55 }}>
        {email ? (
          <>
            We sent a verification link to <strong>{email}</strong>.
          </>
        ) : (
          <>We sent a verification link to the email address you joined with.</>
        )}{' '}
        Open the email and click the link to finish joining. You will not be able to enter the member area until you do.
      </p>
      <p style={{ textAlign: 'center', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>
        The link works once and expires in 24 hours. If you do not see it, check your spam folder.
      </p>

      <div style={{ marginTop: 24 }}>
        <label htmlFor="resend-email" style={{ display: 'block', marginBottom: 6 }}>
          Did not get it? Send a new link to:
        </label>
        <input
          id="resend-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          style={{ width: '100%', marginBottom: 12, padding: 10, boxSizing: 'border-box' }}
        />
        <button type="button" onClick={resend} disabled={busy} style={{ width: '100%', padding: 10, boxSizing: 'border-box' }}>
          {busy ? 'Sending…' : 'Send a new link'}
        </button>
        {note && (
          <div role="status" style={{ marginTop: 14, padding: 10, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 8 }}>
            {note}
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: 24 }}>
        <a href={JOIN_ROUTE + '?mode=login'}>Already verified? Log in</a>
      </p>
    </main>
  );
}
