'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import styles from '@/components/admin/AdminDashboard.module.css';
import { adminDownload, adminJson } from '@/lib/adminClient';

type ReportItem = {
  id: number;
  kind: string;
  target_id: number;
  reporter_email?: string;
  reason?: string;
  status: string;
  admin_note?: string;
  created_at: string;
  resolved_at?: string;
};

type ItemsResponse<T> = {
  ok: true;
  items?: T[];
};

type StatsResponse = {
  ok: true;
  counts?: Record<string, number | string>;
  unavailable?: Record<string, string>;
};

type ReportCloseResponse = {
  ok: true;
  changed?: number;
};

const EXPORT_TABLES = [
  { value: 'join_requests', label: 'Join requests' },
  { value: 'join_email_log', label: 'Join email log' },
  { value: 'library_entries', label: 'Library entries' },
  { value: 'photos', label: 'Photos' },
  { value: 'page_content', label: 'Page content' },
] as const;

const REPORT_FILTERS = ['open', 'closed'] as const;

function maskEmail(email?: string): string {
  if (!email) return '—';
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return 'redacted';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function fieldStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.16)',
    width: '100%',
  };
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.18)',
    background: disabled ? 'rgba(0,0,0,0.05)' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
  };
}

export default function AdminAuditPage() {
  const [status, setStatus] = useState('Loading audit surfaces…');
  const [reportFilter, setReportFilter] = useState<(typeof REPORT_FILTERS)[number]>('open');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [exportTable, setExportTable] = useState<(typeof EXPORT_TABLES)[number]['value']>('join_requests');
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [statsRows, setStatsRows] = useState<Array<{ table: string; count: number }>>([]);
  const [unavailableTables, setUnavailableTables] = useState<string[]>([]);
  const loadRequestRef = useRef(0);
  const reportRequestIdRef = useRef(0);
  const statsRequestIdRef = useRef(0);
  const filterRef = useRef(reportFilter);
  const skipFilterEffectRef = useRef(true);
  filterRef.current = reportFilter;
  const actionBusy = loadingReports || loadingStats || exporting || closing;

  const operationalCounts = useMemo(() => {
    const reportsOpen = statsRows.find((row) => row.table === 'reports')?.count;
    const joinRequests = statsRows.find((row) => row.table === 'join_requests')?.count;
    const libraryEntries = statsRows.find((row) => row.table === 'library_entries')?.count;
    return {
      reportsOpen: typeof reportsOpen === 'number' ? reportsOpen : null,
      joinRequests: typeof joinRequests === 'number' ? joinRequests : null,
      libraryEntries: typeof libraryEntries === 'number' ? libraryEntries : null,
    };
  }, [statsRows]);

  const loadStats = useCallback(async () => {
    const requestId = ++statsRequestIdRef.current;
    setLoadingStats(true);
    const result = await adminJson<StatsResponse>('/api/admin/stats');

    if (requestId !== statsRequestIdRef.current) {
      return;
    }

    if (!result.ok || !result.data) {
      setStatsRows([]);
      setUnavailableTables([]);
      setStatus(`Error: Stats failed — ${result.error}`);
      setLoadingStats(false);
      return;
    }

    const counts = result.data.counts || {};
    const rows = Object.entries(counts)
      .map(([table, value]) => ({
        table,
        count: typeof value === 'number' ? value : Number(value),
      }))
      .filter((row) => Number.isFinite(row.count))
      .sort((a, b) => a.table.localeCompare(b.table));

    setStatsRows(rows);
    setUnavailableTables(
      result.data.unavailable ? Object.keys(result.data.unavailable).sort() : [],
    );
    setLoadingStats(false);
  }, []);

  const loadReports = useCallback(async () => {
    const currentFilter = filterRef.current;
    const requestId = ++reportRequestIdRef.current;
    setLoadingReports(true);
    const result = await adminJson<ItemsResponse<ReportItem>>(
      `/api/admin/reports/list?status=${currentFilter}&limit=200`,
    );

    if (requestId !== reportRequestIdRef.current) {
      return;
    }

    setReports(result.ok && result.data?.items ? result.data.items : []);
    if (!result.ok) setStatus(`Error: Reports failed — ${result.error}`);
    setLoadingReports(false);
  }, []);

  const refreshAll = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setStatus('Refreshing audit surfaces…');
    await Promise.all([loadStats(), loadReports()]);

    if (requestId !== loadRequestRef.current) {
      return;
    }

    setStatus((current) => (current === 'Refreshing audit surfaces…' ? 'Audit surfaces loaded.' : current));
  }, [loadReports, loadStats]);

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipFilterEffectRef.current) {
      skipFilterEffectRef.current = false;
      return;
    }

    void loadReports();
  }, [reportFilter, loadReports]);

  const closeReport = useCallback(
    async (id: number) => {
      setClosing(true);
      setStatus('Closing report…');

      const result = await adminJson<ReportCloseResponse>('/api/admin/reports/close', {
        method: 'POST',
        body: JSON.stringify({ id, admin_note: reportNotes[id] ?? '' }),
      });

      if (!result.ok) {
        setStatus(`Error: Close failed — ${result.error}`);
        setClosing(false);
        return;
      }

      setClosing(false);
      setStatus(`Report #${id} closed.`);
      await loadReports();
      await loadStats();
    },
    [loadReports, loadStats, reportNotes],
  );

  const downloadExport = useCallback(async () => {
    setExporting(true);
    setStatus(`Exporting ${exportTable}…`);

    const result = await adminDownload(
      `/api/admin/export?table=${encodeURIComponent(exportTable)}&limit=5000`,
    );

    if (!result.ok || !result.blob) {
      setStatus(`Error: Export failed — ${result.error}`);
      setExporting(false);
      return;
    }

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${result.filename}.`);
    setExporting(false);
  }, [exportTable]);

  return (
    <PageShell
      title="Audit & Reporting"
      subtitle="Operational evidence, protected exports, and report closeout without exposing member PII in the admin UI."
    >
      <AdminNav />
      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Operational snapshot</div>
            <button
              className={styles.btn}
              onClick={() => void refreshAll()}
              disabled={actionBusy}
            >
              Refresh
            </button>
          </div>
          {status ? <AdminStatusText message={status} className={styles.status} /> : null}
          {loadingStats ? <p className={styles.status}>Loading D1 counts…</p> : null}
          {unavailableTables.length ? (
            <p className={styles.status}>Unavailable tables: {unavailableTables.join(', ')}</p>
          ) : null}
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Reports in queue ({reportFilter})</div>
              <div className={styles.statValue}>{reports.length}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Reports (D1 total)</div>
              <div className={styles.statValue}>
                {operationalCounts.reportsOpen ?? '—'}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Join requests</div>
              <div className={styles.statValue}>
                {operationalCounts.joinRequests ?? '—'}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Library entries</div>
              <div className={styles.statValue}>
                {operationalCounts.libraryEntries ?? '—'}
              </div>
            </div>
          </div>
          <p className={styles.status}>
            Full moderation for Ask and FAQ queues remains on{' '}
            <a href="/admin/moderation">Admin Moderation</a>.
          </p>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Protected CSV export</div>
          </div>
          <p className={styles.status}>
            Exports use allowlisted operational tables only. Reporter emails are not included in
            report exports from this lane.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'grid', gap: 6, minWidth: 220 }}>
              <span>Table</span>
              <select
                value={exportTable}
                onChange={(event) =>
                  setExportTable(event.target.value as (typeof EXPORT_TABLES)[number]['value'])
                }
                disabled={actionBusy}
                style={fieldStyle()}
              >
                {EXPORT_TABLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              style={{ ...buttonStyle(exporting || actionBusy), alignSelf: 'end' }}
              disabled={exporting || actionBusy}
              onClick={() => void downloadExport()}
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Report audit queue</div>
            <button
              className={styles.btn}
              onClick={() => void loadReports()}
              disabled={loadingReports || actionBusy}
            >
              Refresh reports
            </button>
          </div>
          <p className={styles.status}>
            Reporter contact is masked in this view. Close reviewed reports with an admin note for
            audit history.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {REPORT_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                style={buttonStyle(actionBusy)}
                disabled={actionBusy || reportFilter === filter}
                onClick={() => setReportFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          {loadingReports ? <p className={styles.status}>Loading reports…</p> : null}
          <div style={{ display: 'grid', gap: 12 }}>
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div>
                  <strong>
                    #{report.id} · {report.kind} · target {report.target_id}
                  </strong>
                </div>
                <div>Reporter: {maskEmail(report.reporter_email)}</div>
                <div>Reason: {report.reason?.trim() || '—'}</div>
                <div>
                  Status: {report.status}
                  {report.resolved_at ? ` · resolved ${report.resolved_at}` : ''}
                </div>
                {report.admin_note ? <div>Admin note: {report.admin_note}</div> : null}
                {report.status === 'open' ? (
                  <>
                    <textarea
                      value={reportNotes[report.id] ?? ''}
                      onChange={(event) =>
                        setReportNotes((current) => ({
                          ...current,
                          [report.id]: event.target.value,
                        }))
                      }
                      placeholder="Admin note for closeout"
                      rows={2}
                      disabled={actionBusy}
                      style={fieldStyle()}
                    />
                    <button
                      type="button"
                      style={buttonStyle(actionBusy)}
                      disabled={actionBusy}
                      onClick={() => void closeReport(report.id)}
                    >
                      Close report
                    </button>
                  </>
                ) : null}
              </div>
            ))}
            {!loadingReports && reports.length === 0 ? (
              <p className={styles.status}>No {reportFilter} reports in this queue.</p>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
