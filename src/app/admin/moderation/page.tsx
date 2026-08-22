'use client';

import { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import styles from '@/components/admin/AdminDashboard.module.css';
import { adminJson } from '@/lib/adminClient';

type ReportItem = {
  id: number;
  kind: string;
  target_id: number;
  reporter_email?: string;
  reason?: string;
  status: string;
  admin_note?: string;
  created_at: string;
  resolved_at?: string;
};

type AskItem = {
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

type FaqItem = {
  id: number;
  question: string;
  answer: string;
  status: string;
  submitter_email?: string | null;
  view_count?: number;
  pinned?: number | boolean;
  updated_at?: string;
};

type ItemsResponse<T> = {
  ok: true;
  items?: T[];
};

type ReportCloseResponse = {
  ok: true;
  changed?: number;
};

const ASK_FILTERS = ['pending', 'approved', 'rejected', 'archived'] as const;
const FAQ_FILTERS = ['pending', 'approved', 'denied', 'all'] as const;
const REPORT_FILTERS = ['open', 'closed'] as const;

export default function AdminModerationPage() {
  const [reportFilter, setReportFilter] = useState<(typeof REPORT_FILTERS)[number]>('open');
  const [askFilter, setAskFilter] = useState<(typeof ASK_FILTERS)[number]>('pending');
  const [faqFilter, setFaqFilter] = useState<(typeof FAQ_FILTERS)[number]>('pending');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [askItems, setAskItems] = useState<AskItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
  const [askAnswers, setAskAnswers] = useState<Record<number, string>>({});
  const [askNotes, setAskNotes] = useState<Record<number, string>>({});
  const [faqAnswers, setFaqAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  const setSectionLoading = (section: string, value: boolean) => {
    setLoading((current) => ({ ...current, [section]: value }));
  };

  const loadReports = useCallback(async () => {
    setSectionLoading('reports', true);
    const result = await adminJson<ItemsResponse<ReportItem>>(
      `/api/admin/reports/list?status=${reportFilter}&limit=200`,
    );
    setReports(result.ok && result.data?.items ? result.data.items : []);
    if (!result.ok) setMessage(`Error: ${result.error}`);
    setSectionLoading('reports', false);
  }, [reportFilter]);

  const loadAsk = useCallback(async () => {
    setSectionLoading('ask', true);
    const result = await adminJson<ItemsResponse<AskItem>>(`/api/admin/ask/list?status=${askFilter}`);
    setAskItems(result.ok && result.data?.items ? result.data.items : []);
    if (!result.ok) setMessage(`Error: ${result.error}`);
    setSectionLoading('ask', false);
  }, [askFilter]);

  const loadFaq = useCallback(async () => {
    setSectionLoading('faq', true);
    const query = faqFilter === 'all' ? '' : `?status=${faqFilter}`;
    const result = await adminJson<ItemsResponse<FaqItem>>(`/api/admin/faq/list${query}`);
    setFaqItems(result.ok && result.data?.items ? result.data.items : []);
    if (!result.ok) setMessage(`Error: ${result.error}`);
    setSectionLoading('faq', false);
  }, [faqFilter]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadReports(), loadAsk(), loadFaq()]);
  }, [loadAsk, loadFaq, loadReports]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function closeReport(id: number) {
    setMessage('Closing report...');
    const result = await adminJson<ReportCloseResponse>('/api/admin/reports/close', {
      method: 'POST',
      body: JSON.stringify({ id, admin_note: reportNotes[id] ?? '' }),
    });

    if (!result.ok) {
      setMessage(`Error: ${result.error}`);
      return;
    }

    setReportNotes((current) => ({ ...current, [id]: '' }));
    setMessage(result.data?.changed ? `Closed report #${id}.` : `Report #${id} was already closed.`);
    await loadReports();
  }

  async function askAction(path: string, id: number, body: Record<string, unknown>) {
    setMessage('Saving ask review...');
    const result = await adminJson<{ ok: true; faq_entry_id?: number }>(path, {
      method: 'POST',
      body: JSON.stringify({ id, ...body }),
    });

    if (!result.ok) {
      setMessage(`Error: ${result.error}`);
      return;
    }

    setAskAnswers((current) => ({ ...current, [id]: '' }));
    setAskNotes((current) => ({ ...current, [id]: '' }));
    setMessage('Ask review saved.');
    await loadAsk();
    if (path.endsWith('/approve')) await loadFaq();
  }

  async function faqAction(path: string, item: FaqItem) {
    setMessage('Saving FAQ review...');
    const answer = faqAnswers[item.id] ?? item.answer ?? '';
    const result = await adminJson<{ ok: true }>(path, {
      method: 'POST',
      body: JSON.stringify({ id: item.id, answer }),
    });

    if (!result.ok) {
      setMessage(`Error: ${result.error}`);
      return;
    }

    setFaqAnswers((current) => ({ ...current, [item.id]: '' }));
    setMessage('FAQ review saved.');
    await loadFaq();
  }

  return (
    <PageShell title="Admin Moderation" subtitle="Review reports, Ask submissions, and pending FAQ entries">
      <AdminNav />
      <div className={styles.wrap}>
        {message ? (
          message.startsWith('Error:') ? (
            <AdminStatusText message={message} className={styles.status} />
          ) : (
            <p className={styles.status}>{message}</p>
          )
        ) : null}

        <section className={styles.panel} aria-label="Reports review queue">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Reports</h2>
              <p className={styles.status}>Close reviewed reports with an admin note for audit history.</p>
            </div>
            <button className={styles.btn} type="button" onClick={() => void loadReports()}>
              Refresh reports
            </button>
          </div>
          <FilterButtons values={REPORT_FILTERS} selected={reportFilter} onSelect={setReportFilter} />
          {loading.reports ? <p className={styles.status}>Loading reports...</p> : null}
          <div className={styles.list}>
            {reports.map((report) => (
              <article className={styles.listItem} key={report.id}>
                <h3>Report #{report.id}</h3>
                <p>
                  {report.kind} #{report.target_id} • {report.status}
                </p>
                <p className={styles.prewrap}>{report.reason || 'No reason provided.'}</p>
                {report.reporter_email ? <p>Reporter: {report.reporter_email}</p> : null}
                {report.admin_note ? <p className={styles.prewrap}>Admin note: {report.admin_note}</p> : null}
                {report.status === 'open' ? (
                  <>
                    <label className={styles.fieldWide}>
                      Admin note
                      <textarea
                        value={reportNotes[report.id] ?? ''}
                        onChange={(event) =>
                          setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))
                        }
                        rows={3}
                      />
                    </label>
                    <div className={styles.actions}>
                      <button className={styles.btn} type="button" onClick={() => void closeReport(report.id)}>
                        Close report
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            ))}
            {!loading.reports && reports.length === 0 ? (
              <p className={styles.status}>No {reportFilter} reports in this queue.</p>
            ) : null}
          </div>
        </section>

        <section className={styles.panel} aria-label="Ask review queue">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Ask Inbox</h2>
              <p className={styles.status}>Approve, reject, or archive visitor questions from the review queue.</p>
            </div>
            <button className={styles.btn} type="button" onClick={() => void loadAsk()}>
              Refresh ask
            </button>
          </div>
          <FilterButtons values={ASK_FILTERS} selected={askFilter} onSelect={setAskFilter} />
          {loading.ask ? <p className={styles.status}>Loading ask queue...</p> : null}
          <div className={styles.list}>
            {askItems.map((item) => (
              <article className={styles.listItem} key={item.id}>
                <h3>{item.question}</h3>
                <p>
                  {item.first_name} {item.last_name}
                  {item.screen_name ? ` (${item.screen_name})` : ''} • {item.email} • {item.status}
                </p>
                {item.moderation_note ? <p className={styles.prewrap}>Note: {item.moderation_note}</p> : null}
                {item.status === 'open' || item.status === 'pending' ? (
                  <>
                    <label className={styles.fieldWide}>
                      Published answer
                      <textarea
                        value={askAnswers[item.id] ?? ''}
                        onChange={(event) =>
                          setAskAnswers((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        rows={4}
                      />
                    </label>
                    <label className={styles.fieldWide}>
                      Moderation note
                      <textarea
                        value={askNotes[item.id] ?? ''}
                        onChange={(event) =>
                          setAskNotes((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        rows={2}
                      />
                    </label>
                  </>
                ) : null}
                <div className={styles.actions}>
                  {(item.status === 'open' || item.status === 'pending') ? (
                    <>
                      <button
                        className={styles.btn}
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
                        className={styles.btn}
                        type="button"
                        onClick={() =>
                          void askAction('/api/admin/ask/reject', item.id, {
                            moderation_note: askNotes[item.id] ?? '',
                          })
                        }
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  <button
                    className={styles.btn}
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
              </article>
            ))}
            {!loading.ask && askItems.length === 0 ? (
              <p className={styles.status}>No {askFilter} ask entries in this queue.</p>
            ) : null}
          </div>
        </section>

        <section className={styles.panel} aria-label="FAQ review queue">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>FAQ Review</h2>
              <p className={styles.status}>Approve or deny FAQ drafts while preserving review state.</p>
            </div>
            <button className={styles.btn} type="button" onClick={() => void loadFaq()}>
              Refresh FAQ
            </button>
          </div>
          <FilterButtons values={FAQ_FILTERS} selected={faqFilter} onSelect={setFaqFilter} />
          {loading.faq ? <p className={styles.status}>Loading FAQ queue...</p> : null}
          <div className={styles.list}>
            {faqItems.map((item) => {
              const answer = faqAnswers[item.id] ?? item.answer ?? '';
              return (
                <article className={styles.listItem} key={item.id}>
                  <h3>{item.question}</h3>
                  <p>
                    Status: {item.status} • Views: {item.view_count ?? 0}
                    {item.submitter_email ? ` • ${item.submitter_email}` : ''}
                  </p>
                  <label className={styles.fieldWide}>
                    Answer
                    <textarea
                      value={answer}
                      onChange={(event) =>
                        setFaqAnswers((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      rows={4}
                    />
                  </label>
                  <div className={styles.actions}>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => void faqAction('/api/admin/faq/approve', { ...item, answer })}
                    >
                      Approve FAQ
                    </button>
                    <button
                      className={styles.btn}
                      type="button"
                      onClick={() => void faqAction('/api/admin/faq/deny', item)}
                    >
                      Deny FAQ
                    </button>
                  </div>
                </article>
              );
            })}
            {!loading.faq && faqItems.length === 0 ? (
              <p className={styles.status}>No {faqFilter} FAQ entries in this queue.</p>
            ) : null}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function FilterButtons<T extends string>({
  values,
  selected,
  onSelect,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className={styles.actions}>
      {values.map((value) => (
        <button
          className={styles.btn}
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          aria-pressed={selected === value}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
