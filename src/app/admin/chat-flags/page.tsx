'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';
import styles from '@/components/admin/AdminDashboard.module.css';

// Member Chat flags (#5553): questions for the admin (@admin) and member reports.

type Flag = {
  id: number;
  kind: 'question' | 'report';
  status: 'open' | 'resolved';
  reason: string | null;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  topic_id: number;
  flagged_by: string;
  flagged_by_name: string | null;
  post_excerpt: string;
  topic_title: string;
};

export default function AdminChatFlagsPage() {
  const [items, setItems] = useState<Flag[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [status, setStatus] = useState('Loading…');
  const [notes, setNotes] = useState<Record<number, string>>({});

  async function load(next = filter) {
    setStatus('Loading…');
    const result = await adminJson<{ ok: true; items: Flag[] }>(`/api/admin/discussions/flags?status=${next}`);
    if (!result.ok || !result.data) {
      setItems([]);
      setStatus(`Error: ${result.error}`);
      return;
    }
    setItems(result.data.items);
    setStatus(result.data.items.length ? '' : next === 'open' ? 'Nothing waiting.' : 'No flags yet.');
  }

  async function resolve(id: number) {
    const result = await adminJson<{ ok: true }>('/api/admin/discussions/resolve-flag', {
      method: 'POST',
      body: JSON.stringify({ id, note: notes[id] || '' }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    await load();
  }

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <PageShell title="Chat Flags" subtitle="Questions for the admin and member reports from Member Chat">
      <AdminNav />
      <div className={styles.wrap}>
        <section className={styles.panel} aria-label="Chat flags">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>{filter === 'open' ? 'Open flags' : 'All flags'}</div>
            <button className={styles.btn} type="button" onClick={() => setFilter(filter === 'open' ? 'all' : 'open')}>
              {filter === 'open' ? 'Show all' : 'Show open only'}
            </button>
          </div>
          {status ? <AdminStatusText message={status} /> : null}
          {items.map((f) => (
            <article key={f.id} className={styles.panel}>
              <div className={styles.panelTitle}>
                {f.kind === 'question' ? 'Question for the admin' : 'Report'} · {f.status}
              </div>
              <p>
                <strong>{f.flagged_by_name || 'Member'}</strong> ({f.flagged_by}) · {new Date(f.created_at.replace(' ', 'T') + 'Z').toLocaleString()}
              </p>
              <p>
                Topic: <Link href={`/fanclub/chat?topic=${f.topic_id}`}>{f.topic_title}</Link>
              </p>
              <p>&ldquo;{f.post_excerpt}&rdquo;</p>
              {f.reason ? <p>Reason: {f.reason}</p> : null}
              {f.status === 'open' ? (
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Note (optional)</span>
                    <input value={notes[f.id] || ''} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} />
                  </label>
                  <button className={styles.btn} type="button" onClick={() => void resolve(f.id)}>
                    Resolve
                  </button>
                </div>
              ) : (
                <p>
                  Resolved{f.resolved_by ? ` by ${f.resolved_by}` : ''}
                  {f.admin_note ? `: ${f.admin_note}` : ''}
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </PageShell>
  );
}
