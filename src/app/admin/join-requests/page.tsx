'use client';

import React, { useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';
import styles from '@/components/admin/AdminDashboard.module.css';

type JoinRequest = {
  id: number;
  name: string;
  email: string;
  message?: string | null;
  created_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  screen_name?: string | null;
  email_opt_in?: number | null;
  presence_status?: string | null;
};

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function normalize(raw: unknown): JoinRequest | null {
  if (!isRecord(raw)) return null;

  const id = asNumber(raw.id);
  const name = asString(raw.name);
  const email = asString(raw.email);

  if (id === null || !name || !email) return null;

  const message = asString(raw.message);
  const created_at = asString(raw.created_at);
  const first_name = asString(raw.first_name);
  const last_name = asString(raw.last_name);
  const screen_name = asString(raw.screen_name);
  const presence_status = asString(raw.presence_status);

  const email_opt_in = asNumber(raw.email_opt_in);
  const email_opt_in_norm = email_opt_in === null ? null : Math.trunc(email_opt_in);

  return {
    id: Math.trunc(id),
    name,
    email,
    message,
    created_at,
    first_name,
    last_name,
    screen_name,
    email_opt_in: email_opt_in_norm,
    presence_status,
  };
}

export default function AdminJoinRequestsPage() {
  const [status, setStatus] = useState<string>('');
  const [items, setItems] = useState<JoinRequest[]>([]);

  async function load() {
    setStatus('Loading…');
    const result = await adminJson<{ ok: true; items?: unknown[] }>('/api/admin/join-requests/list?limit=50');

    if (!result.ok || !result.data) {
      setStatus(`Error: ${result.error}`);
      setItems([]);
      return;
    }

    const arr = Array.isArray(result.data.items) ? result.data.items : [];
    const normalized = arr.map(normalize).filter((x): x is JoinRequest => x !== null);

    setItems(normalized);
    setStatus(normalized.length ? '' : 'No join requests found.');
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageShell title="Join Requests" subtitle="Recent join requests captured from /join">
      <AdminNav />
      <div className={styles.wrap}>
        <button
          onClick={() => void load()}
          className={styles.btn}
        >
          Refresh
        </button>

        {status ? (
          status.startsWith('Error:') ? (
            <AdminStatusText message={status} className={styles.status} />
          ) : (
            <p className={styles.status}>{status}</p>
          )
        ) : null}

        <div className={styles.list}>
          {items.map((j) => (
            <div key={j.id} className={styles.listItem}>
              <div className={styles.cardTitle}>{j.name}</div>
              <div className={styles.status}>{j.email}</div>
              <div className={styles.status}>
                {j.created_at ? new Date(j.created_at).toLocaleString() : ''}
                {j.presence_status ? ` • ${j.presence_status}` : ''}
                {typeof j.email_opt_in === 'number' ? ` • opt-in: ${j.email_opt_in ? 'yes' : 'no'}` : ''}
              </div>
              {j.message ? <div className={styles.prewrap}>{j.message}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
