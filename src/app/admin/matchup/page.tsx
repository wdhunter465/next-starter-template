'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';

type MatchupRecord = {
  id: number;
  week_start: string;
  photo_a_id: number;
  photo_b_id: number;
  status: string;
  created_at: string;
  votes: { a: number; b: number; total: number; winner: string };
};

type MatchupListResponse = {
  ok: true;
  active: MatchupRecord | null;
  items: MatchupRecord[];
};

type PublicCurrentResponse = {
  ok: boolean;
  week_start?: string | null;
  matchup_id?: number | null;
  items?: Array<{ id: number; url: string; title?: string; description?: string }>;
  error?: string;
};

type PublicResultsResponse = {
  ok: boolean;
  week_start?: string | null;
  totals?: { a: number; b: number };
  last_week?: { week_start: string; totals: { a: number; b: number }; winner: string } | null;
  error?: string;
};

type MatchupDraft = {
  week_start: string;
  photo_a_id: string;
  photo_b_id: string;
  activate_on_create: boolean;
};

const EMPTY_DRAFT: MatchupDraft = {
  week_start: '',
  photo_a_id: '',
  photo_b_id: '',
  activate_on_create: false,
};

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
    fontWeight: 700,
  };
}

function mondayForDate(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AdminMatchupPage() {
  const [status, setStatus] = useState('Loading weekly matchups…');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [items, setItems] = useState<MatchupRecord[]>([]);
  const [active, setActive] = useState<MatchupRecord | null>(null);
  const [draft, setDraft] = useState<MatchupDraft>({ ...EMPTY_DRAFT, week_start: mondayForDate() });
  const [publicCurrent, setPublicCurrent] = useState<PublicCurrentResponse | null>(null);
  const [publicResults, setPublicResults] = useState<PublicResultsResponse | null>(null);
  const [previewWeek, setPreviewWeek] = useState('');
  const loadRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const actionBusy = loading || saving || closing || activating;

  const selected = useMemo(
    () => items.find((item) => item.week_start === previewWeek) ?? active ?? items[0] ?? null,
    [active, items, previewWeek],
  );

  const loadPublicPreview = useCallback(async (weekStart?: string) => {
    const requestId = ++previewRequestRef.current;

    try {
      const currentRes = await fetch('/api/matchup/current', { cache: 'no-store' });
      const currentData = (await currentRes.json().catch(() => ({}))) as PublicCurrentResponse;
      if (requestId !== previewRequestRef.current) return;

      setPublicCurrent(currentData?.ok ? currentData : { ok: false, error: currentData?.error || `HTTP ${currentRes.status}` });

      const week = weekStart || currentData?.week_start || '';
      if (!week) {
        setPublicResults({ ok: true, week_start: null, totals: { a: 0, b: 0 }, last_week: null });
        return;
      }

      const resultsRes = await fetch(`/api/matchup/results?week_start=${encodeURIComponent(week)}`, {
        cache: 'no-store',
      });
      const resultsData = (await resultsRes.json().catch(() => ({}))) as PublicResultsResponse;
      if (requestId !== previewRequestRef.current) return;

      setPublicResults(
        resultsData?.ok
          ? resultsData
          : { ok: false, error: resultsData?.error || `HTTP ${resultsRes.status}` },
      );
    } catch {
      if (requestId !== previewRequestRef.current) return;
      setPublicCurrent({ ok: false, error: 'Request failed.' });
      setPublicResults({ ok: false, error: 'Request failed.' });
    }
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setStatus('Loading weekly matchups…');

    const result = await adminJson<MatchupListResponse>('/api/admin/matchup/list?limit=50');

    if (requestId !== loadRequestRef.current) {
      return;
    }

    if (!result.ok) {
      setItems([]);
      setActive(null);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const nextItems = Array.isArray(result.data?.items) ? result.data.items : [];
    const nextActive = result.data?.active ?? nextItems.find((item) => item.status === 'active') ?? null;
    setItems(nextItems);
    setActive(nextActive);
    setPreviewWeek(nextActive?.week_start || nextItems[0]?.week_start || '');
    setStatus(nextItems.length ? `Loaded ${nextItems.length} matchup record(s).` : 'No matchup records found.');
    setLoading(false);

    await loadPublicPreview(nextActive?.week_start || nextItems[0]?.week_start);
  }, [loadPublicPreview]);

  const createMatchup = useCallback(async () => {
    const week_start = draft.week_start.trim();
    const photo_a_id = Number(draft.photo_a_id);
    const photo_b_id = Number(draft.photo_b_id);

    if (
      !week_start ||
      !Number.isFinite(photo_a_id) ||
      photo_a_id <= 0 ||
      !Number.isFinite(photo_b_id) ||
      photo_b_id <= 0 ||
      photo_a_id === photo_b_id
    ) {
      setStatus('Error: Create blocked. Week start and two distinct positive photo IDs are required.');
      return;
    }

    setSaving(true);
    setStatus('Creating matchup…');

    const result = await adminJson<{ ok: true; id: number | null }>('/api/admin/matchup/create', {
      method: 'POST',
      body: JSON.stringify({
        week_start,
        photo_a_id,
        photo_b_id,
        status: draft.activate_on_create ? 'active' : 'closed',
      }),
    });

    if (!result.ok) {
      setStatus(`Error: Create failed — ${result.error}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    await load();
    setStatus(`Matchup created${result.data?.id ? ` (#${result.data.id})` : ''}.`);
  }, [draft, load]);

  const activateMatchup = useCallback(
    async (record: MatchupRecord) => {
      setActivating(true);
      setStatus(`Activating matchup ${record.id}…`);

      const result = await adminJson<{ ok: true; changed: number }>('/api/admin/matchup/update', {
        method: 'POST',
        body: JSON.stringify({ id: record.id, status: 'active' }),
      });

      if (!result.ok) {
        setStatus(`Error: Activate failed — ${result.error}`);
        setActivating(false);
        return;
      }

      setActivating(false);
      await load();
      setStatus(`Matchup ${record.id} is now active.`);
    },
    [load],
  );

  const closeActiveMatchup = useCallback(async () => {
    setClosing(true);
    setStatus('Closing active matchup…');

    const result = await adminJson<{ ok: true; changed: number; closed_id?: number; note?: string }>(
      '/api/admin/matchup/close-active',
      { method: 'POST' },
    );

    if (!result.ok) {
      setStatus(`Error: Close failed — ${result.error}`);
      setClosing(false);
      return;
    }

    setClosing(false);
    await load();
    setStatus(
      result.data?.note ||
        `Closed active matchup${result.data?.closed_id ? ` (#${result.data.closed_id})` : ''}.`,
    );
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (previewWeek) {
      void loadPublicPreview(previewWeek);
    }
  }, [loadPublicPreview, previewWeek]);

  return (
    <PageShell
      title="Weekly Matchup"
      subtitle="Review active matchup state, vote totals, and rotation controls without changing public voting contracts."
    >
      <AdminNav />
      <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={actionBusy}
              style={buttonStyle(actionBusy)}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => void closeActiveMatchup()}
              disabled={actionBusy}
              style={buttonStyle(actionBusy)}
            >
              {closing ? 'Closing…' : 'Close active matchup'}
            </button>
          </div>
          <AdminStatusText message={status} />

          {active ? (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#184d12', fontWeight: 700 }}>
              Active matchup: week {active.week_start} (photos {active.photo_a_id} vs {active.photo_b_id}) — votes{' '}
              {active.votes.a}/{active.votes.b} (winner: {active.votes.winner})
            </p>
          ) : (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#7a4b00', fontWeight: 700 }}>
              No active matchup in D1. Public `/api/matchup/current` may fall back to photo list behavior.
            </p>
          )}
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Create matchup</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              Week start (Monday, YYYY-MM-DD)
              <input
                value={draft.week_start}
                onChange={(e) => setDraft((prev) => ({ ...prev, week_start: e.target.value }))}
                style={fieldStyle()}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Photo A ID
              <input
                type="number"
                value={draft.photo_a_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, photo_a_id: e.target.value }))}
                style={fieldStyle()}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              Photo B ID
              <input
                type="number"
                value={draft.photo_b_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, photo_b_id: e.target.value }))}
                style={fieldStyle()}
              />
            </label>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={draft.activate_on_create}
              onChange={(e) => setDraft((prev) => ({ ...prev, activate_on_create: e.target.checked }))}
            />
            Activate immediately (closes any other active matchup)
          </label>

          <button
            type="button"
            onClick={() => void createMatchup()}
            disabled={actionBusy}
            style={{ ...buttonStyle(actionBusy), marginTop: 12 }}
          >
            {saving ? 'Creating…' : 'Create matchup'}
          </button>
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Matchup inventory</h2>
          {items.length === 0 ? (
            <p>No matchup records found.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map((record) => (
                <article key={record.id} style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>
                        Week {record.week_start} — {record.status}
                      </h3>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        id {record.id} · photos {record.photo_a_id} vs {record.photo_b_id} · votes {record.votes.a}/
                        {record.votes.b} ({record.votes.winner})
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewWeek(record.week_start)}
                        disabled={actionBusy}
                        style={buttonStyle(actionBusy)}
                      >
                        Preview week
                      </button>
                      <button
                        type="button"
                        onClick={() => void activateMatchup(record)}
                        disabled={record.status === 'active' || actionBusy}
                        style={buttonStyle(record.status === 'active' || actionBusy)}
                      >
                        Activate
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Public read-path preview</h2>
          <p style={{ opacity: 0.85 }}>
            These calls use the same public contracts as the homepage Weekly Matchup component. Missing or invalid active
            matchup data fails closed to safe empty/fallback behavior.
          </p>

          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <div>
              <strong>/api/matchup/current</strong>
              {publicCurrent?.ok ? (
                <div style={{ marginTop: 6 }}>
                  week_start: {publicCurrent.week_start || '(none)'} · items: {publicCurrent.items?.length ?? 0}
                  {publicCurrent.matchup_id ? ` · matchup_id: ${publicCurrent.matchup_id}` : ''}
                </div>
              ) : (
                <div style={{ marginTop: 6, color: '#7a4b00' }}>
                  unavailable: {publicCurrent?.error || 'missing matchup content'}
                </div>
              )}
            </div>

            <div>
              <strong>/api/matchup/results</strong>
              {selected ? <span> (week {selected.week_start})</span> : null}
              {publicResults?.ok ? (
                <div style={{ marginTop: 6 }}>
                  totals: {publicResults.totals?.a ?? 0}/{publicResults.totals?.b ?? 0}
                  {publicResults.last_week
                    ? ` · last closed week ${publicResults.last_week.week_start} winner ${publicResults.last_week.winner}`
                    : ''}
                </div>
              ) : (
                <div style={{ marginTop: 6, color: '#7a4b00' }}>
                  unavailable: {publicResults?.error || 'results not available'}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
