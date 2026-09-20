'use client';

import { useEffect, useState } from 'react';
import type { FundraiserDailyDetailItem } from '@/components/fundraiser/FundraiserDailyDetailsFeed';
import { formatPublishedDate } from '@/lib/formatPublishedDate';

export default function FundraiserDailyDetailsTeaser() {
  const [item, setItem] = useState<FundraiserDailyDetailItem | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch('/api/fundraiser-details/list?limit=1', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !data?.ok) return;

        const rows: FundraiserDailyDetailItem[] = Array.isArray(data.items) ? data.items : [];
        setItem(rows[0] || null);
      } catch {
        // Fail closed by rendering nothing -- same pattern as CampaignSpotlightSlot.
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!item) return null;

  return (
    <section id="fundraiser-daily-details" className="container section-gap" data-testid="fundraiser-daily-details-teaser">
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(0,0,0,0.55)' }}>
          Fundraiser Details
        </div>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)', marginTop: 4 }}>
          {formatPublishedDate(item.published_at)}
        </div>
        <h3 style={{ margin: '6px 0 8px 0' }}>{item.title}</h3>
        {item.body_md ? (
          <p style={{ margin: '0 0 12px 0', color: 'rgba(0,0,0,0.8)', whiteSpace: 'pre-wrap' }}>{item.body_md}</p>
        ) : null}
        <a href="/fundraiser-details" style={{ fontSize: 14, fontWeight: 600 }}>
          See all fundraiser updates →
        </a>
      </div>
    </section>
  );
}
