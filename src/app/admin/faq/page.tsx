'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';
import styles from '@/components/admin/AdminDashboard.module.css';

type FaqRow = {
  id: number;
  question: string;
  answer: string;
  status: string;
  published: boolean;
  pinned: boolean;
  view_count: number;
  submitter_email?: string | null;
};

type AskRow = {
  id: number;
  first_name: string;
  last_name: string;
  screen_name?: string | null;
  email: string;
  question: string;
  status: string;
  moderation_note?: string | null;
  faq_entry_id?: number | null;
  created_at?: string;
};

type ItemsResponse<T> = {
  ok: true;
  items?: T[];
};

export default function AdminFaqPage() {
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'ask' | 'faq'>('ask');

  const [askFilter, setAskFilter] = useState<'pending' | 'approved' | 'rejected' | 'archived'>('pending');
  const [askItems, setAskItems] = useState<AskRow[]>([]);
  const [askAnswers, setAskAnswers] = useState<Record<number, string>>({});
  const [askNotes, setAskNotes] = useState<Record<number, string>>({});

  const [faqFilter, setFaqFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [faqItems, setFaqItems] = useState<FaqRow[]>([]);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [draftPublish, setDraftPublish] = useState(false);
  const [draftPinned, setDraftPinned] = useState(false);

  const loadAsk = useCallback(async () => {
    setStatus('Loading ask inbox…');
    const result = await adminJson<ItemsResponse<AskRow>>(`/api/admin/ask/list?status=${askFilter}`);
    if (!result.ok || !result.data) {
      setStatus(`Error: ${result.error}`);
      setAskItems([]);
      return;
    }
    const rows = Array.isArray(result.data.items) ? result.data.items : [];
    setAskItems(rows);
    setStatus('');
  }, [askFilter]);

  const loadFaq = useCallback(async () => {
    setStatus('Loading FAQs…');
    const query = faqFilter === 'all' ? '' : `?status=${faqFilter}`;
    const result = await adminJson<ItemsResponse<Record<string, unknown>>>(`/api/admin/faq/list${query}`);
    if (!result.ok || !result.data) {
      setStatus(`Error: ${result.error}`);
      setFaqItems([]);
      return;
    }
    const rows = (Array.isArray(result.data.items) ? result.data.items : []).map((raw) => {
      const row = isRecord(raw) ? raw : {};
      return {
        id: Number(row.id),
        question: String(row.question ?? ''),
        answer: String(row.answer ?? ''),
        status: String(row.status ?? ''),
        published: Boolean(row.published ?? row.status === 'approved'),
        pinned: Number(row.pinned) === 1,
        view_count: Number(row.view_count ?? 0),
        submitter_email: row.submitter_email != null ? String(row.submitter_email) : null,
      } satisfies FaqRow;
    });
    setFaqItems(rows.filter((row) => Number.isFinite(row.id)));
    setStatus('');
  }, [faqFilter]);

  useEffect(() => {
    if (tab === 'ask') void loadAsk();
  }, [tab, loadAsk]);

  useEffect(() => {
    if (tab === 'faq') void loadFaq();
  }, [tab, loadFaq]);

  async function askAction(path: string, id: number, body: Record<string, unknown>) {
    setStatus('Saving…');
    const result = await adminJson<{ ok: true }>(path, {
      method: 'POST',
      body: JSON.stringify({ id, ...body }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    await loadAsk();
  }

  async function saveFaq(row: FaqRow) {
    setStatus('Saving FAQ…');
    const result = await adminJson<{ ok: true }>('/api/admin/faq/update', {
      method: 'POST',
      body: JSON.stringify({
        id: row.id,
        question: row.question,
        answer: row.answer,
        status: row.status,
        pinned: row.pinned ? 1 : 0,
      }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    await loadFaq();
  }

  async function createFaq() {
    setStatus('Creating FAQ…');
    const result = await adminJson<{ ok: true }>('/api/admin/faq/create', {
      method: 'POST',
      body: JSON.stringify({
        question: draftQuestion,
        answer: draftAnswer,
        published: draftPublish,
        pinned: draftPinned ? 1 : 0,
      }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    setDraftQuestion('');
    setDraftAnswer('');
    setDraftPublish(false);
    setDraftPinned(false);
    await loadFaq();
    setStatus('');
  }

  async function deleteFaq(id: number) {
    if (!window.confirm('Mark this FAQ as denied (removed from public)?')) return;
    setStatus('Deleting…');
    const result = await adminJson<{ ok: true }>('/api/admin/faq/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    await loadFaq();
    setStatus('');
  }

  const askCountLabel = useMemo(() => `${askItems.length} item(s)`, [askItems.length]);

  return (
    <PageShell title="Admin • FAQ Moderation" subtitle="Ask inbox triage and FAQ publishing">
      <AdminNav />

      <div className={styles.wrap}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setTab('ask')} style={{ fontWeight: tab === 'ask' ? 700 : 400 }}>
            Ask Inbox
          </button>
          <button type="button" onClick={() => setTab('faq')} style={{ fontWeight: tab === 'faq' ? 700 : 400 }}>
            FAQ CMS
          </button>
        </div>

        {status ? (
          status.startsWith('Error:') ? (
            <AdminStatusText message={status} className={styles.status} />
          ) : (
            <p className={styles.status}>{status}</p>
          )
        ) : null}

        {tab === 'ask' ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['pending', 'approved', 'rejected', 'archived'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAskFilter(value)}
                  style={{ fontWeight: askFilter === value ? 700 : 400 }}
                >
                  {value}
                </button>
              ))}
              <button type="button" onClick={() => void loadAsk()}>
                Refresh
              </button>
              <span style={{ opacity: 0.75 }}>{askCountLabel}</span>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {askItems.map((item) => (
                <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 800 }}>{item.question}</div>
                  <div className="sub" style={{ marginTop: 6 }}>
                    {item.first_name} {item.last_name}
                    {item.screen_name ? ` (${item.screen_name})` : ''} — {item.email}
                  </div>
                  <div className="sub" style={{ marginTop: 4 }}>
                    Status: {item.status}
                    {item.faq_entry_id ? ` • FAQ #${item.faq_entry_id}` : ''}
                  </div>
                  {item.moderation_note ? (
                    <div className="sub" style={{ marginTop: 6 }}>
                      Note: {item.moderation_note}
                    </div>
                  ) : null}

                  {askFilter === 'pending' ? (
                    <>
                      <label style={{ display: 'block', marginTop: 12 }}>
                        <strong>Publish answer (creates FAQ when approved)</strong>
                        <textarea
                          value={askAnswers[item.id] ?? ''}
                          onChange={(e) =>
                            setAskAnswers((current) => ({ ...current, [item.id]: e.target.value }))
                          }
                          rows={4}
                          style={{ width: '100%', marginTop: 6, padding: 8, boxSizing: 'border-box' }}
                        />
                      </label>
                      <label style={{ display: 'block', marginTop: 8 }}>
                        <strong>Moderation note (optional)</strong>
                        <input
                          value={askNotes[item.id] ?? ''}
                          onChange={(e) =>
                            setAskNotes((current) => ({ ...current, [item.id]: e.target.value }))
                          }
                          style={{ width: '100%', marginTop: 6, padding: 8 }}
                        />
                      </label>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() =>
                            void askAction('/api/admin/ask/approve', item.id, {
                              answer: askAnswers[item.id] ?? '',
                              moderation_note: askNotes[item.id] ?? '',
                              create_faq: Boolean((askAnswers[item.id] ?? '').trim()),
                            })
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void askAction('/api/admin/ask/reject', item.id, {
                              moderation_note: askNotes[item.id] ?? '',
                            })
                          }
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void askAction('/api/admin/ask/archive', item.id, {
                              moderation_note: askNotes[item.id] ?? '',
                            })
                          }
                        >
                          Archive
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      style={{ marginTop: 12 }}
                      onClick={() =>
                        void askAction('/api/admin/ask/archive', item.id, {
                          moderation_note: askNotes[item.id] ?? '',
                        })
                      }
                    >
                      Archive
                    </button>
                  )}
                </div>
              ))}
              {askItems.length === 0 ? (
                <p className="sub">No ask inbox entries in this queue.</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: 18 }}>Create FAQ</h2>
              <label style={{ display: 'block' }}>
                <strong>Question</strong>
                <input
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: 8 }}
                />
              </label>
              <label style={{ display: 'block', marginTop: 10 }}>
                <strong>Answer</strong>
                <textarea
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  rows={4}
                  style={{ width: '100%', marginTop: 6, padding: 8, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={draftPublish}
                  onChange={(e) => setDraftPublish(e.target.checked)}
                />
                Publish immediately
              </label>
              <label style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={draftPinned}
                  onChange={(e) => setDraftPinned(e.target.checked)}
                />
                Pin on publish
              </label>
              <button type="button" style={{ marginTop: 12 }} onClick={() => void createFaq()}>
                Create FAQ
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['all', 'pending', 'approved', 'denied'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFaqFilter(value)}
                  style={{ fontWeight: faqFilter === value ? 700 : 400 }}
                >
                  {value}
                </button>
              ))}
              <button type="button" onClick={() => void loadFaq()}>
                Refresh
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {faqItems.map((item) => (
                <FaqEditor
                  key={item.id}
                  item={item}
                  onChange={(next) =>
                    setFaqItems((rows) => rows.map((row) => (row.id === next.id ? next : row)))
                  }
                  onSave={() => {
                    const current = faqItems.find((row) => row.id === item.id) ?? item;
                    void saveFaq(current);
                  }}
                  onDelete={() => void deleteFaq(item.id)}
                />
              ))}
              {faqItems.length === 0 ? (
                <p className="sub">No FAQ entries in this filter.</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function FaqEditor({
  item,
  onChange,
  onSave,
  onDelete,
}: {
  item: FaqRow;
  onChange: (row: FaqRow) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 14 }}>
      <label style={{ display: 'block' }}>
        <strong>Question</strong>
        <input
          value={item.question}
          onChange={(e) => onChange({ ...item, question: e.target.value })}
          style={{ width: '100%', marginTop: 6, padding: 8 }}
        />
      </label>
      <label style={{ display: 'block', marginTop: 10 }}>
        <strong>Answer</strong>
        <textarea
          value={item.answer}
          onChange={(e) => onChange({ ...item, answer: e.target.value })}
          rows={5}
          style={{ width: '100%', marginTop: 6, padding: 8, boxSizing: 'border-box' }}
        />
      </label>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={item.published}
            onChange={(e) =>
              onChange({
                ...item,
                published: e.target.checked,
                status: e.target.checked ? 'approved' : 'pending',
              })
            }
          />
          Published
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={item.pinned}
            onChange={(e) => onChange({ ...item, pinned: e.target.checked })}
          />
          Pinned
        </label>
        <span className="sub">Views: {item.view_count}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={onSave}>
          Save
        </button>
        <button type="button" onClick={onDelete}>
          Delete
        </button>
        <span className="sub">Status: {item.status}</span>
      </div>
    </div>
  );
}
