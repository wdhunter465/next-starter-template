import { describe, expect, it } from 'vitest';
import {
  BACKUP_WORKFLOW,
  UPTIME_WORKFLOW,
  buildScorecard,
  collectFacts,
  ragBackupAge,
  ragFailedJobs,
  ragFirstPass,
  ragQueue,
  ragUptime,
  renderScorecard,
  weekWindow,
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
