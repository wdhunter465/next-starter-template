import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildReconcileFindingsBody,
  OPS_RECONCILE_FINDINGS_MARKER,
  reportReconcileFindings,
} from '../scripts/ci/ops_reconcile_findings.mjs';

describe('OPS B2/D1 reconcile findings body (#3714 phase 2b)', () => {
  it('includes the media_assets/content_items retired count alongside photos counts', () => {
    const body = buildReconcileFindingsBody({
      workflowName: 'OPS — B2 D1 Daily Sync',
      runUrl: 'https://github.test/actions/1',
      commitSha: 'abc123',
      retiredCount: '3',
      repairedMatchups: '1',
      mediaRetiredCount: '2',
    });

    expect(body).toContain(OPS_RECONCILE_FINDINGS_MARKER);
    expect(body).toContain('Soft-retired photo rows: 3');
    expect(body).toContain('Active matchups repaired (votes cleared on pair change): 1');
    expect(body).toContain('Soft-retired content_items rows (media_assets missing from B2): 2');
  });

  it('defaults the media_assets/content_items count to 0 when omitted', () => {
    const body = buildReconcileFindingsBody({ retiredCount: '1' });
    expect(body).toContain('Soft-retired content_items rows (media_assets missing from B2): 0');
  });
});

describe('reportReconcileFindings hasFindings gate (#3714 phase 2b)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats a media-only finding (no stale photos, no matchup repairs) as actionable', async () => {
    const fetchMock = vi
      .fn()
      // GET /issues?state=open -- no existing findings issue.
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      // POST /issues -- creates the new findings issue.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ html_url: 'https://github.test/issues/9', number: 9 }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await reportReconcileFindings({
      token: 'test-token',
      repository: 'wdhunter465/next-starter-template',
      retiredCount: '0',
      repairedMatchups: '0',
      mediaRetiredCount: '4',
    });

    // The count-based hasFindings computation (not an explicit override) is
    // what must treat a media-only finding as actionable -- proving the
    // media count alone is enough to trigger the issue upsert.
    expect(outcome.action).toBe('created');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('skips when retired, repaired, and media counts are all zero', async () => {
    const outcome = await reportReconcileFindings({
      token: 'test-token',
      repository: 'wdhunter465/next-starter-template',
      retiredCount: '0',
      repairedMatchups: '0',
      mediaRetiredCount: '0',
    });
    expect(outcome).toEqual({ action: 'skipped', issue: null, reason: 'no_actionable_findings' });
  });
});
