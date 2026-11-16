'use client';

import React, { useState } from 'react';

export type AwardItem = {
  id: number;
  kind: 'purpose' | 'criteria' | 'honoree_entry' | 'draft';
  title: string;
  body_md: string;
  status: 'draft' | 'reviewed';
  honoree_consent: 'unknown' | 'requested' | 'given' | 'declined';
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const KIND_LABELS: Record<AwardItem['kind'], string> = {
  purpose: 'Purpose',
  criteria: 'Criteria',
  honoree_entry: 'Honoree entry',
  draft: 'Draft',
};

const fieldStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.16)', width: '100%' };

type Props = {
  item: AwardItem | null;
  busy: boolean;
  onSave: (value: Omit<AwardItem, 'id' | 'created_by' | 'created_at' | 'updated_at'> & { id: number | null }) => void;
  onCancel: () => void;
};

export default function AdamWilsonStagingForm({ item, busy, onSave, onCancel }: Props) {
  const [kind, setKind] = useState<AwardItem['kind']>(item?.kind ?? 'draft');
  const [title, setTitle] = useState(item?.title ?? '');
  const [bodyMd, setBodyMd] = useState(item?.body_md ?? '');
  const [status, setStatus] = useState<AwardItem['status']>(item?.status ?? 'draft');
  const [consent, setConsent] = useState<AwardItem['honoree_consent']>(item?.honoree_consent ?? 'unknown');
  const [notes, setNotes] = useState(item?.notes ?? '');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ id: item?.id ?? null, kind, title, body_md: bodyMd, status, honoree_consent: consent, notes });
      }}
      style={{ display: 'grid', gap: 12 }}
    >
      <label>
        Kind
        <select style={fieldStyle} value={kind} onChange={(e) => setKind(e.target.value as AwardItem['kind'])}>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input style={fieldStyle} value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Body (Markdown)
        <textarea style={{ ...fieldStyle, minHeight: 180 }} value={bodyMd} maxLength={20000} onChange={(e) => setBodyMd(e.target.value)} />
      </label>
      <label>
        Review status
        <select style={fieldStyle} value={status} onChange={(e) => setStatus(e.target.value as AwardItem['status'])}>
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed (still staging only)</option>
        </select>
      </label>
      <label>
        Honoree consent (notes for the team; never shown publicly)
        <select style={fieldStyle} value={consent} onChange={(e) => setConsent(e.target.value as AwardItem['honoree_consent'])}>
          <option value="unknown">Unknown</option>
          <option value="requested">Requested</option>
          <option value="given">Given</option>
          <option value="declined">Declined</option>
        </select>
      </label>
      <label>
        Internal notes
        <textarea style={{ ...fieldStyle, minHeight: 80 }} value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={busy || !title.trim()}>{item ? 'Save changes' : 'Create draft'}</button>
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
