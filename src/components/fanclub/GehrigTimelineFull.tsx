'use client';

import {
  GEHRIG_TIMELINE_EVENT_TYPE_LABELS,
  formatGehrigTimelineWhen,
  useGehrigTimeline,
} from './useGehrigTimeline';
import { clubHomeMutedText } from './clubHomeStyles';

/** Every timeline entry with its type, narrative and source link (the `/fanclub/timeline` page body). */
export default function GehrigTimelineFull() {
  const { items, error } = useGehrigTimeline();

  if (error) return <p style={{ ...clubHomeMutedText, margin: 0 }}>{error}</p>;
  if (items === null) return <p style={{ ...clubHomeMutedText, margin: 0 }}>Loading timeline.</p>;
  if (items.length === 0) return <p style={{ ...clubHomeMutedText, margin: 0 }}>No timeline entries are available yet.</p>;

  return (
    <ol aria-label="Full Gehrig timeline" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 18 }}>
      {items.map((entry) => {
        const typeLabel = entry.event_type ? GEHRIG_TIMELINE_EVENT_TYPE_LABELS[entry.event_type] ?? null : null;
        const narrative = entry.detail_body ?? entry.description;
        return (
          <li key={entry.id} style={{ lineHeight: 1.5 }}>
            <strong>
              {formatGehrigTimelineWhen(entry)}: {entry.title}
              {typeLabel ? <span style={{ ...clubHomeMutedText, fontWeight: 400 }}> · {typeLabel}</span> : null}
            </strong>
            {narrative ? <p style={{ ...clubHomeMutedText, margin: '6px 0 0' }}>{narrative}</p> : null}
            {entry.source_url ? (
              <a href={entry.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85em' }}>
                Source
              </a>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
