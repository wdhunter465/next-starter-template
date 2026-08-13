'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import AdminTokenPanel from '@/components/admin/AdminTokenPanel';
import { adminJson, getStoredAdminToken } from '@/lib/adminClient';

const ALLOWED_SECTION_OPTIONS = [
  { key: 'club_home', label: 'Club Home' },
  { key: 'homepage_spotlight', label: 'Homepage spotlight' },
  { key: 'homepage_discussions', label: 'Homepage discussions' },
  { key: 'homepage_milestones', label: 'Homepage milestones' },
  { key: 'library', label: 'Fan Club library' },
  { key: 'search', label: 'Public search' },
  { key: 'archive', label: 'Archive' },
  { key: 'related_content', label: 'Related content' },
] as const;

const CLUB_HOME_PIN_ZONES = [
  { key: 'lead-story', label: 'Lead story' },
  { key: 'story-rail', label: 'Story rail' },
  { key: 'archive-spotlight', label: 'Archive spotlight' },
] as const;

type MediaAssociation = {
  media_id: number;
  media_role: string;
  display_order: number;
  url?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  credit_line?: string | null;
};

type Submission = {
  submission_id: number;
  submitted_by: string;
  payload?: string | null;
  title: string;
  description: string;
  source_name?: string | null;
  source_url?: string | null;
  credit_line?: string | null;
  proposed_tag?: string | null;
  media_url?: string | null;
  media_reference?: string | null;
  status: SubmissionStatus;
  triage_flags?: string | null;
  duplicate_candidate?: string | null;
  review_notes?: string | null;
  decision_by?: string | null;
  decision_at?: string | null;
  rejected_at?: string | null;
  purge_eligible_at?: string | null;
  retention_reason?: string | null;
  created_at?: string | null;
};

type SubmissionStatus = 'pending' | 'triaged' | 'under_review' | 'approved' | 'rejected' | 'merged' | 'purged';
type SubmissionFilter = SubmissionStatus | 'all';
type ReviewAction = 'triage' | 'start_review' | 'approve' | 'merge' | 'reject' | 'purge';

const SUBMISSION_FILTERS: Array<{ value: SubmissionFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'merged', label: 'Merged' },
  { value: 'purged', label: 'Purged' },
  { value: 'all', label: 'All submissions' },
];

type InventoryFilter = 'all' | 'draft' | 'published' | 'archived';

const INVENTORY_FILTERS: Array<{ value: InventoryFilter; label: string }> = [
  { value: 'all', label: 'All inventory' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

type InventoryRecord = {
  id: number;
  tag: string;
  title: string;
  text: string;
  summary?: string | null;
  perspective_label?: string | null;
  story_type: string;
  allowed_sections: string;
  priority: number;
  canonical: number;
  source_name?: string | null;
  source_url?: string | null;
  credit_line: string;
  event_date?: string | null;
  event_year?: number | null;
  rotation_group?: string | null;
  feature_weight?: number | null;
  status: 'draft' | 'published' | 'archived';
  review_notes?: string | null;
  last_featured?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  media_associations?: MediaAssociation[];
};

type EditorialListResponse = {
  ok: true;
  submissions: Submission[];
  inventory: InventoryRecord[];
};

function fieldStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.16)',
    width: '100%',
  };
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.18)',
    background: disabled ? 'rgba(0,0,0,0.05)' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };
}

function defaultCreditFromSubmitter(value: string): string {
  return value.includes('<') ? value.split('<')[0].trim() : value;
}

function parseAllowedSectionsValue(raw: string | null | undefined): string[] {
  if (!raw) return ['library'];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed.map(String) : ['library'];
  } catch {
    return ['library'];
  }
}

function readAllowedSectionsFromForm(form: HTMLFormElement): string[] {
  const selected = ALLOWED_SECTION_OPTIONS.filter((option) => {
    const input = form.elements.namedItem(`section_${option.key}`) as HTMLInputElement | null;
    return Boolean(input?.checked);
  }).map((option) => option.key);
  return selected.length ? [...selected] : ['library'];
}

