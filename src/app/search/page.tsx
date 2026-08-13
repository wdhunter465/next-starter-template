'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';

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
    <main style={{ padding: '40px 16px', maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 34, margin: '0 0 12px 0' }}>Search</h1>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, maxWidth: 720 }}>
        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>Search the Lou Gehrig Fan Club</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search the Lou Gehrig Fan Club…"
            type="search"
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #dde3f5',
              fontSize: 16,
              minHeight: 48,
              width: '100%',
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{
            width: 'fit-content',
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--lgfc-blue)',
            color: '#fff',
            fontWeight: 700,
            cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          Search
        </button>
      </form>

      <p style={{ marginTop: 18, color: '#666', minHeight: 24 }}>{statusLine}</p>

      {data?.isMember ? (
        <p style={{ marginTop: 0, color: 'rgba(0,0,0,0.65)', fontSize: 14 }}>
          Member session detected: results include Fan Club content.
        </p>
      ) : null}

      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        {(data?.results || []).map((result, index) => (
          <article
            key={`${result.type}-${result.url}-${index}`}
            style={{
              background: '#fff',
              border: '1px solid #dde3f5',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                padding: '4px 10px',
                borderRadius: 999,
                background: '#f8f9ff',
                color: 'var(--lgfc-blue)',
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              {result.type}
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 18 }}>
              <Link href={result.url} style={{ color: '#333', textDecoration: 'none' }}>
                {result.title}
              </Link>
            </h2>
            {result.excerpt ? <p style={{ margin: 0, color: '#666', lineHeight: 1.5 }}>{result.excerpt}</p> : null}
          </article>
        ))}
      </div>

      {data && data.pages > 1 ? (
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((pageNumber) => {
            const active = pageNumber === data.page;
            return (
              <Link
                key={pageNumber}
                href={`/search?q=${encodeURIComponent(queryFromUrl)}&page=${pageNumber}`}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 700,
                  background: active ? 'var(--lgfc-blue)' : '#fff',
                  color: active ? '#fff' : '#333',
                  border: '1px solid #dde3f5',
                }}
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
        <main style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>Search</h1>
          <p className="sub">Search Fan Club public content. Enter at least two characters to begin.</p>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
