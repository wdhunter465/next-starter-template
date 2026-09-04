'use client';

import { useEffect, useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';
import styles from './page.module.css';

type DiscussionItem = {
  id: number;
  title: string;
  body: string;
  author_email?: string;
  created_at: string;
};

export default function FanclubChatPage() {
  const [items, setItems] = useState<DiscussionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const { isLoading, isAuthenticated, email } = useMemberSession({ redirectTo: '/' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/discussions/list?limit=20', { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'list_failed');
      setItems(json.items || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      load();
    }
  }, [isLoading, isAuthenticated]);

  async function submitPost(title: string, body: string) {
    const res = await fetch('/api/discussions/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error || 'create_failed');
    await load();
  }

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Member Chat</h1>
      <p className={styles.lead}>
        Post short notes, questions, and updates. Reports go to the admin moderation queue.
      </p>

      <ChatComposer onSubmit={submitPost} disabled={!email} />
      {!email && (
        <div className={styles.banner}>
          You appear to be missing a stored member email. Login again to restore session.
        </div>
      )}

      <div className={styles.feedWrap}>
        <div className={styles.feedHeader}>
          <h2 className={styles.feedTitle}>Latest posts</h2>
          <button onClick={load} className={styles.refresh}>
            Refresh
          </button>
        </div>

        {loading && <p className={styles.muted}>Loading…</p>}
        {error && <p className={styles.error}>Error: {error}</p>}

        {!loading && !error && (
          <ChatFeed items={items} />
        )}
      </div>
    </main>
  );
}

function ChatComposer({ onSubmit, disabled }: { onSubmit: (title: string, body: string) => Promise<void>; disabled: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = !disabled && title.trim().length >= 3 && body.trim().length >= 5 && !busy;

  async function go() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(title.trim(), body.trim());
      setTitle('');
      setBody('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg ? `Error: ${msg}` : 'Error: Post failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.composer}>
      <h2 className={styles.composerTitle}>Create a post</h2>
      <div className={styles.formGrid}>
        <label className={styles.field} htmlFor="fanclub-chat-title">
          Title
          <input
            id="fanclub-chat-title"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoComplete="off"
          />
        </label>
        <label className={styles.field} htmlFor="fanclub-chat-body">
          Message
          <textarea
            id="fanclub-chat-body"
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            rows={4}
          />
        </label>
        <button className={styles.button} onClick={go} disabled={!canSubmit}>
          {busy ? 'Posting…' : 'Post'}
        </button>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    </section>
  );
}

function ChatFeed({ items }: { items: DiscussionItem[] }) {
  return (
    <div className={styles.feed}>
      {items.length === 0 && (
        <div className={styles.empty}>No posts yet.</div>
      )}

      {items.map((it) => (
        <article key={it.id} className={styles.article}>
          <div className={styles.articleHead}>
            <h3 className={styles.articleTitle}>{it.title}</h3>
            <span className={styles.timestamp}>{new Date(it.created_at).toLocaleString()}</span>
          </div>
          <p className={styles.body}>{it.body}</p>
          <div className={styles.meta}>
            Reporting workflow will be handled by the moderation queue.
          </div>
        </article>
      ))}
    </div>
  );
}
