'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import AdminStatusText from '@/components/admin/AdminStatusText';
import CampaignSpotlightCard from '@/components/home/CampaignSpotlightCard';
import { adminJson } from '@/lib/adminClient';
import {
  CAMPAIGN_SPOTLIGHT_KEY,
  CAMPAIGN_SPOTLIGHT_PAGE,
  CAMPAIGN_SPOTLIGHT_SECTION,
  CAMPAIGN_SPOTLIGHT_TITLE,
  defaultCampaignSpotlightConfig,
  buildPersistedCampaignConfig,
  parseCampaignSpotlightConfig,
  serializeCampaignSpotlightConfig,
  snapshotLeaderboardFromFundraiser,
  type CampaignSpotlightConfig,
  validateCampaignSpotlightConfig,
} from '@/lib/campaignSpotlight';
import { safeGetFundraiserTeams, type FundraiserTeam } from '@/lib/fundraiser';

type Block = {
  key: string;
  body_md: string;
  published_body_md: string | null;
  version: number;
  status: 'draft' | 'published';
  updated_at: string;
  published_at: string | null;
  updated_by: string;
};

type CmsListResponse = {
  ok: true;
  blocks: Block[];
};

type CmsMutationResponse = {
  ok: true;
  version: number;
};

function fieldStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.16)',
    width: '100%',
  };
}

function buttonStyle(primary = false, disabled = false): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 10,
    border: primary ? '1px solid #0033cc' : '1px solid rgba(0,0,0,0.18)',
    background: disabled ? 'rgba(0,0,0,0.05)' : primary ? '#0033cc' : 'white',
    color: primary && !disabled ? '#fff' : '#111',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };
}

