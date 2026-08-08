'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import AdminTokenPanel from '@/components/admin/AdminTokenPanel';
import { adminJson, getStoredAdminToken } from '@/lib/adminClient';

type PendingPhoto = {
  id: number;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string | null;
  status?: string;
  submitted_by?: string | null;
  credit_line?: string | null;
  rights_owner?: string | null;
  quarantine_key?: string | null;
};

export default function AdminPhotosPage() {
  const [status, setStatus] = useState('Idle.');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [tokenReady, setTokenReady] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    setTokenReady(Boolean(getStoredAdminToken()));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus('Loading pending photos…');
    const result = await adminJson<{ ok: true; items?: PendingPhoto[] }>('/api/admin/photos/list?limit=100');
    if (!result.ok || !result.data) {
      setStatus(`Load failed: ${result.error}`);
      setItems([]);
      setLoading(false);
      return;
    }
    const data = result.data;
    setItems(Array.isArray(data.items) ? data.items : []);
    setStatus(`Loaded ${data.items?.length || 0} pending photo(s).`);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tokenReady) void load();
  }, [tokenReady, load]);

  async function review(photoId: number, action: 'approve' | 'reject') {
    setStatus(`${action === 'approve' ? 'Approving' : 'Rejecting'} photo #${photoId}…`);
    const result = await adminJson<{ ok: true; status: string }>('/api/admin/photos/review', {
      method: 'POST',
      body: JSON.stringify({
        photo_id: photoId,
        action,
        notes: notes[photoId] || '',
        skip_object_promote: true,
      }),
    });
    if (!result.ok || !result.data) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    setStatus(`Photo #${photoId} marked ${result.data.status}.`);
    await load();
  }

  return (
    <PageShell title="Photo Queue" subtitle="Moderate pending member photo submissions">
      <AdminNav />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ marginTop: 0 }}>Member photo moderation</h1>
        <p style={{ opacity: 0.85 }}>
          Review pending member submissions. Approve publishes the row (and promotes quarantine storage when B2 is configured). Reject keeps it non-public.
        </p>
        <AdminTokenPanel onSaved={() => setTokenReady(Boolean(getStoredAdminToken()))} />
        <AdminStatusText message={status} />
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void load()} disabled={loading || !tokenReady}>
            Refresh queue
          </button>
        </div>
        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {items.map((item) => (
            <article key={item.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
              <strong>#{item.id}</strong> — {item.title || item.description || 'Untitled'}
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                Submitted by: {item.submitted_by || '—'} · Credit: {item.credit_line || '—'} · Rights: {item.rights_owner || '—'}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Quarantine: {item.quarantine_key || item.url || '—'}</div>
              <label style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                Notes
                <input
                  value={notes[item.id] || ''}
                  onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => void review(item.id, 'approve')}>
                  Approve
                </button>
                <button type="button" onClick={() => void review(item.id, 'reject')}>
                  Reject
                </button>
              </div>
            </article>
          ))}
          {!loading && items.length === 0 ? <p>No pending photos.</p> : null}
        </div>
      </main>
    </PageShell>
  );
}
