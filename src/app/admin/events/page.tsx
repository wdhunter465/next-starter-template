'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';

type EventRecord = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  host?: string | null;
  fees?: string | null;
  description?: string | null;
  external_url?: string | null;
  status: 'posted' | 'hidden';
  updated_at?: string | null;
};

type EventListResponse = {
  ok: true;
  month?: string;
  items: EventRecord[];
};

type EventMutationResponse = {
  ok: true;
  id?: number | null;
  changed?: number;
};

type SeedResponse = {
  ok: true;
  inserted: number;
  upcoming_posted: number;
  note?: string;
};

type EventDraft = {
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  host: string;
  fees: string;
  description: string;
  external_url: string;
  status: 'posted' | 'hidden';
};

const EMPTY_DRAFT: EventDraft = {
  title: '',
  start_date: '',
  end_date: '',
  location: '',
  host: '',
  fees: '',
  description: '',
  external_url: '',
  status: 'posted',
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

function monthKeyFromDate(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function draftFromRecord(record: EventRecord): EventDraft {
  return {
    title: record.title,
    start_date: record.start_date,
    end_date: record.end_date || record.start_date,
    location: record.location || '',
    host: record.host || '',
    fees: record.fees || '',
    description: record.description || '',
    external_url: record.external_url || '',
    status: record.status === 'hidden' ? 'hidden' : 'posted',
  };
}

export default function AdminEventsPage() {
  const [month, setMonth] = useState(monthKeyFromDate());
  const [status, setStatus] = useState('Loading events…');
  const [seedStatus, setSeedStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [items, setItems] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  // AdminLayout already gates this whole route tree on an admin session (#3547).
  const tokenReady = true;
  const loadRequestRef = useRef(0);

  const selected = useMemo(
    () => (selectedId === null ? null : items.find((item) => item.id === selectedId) ?? null),
    [items, selectedId],
  );

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setStatus(`Loading events for ${month}…`);

    const result = await adminJson<EventListResponse>(
      `/api/admin/events/list?month=${encodeURIComponent(month)}&limit=100`,
    );

    if (requestId !== loadRequestRef.current) {
      return;
    }

    if (!result.ok) {
      setItems([]);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const nextItems = Array.isArray(result.data?.items) ? result.data.items : [];
    setItems(nextItems);
    setStatus(nextItems.length ? `Loaded ${nextItems.length} event(s) for ${month}.` : `No events found for ${month}.`);
    setLoading(false);
  }, [month]);

  const resetCreateForm = useCallback(() => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
  }, []);

  const startEdit = useCallback((record: EventRecord) => {
    setSelectedId(record.id);
    setDraft(draftFromRecord(record));
  }, []);

  const createEvent = useCallback(async () => {
    setSaving(true);
    setStatus('Creating event…');

    const result = await adminJson<EventMutationResponse>('/api/admin/events/create', {
      method: 'POST',
      body: JSON.stringify(draft),
    });

    if (!result.ok) {
      setStatus(`Create error: ${result.error}`);
      setSaving(false);
      return;
    }

    resetCreateForm();
    setSaving(false);
    await load();
    setStatus('Event created.');
  }, [draft, load, resetCreateForm]);

  const updateEvent = useCallback(async () => {
    if (selectedId === null) return;

    setSaving(true);
    setStatus(`Updating event ${selectedId}…`);

    const result = await adminJson<EventMutationResponse>('/api/admin/events/update', {
      method: 'POST',
      body: JSON.stringify({ id: selectedId, ...draft }),
    });

    if (!result.ok) {
      setStatus(`Update error: ${result.error}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    await load();
    setStatus(`Event ${selectedId} updated.`);
  }, [draft, load, selectedId]);

  const seedNextTen = useCallback(async () => {
    setSeeding(true);
    setSeedStatus('Seeding placeholder events…');

    const result = await adminJson<SeedResponse>('/api/admin/events/seed-next10', {
      method: 'POST',
    });

    if (!result.ok) {
      setSeedStatus(`Seed error: ${result.error}`);
      setSeeding(false);
      return;
    }

    const data = result.data;
    setSeedStatus(
      `Seed complete: inserted ${data?.inserted ?? 0}, upcoming posted ${data?.upcoming_posted ?? 0}.`,
    );
    setSeeding(false);
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell
      title="Event Calendar"
      subtitle="Create, update, and seed events that feed the public /events page and homepage calendar."
    >
      <AdminNav />
      <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              Month
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                disabled={!tokenReady}
                style={fieldStyle()}
              />
            </label>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !tokenReady}
              style={buttonStyle(loading || !tokenReady)}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={() => void seedNextTen()}
              disabled={seeding || !tokenReady}
              style={buttonStyle(seeding || !tokenReady)}
            >
              {seeding ? 'Seeding…' : 'Seed next 10 placeholders'}
            </button>

            <button type="button" onClick={resetCreateForm} disabled={!tokenReady} style={buttonStyle(!tokenReady)}>
              New event
            </button>
          </div>

          <AdminStatusText message={status} />
        </div>

        {seedStatus ? <AdminStatusText message={seedStatus} /> : null}

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>{selected ? `Edit event #${selected.id}` : 'Create event'}</h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) {
                void updateEvent();
              } else {
                void createEvent();
              }
            }}
            style={{ display: 'grid', gap: 12 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                Title
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  minLength={3}
                  style={fieldStyle()}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Start date
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(event) => setDraft((prev) => ({ ...prev, start_date: event.target.value }))}
                  required
                  style={fieldStyle()}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                End date
                <input
                  type="date"
                  value={draft.end_date}
                  onChange={(event) => setDraft((prev) => ({ ...prev, end_date: event.target.value }))}
                  style={fieldStyle()}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Status
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      status: event.target.value === 'hidden' ? 'hidden' : 'posted',
                    }))
                  }
                  style={fieldStyle()}
                >
                  <option value="posted">posted</option>
                  <option value="hidden">hidden</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                Location
                <input
                  value={draft.location}
                  onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
                  style={fieldStyle()}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Host
                <input
                  value={draft.host}
                  onChange={(event) => setDraft((prev) => ({ ...prev, host: event.target.value }))}
                  style={fieldStyle()}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Fees
                <input
                  value={draft.fees}
                  onChange={(event) => setDraft((prev) => ({ ...prev, fees: event.target.value }))}
                  style={fieldStyle()}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                External URL
                <input
                  value={draft.external_url}
                  onChange={(event) => setDraft((prev) => ({ ...prev, external_url: event.target.value }))}
                  style={fieldStyle()}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              Description
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                style={fieldStyle()}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving || !tokenReady} style={buttonStyle(saving || !tokenReady)}>
                {saving ? 'Saving…' : selected ? 'Save changes' : 'Create event'}
              </button>
              {selected ? (
                <button type="button" onClick={resetCreateForm} disabled={!tokenReady} style={buttonStyle(!tokenReady)}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Events for {month}</h2>
          <p style={{ opacity: 0.8 }}>
            Hidden events remain visible here for admin review but are excluded from public /events and homepage calendar reads.
          </p>

          {items.length === 0 ? (
            <p>No events found for this month.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {items.map((record) => (
                <article key={record.id} style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{record.title}</h3>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>
                        {record.start_date}
                        {record.end_date && record.end_date !== record.start_date ? ` → ${record.end_date}` : ''}
                        {' · '}
                        status: {record.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(record)}
                      disabled={!tokenReady}
                      style={buttonStyle(!tokenReady)}
                    >
                      Edit
                    </button>
                  </div>

                  {record.location ? <div style={{ marginTop: 6 }}>Location: {record.location}</div> : null}
                  {record.host ? <div style={{ marginTop: 4 }}>Host: {record.host}</div> : null}
                  {record.fees ? <div style={{ marginTop: 4 }}>Fees: {record.fees}</div> : null}
                  {record.description ? (
                    <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{record.description}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
