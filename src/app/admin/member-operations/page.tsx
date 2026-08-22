'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';
import styles from '@/components/admin/AdminDashboard.module.css';

type ManagedContent = {
  id?: number;
  title: string;
  body_md: string;
  status?: string | null;
  updated_at?: string | null;
};

type ManagedEndpoint = {
  key: 'welcome' | 'card';
  heading: string;
  emptyText: string;
  path: string;
  defaultTitle: string;
};

const endpoints: ManagedEndpoint[] = [
  {
    key: 'welcome',
    heading: 'Welcome Email',
    emptyText: 'No welcome email content is published yet.',
    path: '/api/admin/welcome-email',
    defaultTitle: 'Welcome Email',
  },
  {
    key: 'card',
    heading: 'Membership Card',
    emptyText: 'No membership card instructions are published yet.',
    path: '/api/admin/membership-card',
    defaultTitle: 'Membership Card',
  },
];

function asContent(data: unknown, defaultTitle: string): ManagedContent {
  if (!isRecord(data)) return { title: defaultTitle, body_md: '' };
  return {
    id: typeof data.id === 'number' ? data.id : undefined,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : defaultTitle,
    body_md: typeof data.body_md === 'string' ? data.body_md : '',
    status: typeof data.status === 'string' ? data.status : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export default function AdminMemberOperationsPage() {
  const [content, setContent] = useState<Record<ManagedEndpoint['key'], ManagedContent>>({
    welcome: { title: 'Welcome Email', body_md: '' },
    card: { title: 'Membership Card', body_md: '' },
  });
  const [messages, setMessages] = useState<Record<ManagedEndpoint['key'], string>>({
    welcome: 'Loading welcome email...',
    card: 'Loading membership card...',
  });

  const loadEndpoint = useCallback(async (endpoint: ManagedEndpoint) => {
    setMessages((current) => ({ ...current, [endpoint.key]: `Loading ${endpoint.heading.toLowerCase()}...` }));
    const result = await adminJson<Record<string, unknown>>(endpoint.path);
    if (!result.ok || !result.data) {
      setMessages((current) => ({ ...current, [endpoint.key]: `Error: ${result.error}` }));
      setContent((current) => ({
        ...current,
        [endpoint.key]: { title: endpoint.defaultTitle, body_md: '' },
      }));
      return;
    }

    const nextContent = asContent(result.data, endpoint.defaultTitle);
    setContent((current) => ({ ...current, [endpoint.key]: nextContent }));
    setMessages((current) => ({
      ...current,
      [endpoint.key]: nextContent.body_md ? '' : endpoint.emptyText,
    }));
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all(endpoints.map(loadEndpoint));
  }, [loadEndpoint]);

  async function saveEndpoint(endpoint: ManagedEndpoint) {
    const current = content[endpoint.key];
    if (!current.body_md.trim()) {
      setMessages((state) => ({ ...state, [endpoint.key]: 'Body content is required.' }));
      return;
    }

    setMessages((state) => ({ ...state, [endpoint.key]: `Publishing ${endpoint.heading.toLowerCase()}...` }));
    const result = await adminJson<{ ok: true }>(endpoint.path, {
      method: 'POST',
      body: JSON.stringify({
        title: current.title,
        body_md: current.body_md,
      }),
    });
    if (!result.ok) {
      setMessages((state) => ({ ...state, [endpoint.key]: `Error: ${result.error}` }));
      return;
    }
    setMessages((state) => ({ ...state, [endpoint.key]: `${endpoint.heading} published.` }));
  }

  function updateContent(endpoint: ManagedEndpoint, patch: Partial<ManagedContent>) {
    setContent((current) => ({
      ...current,
      [endpoint.key]: {
        ...current[endpoint.key],
        ...patch,
      },
    }));
  }

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <PageShell title="Member Operations" subtitle="Admin-managed member onboarding and card content">
      <AdminNav />
      <div className={styles.wrap}>
        {endpoints.map((endpoint) => {
          const current = content[endpoint.key];
          return (
            <section key={endpoint.key} className={styles.panel} aria-label={endpoint.heading}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.panelTitle}>{endpoint.heading}</div>
                  {current.updated_at ? <p className={styles.status}>Last updated: {current.updated_at}</p> : null}
                </div>
                <button className={styles.btn} type="button" onClick={() => void saveEndpoint(endpoint)}>
                  Publish
                </button>
              </div>
              {messages[endpoint.key] ? (
                messages[endpoint.key].startsWith('Error:') ? (
                  <AdminStatusText message={messages[endpoint.key]} className={styles.status} />
                ) : (
                  <p className={styles.status}>{messages[endpoint.key]}</p>
                )
              ) : null}
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Title</span>
                  <input
                    value={current.title}
                    onChange={(event) => updateContent(endpoint, { title: event.target.value })}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Body markdown</span>
                  <textarea
                    value={current.body_md}
                    rows={8}
                    onChange={(event) => updateContent(endpoint, { body_md: event.target.value })}
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
