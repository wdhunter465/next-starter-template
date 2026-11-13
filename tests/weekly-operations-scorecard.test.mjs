import { describe, expect, it } from 'vitest';
import { appendToDay, buildEvidenceRecord } from '../scripts/ops/social-evidence.mjs';
import {
  BACKUP_WORKFLOW,
  UPTIME_WORKFLOW,
  buildScorecard,
  collectFacts,
  collectSocialFacts,
  ragBackupAge,
  ragFailedJobs,
  ragFirstPass,
  ragQueue,
  ragUptime,
  renderScorecard,
  socialRows,
  socialWeek,
  weekWindow,
  windowDates,
} from '../scripts/ops/weekly-operations-scorecard.mjs';

const NOW = new Date('2026-10-14T13:00:00Z');
const WINDOW = weekWindow(NOW);

function jsonResponse(status, body, link) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    headers: { get: (name) => (name === 'link' ? link || '' : '') },
  };
}

function quietFacts() {
  return {
    window: WINDOW,
    uptimeRuns: [],
    failedJobCount: 0,
    mergedPulls: [],
    closedOutages: [],
    openOutages: [],
    openedOpsIssues: [],
    openOpsIssues: [],
    backupAgeHours: null,
    priorityOneProjects: [],
  };
}

describe('scorecard RAG', () => {
  it('bands uptime, jobs, first-pass, queue and backup age', () => {
    expect(ragUptime(99.5)).toBe('green');
    expect(ragUptime(98)).toBe('amber');
    expect(ragUptime(97.9)).toBe('red');
    expect(ragUptime(null)).toBe('red');
    expect(ragFailedJobs(0)).toBe('green');
    expect(ragFailedJobs(1)).toBe('amber');
    expect(ragFailedJobs(2)).toBe('red');
    expect(ragFirstPass(90)).toBe('green');
    expect(ragFirstPass(75)).toBe('amber');
    expect(ragFirstPass(74.9)).toBe('red');
    expect(ragFirstPass(null)).toBe('green');
    expect(ragQueue(0, 0)).toBe('green');
    expect(ragQueue(3, 24)).toBe('amber');
    expect(ragQueue(1, 25)).toBe('red');
    expect(ragQueue(4, 1)).toBe('red');
    expect(ragBackupAge(29.9)).toBe('green');
    expect(ragBackupAge(48)).toBe('amber');
    expect(ragBackupAge(48.1)).toBe('red');
    expect(ragBackupAge(null)).toBe('red');
  });
});

describe('buildScorecard', () => {
  it('renders a quiet week with empty data', () => {
    const report = renderScorecard(buildScorecard(quietFacts(), NOW));
    expect(report).toContain(`- Week: ${WINDOW.start} to ${WINDOW.end}`);
    expect(report).toContain('| Website uptime (www and apex) | no samples | red |');
    expect(report).toContain('| Failed scheduled jobs now | 0 | green |');
    expect(report).toContain('| PRs merged, and CI first-pass rate | no merges | green |');
    expect(report).toContain('| Time to restore after an outage | none | green |');
    expect(report).toContain('| Ops issues opened | 0 (monitoring 0, person 0) | — |');
    expect(report).toContain('| Operations queue | 0 open | green |');
    expect(report).toContain('| Latest D1 backup age | no successful backup | red |');
    expect(report).toContain('| Open Priority 1 project blockers | none | — |');
  });

  it('computes each row from the recorded sources', () => {
    const card = buildScorecard({
      window: WINDOW,
      uptimeRuns: [{ conclusion: 'success' }, { conclusion: 'success' }, { conclusion: 'failure' }, { conclusion: 'cancelled' }],
      failedJobCount: 1,
      mergedPulls: [{ number: 1, firstPass: true }, { number: 2, firstPass: false }],
      closedOutages: [{ createdAt: '2026-10-13T00:00:00Z', closedAt: '2026-10-13T20:00:00Z' }],
      openOutages: [{ createdAt: '2026-10-14T01:00:00Z' }],
      openedOpsIssues: [{ monitored: true }, { monitored: false }, { monitored: false }],
      openOpsIssues: [{ createdAt: '2026-10-13T13:00:00Z' }, { createdAt: '2026-10-14T01:00:00Z' }],
      backupAgeHours: 20,
      priorityOneProjects: [{ number: 2093, title: 'Launch calendar' }],
    }, NOW);
    const report = renderScorecard(card);
    expect(report).toContain('66.7% of 3 probe runs');
    expect(report).toContain('| Failed scheduled jobs now | 1 | amber |');
    expect(report).toContain('2 merged, 50.0% first-pass');
    expect(report).toContain('| Ops issues opened | 3 (monitoring 1, person 2) | — |');
    expect(report).toContain('2 open, oldest 24.0 h');
    expect(report).toContain('| Latest D1 backup age | 20.0 h | green |');
    expect(report).toContain('#2093 Launch calendar');
  });
});

