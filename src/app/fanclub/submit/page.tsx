'use client';

import { useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';

export default function FanclubSubmitPage() {
  const { isLoading, isAuthenticated, email } = useMemberSession({ redirectTo: '/' });
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [ownershipStatement, setOwnershipStatement] = useState('');
  const [permissionStatement, setPermissionStatement] = useState('');
  const [creditPreference, setCreditPreference] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  async function submit() {
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/library/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          content: content.trim(),
          ownership_statement: ownershipStatement.trim(),
          permission_statement: permissionStatement.trim(),
          credit_preference: creditPreference,
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'submit_failed');
      setTitle('');
      setContent('');
      setOwnershipStatement('');
      setPermissionStatement('');
      setCreditPreference('');
      setMsg('Submitted. Thank you!');
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      setMsg(`Error: ${text}`);
    } finally {
      setBusy(false);
    }
  }

  const can =
    !busy &&
    name.trim().length >= 2 &&
    email.trim().length >= 5 &&
    title.trim().length >= 3 &&
    content.trim().length >= 20 &&
    ownershipStatement.trim().length >= 5 &&
    permissionStatement.trim().length >= 5 &&
    creditPreference.length > 0;

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 16px' }}>
      <h1 style={{ fontSize: 32, margin: '0 0 8px 0' }}>Member Submissions</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Submit a short article or note to be considered for the Library. (PDF upload pipeline will be added as part of the media workflow.)
      </p>

      <section style={{ marginTop: 14, padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.14)' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Submit an article</h2>

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.2)' }}
          />
          <input
            value={email}
            readOnly
            placeholder="Your email"
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.12)' }}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title"
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.2)' }}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your article text here…"
            rows={8}
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.2)', resize: 'vertical' }}
          />

          <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 15 }}>Rights and permission</h3>
            <p style={{ margin: '0 0 10px 0', fontSize: 13, opacity: 0.8 }}>
              We need this before we can review your submission.
            </p>
          </div>
          <textarea
            value={ownershipStatement}
            onChange={(e) => setOwnershipStatement(e.target.value)}
            placeholder="Ownership: describe how this is yours or how you lawfully obtained it (e.g., &quot;I wrote this myself&quot; or &quot;from my personal collection&quot;)"
            rows={2}
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.2)', resize: 'vertical' }}
          />
          <textarea
            value={permissionStatement}
            onChange={(e) => setPermissionStatement(e.target.value)}
            placeholder="Permission: confirm the Lou Gehrig Fan Club may use this submission on the site"
            rows={2}
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.2)', resize: 'vertical' }}
          />
          <label style={{ display: 'grid', gap: 6 }}>
            How should we credit you?
            <select
              value={creditPreference}
              onChange={(e) => setCreditPreference(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.2)' }}
            >
              <option value="">Select a credit preference…</option>
              <option value="public_credit">Credit me by name</option>
              <option value="anonymous">Credit as anonymous</option>
              <option value="private">Do not display my name publicly</option>
              <option value="custom">Other (note in your submission text)</option>
            </select>
          </label>

          <button
            onClick={submit}
            disabled={!can}
            style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: can ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', cursor: can ? 'pointer' : 'not-allowed' }}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
          {msg && <div style={{ marginTop: 6, opacity: 0.9 }}>{msg}</div>}
        </div>
      </section>
    </main>
  );
}
