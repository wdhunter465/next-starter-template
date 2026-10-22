'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type Discussion = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

type DiscussionFeedProps = {
  refreshTrigger: number;
};

const formatCreatedAt = (raw: string): string => {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw || 'Unknown date';
  return new Date(parsed).toISOString().slice(0, 10);
};

export default function DiscussionFeed({ refreshTrigger }: DiscussionFeedProps) {
  const [items, setItems] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ ok: boolean; items: Discussion[] }>('/api/discussions/list?limit=10');
        if (!alive) return;

        const normalized = Array.isArray(data?.items)
          ? data.items.filter(
              (item): item is Discussion =>
                typeof item?.id === 'number' && typeof item?.title === 'string' && typeof item?.body === 'string',
            )
          : [];

        setItems(normalized);
        setError(null);
      } catch {
        if (!alive) return;
        setItems([]);
        setError('Unable to load club discussions right now.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [refreshTrigger]);

  return (
    <section
      aria-label="Member discussion feed"
      style={{
        padding: 16,
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 12px 0' }}>Member Discussions</h2>

      {loading ? (
        <p style={{ margin: 0, color: 'rgba(0,0,0,0.72)' }}>Loading discussions…</p>
      ) : error ? (
        <p style={{ margin: 0, color: '#b00020' }}>{error}</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, color: 'rgba(0,0,0,0.72)' }}>No discussions yet. Be the first to post above.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((post) => (
            <article
              key={post.id}
              style={{
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10,
                padding: 12,
              }}
            >
              <strong>{post.title}</strong>
              <p style={{ margin: '8px 0', color: 'rgba(0,0,0,0.8)', lineHeight: 1.5 }}>
                {post.body.length > 280 ? `${post.body.slice(0, 280)}…` : post.body}
              </p>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)' }}>Posted: {formatCreatedAt(post.created_at)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
