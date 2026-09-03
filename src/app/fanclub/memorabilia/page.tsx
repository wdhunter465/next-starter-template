'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fanclubThreeColumnGridClassName } from '@/components/fanclub/fanclubGridStyles';
import { useMemberSession } from '@/hooks/useMemberSession';
import { buildFanclubPhotoListApiUrl } from '@/lib/fanclubApi';
import styles from './page.module.css';

type MemorabiliaItem = {
  id: number;
  thumbnail_url?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string | null;
};

type RelatedLibraryEntry = {
  id: number;
  title?: string | null;
  author?: string | null;
  summary?: string | null;
};

function parseTagsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function MemorabiliaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeQuery = searchParams.get('q') || '';
  const tagsParam = searchParams.get('tags');
  const activeTags = useMemo(() => parseTagsParam(tagsParam), [tagsParam]);
  const { isLoading, isAuthenticated } = useMemberSession({ redirectTo: '/' });
  const [items, setItems] = useState<MemorabiliaItem[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [relatedEntries, setRelatedEntries] = useState<RelatedLibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState('');
  const [draftQuery, setDraftQuery] = useState(activeQuery);
  const [selectedTags, setSelectedTags] = useState<string[]>(activeTags);
  const limit = 24;

  useEffect(() => {
    setDraftQuery(activeQuery);
    setSelectedTags(activeTags);
  }, [activeQuery, activeTags]);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch('/api/fanclub/memorabilia/tags', { credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok && Array.isArray(json.tags)) {
        setAvailableTags(json.tags.filter((tag: unknown) => typeof tag === 'string' && tag.trim()));
      }
    } catch {
      setAvailableTags([]);
    }
  }, []);

  const load = useCallback(
    async (nextOffset: number, q: string, tags: string[]) => {
      setLoading(true);
      setMessage('');
      try {
        const tagCsv = tags.join(',');
        const res = await fetch(
          buildFanclubPhotoListApiUrl({ limit, offset: nextOffset, memorabilia: true, q, tags: tagCsv }),
          { credentials: 'include', cache: 'no-store' },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          const incoming = Array.isArray(data.items) ? data.items : [];
          if (nextOffset === 0) setItems(incoming);
          else setItems((prev) => [...prev, ...incoming]);
          if (nextOffset === 0) {
            setRelatedEntries(Array.isArray(data.related_library_entries) ? data.related_library_entries : []);
          }
        } else if (nextOffset === 0) {
          setItems([]);
          setRelatedEntries([]);
          setMessage(data?.error || 'Unable to load memorabilia items right now.');
        }
      } catch {
        if (nextOffset === 0) {
          setItems([]);
          setRelatedEntries([]);
          setMessage('Unable to load memorabilia items right now.');
        }
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      loadTags();
    }
  }, [isLoading, isAuthenticated, loadTags]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setOffset(0);
      load(0, activeQuery, activeTags);
    }
  }, [isLoading, isAuthenticated, activeQuery, activeTags, load]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const tagCsv = selectedTags.join(',');

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Memorabilia Archive</h1>
      <p className={styles.lead}>A read-only view of memorabilia-tagged records sourced from the photo archive.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = draftQuery.trim();
          const params = new URLSearchParams();
          if (next) params.set('q', next);
          if (tagCsv) params.set('tags', tagCsv);
          const suffix = params.toString();
          router.replace(suffix ? `/fanclub/memorabilia?${suffix}` : '/fanclub/memorabilia');
        }}
      >
        <label className={styles.field}>
          Search
          <input
            className={styles.input}
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="Search memorabilia…"
          />
        </label>

        <div className={styles.tagBlock}>
          <div className={styles.tagLabel}>Tag filters</div>
          <div className={styles.pillRow}>
            <button
              type="button"
              aria-pressed={selectedTags.length === 0}
              className={selectedTags.length === 0 ? styles.pillActive : styles.pill}
              onClick={() => setSelectedTags([])}
            >
              All
            </button>
            {availableTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  className={active ? styles.pillActive : styles.pill}
                  onClick={() => {
                    setSelectedTags((current) =>
                      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
                    );
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <button type="submit" className={styles.button}>
          Apply filters
        </button>
      </form>
      {message ? <p className={styles.muted}>{message}</p> : null}

      <div className={fanclubThreeColumnGridClassName}>
        {items.map((p) => (
          <div key={p.id} className={styles.card}>
            {p.thumbnail_url ? (
              <img src={p.thumbnail_url} alt={p.description || p.title || `Item ${p.id}`} className={styles.img} />
            ) : (
              <div className={styles.imgFallback}>No image</div>
            )}
            <div className={styles.cap}>
              <div>{p.title || p.description || '—'}</div>
              {p.tags ? <div className={styles.capMeta}>Tags: {p.tags}</div> : null}
            </div>
          </div>
        ))}
      </div>
      {!loading && items.length === 0 ? (
        <p className={styles.muted}>
          {activeQuery.trim() || activeTags.length > 0
            ? 'No memorabilia items match your search.'
            : 'No memorabilia items found.'}
        </p>
      ) : null}

      {relatedEntries.length > 0 ? (
        <section className={styles.related} aria-label="Related library stories">
          <h2 className={styles.relatedTitle}>Related stories</h2>
          <ul className={styles.relatedList}>
            {relatedEntries.map((entry) => (
              <li key={entry.id} className={styles.relatedItem}>
                <strong>{entry.title || 'Untitled story'}</strong>
                {entry.author ? <span className={styles.muted}> — {entry.author}</span> : null}
                {entry.summary ? <div className={styles.relatedSummary}>{entry.summary}</div> : null}
              </li>
            ))}
          </ul>
          <Link href="/fanclub/library" className={styles.button}>
            Open Gehrig Library
          </Link>
        </section>
      ) : null}

      <div className={styles.btnRow}>
        <button
          className={styles.button}
          disabled={loading}
          onClick={() => {
            const next = offset + limit;
            setOffset(next);
            load(next, activeQuery, activeTags);
          }}
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
        <Link className={styles.button} href="/fanclub/photo">
          View photos
        </Link>
        <Link className={styles.button} href="/fanclub/library">
          View library
        </Link>
        <Link className={styles.button} href="/fanclub">
          Back to Fan Club Home
        </Link>
      </div>
    </main>
  );
}
