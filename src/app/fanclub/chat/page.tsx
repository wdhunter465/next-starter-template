'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';
import styles from './page.module.css';

// Threaded Member Chat (#5550): topics with replies, display names, and the original poster's two checkboxes.

type Topic = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  closed_at: string | null;
  mine: number;
  notify_author: number | null;
  author_name: string;
  reply_count: number;
  last_activity: string;
};

type Reply = { id: number; body: string; created_at: string; mine: number; author_name: string };

const when = (value: string) => new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toLocaleString();

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', cache: 'no-store', ...init });
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new Error(json?.error || 'request_failed');
  return json;
}

const post = (path: string, payload: unknown) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

export default function FanclubChatPage() {
  const { isLoading, isAuthenticated, email } = useMemberSession({ redirectTo: '/' });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const json = await api('/api/discussions/list?limit=50');
      setTopics(json.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) load();
  }, [isLoading, isAuthenticated, load]);

  if (isLoading || !isAuthenticated) return null;

  if (openId !== null) {
    return (
      <main className={styles.main}>
        <ThreadView
          id={openId}
          onBack={() => {
            setOpenId(null);
            load();
          }}
        />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Member Chat</h1>
      <p className={styles.lead}>
        Start a topic, or open one to read it and reply. Each post shows the member&apos;s screen name, or first name
        and last initial.
      </p>

      <TopicComposer
        disabled={!email}
        onCreated={async (id) => {
          await load();
          setOpenId(id);
        }}
      />
      {!email && <div className={styles.banner}>Your member email is missing. Log in again to restore your session.</div>}

      <div className={styles.feedWrap}>
        <div className={styles.feedHeader}>
          <h2 className={styles.feedTitle}>Topics</h2>
          <button onClick={load} className={styles.refresh}>
            Refresh
          </button>
        </div>
        {loading && <p className={styles.muted}>Loading…</p>}
        {error && <p className={styles.error}>Error: {error}</p>}
        {!loading && !error && (
          <div className={styles.feed}>
            {topics.length === 0 && <div className={styles.empty}>No topics yet.</div>}
            {topics.map((t) => (
              <article key={t.id} className={styles.article}>
                <div className={styles.articleHead}>
                  <h3 className={styles.articleTitle}>
                    <button className={styles.linkButton} onClick={() => setOpenId(t.id)}>
                      {t.title}
                    </button>
                  </h3>
                  <span className={styles.timestamp}>{when(t.last_activity)}</span>
                </div>
                <div className={styles.meta}>
                  Started by {t.author_name} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                  {t.closed_at ? ' · Closed' : ''}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TopicComposer({ disabled, onCreated }: { disabled: boolean; onCreated: (id: number) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = !disabled && title.trim().length >= 3 && body.trim().length >= 2 && !busy;

  async function go() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const json = await post('/api/discussions/create', { title: title.trim(), body: body.trim(), notify });
      setTitle('');
      setBody('');
      await onCreated(json.discussion.id);
    } catch (e: unknown) {
      setError(`Error: ${e instanceof Error ? e.message : 'Post failed.'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.composer}>
      <h2 className={styles.composerTitle}>Start a topic</h2>
      <div className={styles.formGrid}>
        <label className={styles.field} htmlFor="chat-title">
          Title
          <input id="chat-title" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoComplete="off" />
        </label>
        <label className={styles.field} htmlFor="chat-body">
          Message
          <textarea id="chat-body" className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email me when someone replies
          (one email a day at most)
        </label>
        <button className={styles.button} onClick={go} disabled={!canSubmit}>
          {busy ? 'Posting…' : 'Post'}
        </button>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    </section>
  );
}

function ThreadView({ id, onBack }: { id: number; onBack: () => void }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const json = await api(`/api/discussions/thread?id=${id}`);
      setTopic(json.topic);
      setReplies(json.replies || []);
      setError('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply() {
    if (busy || text.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      await post('/api/discussions/create', { parent_id: id, body: text.trim() });
      setText('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error && e.message === 'thread_closed' ? 'This thread has been closed.' : `Error: ${e instanceof Error ? e.message : 'Reply failed.'}`);
    } finally {
      setBusy(false);
    }
  }

  async function setting(change: { notify?: boolean; closed?: boolean }) {
    try {
      await post('/api/discussions/settings', { id, ...change });
      await load();
    } catch (e: unknown) {
      setError(`Error: ${e instanceof Error ? e.message : 'Could not save.'}`);
    }
  }

  return (
    <>
      <button className={styles.refresh} onClick={onBack}>
        ← All topics
      </button>
      {error && !topic && <p className={styles.error}>Error: {error}</p>}
      {topic && (
        <>
          <article className={styles.article}>
            <div className={styles.articleHead}>
              <h1 className={styles.articleTitle}>{topic.title}</h1>
              <span className={styles.timestamp}>{when(topic.created_at)}</span>
            </div>
            <div className={styles.meta}>{topic.author_name} started this topic{topic.closed_at ? ' · Closed' : ''}</div>
            <p className={styles.body}>{topic.body}</p>
            {topic.mine ? (
              <div className={styles.authorControls}>
                <label className={styles.check}>
                  <input type="checkbox" checked={topic.notify_author === 1} onChange={(e) => setting({ notify: e.target.checked })} /> Email me
                  when someone replies (one email a day at most)
                </label>
                <label className={styles.check}>
                  <input type="checkbox" checked={Boolean(topic.closed_at)} onChange={(e) => setting({ closed: e.target.checked })} /> Close this
                  thread (no more replies)
                </label>
              </div>
            ) : null}
          </article>

          <div className={styles.feed}>
            {replies.length === 0 && <div className={styles.empty}>No replies yet.</div>}
            {replies.map((r) => (
              <article key={r.id} className={styles.article}>
                <div className={styles.articleHead}>
                  <strong>{r.author_name}</strong>
                  <span className={styles.timestamp}>{when(r.created_at)}</span>
                </div>
                <p className={styles.body}>{r.body}</p>
              </article>
            ))}
          </div>

          {topic.closed_at ? (
            <p className={styles.muted}>This thread is closed. No more replies can be added.</p>
          ) : (
            <section className={styles.composer}>
              <h2 className={styles.composerTitle}>Reply</h2>
              <div className={styles.formGrid}>
                <label className={styles.field} htmlFor="chat-reply">
                  Your reply
                  <textarea id="chat-reply" className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} />
                </label>
                <button className={styles.button} onClick={sendReply} disabled={busy || text.trim().length < 2}>
                  {busy ? 'Posting…' : 'Reply'}
                </button>
                {error ? <p className={styles.error}>{error}</p> : null}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
