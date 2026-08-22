'use client';

import React, { useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';
import styles from '@/components/admin/AdminDashboard.module.css';

type WorklistItem = {
  id: number;
  task: string;
  owner?: string | null;
  status: string;
  needed_completion_date?: string | null;
  updated_at?: string | null;
};

type WorklistResponse = { ok: true; results?: unknown[] };

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function normalizeWorklistItem(raw: unknown): WorklistItem | null {
  if (!isRecord(raw)) return null;
  const id = asNumber(raw.id);
  const task = asString(raw.task);
  const status = asString(raw.status) || 'open';
  if (id === null || !task) return null;

  return {
    id: Math.trunc(id),
    task,
    status,
    owner: asString(raw.owner),
    needed_completion_date: asString(raw.needed_completion_date),
    updated_at: asString(raw.updated_at),
  };
}

export default function AdminWorklistPage() {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [status, setStatus] = useState('Loading worklist...');
  const [task, setTask] = useState('');
  const [owner, setOwner] = useState('');
  const [neededDate, setNeededDate] = useState('');

  async function load() {
    setStatus('Loading worklist...');
    const result = await adminJson<WorklistResponse>('/api/admin/worklist');
    if (!result.ok || !result.data) {
      setItems([]);
      setStatus(`Error: ${result.error}`);
      return;
    }

    const normalized = (Array.isArray(result.data.results) ? result.data.results : [])
      .map(normalizeWorklistItem)
      .filter((item): item is WorklistItem => item !== null);
    setItems(normalized);
    setStatus(normalized.length ? '' : 'No worklist items found.');
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task.trim()) {
      setStatus('Task is required.');
      return;
    }

    setStatus('Adding worklist item...');
    const result = await adminJson<{ ok: true }>('/api/admin/worklist', {
      method: 'POST',
      body: JSON.stringify({
        task,
        owner,
        needed_completion_date: neededDate,
      }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }

    setTask('');
    setOwner('');
    setNeededDate('');
    await load();
  }

  async function updateStatus(id: number, nextStatus: string) {
    setStatus('Updating worklist item...');
    const result = await adminJson<{ ok: true }>('/api/admin/worklist', {
      method: 'PATCH',
      body: JSON.stringify({ id, status: nextStatus }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageShell title="Admin Worklist" subtitle="Operational admin tasks, owners, due dates, and status">
      <AdminNav />
      <div className={styles.wrap}>
        <form className={styles.panel} onSubmit={addItem}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Add worklist item</div>
            <button className={styles.btn} type="submit">
              Add item
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Task</span>
              <input value={task} onChange={(event) => setTask(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Owner</span>
              <input value={owner} onChange={(event) => setOwner(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Needed completion date</span>
              <input type="date" value={neededDate} onChange={(event) => setNeededDate(event.target.value)} />
            </label>
          </div>
        </form>

        <section className={styles.panel} aria-label="Admin worklist items">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Current worklist</div>
            <button className={styles.btn} type="button" onClick={() => void load()}>
              Refresh
            </button>
          </div>
          {status ? (
            status.startsWith('Error:') ? (
              <AdminStatusText message={status} className={styles.status} />
            ) : (
              <p className={styles.status}>{status}</p>
            )
          ) : null}
          <div className={styles.list}>
            {items.map((item) => (
              <article key={item.id} className={styles.listItem}>
                <div>
                  <h2>{item.task}</h2>
                  <p>
                    {item.owner ? `Owner: ${item.owner}` : 'Owner unassigned'}
                    {item.needed_completion_date ? ` | Due: ${item.needed_completion_date}` : ''}
                  </p>
                  <p>Status: {item.status}</p>
                </div>
                <div className={styles.actions}>
                  {['open', 'in_progress', 'completed'].map((nextStatus) => (
                    <button
                      key={nextStatus}
                      className={styles.btn}
                      type="button"
                      disabled={item.status === nextStatus}
                      onClick={() => void updateStatus(item.id, nextStatus)}
                    >
                      {nextStatus.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
