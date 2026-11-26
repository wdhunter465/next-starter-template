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
  open_question?: number;
  question_open?: number;
  reported_by_me?: number;
  is_admin?: number;
};

type Reply = {
  id: number;
  body: string;
  created_at: string;
  mine: number;
  author_name: string;
  question_open?: number;
  reported_by_me?: number;
  is_admin?: number;
};

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

  // A link such as /fanclub/chat?topic=12 (from the admin Chat Flags page) opens that topic.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('topic'));
    if (Number.isInteger(id) && id > 0) setOpenId(id);
  }, []);

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
                  {t.open_question ? <span className={styles.badgeQuestion}>Question for the admin</span> : null}
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
        <p className={styles.muted}>Type @admin in a post to ask the admin a question.</p>
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
            <div className={styles.meta}>
              {topic.author_name}
              {topic.is_admin ? <span className={styles.badgeAdmin}>Admin</span> : null} started this topic{topic.closed_at ? ' · Closed' : ''}
              {topic.question_open ? <span className={styles.badgeQuestion}>Question for the admin</span> : null}
            </div>
            <p className={styles.body}>{topic.body}</p>
            <ReportLink postId={topic.id} reported={Boolean(topic.reported_by_me)} onDone={load} />
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
                  {r.is_admin ? <span className={styles.badgeAdmin}>Admin</span> : null}
                  {r.question_open ? <span className={styles.badgeQuestion}>Question for the admin</span> : null}
                  <span className={styles.timestamp}>{when(r.created_at)}</span>
                </div>
                <p className={styles.body}>{r.body}</p>
                <ReportLink postId={r.id} reported={Boolean(r.reported_by_me)} onDone={load} />
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
                  Your reply (type @admin to ask the admin a question)
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

function ReportLink({ postId, reported, onDone }: { postId: number; reported: boolean; onDone: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (reported) return <div className={styles.reportNote}>You reported this.</div>;

  async function send() {
    if (busy || reason.trim().length < 3) return;
    setBusy(true);
    setError('');
    try {
      await post('/api/discussions/report', { id: postId, reason: reason.trim() });
      setOpen(false);
      setReason('');
      await onDone();
    } catch (e: unknown) {
      setError(e instanceof Error && e.message === 'too_many_reports' ? 'You have sent several reports; please try again later.' : 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.reportLink} onClick={() => setOpen(true)}>
        Report
      </button>
    );
  }
  return (
    <div className={styles.reportBox}>
      <label className={styles.field} htmlFor={`report-${postId}`}>
        Why are you reporting this? (required)
        <textarea id={`report-${postId}`} className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
      </label>
      <div className={styles.reportActions}>
        <button className={styles.button} onClick={send} disabled={busy || reason.trim().length < 3}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
        <button className={styles.refresh} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
