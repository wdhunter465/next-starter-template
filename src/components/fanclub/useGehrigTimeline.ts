'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type GehrigMilestone = {
  id: number;
  year: number | null;
  title: string;
  description?: string | null;
  detail_body?: string | null;
  event_date?: string | null;
  event_type?: string | null;
  source_url?: string | null;
};

export const GEHRIG_TIMELINE_EVENT_TYPE_LABELS: Record<string, string> = {
  birth: 'Birth',
  death: 'Death',
  marriage: 'Marriage',
  graduation: 'School',
  public_appearance: 'Public appearance',
  career: 'Career',
};

export function formatGehrigTimelineWhen(entry: GehrigMilestone): string {
  if (entry.event_date) {
    const parsed = new Date(`${entry.event_date}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    }
  }
  return entry.year != null ? String(entry.year) : '—';
}

/** Loads the members-only timeline (every posted entry). `items` is null while loading. */
export function useGehrigTimeline(): { items: GehrigMilestone[] | null; error: string | null } {
  const [items, setItems] = useState<GehrigMilestone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await apiGet<{ ok: boolean; items: GehrigMilestone[] }>('/api/fanclub/timeline?limit=100');
        if (!alive) return;

        const normalized = Array.isArray(data?.items)
          ? data.items.filter((m): m is GehrigMilestone => typeof m?.id === 'number' && typeof m?.title === 'string')
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

  return { items, error };
}
