'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type Charity = {
  id: number;
  name: string;
  kind: string;
  blurb?: string | null;
  url?: string | null;
  photo_url?: string | null;
};

export default function CharitiesTiles() {
  const [items, setItems] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<{ ok: boolean; items: Charity[] }>(`/api/friends/list?kind=charity&limit=40`);
        if (alive) setItems(data.items || []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ lineHeight: 1.25, margin: '0 0 10px 0' }}>Charities listed in D1</h2>
      <p style={{ margin: '0 0 14px 0', opacity: 0.85 }}>
        These tiles are pulled live from the D1 <code>friends</code> table (kind=charity). This is the “connectivity proof” layer.
      </p>

      {loading ? (
        <p style={{ opacity: 0.85 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ opacity: 0.85 }}>No charity tiles yet (D1 table is empty).</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {items.map((c) => (
            <div key={c.id} style={{ padding: 16, borderRadius: 14, border: '1px solid rgba(0,0,0,0.12)' }}>
              {c.photo_url ? (
                <img src={c.photo_url} alt={c.name} style={{ width: '100%', borderRadius: 12, marginBottom: 10 }} />
              ) : null}
              <strong>{c.name}</strong>
              {c.blurb ? <div style={{ marginTop: 8, opacity: 0.85 }}>{c.blurb}</div> : null}
              {c.url ? (
                <div style={{ marginTop: 10 }}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ color: 'var(--lgfc-blue)', fontWeight: 700, textDecoration: 'none' }}>Visit</a>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
