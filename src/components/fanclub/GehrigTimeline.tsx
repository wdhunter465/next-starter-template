'use client';

import Link from 'next/link';
import { clubHomeColors, clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';
import { formatGehrigTimelineWhen, useGehrigTimeline, type GehrigMilestone } from './useGehrigTimeline';

export const GEHRIG_TIMELINE_HREF = '/fanclub/timeline';
export const GEHRIG_TIMELINE_TEASER_COUNT = 4;

/** Entries spread evenly across the whole timeline, so the teaser spans his life rather than only the start. */
export function pickGehrigTimelineTeaser(items: GehrigMilestone[], count = GEHRIG_TIMELINE_TEASER_COUNT): GehrigMilestone[] {
  if (items.length <= count) return items;
  const last = items.length - 1;
  const picked: GehrigMilestone[] = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(items[Math.round((i * last) / (count - 1))]);
  }
  return picked;
}

/** Club Home teaser. The whole section opens the full timeline page. */
export default function GehrigTimeline() {
  const { items, error } = useGehrigTimeline();

  let body;
  if (error) {
    body = <p style={{ ...clubHomeMutedText, margin: 0 }}>{error}</p>;
  } else if (items === null) {
    body = <p style={{ ...clubHomeMutedText, margin: 0 }}>Loading timeline.</p>;
  } else if (items.length === 0) {
    body = <p style={{ ...clubHomeMutedText, margin: 0 }}>No timeline entries are available yet.</p>;
  } else {
    body = (
      <Link
        href={GEHRIG_TIMELINE_HREF}
        style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
        aria-label={`Open the full Gehrig timeline (${items.length} entries)`}
      >
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {pickGehrigTimelineTeaser(items).map((entry) => (
            <li key={entry.id} style={{ lineHeight: 1.4 }}>
              <span style={{ ...clubHomeMutedText, fontSize: 13, display: 'block' }}>{formatGehrigTimelineWhen(entry)}</span>
              <strong>{entry.title}</strong>
            </li>
          ))}
        </ul>
        <p style={{ margin: '12px 0 0', fontWeight: 700, color: clubHomeColors.accent }}>
          Open the full timeline ({items.length} entries) &rarr;
        </p>
      </Link>
    );
  }

  return (
    <section aria-label="Gehrig timeline" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Gehrig Timeline</h2>
      {body}
    </section>
  );
}
