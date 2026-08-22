'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson } from '@/lib/adminClient';

type Block = {
  key: string;
  page: string;
  section: string;
  title: string;
  body_md: string;
  status: 'draft' | 'published';
  published_body_md: string | null;
  version: number;
  updated_at: string;
  published_at: string | null;
  updated_by: string;
};

type CmsListResponse = {
  ok: true;
  page?: string | null;
  pages?: string[];
  blocks?: Block[];
};

type CmsSaveResponse = {
  ok: true;
  version?: number;
};

type CmsPublishResponse = {
  ok: true;
  version?: number;
};

export default function AdminCMS() {
  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState<string>('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [status, setStatus] = useState<string>('Idle');

  const selected = useMemo(() => blocks.find((b) => b.key === selectedKey) || null, [blocks, selectedKey]);
  const [editKey, setEditKey] = useState('');
  const [editPage, setEditPage] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  useEffect(() => {
    if (!selected) return;
    setEditKey(selected.key);
    setEditPage(selected.page);
    setEditSection(selected.section);
    setEditTitle(selected.title);
    setEditBody(selected.body_md);
  }, [selected?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(
    async (targetPage?: string) => {
      setStatus('Loading...');
      const qs = targetPage ? `?page=${encodeURIComponent(targetPage)}` : '';
      const result = await adminJson<CmsListResponse>(`/api/admin/cms/list${qs}`);

      if (!result.ok || !result.data) {
        setPages([]);
        setBlocks([]);
        setStatus(`Error: ${result.error}`);
        return;
      }

      setPages(result.data.pages || []);
      setBlocks(result.data.blocks || []);
      setStatus('Loaded');
    },
    [],
  );

  const saveDraft = useCallback(async () => {
    setStatus('Saving draft...');
    const result = await adminJson<CmsSaveResponse>('/api/admin/cms/save', {
      method: 'POST',
      body: JSON.stringify({
        key: editKey,
        page: editPage,
        section: editSection,
        title: editTitle,
        body_md: editBody,
        updated_by: 'admin-ui',
      }),
    });

    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }

    await load(page || undefined);
    setSelectedKey(editKey);
    setStatus(`Saved (v${result.data?.version ?? '?'})`);
  }, [editBody, editKey, editPage, editSection, editTitle, load, page]);

  const publish = useCallback(async () => {
    if (!selectedKey) return;

    setStatus('Publishing...');
    const result = await adminJson<CmsPublishResponse>('/api/admin/cms/publish', {
      method: 'POST',
      body: JSON.stringify({ key: selectedKey, updated_by: 'admin-ui' }),
    });

    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }

    await load(page || undefined);
    setStatus(`Published (v${result.data?.version ?? '?'})`);
  }, [load, page, selectedKey]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell title="Admin – CMS Blocks" subtitle="Manage published CMS blocks (content_blocks) in D1">
      <AdminNav />
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>CMS Editor</h1>
            <p style={{ marginTop: 8, opacity: 0.85 }}>
              Table: <code>content_blocks</code>. Draft + publish workflow. (Markdown stored as raw text.)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              ← Admin Home
            </Link>
          </div>
        </div>

        <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Page:
              <select
                value={page}
                onChange={(e) => {
                  const p = e.target.value;
                  setPage(p);
                  void load(p || undefined);
                }}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
              >
                <option value="">(all)</option>
                {pages.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void load(page || undefined)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #222', cursor: 'pointer' }}
            >
              Refresh
            </button>
            <AdminStatusText message={status} />
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, marginTop: 16 }}>
          <section style={{ border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: 12, borderBottom: '1px solid #eee', fontWeight: 700 }}>Blocks</div>
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              {blocks.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedKey(b.key)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: 12,
                    border: '0',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    background: b.key === selectedKey ? '#f7f7f7' : 'white',
                  }}
                >
                  <span style={{ display: 'block', fontWeight: 700 }}>{b.title}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>{b.key}</span>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {b.page} / {b.section} • {b.status} • v{b.version}
                  </span>
                </button>
              ))}
              {blocks.length === 0 && <div style={{ padding: 12, opacity: 0.8 }}>No blocks found.</div>}
            </div>
          </section>

          <section style={{ border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: 12, borderBottom: '1px solid #eee', fontWeight: 700 }}>
              Editor {selected ? `— ${selected.title}` : ''}
            </div>

            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Key
                  <input
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  Title
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Page
                  <input
                    value={editPage}
                    onChange={(e) => setEditPage(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  Section
                  <input
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    style={{ padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                Body (Markdown text)
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={14}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #222', cursor: 'pointer' }}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={!selected}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}
                >
                  Publish
                </button>
              </div>

              {selected && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  <div>
                    Current: {selected.status} • v{selected.version} • updated {selected.updated_at} by{' '}
                    {selected.updated_by}
                  </div>
                  <div>Published: {selected.published_at || '(never)'}</div>
                  <div style={{ marginTop: 6 }}>
                    Public read endpoint: <code>/api/cms/get?key={encodeURIComponent(selected.key)}</code>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