export default function FundraiserPreviewPage() {
  const [status, setStatus] = useState('Loading campaign spotlight…');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [block, setBlock] = useState<Block | null>(null);
  const [form, setForm] = useState<CampaignSpotlightConfig>(defaultCampaignSpotlightConfig);
  const [fundraiserTeams, setFundraiserTeams] = useState<FundraiserTeam[]>([]);
  const [fundraiserError, setFundraiserError] = useState('');
  const loadRequestRef = useRef(0);

  const refreshFundraiserData = useCallback(() => {
    const result = safeGetFundraiserTeams();
    if (!result.ok) {
      setFundraiserTeams([]);
      setFundraiserError(result.error);
      return;
    }

    setFundraiserTeams(result.teams);
    setFundraiserError('');
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setStatus('Loading campaign spotlight block…');

    const result = await adminJson<CmsListResponse>(
      `/api/admin/cms/list?page=${encodeURIComponent(CAMPAIGN_SPOTLIGHT_PAGE)}`,
    );

    if (requestId !== loadRequestRef.current) {
      return;
    }

    if (!result.ok) {
      setBlock(null);
      setForm(defaultCampaignSpotlightConfig);
      setStatus(`Error: ${result.error}`);
      setLoading(false);
      return;
    }

    const blocks = Array.isArray(result.data?.blocks) ? result.data.blocks : [];
    const found = blocks.find((item) => item.key === CAMPAIGN_SPOTLIGHT_KEY);

    if (!found) {
      setBlock(null);
      setForm(defaultCampaignSpotlightConfig);
      setStatus(
        'No campaign spotlight block exists yet. Starter config loaded locally. Save Draft to create it.',
      );
      setLoading(false);
      return;
    }

    setBlock(found);
    setForm(parseCampaignSpotlightConfig(found.body_md) || defaultCampaignSpotlightConfig);
    setStatus('Campaign spotlight block loaded.');
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshFundraiserData();
    void load();
  }, [load, refreshFundraiserData]);

  const validationErrors = useMemo(() => validateCampaignSpotlightConfig(form), [form]);
  const publishedConfig = useMemo(
    () => parseCampaignSpotlightConfig(block?.published_body_md || null),
    [block?.published_body_md],
  );
  const publishedErrors = useMemo(
    () => validateCampaignSpotlightConfig(publishedConfig),
    [publishedConfig],
  );
  const actionBusy = loading || saving || publishing;

  const updateField = useCallback(
    <K extends keyof CampaignSpotlightConfig>(key: K, value: CampaignSpotlightConfig[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const syncLeaderboardFromFundraiser = useCallback(() => {
    const result = safeGetFundraiserTeams();
    if (!result.ok) {
      setFundraiserError(result.error);
      setStatus(`Fundraiser data error: ${result.error}`);
      return;
    }

    setFundraiserTeams(result.teams);
    setFundraiserError('');
    setForm((current) => ({
      ...current,
      leaderboard: snapshotLeaderboardFromFundraiser(result.teams),
    }));
    setStatus(`Leaderboard snapshot refreshed from ${result.teams.length} fundraiser team record(s).`);
  }, []);

  const saveDraft = useCallback(async () => {
    let persistedConfig: CampaignSpotlightConfig;
    try {
      persistedConfig = buildPersistedCampaignConfig(form);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Draft not saved. Fundraiser data error: ${message}`);
      return;
    }

    const persistedErrors = validateCampaignSpotlightConfig(persistedConfig);
    if (persistedErrors.length > 0) {
      setStatus('Draft not saved. Fix campaign validation errors first.');
      return;
    }

    if (fundraiserError) {
      setStatus('Draft not saved. Fix fundraiser source data before publishing campaign content.');
      return;
    }

    setSaving(true);
    setStatus('Saving draft…');

    const result = await adminJson<CmsMutationResponse>('/api/admin/cms/save', {
      method: 'POST',
      body: JSON.stringify({
        key: CAMPAIGN_SPOTLIGHT_KEY,
        page: CAMPAIGN_SPOTLIGHT_PAGE,
        section: CAMPAIGN_SPOTLIGHT_SECTION,
        title: CAMPAIGN_SPOTLIGHT_TITLE,
        body_md: serializeCampaignSpotlightConfig(persistedConfig),
        updated_by: 'admin-fundraiser-preview',
      }),
    });

    if (!result.ok) {
      setStatus(`Draft save error: ${result.error}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    await load();
    setStatus(`Draft saved. Version ${result.data?.version ?? 'unknown'}.`);
  }, [form, fundraiserError, load]);

  const publish = useCallback(async () => {
    let persistedConfig: CampaignSpotlightConfig;
    try {
      persistedConfig = buildPersistedCampaignConfig(form);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Publish blocked. Fundraiser data error: ${message}`);
      return;
    }

    const persistedErrors = validateCampaignSpotlightConfig(persistedConfig);
    if (persistedErrors.length > 0) {
      setStatus('Publish blocked. Fix campaign validation errors first.');
      return;
    }

    if (fundraiserError) {
      setStatus('Publish blocked. Fundraiser source data must be valid before public exposure.');
      return;
    }

    if (block?.body_md !== serializeCampaignSpotlightConfig(persistedConfig)) {
      setStatus('Publish blocked. Save Draft first so the published version matches the current preview.');
      return;
    }

    setPublishing(true);
    setStatus('Publishing…');

    const result = await adminJson<CmsMutationResponse>('/api/admin/cms/publish', {
      method: 'POST',
      body: JSON.stringify({ key: CAMPAIGN_SPOTLIGHT_KEY, updated_by: 'admin-fundraiser-preview' }),
    });

    if (!result.ok) {
      setStatus(`Publish error: ${result.error}`);
      setPublishing(false);
      return;
    }

    setPublishing(false);
    await load();
    setStatus(`Published successfully. Version ${result.data?.version ?? 'unknown'}.`);
  }, [block?.body_md, form, fundraiserError, load]);

  return (
    <PageShell
      title="Fundraiser Preview"
      subtitle="Validate campaign spotlight content and fundraiser leaderboard data before enabling public homepage exposure."
    >
      <AdminNav />
      <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 16, padding: 18, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Campaign Spotlight Control</h2>
              <p style={{ margin: '8px 0 0 0', opacity: 0.85 }}>
                Homepage placement stays between the Hero Banner and Weekly Matchup. When disabled, the homepage omits this section entirely.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void load()}
                disabled={actionBusy}
                style={buttonStyle(false, actionBusy)}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={actionBusy}
                style={buttonStyle(false, actionBusy)}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={actionBusy}
                style={buttonStyle(true, actionBusy)}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>

          <AdminStatusText message={status} />
          <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
            <div>
              <strong>CMS key:</strong> <code>{CAMPAIGN_SPOTLIGHT_KEY}</code>
            </div>
            <div>
              <strong>Enable flow:</strong> validate fundraiser data → Save Draft → Publish.
            </div>
            <div>
              <strong>Archive flow:</strong> set Enabled off → Save Draft → Publish.
            </div>
          </div>
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 16, padding: 18, background: '#fff' }}>
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Fundraiser Source Data</h2>
          <p style={{ opacity: 0.85 }}>
            Leaderboard snapshots for enabled campaigns are derived from <code>data/fundraiser.json</code>. Invalid source data blocks save/publish.
          </p>

          {fundraiserError ? (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: '1px solid #e7b8b8', background: '#fff7f7' }}>
              <strong>Fundraiser validation failed:</strong> {fundraiserError}
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: '1px solid #cde4cf', background: '#f6fff6' }}>
              <strong>Fundraiser source is valid.</strong> {fundraiserTeams.length} team record(s) loaded.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={refreshFundraiserData} style={buttonStyle()}>
              Revalidate fundraiser data
            </button>
            <button
              type="button"
              onClick={syncLeaderboardFromFundraiser}
              disabled={Boolean(fundraiserError) || actionBusy}
              style={buttonStyle(false, Boolean(fundraiserError) || actionBusy)}
            >
              Sync leaderboard snapshot
            </button>
          </div>

          {fundraiserTeams.length > 0 ? (
            <ul style={{ marginTop: 14, paddingLeft: 18 }}>
              {fundraiserTeams.map((team) => (
                <li key={team.teamId}>
                  {team.teamName} — ${team.totalAmount} from {team.donorCount} donor(s) — {team.points} points
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 16, padding: 18, background: '#fff' }}>
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Current Block Status</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <strong>Draft version:</strong> {block?.version ?? '(new)'}
            </div>
            <div>
              <strong>Draft status:</strong> {block?.status ?? 'not created'}
            </div>
            <div>
              <strong>Updated at:</strong> {block?.updated_at ?? '(not yet saved)'}
            </div>
            <div>
              <strong>Published at:</strong> {block?.published_at ?? '(never)'}
            </div>
          </div>
          {publishedConfig && publishedErrors.length === 0 ? (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#184d12', fontWeight: 700 }}>
              Published snapshot is valid and currently{' '}
              {publishedConfig.enabled
                ? 'eligible to render on the homepage.'
                : 'hidden because Enabled is off.'}
            </p>
          ) : (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#7a4b00', fontWeight: 700 }}>
              No valid published snapshot is currently available for the homepage.
            </p>
          )}
        </section>

        <section style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 16, padding: 18, background: '#fff' }}>
          <h2 style={{ marginTop: 0, fontSize: 22 }}>Editor</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Eyebrow</span>
              <input value={form.eyebrow} onChange={(e) => updateField('eyebrow', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Badge</span>
              <input value={form.badge} onChange={(e) => updateField('badge', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Title</span>
              <input value={form.title} onChange={(e) => updateField('title', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Deadline label</span>
              <input value={form.deadlineLabel} onChange={(e) => updateField('deadlineLabel', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Primary CTA label</span>
              <input value={form.primaryCtaLabel} onChange={(e) => updateField('primaryCtaLabel', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Primary CTA href</span>
              <input value={form.primaryCtaHref} onChange={(e) => updateField('primaryCtaHref', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Secondary CTA label</span>
              <input value={form.secondaryCtaLabel} onChange={(e) => updateField('secondaryCtaLabel', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Secondary CTA href</span>
              <input value={form.secondaryCtaHref} onChange={(e) => updateField('secondaryCtaHref', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Progress label</span>
              <input value={form.progressLabel} onChange={(e) => updateField('progressLabel', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Goal amount</span>
              <input value={form.goalAmount} onChange={(e) => updateField('goalAmount', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Raised amount</span>
              <input value={form.raisedAmount} onChange={(e) => updateField('raisedAmount', e.target.value)} style={fieldStyle()} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Supporter count</span>
              <input value={form.supporterCount} onChange={(e) => updateField('supporterCount', e.target.value)} style={fieldStyle()} />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
            <span>Description</span>
            <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={4} style={fieldStyle()} />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
            <span>Note</span>
            <textarea value={form.note} onChange={(e) => updateField('note', e.target.value)} rows={3} style={fieldStyle()} />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
            <span>Archive label</span>
            <textarea value={form.archiveLabel} onChange={(e) => updateField('archiveLabel', e.target.value)} rows={2} style={fieldStyle()} />
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, fontWeight: 700 }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => updateField('enabled', e.target.checked)} />
            Enabled for homepage rendering after publish
          </label>

          {validationErrors.length > 0 ? (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid #e7b8b8', background: '#fff7f7' }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Campaign validation errors</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid #cde4cf', background: '#f6fff6', fontWeight: 700 }}>
              Draft is valid for preview and publish.
            </div>
          )}
        </section>

        <section style={{ display: 'grid', gap: 16 }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 22 }}>Admin Preview</h2>
            <CampaignSpotlightCard config={form} previewLabel="Local Draft Preview" />
          </div>

          {publishedConfig && publishedErrors.length === 0 ? (
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 22 }}>Published Snapshot</h2>
              <CampaignSpotlightCard
                config={publishedConfig}
                previewLabel={publishedConfig.enabled ? 'Homepage Eligible' : 'Published Hidden State'}
              />
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
