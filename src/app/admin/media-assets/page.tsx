'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';

type MediaAsset = {
  id: number;
  media_uid: string;
  b2_key: string;
  b2_file_id?: string | null;
  size: number;
  etag?: string | null;
  ingested_at?: string | null;
};

type MediaListResponse = {
  ok: true;
  items: unknown[];
};

type MediaSyncResponse = {
  ok: true;
  listed: number;
  maxObjects: number;
  batches: number;
  changes_reported: number;
  note?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function normalize(raw: unknown): MediaAsset | null {
  if (!isRecord(raw)) return null;

  const id = asNumber(raw.id);
  const media_uid = asString(raw.media_uid);
  const b2_key = asString(raw.b2_key);
  const size = asNumber(raw.size);

  if (id === null || !media_uid || !b2_key || size === null) return null;

  const b2_file_id = asString(raw.b2_file_id);
  const etag = asString(raw.etag);
  const ingested_at = asString(raw.ingested_at);

  return {
    id: Math.trunc(id),
    media_uid,
    b2_key,
    b2_file_id,
    size: Math.trunc(size),
    etag,
    ingested_at,
  };
}

export default function AdminMediaAssetsPage() {
  const [status, setStatus] = useState<string>('Idle.');
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [items, setItems] = useState<MediaAsset[]>([]);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setStatus('Loading…');

    const result = await adminJson<MediaListResponse>('/api/admin/media-assets/list?limit=100');

    if (requestId !== loadRequestRef.current) {
      return;
    }

    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      setItems([]);
      setLoading(false);
      return;
    }

    const arr = Array.isArray(result.data?.items) ? result.data.items : [];
    const normalized = arr.map(normalize).filter((x): x is MediaAsset => x !== null);

    setItems(normalized);
    setStatus(normalized.length ? `Loaded ${normalized.length} media asset(s).` : 'No media assets found.');
    setLoading(false);
  }, []);

  const syncFromB2 = useCallback(async () => {
    setSyncing(true);
    setSyncStatus('Syncing from B2…');

    const result = await adminJson<MediaSyncResponse>('/api/admin/media-assets/sync-from-b2', {
      method: 'POST',
    });

    if (!result.ok) {
      setSyncStatus(`Error: ${result.error}`);
      setSyncing(false);
      return;
    }

    const data = result.data;
    setSyncStatus(
      `B2 sync complete: listed ${data?.listed ?? 0} object(s), reported ${data?.changes_reported ?? 0} D1 change(s).`,
    );
    setSyncing(false);
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="Media Assets" subtitle="D1 inventory of ingested media (B2 keys, size, etag)">
      <AdminNav />
      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: '10px 12px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(0,0,0,0.05)' : 'white',
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={() => void syncFromB2()}
            disabled={syncing}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: '10px 12px',
              fontWeight: 700,
              cursor: syncing ? 'not-allowed' : 'pointer',
              background: syncing ? 'rgba(0,0,0,0.05)' : 'white',
            }}
          >
            {syncing ? 'Syncing…' : 'Sync from B2'}
          </button>
        </div>

        {status.startsWith('Error:') ? (
          <div style={{ marginTop: 10, opacity: 0.85 }}>
            <AdminStatusText message={status} />
          </div>
        ) : status ? (
          <p style={{ marginTop: 10, opacity: 0.85 }}>{status}</p>
        ) : null}

        {syncStatus.startsWith('Error:') ? (
          <div style={{ marginTop: 0, opacity: 0.85 }}>
            <AdminStatusText message={syncStatus} />
          </div>
        ) : syncStatus ? (
          <p style={{ marginTop: 0, opacity: 0.85 }}>{syncStatus}</p>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((m) => (
            <div key={m.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800 }}>{m.b2_key}</div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>uid: {m.media_uid}</div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>size: {m.size}</div>
              {m.etag ? <div style={{ opacity: 0.85, marginTop: 4 }}>etag: {m.etag}</div> : null}
              {m.b2_file_id ? <div style={{ opacity: 0.85, marginTop: 4 }}>b2_file_id: {m.b2_file_id}</div> : null}
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
                {m.ingested_at ? new Date(m.ingested_at).toLocaleString() : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
