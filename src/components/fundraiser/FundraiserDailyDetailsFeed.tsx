'use client';

import { useEffect, useState } from 'react';
import { formatPublishedDate } from '@/lib/formatPublishedDate';

export type FundraiserDailyDetailItem = {
  key: string;
  title: string;
  body_md: string | null;
  image_url: string | null;
  image_alt: string | null;
  published_at: string;
};

type FundraiserDailyDetailsFeedProps = {
  limit?: number;
  heading?: string;
  emptyMessage?: string;
};

export default function FundraiserDailyDetailsFeed({
  limit = 30,
  heading = 'Fundraiser Details',
  emptyMessage = 'No fundraiser updates posted yet — check back soon.',
}: FundraiserDailyDetailsFeedProps) {
  const [items, setItems] = useState<FundraiserDailyDetailItem[]>([]);
  const [status, setStatus] = useState<string>('Loading fundraiser updates…');

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`/api/fundraiser-details/list?limit=${limit}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!alive) return;

        if (!res.ok || !data?.ok) {
          setStatus('Error loading fundraiser updates.');
          setItems([]);
          return;
        }

        const rows: FundraiserDailyDetailItem[] = Array.isArray(data.items) ? data.items : [];
        setItems(rows);
        setStatus(rows.length ? '' : emptyMessage);
      } catch {
        if (!alive) return;
        setStatus('Error loading fundraiser updates.');
        setItems([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [limit, emptyMessage]);

  return (
    <section style={{ marginTop: 22 }}>
      {heading ? <h2 style={{ fontSize: 22, lineHeight: 1.25, margin: '0 0 10px 0' }}>{heading}</h2> : null}
      {status ? (
        <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.6)', margin: 0 }}>{status}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li
              key={item.key}
              style={{
                margin: '0 0 16px 0',
                paddingBottom: 16,
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>{formatPublishedDate(item.published_at)}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginTop: 2 }}>{item.title}</div>
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.image_alt || ''}
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, marginTop: 8, display: 'block' }}
                />
              ) : null}
              {item.body_md ? (
                <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.8)', marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  {item.body_md}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
