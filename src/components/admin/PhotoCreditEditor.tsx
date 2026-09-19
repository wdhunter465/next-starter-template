'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminJson } from '@/lib/adminClient';
import AdminStatusText from './AdminStatusText';

type PhotoDetail = {
  id: number;
  url: string;
  title?: string | null;
  description?: string | null;
  source?: string | null;
  publication_eligible?: number;
  rights_status?: string;
};

type PhotoGetResponse = { ok: true; item: PhotoDetail };
type PhotoUpdateResponse = { ok: true; id: number; source: string | null; changed: number };

/**
 * Admin-only editor for a single photo's `source` (credit line) field --
 * the same field the public Weekly Matchup widget renders as "Credit: ..."
 * (#4166). Bypasses the public rights-cleared filter via
 * /api/admin/photos/get, so a held/unreviewed photo's current credit is
 * still visible and editable here.
 */
export default function PhotoCreditEditor({ photoId, label }: { photoId: number; label: string }) {
  const [photo, setPhoto] = useState<PhotoDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!Number.isFinite(photoId) || photoId <= 0) return;
    setLoading(true);
    setStatus('');

    const result = await adminJson<PhotoGetResponse>(`/api/admin/photos/get?id=${photoId}`);

    if (!result.ok) {
      setPhoto(null);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    setPhoto(result.data!.item);
    setDraft(result.data!.item.source || '');
    setLoading(false);
  }, [photoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setStatus('Saving…');

    const result = await adminJson<PhotoUpdateResponse>('/api/admin/photos/update', {
      method: 'POST',
      body: JSON.stringify({ id: photoId, source: draft }),
    });

    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    const savedSource = result.data!.source;
    setPhoto((prev) => (prev ? { ...prev, source: savedSource } : prev));
    setDraft(savedSource || '');
    setStatus(savedSource ? `Saved: "${savedSource}"` : 'Saved (credit cleared).');
  }, [draft, photoId]);

  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700 }}>
        {label} — photo id {photoId}
      </div>

      {loading && <p style={{ opacity: 0.75 }}>Loading…</p>}

      {!loading && photo && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
            <img
              src={photo.url}
              alt=""
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
            />
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                {photo.title || photo.description || '(no title)'}
                {photo.publication_eligible === 0 && ' · not publication-eligible'}
              </div>
              <label style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                Credit (shown on the homepage as &quot;Credit: ...&quot;)
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. LGFC Archive, or a photographer/institution name"
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.16)', width: '100%' }}
                />
              </label>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.18)',
                  background: saving ? 'rgba(0,0,0,0.05)' : 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                }}
              >
                {saving ? 'Saving…' : 'Save credit'}
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && !photo && !status && <p style={{ opacity: 0.75 }}>No photo loaded.</p>}

      {status && <AdminStatusText message={status} />}
    </div>
  );
}
