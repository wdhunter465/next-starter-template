'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import styles from './page.module.css';

type SearchResult = {
  type: string;
  title: string;
  excerpt: string;
  url: string;
};

type SearchResponse = {
  ok: boolean;
  query: string;
  page: number;
  pages: number;
  total: number;
  isMember?: boolean;
  results: SearchResult[];
};

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';

  const [input, setInput] = useState(queryFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  useEffect(() => {
    setInput(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    let alive = true;
    const q = queryFromUrl.trim();

    if (q.length < 2) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const page = Number(searchParams.get('page') || '1') || 1;
        const response = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&page=${page}`);
        if (!alive) return;
        setData(response);
      } catch {
        if (!alive) return;
        setData(null);
        setError('Search is temporarily unavailable. Please try again.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [queryFromUrl, searchParams]);

  const canSubmit = input.trim().length >= 2;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = input.trim();
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const statusLine = useMemo(() => {
    const q = queryFromUrl.trim();
    if (!q) return 'Search approved FAQs, events, milestones, friends, and member-visible content where available.';
    if (loading) return `Searching for "${q}"…`;
    if (error) return error;
    if (!data) return '';
    if (data.total === 0) return `No results for "${q}".`;
    return `${data.total} result${data.total === 1 ? '' : 's'} for "${q}"`;
  }, [queryFromUrl, loading, error, data]);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Search</h1>

      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Search the Lou Gehrig Fan Club</span>
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search the Lou Gehrig Fan Club…"
            type="search"
            aria-label="Search the Lou Gehrig Fan Club"
          />
        </label>
        <button type="submit" className={styles.button} disabled={!canSubmit || loading}>
          Search
        </button>
      </form>

      <p className={styles.status}>{statusLine}</p>

      {data?.isMember ? (
        <p className={styles.memberNote}>Member session detected: results include Fan Club content.</p>
      ) : null}

      <div className={styles.results}>
        {(data?.results || []).map((result, index) => (
          <article key={`${result.type}-${result.url}-${index}`} className={styles.article}>
            <div className={styles.typeChip}>{result.type}</div>
            <h2 className={styles.resultTitle}>
              <Link href={result.url} className={styles.resultLink}>
                {result.title}
              </Link>
            </h2>
            {result.excerpt ? <p className={styles.excerpt}>{result.excerpt}</p> : null}
          </article>
        ))}
      </div>

      {data && data.pages > 1 ? (
        <div className={styles.pagination}>
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((pageNumber) => {
            const active = pageNumber === data.page;
            return (
              <Link
                key={pageNumber}
                href={`/search?q=${encodeURIComponent(queryFromUrl)}&page=${pageNumber}`}
                className={`${styles.pageLink}${active ? ` ${styles.pageLinkActive}` : ''}`}
              >
                {pageNumber}
              </Link>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.fallback}>
          <h1 className={styles.fallbackTitle}>Search</h1>
          <p className="sub">Search Fan Club public content. Enter at least two characters to begin.</p>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
