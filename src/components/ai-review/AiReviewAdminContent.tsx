'use client';

import type { CSSProperties } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AiReviewBanner from '@/components/ai-review/AiReviewBanner';
import { AI_REVIEW_ADMIN_MODULES } from '@/lib/aiReviewAccess';
import type { AiReviewSnapshot } from '@/components/ai-review/AiReviewGate';

const cardStyle: CSSProperties = {
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 12,
  padding: 16,
  background: 'var(--lgfc-bg-card)',
};

type Props = {
  snapshot: AiReviewSnapshot;
};

export default function AiReviewAdminContent({ snapshot }: Props) {
  return (
    <PageShell title="Admin Dashboard" subtitle="Read-only AI review inspection surface">
      <AiReviewBanner label="/admin" />
      <AdminNav />
      <section aria-label="Admin modules (read-only)" style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {snapshot.sections.map((module) => (
          <div key={module} style={cardStyle}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{module}</h2>
            <p style={{ margin: 0, color: '#4b5563' }}>
              Module visible for layout review. Publish, delete, export, and token controls are disabled in AI review mode.
            </p>
          </div>
        ))}
      </section>
      <p style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>
        Canonical admin modules: {AI_REVIEW_ADMIN_MODULES.join(', ')}.
      </p>
    </PageShell>
  );
}
