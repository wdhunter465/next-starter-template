'use client';

// #2073 Work Package item 5 (#4062): admin surface for physical
// archive-acquisition intake and custody tracking (#4059/#4060/#4061).
// Follows the queue-UI pattern #3827 established at /admin/rights-review:
// a read-only list endpoint plus append-only action endpoints, no raw CRUD.

import React, { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';

const ITEM_TYPE_OPTIONS = [
  { value: 'photograph', label: 'Photograph' },
  { value: 'letter', label: 'Letter' },
  { value: 'document', label: 'Document' },
  { value: 'memorabilia', label: 'Memorabilia' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'other', label: 'Other' },
] as const;

const CUSTODY_TYPE_OPTIONS = [
  { value: 'donation', label: 'Donation (permanent)' },
  { value: 'loan', label: 'Loan (temporary)' },
] as const;

// Mirrors the server-side state machine in archive-items-repository.ts.
const NEXT_STATES: Record<string, string[]> = {
  offered: ['received', 'deaccessioned'],
  received: ['cataloged', 'returned', 'deaccessioned'],
  cataloged: ['stored', 'returned', 'deaccessioned'],
  stored: ['returned', 'deaccessioned'],
  returned: [],
  deaccessioned: [],
};

type ArchiveItem = {
  id: number;
  content_item_id: number;
  candidate_id: string;
  item_type: string;
  custody_type: string;
  custody_state: string;
  loan_expected_return_at: string | null;
  loan_returned_at: string | null;
  storage_location: string | null;
  condition_notes: string | null;
  donor_name: string | null;
  donor_contact: string | null;
  donor_consent_public_credit: number;
  credit_line: string | null;
  intake_notes: string | null;
  created_at: string;
  updated_at: string;
};

type ListResponse = { ok: true; count: number; items: unknown[] };

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeItem(raw: unknown): ArchiveItem | null {
  if (!isRecord(raw)) return null;
  const id = asNumber(raw.id);
  const contentItemId = asNumber(raw.content_item_id);
  const candidateId = asString(raw.candidate_id);
  const itemType = asString(raw.item_type);
  const custodyType = asString(raw.custody_type);
  const custodyState = asString(raw.custody_state);
  const createdAt = asString(raw.created_at);
  const updatedAt = asString(raw.updated_at);
  if (
    id === null ||
    contentItemId === null ||
    !candidateId ||
    !itemType ||
    !custodyType ||
    !custodyState ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    content_item_id: contentItemId,
    candidate_id: candidateId,
    item_type: itemType,
    custody_type: custodyType,
    custody_state: custodyState,
    loan_expected_return_at: asString(raw.loan_expected_return_at),
    loan_returned_at: asString(raw.loan_returned_at),
    storage_location: asString(raw.storage_location),
    condition_notes: asString(raw.condition_notes),
    donor_name: asString(raw.donor_name),
    donor_contact: asString(raw.donor_contact),
    donor_consent_public_credit: asNumber(raw.donor_consent_public_credit) ?? 0,
    credit_line: asString(raw.credit_line),
    intake_notes: asString(raw.intake_notes),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function fieldStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.16)',
    width: '100%',
  };
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.18)',
    background: disabled ? 'rgba(0,0,0,0.05)' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 14,
    padding: 16,
    display: 'grid',
    gap: 10,
  };
}

function IntakeForm(props: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [itemType, setItemType] = useState<string>('photograph');
  const [custodyType, setCustodyType] = useState<string>('donation');
  const [loanExpectedReturnAt, setLoanExpectedReturnAt] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorContact, setDonorContact] = useState('');
  const [donorConsent, setDonorConsent] = useState(false);
  const [creditLine, setCreditLine] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [actor, setActor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    if (!title.trim() || !summary.trim() || !actor.trim()) {
      setError('Title, summary, and your name are required.');
      return;
    }
    if (custodyType === 'loan' && !loanExpectedReturnAt.trim()) {
      setError('Expected return date is required for a loan.');
      return;
    }

    setSubmitting(true);
    setError('');

    const result = await adminJson<{ ok: true }>('/api/admin/archive-items', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        summary: summary.trim(),
        item_type: itemType,
        custody_type: custodyType,
        loan_expected_return_at: custodyType === 'loan' ? loanExpectedReturnAt.trim() : undefined,
        donor_name: donorName.trim() || undefined,
        donor_contact: donorContact.trim() || undefined,
        donor_consent_public_credit: donorConsent,
        credit_line: creditLine.trim() || undefined,
        storage_location: storageLocation.trim() || undefined,
        actor: actor.trim(),
      }),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTitle('');
    setSummary('');
    setLoanExpectedReturnAt('');
    setDonorName('');
    setDonorContact('');
    setDonorConsent(false);
    setCreditLine('');
    setStorageLocation('');
    props.onCreated();
  }, [actor, creditLine, custodyType, donorConsent, donorContact, donorName, itemType, loanExpectedReturnAt, storageLocation, summary, title, props]);

  return (
    <div style={{ ...cardStyle(), background: 'rgba(0,0,0,0.02)' }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>New intake</div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Item type</span>
          <select value={itemType} onChange={(e) => setItemType(e.target.value)} style={fieldStyle()}>
            {ITEM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Summary</span>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} style={fieldStyle()} />
      </label>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Custody type</span>
          <select value={custodyType} onChange={(e) => setCustodyType(e.target.value)} style={fieldStyle()}>
            {CUSTODY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        {custodyType === 'loan' ? (
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.85 }}>Expected return date</span>
            <input
              type="date"
              value={loanExpectedReturnAt}
              onChange={(e) => setLoanExpectedReturnAt(e.target.value)}
              style={fieldStyle()}
            />
          </label>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Donor name (admin-only)</span>
          <input value={donorName} onChange={(e) => setDonorName(e.target.value)} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Donor contact (admin-only, never public)</span>
          <input value={donorContact} onChange={(e) => setDonorContact(e.target.value)} style={fieldStyle()} />
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={donorConsent} onChange={(e) => setDonorConsent(e.target.checked)} />
        <span style={{ fontSize: 13 }}>Donor consented to a public credit line</span>
      </label>

      {donorConsent ? (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Public credit line</span>
          <input value={creditLine} onChange={(e) => setCreditLine(e.target.value)} style={fieldStyle()} placeholder="e.g. Gift of Jane Donor" />
        </label>
      ) : null}

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Storage location</span>
        <input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} style={fieldStyle()} />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Your name</span>
        <input value={actor} onChange={(e) => setActor(e.target.value)} style={fieldStyle()} placeholder="Recorded on the intake audit trail" />
      </label>

      {error ? <AdminStatusText message={`Error: ${error}`} /> : null}

      <div>
        <button type="button" disabled={submitting} style={buttonStyle(submitting)} onClick={() => void submit()}>
          {submitting ? 'Creating…' : 'Create intake record'}
        </button>
      </div>
    </div>
  );
}