describe('collectFacts', () => {
  it('reads recorded API pages, including a second uptime page and a failed check run', async () => {
    const second = `https://api.github.com/repos/o/r/actions/workflows/${UPTIME_WORKFLOW}/runs?page=2`;
    const fetchImpl = async (url) => {
      if (url.startsWith(`https://api.github.com/repos/o/r/actions/workflows/${UPTIME_WORKFLOW}/runs`) && !url.includes('page=2')) {
        return jsonResponse(200, { workflow_runs: [{ conclusion: 'success' }] }, `<${second}>; rel="next"`);
      }
      if (url === second) return jsonResponse(200, { workflow_runs: [{ conclusion: 'failure' }] });
      if (url.includes(`/actions/workflows/${BACKUP_WORKFLOW}`) && !url.includes('/runs')) {
        return jsonResponse(200, { state: 'active' });
      }
      if (url.includes(`/actions/workflows/${BACKUP_WORKFLOW}/runs`)) {
        return jsonResponse(200, { workflow_runs: [{ updated_at: '2026-10-14T00:00:00Z' }] });
      }
      if (url.includes('/pulls?')) {
        return jsonResponse(200, [{
          number: 10,
          merged_at: '2026-10-13T12:00:00Z',
          updated_at: '2026-10-13T12:00:00Z',
          merge_commit_sha: 'abc',
        }]);
      }
      if (url.includes('/commits/abc/check-runs')) {
        return jsonResponse(200, { check_runs: [{ conclusion: 'failure' }] });
      }
      if (url.includes('/search/issues')) {
        const query = decodeURIComponent(url);
        if (query.includes('label:team:operations created:')) {
          return jsonResponse(200, { items: [{ number: 1, labels: [{ name: 'ops-runtime-failure' }] }, { number: 2, labels: [] }] });
        }
        if (query.includes('is:open label:team:operations')) {
          return jsonResponse(200, { items: [] });
        }
        if (query.includes('label:pmo:priority:1')) {
          return jsonResponse(200, { items: [{ number: 9, title: 'Blocker', pull_request: undefined }] });
        }
        return jsonResponse(200, { items: [] });
      }
      return jsonResponse(404, {});
    };

    const facts = await collectFacts(
      { repository: 'o/r', headers: {}, branch: 'main', fetchImpl },
      NOW,
      { jobCheck: async () => ({ results: [{ ok: true }, { ok: false }] }) },
    );
    expect(facts.uptimeRuns).toHaveLength(2);
    expect(facts.failedJobCount).toBe(1);
    expect(facts.mergedPulls).toEqual([{ number: 10, firstPass: false }]);
    expect(facts.openedOpsIssues).toEqual([{ monitored: true }, { monitored: false }]);
    expect(facts.backupAgeHours).toBeCloseTo(13, 5);
    expect(facts.priorityOneProjects).toEqual([{ number: 9, title: 'Blocker' }]);
    expect(buildScorecard(facts, NOW).rows.find((row) => row.name.startsWith('PRs'))).toMatchObject({ rag: 'red' });
  });
});

