'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';

type Milestone = {
  id: number;
  year: number | null;
  title: string;
  description?: string | null;
  detail_body?: string | null;
  event_date?: string | null;
  event_type?: string | null;
  source_url?: string | null;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  birth: 'Birth',
  death: 'Death',
  marriage: 'Marriage',
  graduation: 'School',
  public_appearance: 'Public appearance',
  career: 'Career',
};

function formatWhen(entry: Milestone): string {
  if (entry.event_date) {
    const parsed = new Date(`${entry.event_date}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    }
  }
  return entry.year != null ? String(entry.year) : '—';
}

export default function GehrigTimeline() {
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await apiGet<{ ok: boolean; items: Milestone[] }>('/api/fanclub/timeline?limit=100');
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
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 14 }}>
          {items.map((entry) => {
            const typeLabel = entry.event_type ? EVENT_TYPE_LABELS[entry.event_type] ?? null : null;
            const narrative = entry.detail_body ?? entry.description;
            return (
              <li key={entry.id} style={{ lineHeight: 1.5 }}>
                <strong>
                  {formatWhen(entry)}: {entry.title}
                  {typeLabel ? <span style={{ ...clubHomeMutedText, fontWeight: 400 }}> · {typeLabel}</span> : null}
                </strong>
                {narrative ? (
                  <p style={{ ...clubHomeMutedText, margin: '6px 0 0' }}>{narrative}</p>
                ) : null}
                {entry.source_url ? (
                  <a href={entry.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85em' }}>
                    Source
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
