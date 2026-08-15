'use client';

import { useCallback, useState } from 'react';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, getStoredAdminToken } from '@/lib/adminClient';

type FutureRotationItem = {
  id: number;
  title?: string | null;
  summary?: string | null;
  source_name?: string | null;
  credit_line?: string | null;
  last_featured?: string | null;
  event_date?: string | null;
  score?: number | null;
};

type RotationPreviewResponse = {
  ok: true;
  section: string;
  as_of: string;
  total: number;
  items: FutureRotationItem[];
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClubStagingFutureRotationPreview() {
  const [asOf, setAsOf] = useState(todayUtcDate);
  const [items, setItems] = useState<FutureRotationItem[]>([]);
  const [asOfReturned, setAsOfReturned] = useState('');
  const [status, setStatus] = useState(
    'Choose a UTC date and preview the ranked published club_home set. This does not publish or write last_featured.',
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!getStoredAdminToken()) {
      setItems([]);
      setAsOfReturned('');
      setStatus('Error: Save an admin API token before previewing a future rotation set.');
      return;
    }

    setLoading(true);
    setStatus('Loading future rotation set…');
    const result = await adminJson<RotationPreviewResponse>(
      `/api/admin/editorial/rotation-preview?section=club_home&as_of=${encodeURIComponent(asOf)}&limit=8`,
    );

    if (!result.ok) {
      setItems([]);
      setAsOfReturned('');
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const nextItems = Array.isArray(result.data?.items) ? result.data.items : [];
    setItems(nextItems);
    setAsOfReturned(result.data?.as_of || asOf);
    setStatus(
      nextItems.length
        ? `Ranked ${nextItems.length} published club_home row(s) as of ${result.data?.as_of || asOf}. Preview only.`
        : 'No published club_home rows rank for that date. Preview only; public routes are unchanged.',
    );
    setLoading(false);
  }, [asOf]);

  return (
    <section aria-label="Future rotation set preview" style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: 22, color: 'var(--lgfc-blue, #003366)' }}>
        Future rotation set
      </h2>
      <p style={{ margin: '0 0 16px 0', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>
        Rank published <code>club_home</code> inventory as of a chosen UTC date using the existing rotation
        scorer. This is operator preview only: it does not fire a rotation clock, write <code>last_featured</code>,
        or create a public route.
      </p>

      <label style={{ display: 'block', maxWidth: 280 }}>
        As of (UTC date)
        <input
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px' }}
        />
      </label>

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={() => void load()} disabled={loading}>
          Preview future rotation set
        </button>
      </div>

      <AdminStatusText message={status} />

      {items.length > 0 ? (
        <ol aria-label="Ranked future rotation set" style={{ marginTop: 12, paddingLeft: 22 }}>
          {items.map((item, index) => (
            <li key={item.id} style={{ marginBottom: 8 }}>
              <strong>
                {index + 1}. {item.title || `Inventory ${item.id}`}
              </strong>
              {typeof item.score === 'number' ? ` (score ${item.score})` : ''}
              {asOfReturned ? (
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
                  as of {asOfReturned}
                  {item.event_date ? ` · event ${item.event_date}` : ''}
                  {item.last_featured ? ` · last featured ${item.last_featured}` : ''}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
