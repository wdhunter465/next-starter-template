'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type Discussion = {
  id: number;
  title: string;
  body: string;
  created_at: string;
};

type SessionResponse = {
  ok?: boolean;
  email?: string;
};

const safeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDiscussion = (raw: unknown): Discussion | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<Discussion>;
  if (typeof candidate.id !== 'number') return null;

  const title = safeText(candidate.title) ?? 'Untitled discussion';
  const body = safeText(candidate.body) ?? 'No discussion text available.';
  const createdAt = safeText(candidate.created_at) ?? '';

  return {
    id: candidate.id,
    title,
    body,
    created_at: createdAt,
  };
};

const formatCreatedAt = (raw: string): string => {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw || 'Unknown date';
  // Keep formatting deterministic across prerender + hydration.
  return new Date(parsed).toISOString().slice(0, 10);
};

export default function RecentDiscussionsTeaser() {
  const [items, setItems] = useState<Discussion[]>([]);
  // Static HTML must not ship permanent "Loading…" (#3305); guest empty-state is valid prerender.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const sessionRes = await fetch('/api/session/me', {
          credentials: 'include',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        const session = (await sessionRes.json().catch(() => null)) as SessionResponse | null;
        const hasMemberSession = Boolean(sessionRes.ok && session?.ok && session.email);

        if (!alive) return;
        setIsMember(hasMemberSession);

        if (!hasMemberSession) {
          setItems([]);
          setError(null);
          return;
        }

        const data = await apiGet<{ ok: boolean; items: Discussion[] }>(`/api/discussions/list?limit=5`);
        if (!alive) return;

        const sourceItems = Array.isArray(data?.items) ? data.items : [];
        const normalized = sourceItems
              .map((item) => normalizeDiscussion(item))
              .filter((item): item is Discussion => item !== null);

        setItems(normalized);
        setError(null);
      } catch {
        if (!alive) return;
        setItems([]);
        setError('Unable to load discussions right now.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="recent-club-discussions" className="container section-gap">
      <h2 className="section-title">Recent Club discussions</h2>
      {isMember ? (
        <p className="sub" style={{ textAlign: 'center' }}>
          Latest member discussions from the Fan Club.
        </p>
      ) : null}

      {loading ? (
        <p className="sub" style={{ textAlign: 'center' }}>Loading…</p>
      ) : !isMember ? (
        <p className="sub" style={{ textAlign: 'center' }}>
          Member discussions are private. <Link href="/join">Join or log in</Link> to read recent club posts.
        </p>
      ) : error ? (
        <p className="sub" style={{ textAlign: 'center' }}>{error}</p>
      ) : items.length === 0 ? (
        <p className="sub" style={{ textAlign: 'center' }}>No club posts are visible yet.</p>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <div key={p.id} className="card">
              <strong>{p.title}</strong>
              <p className="sub" style={{ marginTop: 10 }}>
                {p.body.length > 180 ? `${p.body.slice(0, 180)}…` : p.body}
              </p>
              <div className="sub" style={{ marginTop: 10, opacity: 0.75 }}>
                Posted: {formatCreatedAt(p.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
