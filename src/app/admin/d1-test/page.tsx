'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';
import styles from '@/components/admin/AdminDashboard.module.css';

type TableInfo = { name: string; count: number };

type D1SummaryResponse = { ok: true; tables?: TableInfo[] };
type D1DetailResponse = {
  ok: true;
  table?: string;
  schema?: unknown;
  rows?: unknown;
};

const localStyles: Record<string, React.CSSProperties> = {
  main: { padding: '32px 16px', maxWidth: 1100, margin: '0 auto' },
  h1: { fontSize: 34, margin: '0 0 8px 0' },
  lead: { fontSize: 16, lineHeight: 1.7, margin: '0 0 18px 0' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 10 },
  th: { textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid rgba(0,0,0,0.15)' },
  td: { padding: '8px 6px', borderBottom: '1px solid rgba(0,0,0,0.08)', verticalAlign: 'top', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13 },
  small: { fontSize: 13, opacity: 0.85 },
  pre: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13, whiteSpace: 'pre-wrap' },
};

export default function AdminD1TestPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [detail, setDetail] = useState<D1DetailResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const sorted = useMemo(() => [...tables].sort((a, b) => a.name.localeCompare(b.name)), [tables]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setStatus('Loading D1 tables…');
    setDetail(null);
    try {
      const result = await adminJson<D1SummaryResponse>('/api/admin/d1-inspect');
      if (!result.ok || !result.data) {
        setTables([]);
        setError(`Error: ${result.error}`);
        setStatus('');
        return;
      }
      setTables(result.data.tables || []);
      setStatus((result.data.tables || []).length ? '' : 'No D1 tables returned.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Error: ${msg}`);
      setStatus('');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTable = useCallback(async (name: string) => {
    setSelected(name);
    setLoading(true);
    setError('');
    setStatus(`Loading ${name}…`);
    setDetail(null);
    try {
      const result = await adminJson<D1DetailResponse>(
        `/api/admin/d1-inspect?table=${encodeURIComponent(name)}&limit=5`,
      );
      if (!result.ok || !result.data) {
        setError(`Error: ${result.error}`);
        setStatus('');
        return;
      }
      setDetail(result.data);
      setStatus('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Error: ${msg}`);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="Admin – D1 Inspect" subtitle="Inspect tables and run safe, read-only queries">
      <AdminNav />

      <div style={localStyles.main}>
        <h1 style={localStyles.h1}>Admin • D1 Test</h1>
        <p style={localStyles.lead}>
          Diagnostic view of D1 tables: row counts, schema, and sample rows.
        </p>

        <div className={styles.wrap}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>D1 table list</div>
              <button className={styles.btn} type="button" onClick={() => void load()} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {status ? <p className={styles.status}>{status}</p> : null}
            {error ? <AdminStatusText message={error} className={styles.status} /> : null}
          </div>

          {!!sorted.length && (
            <div className={styles.panel}>
              <div style={localStyles.small}>Tables ({sorted.length}) — click a row to inspect</div>
              <table style={localStyles.table}>
                <thead>
                  <tr>
                    <th style={localStyles.th}>Table</th>
                    <th style={localStyles.th}>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <tr
                      key={t.name}
                      onClick={() => void loadTable(t.name)}
                      style={{ cursor: 'pointer', background: t.name === selected ? 'rgba(0,0,0,0.04)' : 'transparent' }}
                    >
                      <td style={localStyles.td}>{t.name}</td>
                      <td style={localStyles.td}>{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {detail ? (
            <div className={styles.panel}>
              <div style={localStyles.small}>
                Detail: <strong>{detail.table}</strong>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={localStyles.small}><strong>Schema</strong></div>
                <pre style={localStyles.pre}>{JSON.stringify(detail.schema, null, 2)}</pre>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={localStyles.small}><strong>Sample rows</strong></div>
                <pre style={localStyles.pre}>{JSON.stringify(detail.rows, null, 2)}</pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
