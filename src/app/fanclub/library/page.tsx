'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';

type LibraryItem = {
  id: number;
  title: string | null;
  content?: string | null;
  description?: string | null;
  author?: string | null;
  year?: number | null;
  created_at?: string | null;
  source_name?: string | null;
  source_url?: string | null;
};

const styles: Record<string, React.CSSProperties> = {
  main: { padding: '40px 16px', maxWidth: 1000, margin: '0 auto' },
  h1: { fontSize: 34, lineHeight: 1.15, margin: '0 0 12px 0' },
  lead: { fontSize: 18, lineHeight: 1.6, margin: '0 0 18px 0' },
  p: { fontSize: 16, lineHeight: 1.7, margin: '0 0 14px 0' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: 18 },
  card: { border: '1px solid rgba(0,0,0,0.15)', borderRadius: 16, padding: 16 },
  label: { display: 'grid', gap: 6, fontSize: 14 },
  input: { padding: '10px 12px', fontSize: 16, borderRadius: 10, border: '1px solid rgba(0,0,0,0.2)' },
  btn: { padding: '10px 14px', fontSize: 15, borderRadius: 12, border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer', textDecoration: 'none' },
  meta: { opacity: 0.75, fontSize: 13, marginTop: 6 },
  hr: { margin: '18px 0', opacity: 0.25 },
};

function buildLibraryApiUrl(page: number, q: string): string {
  const params = new URLSearchParams({ page: String(page) });
  const needle = q.trim();
  if (needle) params.set('q', needle);
  return `/api/fanclub/library?${params.toString()}`;
}

export default function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeQuery = searchParams.get('q') || '';
  const { isLoading, isAuthenticated } = useMemberSession({ redirectTo: '/' });
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [draftQuery, setDraftQuery] = useState(activeQuery);

  useEffect(() => {
    setDraftQuery(activeQuery);
  }, [activeQuery]);

  async function load(q: string) {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(buildLibraryApiUrl(1, q), { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setItems(Array.isArray(data.items) ? data.items : []);
      } else {
        setItems([]);
        setMessage(data?.error || 'Unable to load library items right now.');
      }
    } catch {
      setItems([]);
      setMessage('Unable to load library items right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      load(activeQuery);
    }
  }, [isLoading, isAuthenticated, activeQuery]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Gehrig Library</h1>
      <p style={styles.lead}>
        A read-only member view of published editorial inventory stories about Lou Gehrig and related history.
      </p>
      <p style={styles.p}>
        Stories display source and credit attribution when available. Use search to locate entries by title, summary, or body text, then jump to memorabilia or other Fan Club pages from the links below.
      </p>

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={{ margin: 0 }}>Browse entries</h2>
          <hr style={styles.hr} />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = draftQuery.trim();
              const params = new URLSearchParams();
              if (next) params.set('q', next);
              const suffix = params.toString();
              router.replace(suffix ? `/fanclub/library?${suffix}` : '/fanclub/library');
            }}
          >
            <label style={styles.label}>
              Search
              <input
                style={styles.input}
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Search library…"
              />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="submit" style={styles.btn}>
                Search library
              </button>
              <Link href="/fanclub/submit" style={styles.btn}>
                Submit an Article
              </Link>
              <Link href="/fanclub/memorabilia" style={styles.btn}>
                View Memorabilia
              </Link>
              <Link href="/fanclub" style={styles.btn}>
                Back to Fan Club Home
              </Link>
            </div>
          </form>
          {message ? <p style={{ ...styles.p, marginTop: 12 }}>{message}</p> : null}
        </section>

        <section style={styles.card}>
          <h2 style={{ margin: 0 }}>Recent entries</h2>
          <hr style={styles.hr} />
          {loading ? (
            <p style={styles.p}>Loading…</p>
          ) : items.length === 0 ? (
            <p style={styles.p}>{activeQuery.trim() ? 'No library entries match your search.' : 'No entries yet.'}</p>
          ) : (
            items.map((it) => (
              <article key={it.id} style={{ marginBottom: 14 }}>
                <h3 style={{ margin: '0 0 6px 0' }}>{it.title || 'Untitled story'}</h3>
                <div style={styles.meta}>
                  {[
                    it.author ? `Credit: ${it.author}` : null,
                    it.source_name ? `Source: ${it.source_name}` : null,
                    it.year ? String(it.year) : null,
                    it.created_at ? it.created_at.slice(0, 10) : null,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Published inventory story'}
                </div>
                <p style={{ ...styles.p, marginTop: 8, whiteSpace: 'pre-wrap' }}>{it.content || it.description || 'No description available yet.'}</p>
                {it.source_url ? (
                  <p style={{ ...styles.p, marginTop: 0 }}>
                    <a href={it.source_url} rel="noopener noreferrer" target="_blank">
                      Bibliographic source
                    </a>
                  </p>
                ) : null}
                <hr style={styles.hr} />
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
