'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';

// #5471: takedown path for the 2026-11-23 decision that every B2 photo is public unless it is
// blocked or copyright_restricted (#5467). Block removes a photo from every public surface at
// once; Restore moves a blocked photo back to unreviewed. A copyright_restricted photo cannot be
// restored here.

type PhotoRow = {
  id: number;
  url: string;
  title?: string | null;
  description?: string | null;
  source?: string | null;
  rights_status?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rights_notes?: string | null;
};

type ListResponse = { ok: true; total: number; items: PhotoRow[] };
type BlockResponse = { ok: true; id: number; rights_status: string };

const PAGE_SIZE = 60;

function statusOf(photo: PhotoRow): string {
  return photo.rights_status || 'unreviewed';
}

function lastNote(photo: PhotoRow): string {
  const notes = (photo.rights_notes || '').split(' | ');
  return notes[notes.length - 1] || '';
}

export default function AdminPhotosPage() {
  const [filter, setFilter] = useState<'all' | 'blocked'>('all');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<PhotoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Idle.');
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setStatus('Loading…');
    const result = await adminJson<ListResponse>(
      `/api/admin/photos/list?filter=${filter}&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (requestId !== loadRequestRef.current) return;
    if (!result.ok) {
      setItems([]);
      setTotal(0);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }
    const rows = Array.isArray(result.data?.items) ? result.data!.items : [];
    setItems(rows);
    setTotal(Number(result.data?.total ?? rows.length));
    setStatus(rows.length ? '' : filter === 'blocked' ? 'No blocked photos.' : 'No photos found.');
    setLoading(false);
  }, [filter, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (photo: PhotoRow, blocked: boolean) => {
      const reason = (reasons[photo.id] || '').trim();
      if (!reason) {
        setStatus(`Error: enter a reason for photo ${photo.id} first.`);
        return;
      }
      setBusyId(photo.id);
      setStatus(blocked ? `Blocking photo ${photo.id}…` : `Restoring photo ${photo.id}…`);
      const result = await adminJson<BlockResponse>('/api/admin/photos/block', {
        method: 'POST',
        body: JSON.stringify({ id: photo.id, blocked, reason }),
      });
      setBusyId(null);
      if (!result.ok) {
        setStatus(`Error: ${result.error}`);
        return;
      }
      setReasons((prev) => ({ ...prev, [photo.id]: '' }));
      setStatus(blocked ? `Photo ${photo.id} is blocked and no longer public.` : `Photo ${photo.id} restored.`);
      await load();
    },
    [load, reasons],
  );

  const pageEnd = Math.min(offset + items.length, total);

  return (
    <PageShell
      title="Photos: Block / Restore"
      subtitle="Every B2 photo is public unless blocked. Block one on a rights holder's request; restore it if the request is withdrawn."
    >
      <AdminNav />
      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'blocked'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setOffset(0);
                setFilter(value);
              }}
              aria-pressed={filter === value}
              style={{
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
                background: filter === value ? 'rgba(0,0,0,0.08)' : 'white',
                cursor: 'pointer',
              }}
            >
              {value === 'all' ? 'All photos' : 'Blocked / restricted'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{ border: '1px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 12px', fontWeight: 700, background: 'white' }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <span style={{ opacity: 0.75 }}>
            {total ? `${offset + 1}-${pageEnd} of ${total}` : ''}
          </span>
        </div>

        {status.startsWith('Error:') ? (
          <AdminStatusText message={status} />
        ) : status ? (
          <p style={{ opacity: 0.85 }}>{status}</p>
        ) : null}

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {items.map((photo) => {
            const state = statusOf(photo);
            const isBlocked = state === 'blocked';
            const isRestricted = state === 'copyright_restricted';
            const busy = busyId === photo.id;
            return (
              <div key={photo.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }}
                />
                <div style={{ fontWeight: 700 }}>
                  #{photo.id} {photo.title || photo.description || '(no title)'}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Status: <strong>{state}</strong>
                  {isBlocked || isRestricted ? ' (not public)' : ' (public)'}
                </div>
                {photo.source ? <div style={{ fontSize: 13, opacity: 0.75 }}>Credit: {photo.source}</div> : null}
                {isBlocked || isRestricted ? (
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{lastNote(photo)}</div>
                ) : null}

                {isRestricted ? (
                  <div style={{ fontSize: 13 }}>
                    Copyright-restricted photos cannot be restored here.
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
                      Reason (required)
                      <input
                        value={reasons[photo.id] || ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [photo.id]: e.target.value }))}
                        placeholder={isBlocked ? 'e.g. Request withdrawn by rights holder' : 'e.g. Removal requested by CMG'}
                        maxLength={500}
                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.16)' }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void act(photo, !isBlocked)}
                      disabled={busy}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.18)',
                        background: busy ? 'rgba(0,0,0,0.05)' : 'white',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      {busy ? 'Working…' : isBlocked ? 'Restore photo' : 'Block photo'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            style={{ border: '1px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 12px', fontWeight: 700, background: 'white' }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={pageEnd >= total || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            style={{ border: '1px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 12px', fontWeight: 700, background: 'white' }}
          >
            Next
          </button>
        </div>
      </div>
    </PageShell>
  );
}
