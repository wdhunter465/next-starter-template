'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';
import styles from './page.module.css';

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

function buildLibraryApiUrl(page: number, q: string): string {
  const params = new URLSearchParams({ page: String(page) });
  const needle = q.trim();
  if (needle) params.set('q', needle);
  return `/api/fanclub/library?${params.toString()}`;
}

function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
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
    <main className={styles.main}>
      <h1 className={styles.title}>Gehrig Library</h1>
      <p className={styles.lead}>
        A read-only member view of published editorial inventory stories about Lou Gehrig and related history.
      </p>
      <p className={styles.p}>
        Stories display source and credit attribution when available. Use search to locate entries by title, summary, or body text, then jump to memorabilia or other Fan Club pages from the links below.
      </p>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Browse entries</h2>
          <hr className={styles.hr} />
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
            <label className={styles.field}>
              Search
              <input
                className={styles.input}
                type="search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Search library…"
              />
            </label>
            <div className={styles.actions}>
              <button type="submit" className={styles.button}>
                Search library
              </button>
              <Link href="/fanclub/submit" className={styles.button}>
                Submit an Article
              </Link>
              <Link href="/fanclub/memorabilia" className={styles.button}>
                View Memorabilia
              </Link>
              <Link href="/fanclub" className={styles.button}>
                Back to Fan Club Home
              </Link>
            </div>
          </form>
          {message ? <p className={styles.p}>{message}</p> : null}
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Recent entries</h2>
          <hr className={styles.hr} />
          {loading ? (
            <p className={styles.p}>Loading…</p>
          ) : items.length === 0 ? (
            <p className={styles.p}>{activeQuery.trim() ? 'No library entries match your search.' : 'No entries yet.'}</p>
          ) : (
            items.map((it) => (
              <article key={it.id} className={styles.article}>
                <h3 className={styles.articleTitle}>{it.title || 'Untitled story'}</h3>
                <div className={styles.meta}>
                  {[
                    it.author ? `Credit: ${it.author}` : null,
                    it.source_name ? `Source: ${it.source_name}` : null,
                    it.year ? String(it.year) : null,
                    it.created_at ? it.created_at.slice(0, 10) : null,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Published inventory story'}
                </div>
                <p className={styles.body}>{it.content || it.description || 'No description available yet.'}</p>
                {isSafeHttpUrl(it.source_url) ? (
                  <p className={styles.p}>
                    <a href={it.source_url} rel="noopener noreferrer" target="_blank">
                      Bibliographic source
                    </a>
                  </p>
                ) : null}
                <hr className={styles.hr} />
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