function CustodyControls(props: { item: ArchiveItem; onChanged: () => void }) {
  const { item, onChanged } = props;
  const [toState, setToState] = useState('');
  const [note, setNote] = useState('');
  const [actor, setActor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const nextStates = NEXT_STATES[item.custody_state] ?? [];

  const advance = useCallback(async () => {
    if (!toState) {
      setError('Choose a next state.');
      return;
    }
    if (!actor.trim()) {
      setError('Your name is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    const result = await adminJson<{ ok: true }>('/api/admin/archive-items/custody', {
      method: 'POST',
      body: JSON.stringify({
        archive_item_id: item.id,
        to_state: toState,
        actor: actor.trim(),
        note: note.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setToState('');
    setNote('');
    onChanged();
  }, [actor, item.id, note, onChanged, toState]);

  if (nextStates.length === 0) {
    return <div style={{ fontSize: 13, opacity: 0.75 }}>No further custody transitions from this state.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr' }}>
        <select value={toState} onChange={(e) => setToState(e.target.value)} style={fieldStyle()}>
          <option value="">Advance to…</option>
          {nextStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input value={actor} onChange={(e) => setActor(e.target.value)} style={fieldStyle()} placeholder="Your name" />
        <input value={note} onChange={(e) => setNote(e.target.value)} style={fieldStyle()} placeholder="Note (optional)" />
      </div>
      {error ? <AdminStatusText message={`Error: ${error}`} /> : null}
      <div>
        <button type="button" disabled={submitting} style={buttonStyle(submitting)} onClick={() => void advance()}>
          {submitting ? 'Saving…' : 'Update custody state'}
        </button>
      </div>
    </div>
  );
}

function ItemCard(props: { item: ArchiveItem; onChanged: () => void }) {
  const { item, onChanged } = props;
  return (
    <div style={cardStyle()}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{item.candidate_id}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
          {item.item_type} · {item.custody_type} · <strong>{item.custody_state}</strong>
        </div>
      </div>

      <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        {item.storage_location ? <div>Storage: {item.storage_location}</div> : null}
        {item.custody_type === 'loan' && item.loan_expected_return_at ? (
          <div>Expected return: {item.loan_expected_return_at}</div>
        ) : null}
        {item.loan_returned_at ? <div>Returned: {new Date(item.loan_returned_at).toLocaleString()}</div> : null}
        {item.donor_name ? <div>Donor: {item.donor_name} (admin-only)</div> : null}
        {item.credit_line ? (
          <div>
            Public credit line: {item.credit_line} {item.donor_consent_public_credit ? '' : '(consent not yet recorded)'}
          </div>
        ) : null}
      </div>

      <CustodyControls item={item} onChanged={onChanged} />
    </div>
  );
}

export default function AdminArchiveItemsPage() {
  const [status, setStatus] = useState('Idle.');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ArchiveItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus('Loading…');

    const result = await adminJson<ListResponse>('/api/admin/archive-items?limit=100');

    if (!result.ok) {
      setItems([]);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const raw = Array.isArray(result.data?.items) ? result.data.items : [];
    const normalized = raw.map(normalizeItem).filter((x): x is ArchiveItem => x !== null);
    setItems(normalized);
    setStatus(normalized.length ? `${normalized.length} archive item(s).` : 'No archive items yet.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="Archive Items" subtitle="Physical archive-acquisition intake and custody tracking (#2073).">
      <AdminNav />
      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <IntakeForm onCreated={() => void load()} />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={buttonStyle(loading)}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <AdminStatusText message={status} />
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onChanged={() => void load()} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