function readMetadataFromForm(form: HTMLFormElement) {
  const canonicalInput = form.elements.namedItem('canonical') as HTMLInputElement | null;
  const eventYearRaw = String(new FormData(form).get('event_year') || '').trim();
  return {
    tag: String(new FormData(form).get('tag') || '').trim(),
    title: String(new FormData(form).get('title') || '').trim(),
    text: String(new FormData(form).get('text') || '').trim(),
    summary: String(new FormData(form).get('summary') || '').trim(),
    perspective_label: String(new FormData(form).get('perspective_label') || '').trim(),
    story_type: String(new FormData(form).get('story_type') || 'brief'),
    source_name: String(new FormData(form).get('source_name') || '').trim(),
    source_url: String(new FormData(form).get('source_url') || '').trim(),
    credit_line: String(new FormData(form).get('credit_line') || '').trim(),
    allowed_sections: readAllowedSectionsFromForm(form),
    priority: Number(new FormData(form).get('priority') || 0),
    canonical: canonicalInput?.checked !== false,
    event_date: String(new FormData(form).get('event_date') || '').trim(),
    event_year: eventYearRaw ? Number(eventYearRaw) : null,
    rotation_group: String(new FormData(form).get('rotation_group') || '').trim(),
    feature_weight: Number(new FormData(form).get('feature_weight') || 1),
    review_notes: String(new FormData(form).get('review_notes') || '').trim(),
  };
}

function parseMediaAssociationsJson(raw: string): MediaAssociation[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed as MediaAssociation[];
}

type ClubHomeEditionInspect = {
  ok: true;
  active: { edition_id: number; activated_at: string; activated_by: string | null } | null;
  edition?: {
    id: number;
    status: string;
    created_at: string;
    created_by: string | null;
    completed_at: string | null;
  };
  placements?: Array<{
    zone_id: string;
    story_id: number | null;
    position: number;
    selection_mode: string;
  }>;
  message?: string;
};

