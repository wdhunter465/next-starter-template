'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminStatusText from '@/components/admin/AdminStatusText';
import AdminTokenPanel from '@/components/admin/AdminTokenPanel';
import { adminJson, getStoredAdminToken } from '@/lib/adminClient';
import type { ClubStagingRotationItem } from './clubStagingSamples';

type StagingFilter = 'preview' | 'draft' | 'rejected' | 'approved' | 'scheduled';

type StagingInventoryRow = {
  id: number;
  title: string;
  text?: string | null;
  summary?: string | null;
  story_type?: string | null;
  allowed_sections?: string | null;
  priority?: number | null;
  canonical?: number | null;
  source_name?: string | null;
  credit_line?: string | null;
  rights_status?: string | null;
  privacy_flag?: string | null;
  reviewer?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  operational_state?: string | null;
  approved_by?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
};

type EditorialListResponse = {
  ok: true;
  inventory: StagingInventoryRow[];
};

const FILTERS: Array<{ value: StagingFilter; label: string }> = [
  { value: 'preview', label: 'Staged / reviewed' },
  { value: 'draft', label: 'Draft' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
];

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function metadataComplete(row: StagingInventoryRow): boolean {
  const rights = trim(row.rights_status);
  return Boolean(
    trim(row.source_name) && trim(row.credit_line) && rights && rights !== 'unknown' && trim(row.privacy_flag),
  );
}

function toRotationItem(row: StagingInventoryRow): ClubStagingRotationItem {
  return {
    id: `inventory-${row.id}`,
    title: row.title || 'Untitled staged item',
    headline: row.title || 'Untitled staged item',
    summary: trim(row.summary) || trim(row.text) || 'No summary provided.',
    credit: trim(row.credit_line) || undefined,
    sourceName: trim(row.source_name) || undefined,
  };
}

function operationalState(row: StagingInventoryRow): string {
  return trim(row.operational_state) || 'draft';
}

type ClubStagingReviewWorkspaceProps = {
  onPreviewItemsChange: (items: ClubStagingRotationItem[] | null) => void;
};

export default function ClubStagingReviewWorkspace({ onPreviewItemsChange }: ClubStagingReviewWorkspaceProps) {
  const [filter, setFilter] = useState<StagingFilter>('preview');
  const [rows, setRows] = useState<StagingInventoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('Save an admin API token to load staged inventory.');
  const [loading, setLoading] = useState(false);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const load = useCallback(async () => {
    if (!getStoredAdminToken()) {
      setRows([]);
      setSelectedId(null);
      onPreviewItemsChange(null);
      setStatus('Save an admin API token to load staged inventory.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setStatus('Loading staged inventory…');
    const result = await adminJson<EditorialListResponse>(
      `/api/admin/editorial/list?limit=100&submission_status=all&inventory_status=all&operational_state=${filter}`,
    );

    if (!result.ok) {
      setRows([]);
      setSelectedId(null);
      onPreviewItemsChange(null);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const inventory = Array.isArray(result.data?.inventory) ? result.data.inventory : [];
    setRows(inventory);
    setSelectedId((current) => {
      if (current && inventory.some((row) => row.id === current)) return current;
      return inventory[0]?.id ?? null;
    });
    setStatus(
      inventory.length
        ? `Loaded ${inventory.length} ${filter === 'preview' ? 'staged/reviewed' : filter} inventory row(s).`
        : 'No inventory rows in this filter. Fixture preview remains bound.',
    );
    setLoading(false);
  }, [filter, onPreviewItemsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onPreviewItemsChange(selected ? [toRotationItem(selected)] : null);
  }, [onPreviewItemsChange, selected]);

  useEffect(() => {
    setApprovedBy(trim(selected?.approved_by));
    setScheduledAt(trim(selected?.scheduled_at));
  }, [selected]);

  const runAction = useCallback(
    async (action: 'stage' | 'review' | 'reject' | 'approve' | 'schedule' | 'publish') => {
      if (!selected) {
        setStatus('Error: Select a staged inventory row first.');
        return;
      }
      if (!getStoredAdminToken()) {
        setStatus('Error: Save an admin API token before recording a review outcome.');
        return;
      }

      const payload: Record<string, unknown> = {
        id: selected.id,
        action,
        reviewer: reviewer.trim() || undefined,
        reason: reason.trim() || undefined,
        approved_by: approvedBy.trim() || undefined,
        scheduled_at: scheduledAt.trim() || undefined,
      };

      setStatus(`Recording ${action} for inventory ${selected.id}…`);
      const result = await adminJson<{ ok: true }>(`/api/admin/editorial/publish`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        setStatus(`Error: ${result.error}`);
        return;
      }

      setStatus(`Inventory ${selected.id} recorded as ${action}.`);
      setReason('');
      await load();
    },
    [approvedBy, load, reason, reviewer, scheduledAt, selected],
  );

  const state = selected ? operationalState(selected) : '';
  const canStage = state === 'draft' || state === 'reviewed';
  const canReview = state === 'staged';
  const canReject = state === 'draft' || state === 'staged' || state === 'reviewed';
  const canApprove = Boolean(selected) && state !== 'published' && state !== 'rejected';
  const canSchedule = state === 'approved' || state === 'scheduled';
  const canPublish =
    (state === 'approved' || state === 'scheduled') && Boolean(selected && metadataComplete(selected));
  const blocking = selected ? !metadataComplete(selected) : false;

  return (
    <section aria-label="Staged content review workspace" style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: 22, color: 'var(--lgfc-blue, #003366)' }}>
        Staged content review
      </h2>
      <p style={{ margin: '0 0 16px 0', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>
        List and review <code>content_inventory</code> rows. Editors may stage, mark reviewed, reject, approve,
        schedule, or publish. The preview frame below is not a public route; public helpers still read only published
        inventory.
      </p>

      <AdminTokenPanel onSaved={() => void load()} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0' }}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.18)',
              background: filter === item.value ? 'rgba(0, 51, 102, 0.12)' : 'white',
              fontWeight: 700,
            }}
          >
            {item.label}
          </button>
        ))}
        <button type="button" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      <AdminStatusText message={status} />

      {rows.length === 0 ? (
        <p style={{ marginTop: 12, color: 'rgba(0,0,0,0.65)' }}>
          No real staged rows in this filter. The production-like frame below keeps fixture samples and is not public.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Title</th>
                <th align="left">State</th>
                <th align="left">Source / credit</th>
                <th align="left">Rights / privacy</th>
                <th align="left">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = row.id === selectedId;
                return (
                  <tr key={row.id} style={{ background: active ? 'rgba(0, 51, 102, 0.08)' : undefined }}>
                    <td>
                      <button type="button" onClick={() => setSelectedId(row.id)}>
                        {row.title || `Inventory ${row.id}`}
                      </button>
                    </td>
                    <td>{operationalState(row)}</td>
                    <td>
                      {trim(row.source_name) || 'missing'} / {trim(row.credit_line) || 'missing'}
                    </td>
                    <td>
                      {trim(row.rights_status) || 'missing'} / {trim(row.privacy_flag) || 'missing'}
                    </td>
                    <td>{trim(row.allowed_sections) || 'unset'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.12)',
            background: 'white',
          }}
        >
          {blocking ? (
            <p role="status" style={{ color: '#7c2d12', fontWeight: 600 }}>
              Preview may render, but Mark reviewed is refused until source, credit, rights, and privacy are present.
            </p>
          ) : null}
          <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 12px', margin: 0 }}>
            <dt>Reviewer</dt>
            <dd style={{ margin: 0 }}>{trim(selected.reviewer) || 'unset'}</dd>
            <dt>Approved by</dt>
            <dd style={{ margin: 0 }}>{trim(selected.approved_by) || 'unset'}</dd>
            <dt>Priority / type</dt>
            <dd style={{ margin: 0 }}>
              {selected.priority ?? 'unset'} / {trim(selected.story_type) || 'unset'} /{' '}
              {Number(selected.canonical) === 1 ? 'canonical' : 'alternate'}
            </dd>
            <dt>Rejection reason</dt>
            <dd style={{ margin: 0 }}>{trim(selected.rejection_reason) || 'none'}</dd>
          </dl>

          <label style={{ display: 'block', marginTop: 12 }}>
            Reviewer name
            <input
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Approver name
            <input
              value={approvedBy}
              onChange={(event) => setApprovedBy(event.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Scheduled at (UTC)
            <input
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              placeholder="2026-08-16T12:00:00Z"
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Rejection reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px' }}
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button type="button" disabled={!canStage} onClick={() => void runAction('stage')}>
              Stage for preview
            </button>
            <button type="button" disabled={!canReview || blocking} onClick={() => void runAction('review')}>
              Mark reviewed
            </button>
            <button type="button" disabled={!canReject} onClick={() => void runAction('reject')}>
              Reject
            </button>
            <button type="button" disabled={!canApprove} onClick={() => void runAction('approve')}>
              Approve
            </button>
            <button type="button" disabled={!canSchedule} onClick={() => void runAction('schedule')}>
              Schedule
            </button>
            <button type="button" disabled={!canPublish} onClick={() => void runAction('publish')}>
              Publish
            </button>
          </div>
          <p style={{ margin: '12px 0 0 0', fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
            Publish still requires named human approval and attribution. Public helpers still read only published
            inventory. This preview frame is not a public route.
          </p>
        </div>
      ) : null}
    </section>
  );
}
