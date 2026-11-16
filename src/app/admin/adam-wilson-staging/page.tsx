'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';
import AdamWilsonStagingForm, { type AwardItem } from './AdamWilsonStagingForm';
import AdamWilsonStagingList from './AdamWilsonStagingList';

// Admin-only staging for Adam Wilson award content (#4876, child of #2078). Staging is the end of the line:
// nothing here is published, and this page has no publish control. Separate from the fundraiser and Club
// staging pages: its own route, components, endpoints and table (award_staging_items).

type ListResponse = { ok: true; items: AwardItem[] };

export default function AdamWilsonStagingPage() {
  const [items, setItems] = useState<AwardItem[]>([]);
  const [editing, setEditing] = useState<AwardItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const result = await adminJson<ListResponse>('/api/admin/adam-wilson/list');
    if (result.ok && result.data) setItems(result.data.items);
    else setMessage(result.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (value: Record<string, unknown>) => {
    setBusy(true);
    const result = await adminJson<{ ok: true }>('/api/admin/adam-wilson/save', { method: 'POST', body: JSON.stringify(value) });
    setBusy(false);
    setMessage(result.ok ? 'Saved.' : result.error);
    if (result.ok) {
      setEditing(null);
      setCreating(false);
      await load();
    }
  };

  const remove = async (item: AwardItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    const result = await adminJson<{ ok: true }>('/api/admin/adam-wilson/delete', { method: 'POST', body: JSON.stringify({ id: item.id }) });
    setMessage(result.ok ? 'Deleted.' : result.error);
    if (result.ok) await load();
  };

  const showForm = creating || editing !== null;

  return (
    <PageShell title="Adam Wilson Award Staging" subtitle="Admin-only drafts. Nothing here is published.">
      <AdminNav />
      <p style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(180, 83, 9, 0.35)', fontWeight: 600 }}>
        Staging only. This page has no publish control. Public publication of Adam Wilson content needs the repository
        owner&apos;s express approval on #2078 and a separate Issue.
      </p>
      {message ? <AdminStatusText message={message} /> : null}
      {showForm ? (
        <AdamWilsonStagingForm
          key={editing?.id ?? 'new'}
          item={editing}
          busy={busy}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      ) : (
        <>
          <button type="button" onClick={() => setCreating(true)}>New staging item</button>
          <AdamWilsonStagingList items={items} onEdit={setEditing} onDelete={remove} />
        </>
      )}
    </PageShell>
  );
}
