'use client';

import React, { useEffect, useState } from 'react';
import styles from './AdminDashboard.module.css';
import AdminStatusText from './AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';

type CountRow = { table: string; count: number };
type StatsResponse = { ok: true; counts?: Record<string, number | string>; unavailable?: Record<string, string> };

function asCounts(data: unknown): CountRow[] {
  if (!isRecord(data) || data.ok !== true) return [];
  const counts = (data as Record<string, unknown>).counts;
  if (!isRecord(counts)) return [];
  const rows: CountRow[] = [];
  for (const [k, v] of Object.entries(counts)) {
    const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
    if (!Number.isFinite(n)) continue;
    rows.push({ table: k, count: n });
  }
  rows.sort((a, b) => a.table.localeCompare(b.table));
  return rows;
}

export default function AdminDashboard() {
  const [status, setStatus] = useState<string>('');
  const [rows, setRows] = useState<CountRow[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  async function loadStats() {
    setStatus('Loading stats…');
    const result = await adminJson<StatsResponse>('/api/admin/stats');

    if (!result.ok || !result.data) {
      setStatus(`Error: ${result.error}`);
      setRows([]);
      setUnavailable([]);
      return;
    }

    const nextRows = asCounts(result.data);
    const skipped = isRecord(result.data.unavailable) ? Object.keys(result.data.unavailable).sort() : [];
    setRows(nextRows);
    setUnavailable(skipped);
    setStatus(nextRows.length ? '' : 'No D1 table counts returned.');
  }

  useEffect(() => {
    void loadStats();
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <a className={styles.card} href="/admin/content">
          <div className={styles.cardTitle}>Page Content</div>
          <div className={styles.cardBody}>Edit D1-backed content blocks (draft + publish).</div>
        </a>

        <a className={styles.card} href="/admin/faq">
          <div className={styles.cardTitle}>FAQ Admin</div>
          <div className={styles.cardBody}>Moderate questions, approvals, pinning, and views.</div>
        </a>

        <a className={styles.card} href="/admin/moderation">
          <div className={styles.cardTitle}>Moderation</div>
          <div className={styles.cardBody}>Review reports, Ask submissions, and pending FAQ entries.</div>
        </a>

        <a className={styles.card} href="/admin/audit">
          <div className={styles.cardTitle}>Audit & Reporting</div>
          <div className={styles.cardBody}>Operational stats, protected CSV exports, and report closeout evidence.</div>
        </a>

        <a className={styles.card} href="/admin/join-requests">
          <div className={styles.cardTitle}>Join Requests</div>
          <div className={styles.cardBody}>View recent join requests captured from /join.</div>
        </a>

        <a className={styles.card} href="/admin/worklist">
          <div className={styles.cardTitle}>Worklist</div>
          <div className={styles.cardBody}>Track admin operations tasks, owners, due dates, and status.</div>
        </a>

        <a className={styles.card} href="/admin/member-operations">
          <div className={styles.cardTitle}>Member Operations</div>
          <div className={styles.cardBody}>Manage welcome email copy and membership card instructions.</div>
        </a>

        <a className={styles.card} href="/admin/media-assets">
          <div className={styles.cardTitle}>Media Assets</div>
          <div className={styles.cardBody}>Inspect ingested media in D1 (Backblaze B2 keys, size, etag).</div>
        </a>

        <a className={styles.card} href="/admin/cms">
          <div className={styles.cardTitle}>CMS</div>
          <div className={styles.cardBody}>Admin tools (work in progress).</div>
        </a>

        <a className={styles.card} href="/admin/editorial">
          <div className={styles.cardTitle}>Editorial Archive</div>
          <div className={styles.cardBody}>Review member submissions and publish content_inventory records.</div>
        </a>

        <a className={styles.card} href="/admin/events">
          <div className={styles.cardTitle}>Event Calendar</div>
          <div className={styles.cardBody}>Create, update, and seed events for the public calendar.</div>
        </a>

        <a className={styles.card} href="/admin/matchup">
          <div className={styles.cardTitle}>Weekly Matchup</div>
          <div className={styles.cardBody}>Activate, close, and review weekly photo matchup vote totals.</div>
        </a>

        <a className={styles.card} href="/admin/fundraiser-preview">
          <div className={styles.cardTitle}>Fundraiser Preview</div>
          <div className={styles.cardBody}>Build and validate the conditional homepage campaign spotlight in the gated admin area.</div>
        </a>

        <a className={styles.card} href="/admin/clubstaging">
          <div className={styles.cardTitle}>Club Staging</div>
          <div className={styles.cardBody}>Preview staged club content, rotation samples, and production-like member cards without public exposure.</div>
        </a>

        <a className={styles.card} href="/admin/d1-test">
          <div className={styles.cardTitle}>D1 Inspect</div>
          <div className={styles.cardBody}>Connectivity checks and diagnostics.</div>
        </a>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>D1 Table Counts</div>
          <button className={styles.btn} onClick={() => void loadStats()}>
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
        {unavailable.length ? (
          <p className={styles.status}>Unavailable tables: {unavailable.join(', ')}</p>
        ) : null}

        <div className={styles.statsGrid}>
          {rows.map((r) => (
            <div key={r.table} className={styles.stat}>
              <div className={styles.statLabel}>{r.table}</div>
              <div className={styles.statValue}>{r.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