export default function AdminEditorialArchivePage() {
  const [status, setStatus] = useState('Idle.');
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('pending');
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [tokenReady, setTokenReady] = useState(false);
  const [editionInspect, setEditionInspect] = useState<ClubHomeEditionInspect | null>(null);
  const [rollbackEditionId, setRollbackEditionId] = useState('');
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    if (!getStoredAdminToken()) {
      setSubmissions([]);
      setInventory([]);
      setStatus('Save an admin API token above to load editorial records.');
      setLoading(false);
      return;
    }

    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setStatus('Loading editorial queue…');

    const result = await adminJson<EditorialListResponse>(
      `/api/admin/editorial/list?limit=100&submission_status=${submissionFilter}&inventory_status=${inventoryFilter}`,
    );

    if (requestId !== loadRequestRef.current) {
      return;
    }

    if (!getStoredAdminToken()) {
      setLoading(false);
      return;
    }

    if (!result.ok) {
      setSubmissions([]);
      setInventory([]);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const nextSubmissions = Array.isArray(result.data?.submissions) ? result.data.submissions : [];
    const nextInventory = Array.isArray(result.data?.inventory) ? result.data.inventory : [];
    setSubmissions(nextSubmissions);
    setInventory(nextInventory);
    setStatus(
      `Loaded ${nextSubmissions.length} ${submissionFilter} submission(s) and ${nextInventory.length} ${inventoryFilter} archive record(s).`,
    );
    setLoading(false);

    const editionResult = await adminJson<ClubHomeEditionInspect>(
      '/api/admin/editorial/club-home-edition-regenerate',
    );
    if (requestId === loadRequestRef.current && editionResult.ok && editionResult.data) {
      setEditionInspect(editionResult.data);
      if (editionResult.data.active?.edition_id) {
        setRollbackEditionId(String(editionResult.data.active.edition_id));
      }
    }
  }, [submissionFilter, inventoryFilter]);

  const regenerateClubHomeEdition = useCallback(async () => {
    if (!getStoredAdminToken()) {
      setStatus('Error: Save an admin API token above before regenerating Club Home editions.');
      return;
    }
    setStatus('Regenerating Club Home edition…');
    const result = await adminJson<{
      ok: true;
      edition_id: number;
      previous_edition_id: number | null;
    }>('/api/admin/editorial/club-home-edition-regenerate', {
      method: 'POST',
      body: JSON.stringify({ created_by: 'admin-ui' }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    setStatus(
      `Activated Club Home edition ${result.data?.edition_id}` +
        (result.data?.previous_edition_id
          ? ` (previous ${result.data.previous_edition_id}).`
          : '.'),
    );
    await load();
  }, [load]);

  const rollbackClubHomeEdition = useCallback(async () => {
    if (!getStoredAdminToken()) {
      setStatus('Error: Save an admin API token above before rolling back Club Home editions.');
      return;
    }
    const editionId = Number(rollbackEditionId);
    if (!Number.isFinite(editionId) || editionId <= 0) {
      setStatus('Error: Enter a valid prior edition_id to roll back to.');
      return;
    }
    setStatus(`Rolling Club Home back to edition ${editionId}…`);
    const result = await adminJson<{
      ok: true;
      edition_id: number;
      previous_edition_id: number | null;
    }>('/api/admin/editorial/club-home-edition-rollback', {
      method: 'POST',
      body: JSON.stringify({ edition_id: editionId, activated_by: 'admin-ui' }),
    });
    if (!result.ok) {
      setStatus(`Error: ${result.error}`);
      return;
    }
    setStatus(`Club Home active edition is now ${result.data?.edition_id}.`);
    await load();
  }, [load, rollbackEditionId]);

  const saveInventory = useCallback(
    async (payload: Record<string, unknown>, label: string) => {
      if (!getStoredAdminToken()) {
        setStatus('Error: Save an admin API token above before saving inventory records.');
        return false;
      }

      setStatus(`${label}…`);
      const result = await adminJson<{ ok: true; id: number; action: string }>('/api/admin/editorial/inventory', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        setStatus(`Error: ${result.error}`);
        return false;
      }

      setStatus(`Inventory ${result.data?.action || 'saved'} for record ${result.data?.id ?? 'unknown'}.`);
      await load();
      return true;
    },
    [load],
  );

  const reviewSubmission = useCallback(
    async (
      submission: Submission,
      action: ReviewAction,
      form: HTMLFormElement,
      options: { retentionReason?: string } = {},
    ) => {
      if (!getStoredAdminToken()) {
        setStatus('Error: Save an admin API token above before reviewing submissions.');
        return;
      }

      const metadata = readMetadataFromForm(form);
      setStatus(`Recording ${action.replace('_', ' ')} for "${submission.title}"…`);

      let mediaAssociations: MediaAssociation[] = [];
      try {
        mediaAssociations = parseMediaAssociationsJson(String(new FormData(form).get('media_associations_json') || '[]'));
      } catch {
        setStatus('Error: media_associations_json must be valid JSON.');
        return;
      }

      const targetInventoryId = Number(new FormData(form).get('target_inventory_id') || 0);
      const retentionReason =
        String(new FormData(form).get('retention_reason') || '').trim() ||
        String(options.retentionReason || '').trim() ||
        '';
      const purgeEligibleAt = String(new FormData(form).get('purge_eligible_at') || '');

      const result = await adminJson<{ ok: true }>('/api/admin/editorial/review', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submission.submission_id,
          action,
          tag: metadata.tag || submission.proposed_tag || '',
          summary: metadata.summary,
          perspective_label: metadata.perspective_label,
          source_name: metadata.source_name || submission.source_name || 'Member submission',
          source_url: metadata.source_url || submission.source_url || '',
          credit_line:
            metadata.credit_line ||
            submission.credit_line ||
            defaultCreditFromSubmitter(submission.submitted_by) ||
            '',
          story_type: metadata.story_type,
          allowed_sections: metadata.allowed_sections,
          priority: metadata.priority,
          canonical: metadata.canonical,
          event_date: metadata.event_date,
          event_year: metadata.event_year,
          rotation_group: metadata.rotation_group,
          feature_weight: metadata.feature_weight,
          review_notes: metadata.review_notes,
          triage_flags: String(new FormData(form).get('triage_flags') || '[]'),
          duplicate_candidate: String(new FormData(form).get('duplicate_candidate') || ''),
          retention_reason: retentionReason,
          purge_eligible_at: retentionReason ? '' : purgeEligibleAt,
          target_inventory_id: Number.isFinite(targetInventoryId) ? targetInventoryId : 0,
          media_associations: mediaAssociations,
        }),
      });

      if (!result.ok) {
        setStatus(`Error: ${result.error}`);
        return;
      }

      setStatus(`Submission workflow action recorded: ${action.replace('_', ' ')}.`);
      await load();
    },
    [load],
  );

  const updatePublication = useCallback(
    async (id: number, nextStatus: InventoryRecord['status']) => {
      if (!getStoredAdminToken()) {
        setStatus('Error: Save an admin API token above before updating publication state.');
        return;
      }

      setStatus(`Updating archive record ${id} to ${nextStatus}…`);

      const result = await adminJson<{ ok: true }>('/api/admin/editorial/publish', {
        method: 'POST',
        body: JSON.stringify({ id, status: nextStatus }),
      });

      if (!result.ok) {
        setStatus(`Error: ${result.error}`);
        return;
      }

      setStatus(`Archive record ${id} is now ${nextStatus}.`);
      await load();
    },
    [load],
  );

  const updateClubHomePin = useCallback(
    async (payload: { action: 'pin' | 'unpin'; id?: number; zoneId: string }) => {
      if (!getStoredAdminToken()) {
        setStatus('Error: Save an admin API token above before updating Club Home pins.');
        return;
      }

      setStatus(
        payload.action === 'pin'
          ? `Pinning archive record ${payload.id} to ${payload.zoneId}…`
          : `Unpinning Club Home zone ${payload.zoneId}…`,
      );

      const result = await adminJson<{ ok: true; action: string; zone_id: string; story_id?: number }>(
        '/api/admin/editorial/publish',
        {
          method: 'POST',
          body: JSON.stringify({
            action: payload.action,
            id: payload.id,
            zone_id: payload.zoneId,
            pinned_by: 'admin-ui',
          }),
        },
      );

      if (!result.ok) {
        setStatus(`Error: ${result.error}`);
        return;
      }

      setStatus(
        payload.action === 'pin'
          ? `Pinned archive record ${payload.id} to ${payload.zoneId}.`
          : `Cleared Club Home pin for ${payload.zoneId}.`,
      );
      await load();
    },
    [load],
  );

  useEffect(() => {
    if (getStoredAdminToken()) {
      setTokenReady(true);
      void load();
    }
  }, [load]);

  return (
    <PageShell
      title="Editorial Archive"
      subtitle="Review member submissions and publish approved records through content_inventory."
    >
      <AdminNav />
      <AdminTokenPanel
        onSaved={() => {
          if (!getStoredAdminToken()) {
            loadRequestRef.current += 1;
            setTokenReady(false);
            setLoading(false);
            setSubmissions([]);
            setInventory([]);
            setStatus('Save an admin API token above to load editorial records.');
            return;
          }
          setTokenReady(true);
          void load();
        }}
      />

      {!tokenReady ? (
        <p style={{ marginTop: 16, opacity: 0.85 }}>Save an admin API token above to load editorial records.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !tokenReady}
            style={buttonStyle(loading || !tokenReady)}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Queue status
            <select
              value={submissionFilter}
              onChange={(event) => setSubmissionFilter(event.target.value as SubmissionFilter)}
              disabled={!tokenReady}
              style={{ ...fieldStyle(), width: 'auto' }}
            >
              {SUBMISSION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Inventory status
            <select
              value={inventoryFilter}
              onChange={(event) => setInventoryFilter(event.target.value as InventoryFilter)}
              disabled={!tokenReady}
              style={{ ...fieldStyle(), width: 'auto' }}
            >
              {INVENTORY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {status.startsWith('Error:') ? (
          <div style={{ opacity: 0.85 }}>
            <AdminStatusText message={status} />
          </div>
        ) : status ? (
          <p style={{ margin: 0, opacity: 0.85 }}>{status}</p>
        ) : null}

        <CreateStorySection onSave={saveInventory} actionsEnabled={tokenReady} />

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Club Home editions</h2>
          <p style={{ opacity: 0.8 }}>
            Member Club Home serves one explicit persisted edition. Regenerate creates a new immutable
            edition from current publication gates, fairness, and pins, then activates it. Rollback
            reactivates a prior ready edition without rewriting its placements. There is no automatic
            schedule.
          </p>
          <p style={{ opacity: 0.85, marginTop: 0 }}>
            {editionInspect?.active
              ? `Active edition ${editionInspect.active.edition_id} (activated ${editionInspect.active.activated_at}${
                  editionInspect.active.activated_by ? ` by ${editionInspect.active.activated_by}` : ''
                }). ${editionInspect.placements?.length ?? 0} persisted placement(s).`
              : editionInspect?.message ||
                'No active edition yet. Regenerate after pins/publication changes to publish Club Home content.'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void regenerateClubHomeEdition()}
              disabled={!tokenReady}
              style={buttonStyle(!tokenReady)}
            >
              Regenerate edition
            </button>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Rollback to edition
              <input
                value={rollbackEditionId}
                onChange={(event) => setRollbackEditionId(event.target.value)}
                disabled={!tokenReady}
                inputMode="numeric"
                style={{ ...fieldStyle(), width: 120 }}
              />
            </label>
            <button
              type="button"
              onClick={() => void rollbackClubHomeEdition()}
              disabled={!tokenReady}
              style={buttonStyle(!tokenReady)}
            >
              Rollback
            </button>
          </div>
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Submission Review Queue</h2>
          <p style={{ opacity: 0.8 }}>
            Member submissions stay here until a human triages, reviews, approves, merges, rejects, retains, or purges them.
          </p>

          {submissions.length === 0 ? (
            <p>No {submissionFilter} submissions.</p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {submissions.map((submission) => (
                <SubmissionCard
                  key={submission.submission_id}
                  submission={submission}
                  onReview={reviewSubmission}
                  actionsEnabled={tokenReady}
                />
              ))}
            </div>
          )}
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Content Inventory Publication State</h2>
          <p style={{ opacity: 0.8 }}>
            Only published records are eligible for member archive/library reads.
          </p>

          {inventory.length === 0 ? (
            <p>No content inventory records found.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {inventory.map((record) => (
                <InventoryRecordCard
                  key={record.id}
                  record={record}
                  onSave={saveInventory}
                  onPublish={updatePublication}
                  onClubHomePin={updateClubHomePin}
                  onStatus={setStatus}
                  actionsEnabled={tokenReady}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function SectionCheckboxes(props: { prefix: string; defaultSections?: string[] }) {
  const defaults = new Set(props.defaultSections || ['library']);
  return (
    <fieldset style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, padding: 12 }}>
      <legend>Allowed sections</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {ALLOWED_SECTION_OPTIONS.map((option) => (
          <label key={`${props.prefix}-${option.key}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              name={`section_${option.key}`}
              defaultChecked={defaults.has(option.key)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EditorialMetadataFields(props: {
  prefix: string;
  defaults?: Partial<InventoryRecord> & { text?: string };
  includeBody?: boolean;
}) {
  const defaults = props.defaults || {};
  const sections = parseAllowedSectionsValue(defaults.allowed_sections);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          Tag
          <input name="tag" defaultValue={defaults.tag || ''} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Title
          <input name="title" defaultValue={defaults.title || ''} style={fieldStyle()} required />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Source name
          <input name="source_name" defaultValue={defaults.source_name || 'Editorial draft'} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Source URL
          <input name="source_url" defaultValue={defaults.source_url || ''} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Credit line
          <input name="credit_line" defaultValue={defaults.credit_line || ''} style={fieldStyle()} required />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Story type
          <select name="story_type" defaultValue={defaults.story_type || 'brief'} style={fieldStyle()}>
            <option value="brief">brief</option>
            <option value="secondary">secondary</option>
            <option value="primary">primary</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Priority
          <input name="priority" type="number" defaultValue={defaults.priority ?? 0} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Event date
          <input name="event_date" defaultValue={defaults.event_date || ''} placeholder="YYYY-MM-DD" style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Event year
          <input name="event_year" type="number" defaultValue={defaults.event_year ?? ''} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Rotation group
          <input name="rotation_group" defaultValue={defaults.rotation_group || ''} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Feature weight
          <input
            name="feature_weight"
            type="number"
            min={1}
            defaultValue={defaults.feature_weight ?? 1}
            style={fieldStyle()}
          />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        Summary
        <textarea name="summary" rows={2} defaultValue={defaults.summary || ''} style={fieldStyle()} />
      </label>

      {props.includeBody !== false ? (
        <label style={{ display: 'grid', gap: 6 }}>
          Story text
          <textarea name="text" rows={5} defaultValue={defaults.text || ''} style={fieldStyle()} required />
        </label>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="canonical" defaultChecked={(defaults.canonical ?? 1) !== 0} />
          Canonical story
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Alternate perspective label
          <input
            name="perspective_label"
            defaultValue={defaults.perspective_label || ''}
            placeholder="Required when not canonical"
            style={fieldStyle()}
          />
        </label>
      </div>

      <SectionCheckboxes prefix={props.prefix} defaultSections={sections} />

      <label style={{ display: 'grid', gap: 6 }}>
        Review notes
        <textarea name="review_notes" rows={2} defaultValue={defaults.review_notes || ''} style={fieldStyle()} />
      </label>
    </>
  );
}

function CreateStorySection(props: {
  onSave: (payload: Record<string, unknown>, label: string) => Promise<boolean>;
  actionsEnabled: boolean;
}) {
  return (
    <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, padding: 14 }}>
      <h2 style={{ marginTop: 0 }}>Create Story Draft</h2>
      <p style={{ opacity: 0.8 }}>Create a content_inventory draft directly without a queue submission.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const metadata = readMetadataFromForm(form);
          void props.onSave({ ...metadata, submitted_by: 'admin-ui' }, 'Creating story draft');
        }}
        style={{ display: 'grid', gap: 10 }}
      >
        <EditorialMetadataFields prefix="create" includeBody />
        <button type="submit" disabled={!props.actionsEnabled} style={buttonStyle(!props.actionsEnabled)}>
          Create Draft Story
        </button>
      </form>
    </section>
  );
}

function MediaAssociationsEditor(props: {
  storyId: number;
  initialAssociations?: MediaAssociation[];
  onStatus: (message: string) => void;
  actionsEnabled: boolean;
}) {
  const initialJson = JSON.stringify(props.initialAssociations || [], null, 2);
  const [jsonValue, setJsonValue] = useState(initialJson);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setJsonValue(JSON.stringify(props.initialAssociations || [], null, 2));
  }, [props.initialAssociations, props.storyId]);

  const saveAssociations = async () => {
    if (!getStoredAdminToken()) {
      props.onStatus('Error: Save an admin API token above before saving media associations.');
      return;
    }

    let mediaAssociations: MediaAssociation[] = [];
    try {
      mediaAssociations = parseMediaAssociationsJson(jsonValue);
    } catch {
      props.onStatus('Error: Media association JSON must be valid.');
      return;
    }

    props.onStatus(`Saving media associations for story ${props.storyId}…`);
    const result = await adminJson<{ ok: true }>('/api/admin/editorial/media-associations', {
      method: 'POST',
      body: JSON.stringify({
        story_id: props.storyId,
        media_associations: mediaAssociations,
      }),
    });

    if (!result.ok) {
      props.onStatus(`Error: ${result.error}`);
      return;
    }

    props.onStatus(`Media associations saved for story ${props.storyId}.`);
  };

  const generateRenditions = async () => {
    if (!getStoredAdminToken()) {
      props.onStatus('Error: Save an admin API token above before generating renditions.');
      return;
    }

    let mediaAssociations: MediaAssociation[] = [];
    try {
      mediaAssociations = parseMediaAssociationsJson(jsonValue);
    } catch {
      props.onStatus('Error: Media association JSON must be valid.');
      return;
    }

    const withUrl = mediaAssociations.filter((row) => Number(row.media_id) > 0 && String(row.url || '').trim());
    if (!withUrl.length) {
      props.onStatus('Error: Associations need media_id and url before generating renditions. Save associations first, then reload.');
      return;
    }

    setGenerating(true);
    props.onStatus(`Generating renditions for story ${props.storyId}…`);

    try {
      const sizes = ['thumbnail', 'small', 'medium', 'large'] as const;
      const longEdge: Record<(typeof sizes)[number], number> = {
        thumbnail: 320,
        small: 640,
        medium: 1280,
        large: 1920,
      };

      const loadImage = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load image (CORS or network): ${url}`));
          img.src = url;
        });

      const renditions: Array<Record<string, unknown>> = [];

      for (const association of withUrl) {
        const mediaId = Number(association.media_id);
        const sourceUrl = String(association.url || '').trim();
        const img = await loadImage(sourceUrl);
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        if (!(sourceWidth > 0 && sourceHeight > 0)) {
          throw new Error(`Invalid source dimensions for media_id ${mediaId}`);
        }

        for (const size of sizes) {
          const contract = longEdge[size];
          const sourceLong = Math.max(sourceWidth, sourceHeight);
          const scale = sourceLong <= contract ? 1 : contract / sourceLong;
          const width = Math.max(1, Math.round(sourceWidth * scale));
          const height = Math.max(1, Math.round(sourceHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable in this browser.');
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const bytesBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          renditions.push({
            media_id: mediaId,
            size,
            source_width: sourceWidth,
            source_height: sourceHeight,
            width_px: width,
            height_px: height,
            content_type: 'image/jpeg',
            bytes_base64: bytesBase64,
          });
        }
      }

      const result = await adminJson<{ ok: true; renditions?: Array<{ status: string; size: string; media_id: number }> }>(
        '/api/admin/editorial/media-associations',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'persist_renditions',
            story_id: props.storyId,
            generated_by: 'admin-ui',
            renditions,
          }),
        },
      );

      if (!result.ok) {
        props.onStatus(`Error: ${result.error}`);
        return;
      }

      const failed = (result.data?.renditions || []).filter((row) => row.status === 'failed').length;
      const ready = (result.data?.renditions || []).filter((row) => row.status === 'ready').length;
      props.onStatus(
        `Renditions persisted for story ${props.storyId}: ${ready} ready, ${failed} failed (fail-closed; no full-resolution fallback).`,
      );
    } catch (err) {
      props.onStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        Media associations JSON
        <textarea
          rows={6}
          value={jsonValue}
          onChange={(event) => setJsonValue(event.target.value)}
          disabled={!props.actionsEnabled}
          style={fieldStyle()}
        />
      </label>
      <p style={{ opacity: 0.75, fontSize: 13, margin: 0 }}>
        Example: [{'{'}&quot;media_id&quot;: 12, &quot;media_role&quot;: &quot;primary_image&quot;, &quot;display_order&quot;: 0,
        &quot;alt_text&quot;: &quot;Caption&quot;{'}'}]
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void saveAssociations()}
          disabled={!props.actionsEnabled || generating}
          style={buttonStyle(!props.actionsEnabled || generating)}
        >
          Save Media Associations
        </button>
        <button
          type="button"
          onClick={() => void generateRenditions()}
          disabled={!props.actionsEnabled || generating}
          style={buttonStyle(!props.actionsEnabled || generating)}
        >
          {generating ? 'Generating Renditions…' : 'Generate Renditions'}
        </button>
      </div>
      <p style={{ opacity: 0.75, fontSize: 13, margin: 0 }}>
        Generate uses the browser Canvas to create thumbnail/small/medium/large JPEGs (long-edge 320/640/1280/1920, no
        upscale), then persists them to B2 + D1. Club Home uses medium only when ready; missing renditions omit the image.
      </p>
    </div>
  );
}

function InventoryRecordCard(props: {
  record: InventoryRecord;
  onSave: (payload: Record<string, unknown>, label: string) => Promise<boolean>;
  onPublish: (id: number, status: InventoryRecord['status']) => Promise<void>;
  onClubHomePin: (payload: { action: 'pin' | 'unpin'; id?: number; zoneId: string }) => Promise<void>;
  onStatus: (message: string) => void;
  actionsEnabled: boolean;
}) {
  const { record } = props;
  const [pinZone, setPinZone] = React.useState<string>(CLUB_HOME_PIN_ZONES[0].key);
  const allowsClubHome = parseAllowedSectionsValue(record.allowed_sections).includes('club_home');
  const canPin = props.actionsEnabled && record.status === 'published' && allowsClubHome;

  return (
    <article style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 12, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{record.title}</h3>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            tag: {record.tag} · status: {record.status} · canonical: {record.canonical ? 'yes' : 'no'} · credit:{' '}
            {record.credit_line}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void props.onPublish(record.id, 'published')}
            disabled={!props.actionsEnabled || record.status === 'published'}
            style={buttonStyle(!props.actionsEnabled || record.status === 'published')}
          >
            Publish
          </button>
          <button
            type="button"
            onClick={() => void props.onPublish(record.id, 'draft')}
            disabled={!props.actionsEnabled || record.status === 'draft'}
            style={buttonStyle(!props.actionsEnabled || record.status === 'draft')}
          >
            Return to Draft
          </button>
          <button
            type="button"
            onClick={() => void props.onPublish(record.id, 'archived')}
            disabled={!props.actionsEnabled || record.status === 'archived'}
            style={buttonStyle(!props.actionsEnabled || record.status === 'archived')}
          >
            Archive
          </button>
        </div>
      </div>

      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{record.text}</p>
      <div style={{ opacity: 0.75, fontSize: 13 }}>
        sections: {record.allowed_sections} · event: {record.event_date || '—'} / {record.event_year ?? '—'} · rotation:{' '}
        {record.rotation_group || '—'} · weight: {record.feature_weight ?? 1} · last featured:{' '}
        {record.last_featured || '—'} · created: {record.created_at || '—'} · updated: {record.updated_at || '—'} ·
        published: {record.published_at || '—'}
      </div>

      <div style={{ display: 'grid', gap: 8, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 10 }}>
        <h4 style={{ margin: 0 }}>Club Home pin</h4>
        <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
          Pin overrides rotation for one zone without changing publication status. Unpin restores ordinary selection.
          {!allowsClubHome ? ' Add club_home to allowed sections before pinning.' : null}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            Zone
            <select
              value={pinZone}
              onChange={(event) => setPinZone(event.target.value)}
              disabled={!canPin && !props.actionsEnabled}
              style={fieldStyle()}
            >
              {CLUB_HOME_PIN_ZONES.map((zone) => (
                <option key={zone.key} value={zone.key}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void props.onClubHomePin({ action: 'pin', id: record.id, zoneId: pinZone })}
            disabled={!canPin}
            style={buttonStyle(!canPin)}
          >
            Pin to zone
          </button>
          <button
            type="button"
            onClick={() => void props.onClubHomePin({ action: 'unpin', zoneId: pinZone })}
            disabled={!props.actionsEnabled}
            style={buttonStyle(!props.actionsEnabled)}
          >
            Unpin zone
          </button>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const metadata = readMetadataFromForm(event.currentTarget);
          void props.onSave({ id: record.id, ...metadata }, `Saving inventory record ${record.id}`);
        }}
        style={{ display: 'grid', gap: 10 }}
      >
        <h4 style={{ margin: 0 }}>Edit Metadata</h4>
        <EditorialMetadataFields prefix={`inventory-${record.id}`} defaults={record} />
        <button type="submit" disabled={!props.actionsEnabled} style={buttonStyle(!props.actionsEnabled)}>
          Save Metadata
        </button>
      </form>

      <MediaAssociationsEditor
        storyId={record.id}
        initialAssociations={record.media_associations}
        onStatus={props.onStatus}
        actionsEnabled={props.actionsEnabled}
      />
    </article>
  );
}

function SubmissionCard(props: {
  submission: Submission;
  onReview: (
    submission: Submission,
    action: ReviewAction,
    form: HTMLFormElement,
    options?: { retentionReason?: string },
  ) => Promise<void>;
  actionsEnabled: boolean;
}) {
  const { submission, onReview } = props;
  const canPurge = submission.status === 'rejected' && !String(submission.retention_reason || '').trim();
  const retainedDefault =
    String(submission.retention_reason || '').trim() || 'Retained for editorial follow-up.';

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}
    >
      <div>
        <h3 style={{ margin: 0 }}>{submission.title}</h3>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          submitted by {submission.submitted_by} · status: {submission.status} · {submission.created_at || 'date unavailable'}
          {submission.decision_by ? ` · decided by ${submission.decision_by}` : ''}
          {submission.decision_at ? ` · decided at ${submission.decision_at}` : ''}
          {submission.rejected_at ? ` · rejected at ${submission.rejected_at}` : ''}
        </div>
      </div>

      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{submission.description}</p>
      <div style={{ opacity: 0.78, fontSize: 13 }}>
        source: {submission.source_name || '—'} · credit: {submission.credit_line || '—'} · media:{' '}
        {submission.media_reference || submission.media_url || '—'}
      </div>

      <EditorialMetadataFields
        prefix={`submission-${submission.submission_id}`}
        defaults={{
          tag: submission.proposed_tag || '',
          title: submission.title,
          text: submission.description,
          source_name: submission.source_name || 'Member submission',
          source_url: submission.source_url || '',
          credit_line: submission.credit_line || defaultCreditFromSubmitter(submission.submitted_by),
          review_notes: submission.review_notes || '',
          allowed_sections: '["library"]',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          Duplicate candidate / merge target note
          <input name="duplicate_candidate" defaultValue={submission.duplicate_candidate || ''} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Target inventory ID for merge
          <input name="target_inventory_id" type="number" min={1} style={fieldStyle()} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          Purge eligible at
          <input name="purge_eligible_at" placeholder="YYYY-MM-DD or ISO timestamp" style={fieldStyle()} />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        Objective triage flags JSON
        <textarea name="triage_flags" rows={2} defaultValue={submission.triage_flags || '[]'} style={fieldStyle()} />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        Retention reason
        <textarea name="retention_reason" rows={2} defaultValue={submission.retention_reason || ''} style={fieldStyle()} />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        Media associations JSON (approve)
        <textarea
          name="media_associations_json"
          rows={4}
          defaultValue="[]"
          style={fieldStyle()}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={(event) => void onReview(submission, 'triage', event.currentTarget.form as HTMLFormElement)}
          disabled={!props.actionsEnabled}
          style={buttonStyle(!props.actionsEnabled)}
        >
          Mark Triaged
        </button>
        <button
          type="button"
          onClick={(event) => void onReview(submission, 'start_review', event.currentTarget.form as HTMLFormElement)}
          disabled={!props.actionsEnabled}
          style={buttonStyle(!props.actionsEnabled)}
        >
          Start Review
        </button>
        <button
          type="button"
          onClick={(event) => void onReview(submission, 'approve', event.currentTarget.form as HTMLFormElement)}
          disabled={!props.actionsEnabled}
          style={buttonStyle(!props.actionsEnabled)}
        >
          Approve as Draft
        </button>
        <button
          type="button"
          onClick={(event) => void onReview(submission, 'merge', event.currentTarget.form as HTMLFormElement)}
          disabled={!props.actionsEnabled}
          style={buttonStyle(!props.actionsEnabled)}
        >
          Mark Merged
        </button>
        <button
          type="button"
          onClick={(event) => void onReview(submission, 'reject', event.currentTarget.form as HTMLFormElement)}
          disabled={!props.actionsEnabled}
          style={buttonStyle(!props.actionsEnabled)}
        >
          Reject + Purge Eligible
        </button>
        <button
          type="button"
          onClick={(event) =>
            void onReview(submission, 'reject', event.currentTarget.form as HTMLFormElement, {
              retentionReason: retainedDefault,
            })
          }
          disabled={!props.actionsEnabled}
          style={buttonStyle(!props.actionsEnabled)}
        >
          Retain Rejected
        </button>
        <button
          type="button"
          onClick={(event) => void onReview(submission, 'purge', event.currentTarget.form as HTMLFormElement)}
          disabled={!props.actionsEnabled || !canPurge}
          style={buttonStyle(!props.actionsEnabled || !canPurge)}
        >
          Mark Purged
        </button>
      </div>
    </form>
  );
}
