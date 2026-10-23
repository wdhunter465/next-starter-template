'use client';

import { useEffect, useState } from 'react';

type EventRow = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  host?: string | null;
  fees?: string | null;
  description?: string | null;
  external_url?: string | null;
};

export default function EventsNextTen() {
  const [items, setItems] = useState<EventRow[]>([]);
  const [status, setStatus] = useState<string>('Loading events…');

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch('/api/events/next?limit=10', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setStatus('Error loading events.');
          setItems([]);
          return;
        }

        const rows: EventRow[] = Array.isArray(data.items) ? data.items : [];
        setItems(rows);
        setStatus(rows.length ? '' : 'No upcoming events posted yet.');
      } catch {
        if (!alive) return;
        setStatus('Error loading events.');
        setItems([]);
      }
    })();

    return () => { alive = false; };
  }, []);

  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ lineHeight: 1.25, margin: '0 0 10px 0' }}>Upcoming events (next 10)</h2>
      {status ? (
        <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)', margin: 0 }}>{status}</p>
      ) : (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {items.map((e) => (
            <li key={e.id} style={{ margin: '0 0 10px 0', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700 }}>{e.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>
                {e.start_date}{e.end_date && e.end_date !== e.start_date ? ` → ${e.end_date}` : ''}
                {e.location ? ` • ${e.location}` : ''}
                {e.host ? ` • Host: ${e.host}` : ''}
                {e.fees ? ` • ${e.fees}` : ''}
              </div>
              {e.description ? (
                <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.75)', marginTop: 4 }}>{e.description}</div>
              ) : null}
              {e.external_url ? (
                <div style={{ marginTop: 4 }}>
                  <a href={e.external_url} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>
                    Details
                  </a>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
