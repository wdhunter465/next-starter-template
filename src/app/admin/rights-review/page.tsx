'use client';

// #3827: curator-facing queue for rights_evidence rows still on `hold`
// (#3552 phase 5 / #3748's per-photo permit/deny/hold triage). Resolving an
// item records a NEW rights_evidence row via the existing
// POST /api/admin/content-pipeline/rights-evidence -- the held row is never
// mutated, matching the table's append-only convention.

import React, { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import { adminJson, isRecord } from '@/lib/adminClient';

const CHANNEL_OPTIONS = [
  { value: '', label: '(no channel-specific conclusion)' },
  { value: 'website', label: 'Website' },
  { value: 'social_media', label: 'Social media' },
  { value: 'newsletter_email', label: 'Newsletter / email' },
  { value: 'fundraiser_campaign', label: 'Fundraiser campaign' },
  { value: 'internal_archive_only', label: 'Internal / archive only' },
] as const;

const CONCLUSION_OPTIONS = [
  { value: '', label: '(none -- triage only)' },
  { value: 'public_domain_confirmed', label: 'Public domain confirmed' },
  { value: 'permission_granted', label: 'Permission granted' },
  { value: 'lgfc_member_owned_item_photo', label: 'LGFC/member-owned item photo' },
] as const;

type LatestEvidence = {
  id: number;
  evidence_type: string;
  evidence_text: string | null;
  evidence_url: string | null;
  reviewer: string | null;
  conclusion: string | null;
  conclusion_rationale: string | null;
  channel: string | null;
  recorded_at: string;
  usage_decision: string;
};

type HoldQueueItem = {
  content_item_id: number;
  candidate_id: string;
  title: string;
  source_name: string | null;
  source_url: string | null;
  source_domain: string | null;
  media_asset_id: string | null;
  content_type: string | null;
  latest_evidence: LatestEvidence;
};

type QueueResponse = { ok: true; count: number; items: unknown[] };

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeItem(raw: unknown): HoldQueueItem | null {
  if (!isRecord(raw)) return null;
  const contentItemId = raw.content_item_id;
  const candidateId = asString(raw.candidate_id);
  const title = asString(raw.title);
  const latest = raw.latest_evidence;
  if (typeof contentItemId !== 'number' || !candidateId || !title || !isRecord(latest)) return null;

  const evidenceId = latest.id;
  const evidenceType = asString(latest.evidence_type);
  const recordedAt = asString(latest.recorded_at);
  const usageDecision = asString(latest.usage_decision);
  if (typeof evidenceId !== 'number' || !evidenceType || !recordedAt || !usageDecision) return null;

  return {
    content_item_id: contentItemId,
    candidate_id: candidateId,
    title,
    source_name: asString(raw.source_name),
    source_url: asString(raw.source_url),
    source_domain: asString(raw.source_domain),
    media_asset_id: asString(raw.media_asset_id),
    content_type: asString(raw.content_type),
    latest_evidence: {
      id: evidenceId,
      evidence_type: evidenceType,
      evidence_text: asString(latest.evidence_text),
      evidence_url: asString(latest.evidence_url),
      reviewer: asString(latest.reviewer),
      conclusion: asString(latest.conclusion),
      conclusion_rationale: asString(latest.conclusion_rationale),
      channel: asString(latest.channel),
      recorded_at: recordedAt,
      usage_decision: usageDecision,
    },
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 14,
    padding: 16,
    display: 'grid',
    gap: 10,
  };
}

function fieldStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.16)',
    width: '100%',
  };
}

function buttonStyle(disabled = false, tone: 'permit' | 'deny' | 'default' = 'default'): React.CSSProperties {
  const background =
    tone === 'permit' ? 'rgba(0,140,60,0.08)' : tone === 'deny' ? 'rgba(180,30,30,0.08)' : 'white';
  return {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.18)',
    background: disabled ? 'rgba(0,0,0,0.05)' : background,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };
}

