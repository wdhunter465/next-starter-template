'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';

type Milestone = {
  id: number;
  year: number | null;
  title: string;
  description?: string | null;
  milestone_date?: string | null;
};

export default function GehrigTimeline() {
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await apiGet<{ ok: boolean; items: Milestone[] }>('/api/milestones/list?limit=12');
        if (!alive) return;

        const normalized = Array.isArray(data?.items)
          ? data.items.filter((m): m is Milestone => typeof m?.id === 'number' && typeof m?.title === 'string')
          : [];

        setItems(normalized);
        setError(null);
      } catch {
        if (!alive) return;
        setItems([]);
        setError('Unable to load Gehrig timeline entries right now.');
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-label="Gehrig timeline" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Gehrig Timeline</h2>

      {error ? (
        <p style={{ ...clubHomeMutedText, margin: 0 }}>{error}</p>
      ) : items === null ? (
        <p style={{ ...clubHomeMutedText, margin: 0 }}>Loading timeline.</p>
      ) : items.length === 0 ? (
        <p style={{ ...clubHomeMutedText, margin: 0 }}>No timeline entries are available yet.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
          {items.map((entry) => (
            <li key={entry.id} style={{ lineHeight: 1.5 }}>
              <strong>
                {entry.year ?? entry.milestone_date ?? '—'}: {entry.title}
              </strong>
              {entry.description ? (
                <p style={{ ...clubHomeMutedText, margin: '6px 0 0' }}>{entry.description}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