describe('social posting counts by platform (#5198)', () => {
  const SNOW = new Date('2026-11-16T13:00:00Z');
  const SWINDOW = weekWindow(SNOW);
  const photo = { image_url: 'https://example.test/i', image_sha256: 'a'.repeat(64), image_bytes: 10, width: 100, height: 120 };
  const verified = { on: '2026-11-16', by: 'test', method: 'test' };
  const post = (id, platforms, publish_at) => ({ id, publish_at, text: `Text ${id}`, photo_id: 1, alt_text: 'A photo', platforms, status: 'approved' });
  const queue = {
    lateness_hours: 4,
    posts: [
      post('2026-11-10-daily', ['x', 'facebook', 'instagram', 'pinterest'], '2026-11-10T10:00:00-05:00'),
      post('2026-11-11-daily', ['x', 'facebook', 'pinterest'], '2026-11-11T10:00:00-05:00'),
      post('2026-11-12-daily', ['x', 'facebook', 'pinterest'], '2026-11-12T10:00:00-05:00'),
      post('2026-11-16-daily', ['x', 'facebook', 'pinterest'], '2026-11-16T10:00:00-05:00'),
    ],
  };
  const okAttempt = { at_utc: '2026-11-10T15:04:00Z', by: 'job', outcome: 'ok', detail: 'sent' };
  const handedOff = { at_utc: '2026-11-10T15:11:00Z', by: 'job', outcome: 'handed_off', detail: 'Issue' };
  const errAttempt = { at_utc: '2026-11-11T15:04:00Z', by: 'job', outcome: 'error', detail: 'Buffer 500' };
  const rec = (p, platform, status, extra = {}) =>
    buildEvidenceRecord({
      post: queue.posts.find((q) => q.id === p),
      platform,
      status,
      attempts: [status === 'confirmed' ? okAttempt : status === 'failed' ? errAttempt : handedOff],
      platformRecord: status === 'confirmed' ? { post_id: 'id1', url: null, created_at_utc: '2026-11-10T15:04:00Z' } : null,
      photo,
      verified,
      ...extra,
    });
  const day = (...records) => records.reduce((doc, r) => appendToDay(doc, r), null);
  const days = [
    day(rec('2026-11-10-daily', 'x', 'confirmed'), rec('2026-11-10-daily', 'facebook', 'confirmed'), rec('2026-11-10-daily', 'instagram', 'confirmed'), rec('2026-11-10-daily', 'pinterest', 'confirmed')),
    day(
      rec('2026-11-11-daily', 'x', 'failed'),
      rec('2026-11-11-daily', 'x', 'confirmed', { version: 2, attempts: [errAttempt, okAttempt] }),
      rec('2026-11-11-daily', 'facebook', 'missing'),
    ),
    day(rec('2026-11-12-daily', 'x', 'confirmed'), rec('2026-11-12-daily', 'pinterest', 'confirmed')),
  ];
  const handoffs = [{ platform: 'pinterest', post_id: '2026-11-11-daily' }];

  it('counts every planned post once, uses the latest version, and never counts a hand-off as a success', () => {
    const week = socialWeek({ queue, days, handoffs }, SWINDOW, SNOW);
    expect(week.x).toMatchObject({ planned: 3, confirmed: 3, failed: 0, successRate: 100 });
    expect(week.facebook).toMatchObject({ planned: 3, confirmed: 1, missing: 1, not_logged: 1 });
    expect(week.pinterest).toMatchObject({ planned: 3, confirmed: 2, handed_off: 1 });
    expect(week.pinterest.successRate).toBeCloseTo(66.7, 1);
    expect(week.instagram).toMatchObject({ planned: 1, confirmed: 1, not_eligible: 2 });
  });

  it('does not count a post that is not due yet, or one outside the window', () => {
    const later = new Date('2026-11-16T13:00:00Z');
    const week = socialWeek({ queue: { ...queue, posts: [...queue.posts, post('p-new', ['x'], '2026-11-16T07:30:00-05:00')] }, days: [], handoffs: [] }, SWINDOW, later);
    expect(week.x.pending).toBe(1);
    expect(week.x.planned).toBe(4);
    expect(week.x.not_logged).toBe(3);
  });

  it('writes one row per platform with the counts and a red, amber or green status', () => {
    const rows = socialRows({ queue, days, handoffs }, SWINDOW, SNOW);
    expect(rows.map((r) => r.name)).toEqual(['Social posts: X', 'Social posts: Facebook Page', 'Social posts: Instagram', 'Social posts: Pinterest']);
    expect(rows[0]).toMatchObject({ value: '3 of 3 confirmed', rag: 'green' });
    expect(rows[1]).toMatchObject({ value: '1 of 3 confirmed, 1 missing, 1 not logged', rag: 'red' });
    expect(rows[2]).toMatchObject({ value: '1 of 1 confirmed, 2 left off (photo shape)', rag: 'green' });
    expect(rows[3]).toMatchObject({ value: '2 of 3 confirmed, 1 handed off, not verified', rag: 'amber' });
  });

  it('shows an unavailable row when the facts could not be read, and nothing when there are none', () => {
    expect(socialRows({ error: 'GET failed: 500' }, SWINDOW, SNOW)).toEqual([{ name: 'Social posts', value: 'unavailable (GET failed: 500)', rag: '—' }]);
    expect(socialRows(undefined, SWINDOW, SNOW)).toEqual([]);
  });

  it('lists the New York dates a window touches', () => {
    expect(windowDates({ start: '2026-11-09T13:00:00Z', end: '2026-11-12T13:00:00Z' })).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  });

  it('collects the queue, the audit day files and the hand-off Issues, and survives a missing audit branch', async () => {
    const dayDoc = days[0];
    const fetchImpl = async (url) => {
      const u = decodeURIComponent(url);
      const text = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => body, json: async () => JSON.parse(body), headers: { get: () => '' } });
      if (u.includes('/contents/data/social-post-queue.json')) return text(200, JSON.stringify(queue));
      if (u.includes('/contents/data/social-audit/2026/11/2026-11-10.json') && u.includes('ref=social-audit')) return text(200, JSON.stringify(dayDoc));
      if (u.includes('/contents/')) return text(404, '');
      if (u.includes('/search/issues')) {
        return jsonResponse(200, { items: [{ number: 5183, title: 'https://www.lougehrigfanclub.com/api/social/image/2026-11-10-daily', labels: [{ name: 'social-post' }, { name: 'social:pinterest' }] }] });
      }
      return jsonResponse(404, {});
    };
    const facts = await collectSocialFacts({ repository: 'o/r', headers: {}, branch: 'main', fetchImpl }, SWINDOW);
    expect(facts.queue.posts).toHaveLength(4);
    expect(facts.days).toHaveLength(1);
    expect(facts.handoffs).toEqual([{ platform: 'pinterest', post_id: '2026-11-10-daily' }]);

    const down = async () => ({ status: 404, ok: false, text: async () => '', json: async () => ({}), headers: { get: () => '' } });
    await expect(collectSocialFacts({ repository: 'o/r', headers: {}, branch: 'main', fetchImpl: down }, SWINDOW)).rejects.toThrow(/queue was not found/);
  });
});