function ResolveForm(props: { item: HoldQueueItem; onResolved: () => void }) {
  const { item, onResolved } = props;
  const [reviewer, setReviewer] = useState('');
  const [rationale, setRationale] = useState('');
  const [channel, setChannel] = useState<string>('');
  const [conclusion, setConclusion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resolve = useCallback(
    async (usageDecision: 'permit' | 'deny') => {
      if (!reviewer.trim()) {
        setError('Reviewer name is required.');
        return;
      }
      if (!rationale.trim()) {
        setError('Rationale is required.');
        return;
      }
      if (conclusion && !channel) {
        setError('A channel is required when recording a conclusion.');
        return;
      }

      setSubmitting(true);
      setError('');

      const result = await adminJson<{ ok: true }>('/api/admin/content-pipeline/rights-evidence', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id: item.candidate_id,
          evidence_type: 'other',
          reviewer: reviewer.trim(),
          conclusion_rationale: rationale.trim(),
          usage_decision: usageDecision,
          ...(conclusion ? { conclusion, channel } : {}),
        }),
      });

      setSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onResolved();
    },
    [channel, conclusion, item.candidate_id, onResolved, rationale, reviewer],
  );

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Reviewer</span>
          <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} style={fieldStyle()} placeholder="Your name" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Channel (optional -- required with a conclusion)</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={fieldStyle()}>
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Legal conclusion (optional -- full determination, not just triage)</span>
        <select value={conclusion} onChange={(e) => setConclusion(e.target.value)} style={fieldStyle()}>
          {CONCLUSION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Rationale</span>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={3}
          style={fieldStyle()}
          placeholder="Why this item is permitted or denied for use."
        />
      </label>

      {error ? <AdminStatusText message={`Error: ${error}`} /> : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" disabled={submitting} style={buttonStyle(submitting, 'permit')} onClick={() => void resolve('permit')}>
          {submitting ? 'Saving…' : 'Permit'}
        </button>
        <button type="button" disabled={submitting} style={buttonStyle(submitting, 'deny')} onClick={() => void resolve('deny')}>
          {submitting ? 'Saving…' : 'Deny'}
        </button>
      </div>
    </div>
  );
}

function QueueCard(props: { item: HoldQueueItem; onResolved: () => void }) {
  const { item, onResolved } = props;
  const evidence = item.latest_evidence;

  return (
    <div style={cardStyle()}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{item.title}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
          {item.candidate_id} · {item.content_type ?? 'unknown type'}
        </div>
      </div>

      <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
        {item.source_name ? <div>Source: {item.source_name}</div> : null}
        {item.source_url ? (
          <div>
            Source URL:{' '}
            <a href={item.source_url} target="_blank" rel="noreferrer">
              {item.source_url}
            </a>
          </div>
        ) : null}
        {item.media_asset_id ? <div>Media asset: {item.media_asset_id}</div> : null}
      </div>

      <div
        style={{
          background: 'rgba(0,0,0,0.03)',
          borderRadius: 10,
          padding: 10,
          fontSize: 13,
          display: 'grid',
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 700 }}>Latest evidence ({evidence.evidence_type})</div>
        {evidence.evidence_text ? <div>{evidence.evidence_text}</div> : null}
        {evidence.evidence_url ? (
          <div>
            <a href={evidence.evidence_url} target="_blank" rel="noreferrer">
              {evidence.evidence_url}
            </a>
          </div>
        ) : null}
        <div style={{ opacity: 0.75 }}>Recorded: {new Date(evidence.recorded_at).toLocaleString()}</div>
      </div>

      <ResolveForm item={item} onResolved={onResolved} />
    </div>
  );
}

export default function AdminRightsReviewPage() {
  const [status, setStatus] = useState('Idle.');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HoldQueueItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus('Loading hold queue…');

    const result = await adminJson<QueueResponse>('/api/admin/content-pipeline/rights-evidence/queue?limit=100');

    if (!result.ok) {
      setItems([]);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const raw = Array.isArray(result.data?.items) ? result.data.items : [];
    const normalized = raw.map(normalizeItem).filter((x): x is HoldQueueItem => x !== null);
    setItems(normalized);
    setStatus(normalized.length ? `${normalized.length} item(s) on hold.` : 'Hold queue is empty.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="Rights Review" subtitle="Curator queue for content-pipeline rights_evidence rows on hold (#3551/#3827).">
      <AdminNav />
      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.15)',
              background: loading ? 'rgba(0,0,0,0.05)' : 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <AdminStatusText message={status} />
        </div>

        {items.length === 0 && !loading ? (
          <p style={{ opacity: 0.8 }}>Nothing on hold right now.</p>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {items.map((item) => (
              <QueueCard key={`${item.content_item_id}:${item.latest_evidence.id}`} item={item} onResolved={() => void load()} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
