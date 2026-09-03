'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';

type ClubHomeEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  description?: string | null;
};

function formatEventDate(startDate: string, endDate?: string | null): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return startDate;
  const formatted = start.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
  if (!endDate || endDate === startDate) return formatted;
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return formatted;
  const endFormatted = end.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
  return `${formatted} – ${endFormatted}`;
}

export default function ClubHomeEventsModule() {
  const [events, setEvents] = useState<ClubHomeEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/events/next?limit=3', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setEvents(res.ok && data?.ok && Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasEvents = Boolean(events && events.length > 0);

  return (
    <section aria-label="Events & Calendar" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Events & Calendar</h2>
      {hasEvents ? (
        <ul style={{ margin: '0 0 12px 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {events!.map((event) => (
            <li key={event.id}>
              <div style={{ fontWeight: 700 }}>{event.title}</div>
              <div style={clubHomeMutedText}>
                {formatEventDate(event.start_date, event.end_date)}
                {event.location ? ` · ${event.location}` : ''}
              </div>
            </li>
          ))}
        </ul>
      ) : events !== null ? (
        <p style={{ ...clubHomeMutedText, marginBottom: 12 }}>
          Upcoming Lou Gehrig Fan Club events will appear here once posted.
        </p>
      ) : null}
      <Link href="/events" style={{ fontWeight: 600 }}>
        View full calendar
      </Link>
    </section>
  );
}
