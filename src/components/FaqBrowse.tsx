'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

export type FAQItem = {
  id: number;
  question: string;
  answer: string;
  view_count: number;
  pinned: number;
  updated_at: string;
};

function sortFaqItems(items: FAQItem[]): FAQItem[] {
  return [...items].sort((left, right) => {
    const pinnedDelta = Number(right.pinned) - Number(left.pinned);
    if (pinnedDelta !== 0) return pinnedDelta;

    return right.updated_at.localeCompare(left.updated_at);
  });
}

type FaqBrowseProps = {
  /** Initial search query (for example from `/faq?q=` compatibility redirect). */
  initialQuery?: string;
  /** Optional id for the Ask form section on the consolidated page. */
  askFormHref?: string;
};

export default function FaqBrowse({
  initialQuery = '',
  askFormHref = '#ask-form',
}: FaqBrowseProps) {
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState(initialQuery);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({});

  const q = useMemo(() => query.trim().toLowerCase(), [query]);

  useEffect(() => {
    let alive = true;
    let completed = false;

    const timer = setTimeout(() => {
      if (!alive || completed) return;
      setLoading(false);
      setItems([]);
      setViewCounts({});
      setLoadError('Unable to load FAQ entries right now.');
    }, 10000);

    (async () => {
      setLoading(true);
      setLoadError('');

      try {
        const data = await apiGet<{ ok: boolean; items: FAQItem[] }>('/api/faq/list?limit=50');
        if (!alive) return;

        completed = true;
        clearTimeout(timer);

        const rows = Array.isArray(data.items) ? data.items : [];
        setItems(rows);
        setLoadError('');
        setViewCounts(
          rows.reduce<Record<number, number>>((acc, item) => {
            acc[item.id] = item.view_count;
            return acc;
          }, {}),
        );
      } catch {
        if (!alive) return;
        setItems([]);
        setViewCounts({});
        setLoadError('Unable to load FAQ entries right now.');
      } finally {
        if (alive) {
          setLoading(false);
          completed = true;
        }
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const matches = q
      ? items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) ||
            item.answer.toLowerCase().includes(q),
        )
      : items;

    return sortFaqItems(matches);
  }, [items, q]);

  const handleItemClick = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }

      next.add(id);
      setViewCounts((counts) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }));
      void apiPost('/api/faq/view', { id }).catch(() => {
        // Fire-and-forget per design; UI already updated optimistically.
      });
      return next;
    });
  };

  return (
    <section aria-labelledby="faq-browse-heading">
      <h2 id="faq-browse-heading" style={{ fontSize: 24, margin: '0 0 10px 0' }}>
        Frequently Asked Questions
      </h2>
      <p className="sub" style={{ marginTop: 0 }}>
        Browse club-reviewed FAQ entries or search by keyword. Approved answers may also appear here after moderator review.
      </p>

      <div className="faq" style={{ marginTop: 10 }}>
        <div className="search">
          <input
            type="search"
            placeholder="Search questions..."
            aria-label="Search questions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" onClick={() => setQuery('')}>
            Clear
          </button>
        </div>

        {loading ? (
          <p className="sub">Loading FAQ…</p>
        ) : loadError ? (
          <p className="sub">{loadError}</p>
        ) : filteredItems.length === 0 ? (
          <p className="sub">
            {q
              ? 'No questions match your search.'
              : 'No FAQ entries are available yet.'}{' '}
            <a href={askFormHref} className="link">
              Ask a Question
            </a>
          </p>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="q"
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemClick(item.id)}
            >
              <strong>
                {item.pinned ? '📌 ' : ''}
                {item.question}
              </strong>
              {expandedIds.has(item.id) ? (
                <>
                  <br />
                  <span className="sub">{item.answer}</span>
                  <br />
                  <small className="sub">Views: {viewCounts[item.id] ?? 0}</small>
                </>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
