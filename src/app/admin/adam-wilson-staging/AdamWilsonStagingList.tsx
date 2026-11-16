'use client';

import React from 'react';
import { KIND_LABELS, type AwardItem } from './AdamWilsonStagingForm';

type Props = {
  items: AwardItem[];
  onEdit: (item: AwardItem) => void;
  onDelete: (item: AwardItem) => void;
};

export default function AdamWilsonStagingList({ items, onEdit, onDelete }: Props) {
  if (items.length === 0) return <p>No staging items yet.</p>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
      {items.map((item) => (
        <li key={item.id} style={{ border: '1px solid rgba(0,0,0,0.16)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700 }}>{item.title}</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {KIND_LABELS[item.kind]} · {item.status} · consent: {item.honoree_consent} · updated {item.updated_at.slice(0, 10)}
          </div>
          {item.body_md ? <p style={{ whiteSpace: 'pre-wrap' }}>{item.body_md}</p> : null}
          {item.notes ? <p style={{ fontSize: 13 }}>Notes: {item.notes}</p> : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => onEdit(item)}>Edit</button>
            <button type="button" onClick={() => onDelete(item)}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
