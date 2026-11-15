import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  RERUN_ONCE_WORKFLOWS,
  handleWorkflowFailure,
  renderComment,
  renderIssueBody,
  shouldRerunOnce,
} from '../scripts/ci/open_workflow_failure_issue.mjs';

// #4681, decision 2: a failed run of a read-only monitor is re-run once before an Issue opens.

const REPO = 'wdhunter465/next-starter-template';
const MONITOR = 'OPS — Production Edge Health';

const run = (over = {}) => ({
  id: '900',
  name: MONITOR,
  url: 'https://github.com/wdhunter465/next-starter-template/actions/runs/900',
  conclusion: 'failure',
  event: 'schedule',
  sha: 'abc1234',
  attempt: 1,
  ...over,
});

function makeApi({ openIssues = [], rerunFails = false } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'POST' && path.endsWith('/rerun-failed-jobs')) {
      if (rerunFails) throw new Error('GitHub API POST rerun failed: 403');
      return null;
    }
    if (method === 'GET' && path.includes('/actions/runs/')) return { jobs: [] };
    if (method === 'GET' && path.includes('/issues?')) return openIssues;
    if (method === 'POST' && path.endsWith('/issues')) return { number: 7001 };
    if (method === 'POST' && path.includes('/comments')) return {};
    throw new Error(`unexpected call ${method} ${path}`);
  };
  return { api, calls };
}

const wrote = (calls) => calls.filter((c) => c.method === 'POST');

describe('re-run once before an Issue opens (#4681)', () => {
  it('re-runs the failed jobs of a first-attempt scheduled monitor and opens no Issue', async () => {
    const { api, calls } = makeApi();
    const result = await handleWorkflowFailure({ run: run(), api, repo: REPO });
    expect(result).toEqual({ action: 'rerun_requested', attempt: 1 });
    expect(wrote(calls)).toEqual([{ method: 'POST', path: `/repos/${REPO}/actions/runs/900/rerun-failed-jobs`, body: undefined }]);
  });

  it('opens the Issue when the re-run fails too (attempt 2), and says it was re-run', async () => {
    const { api, calls } = makeApi();
    const result = await handleWorkflowFailure({ run: run({ attempt: 2 }), api, repo: REPO });
    expect(result).toEqual({ action: 'created', number: 7001 });
    expect(calls.some((c) => c.path.endsWith('/rerun-failed-jobs'))).toBe(false);
    const issue = calls.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
    expect(issue.body.body).toContain('re-run once and failed again');
  });

  it('opens the Issue right away, and says why, when the re-run cannot be requested', async () => {
    const { api, calls } = makeApi({ rerunFails: true });
    const result = await handleWorkflowFailure({ run: run(), api, repo: REPO });
    expect(result).toEqual({ action: 'created', number: 7001 });
    const issue = calls.find((c) => c.method === 'POST' && c.path.endsWith('/issues'));
    expect(issue.body.body).toMatch(/could not be requested \(GitHub API POST rerun failed: 403\)/);
  });

  it('adds the re-run note to a comment on an already-open Issue', async () => {
    const marker = `<!-- ops-exception-workflow:${MONITOR} -->`;
    const { api, calls } = makeApi({ openIssues: [{ number: 55, body: marker }] });
    const result = await handleWorkflowFailure({ run: run({ attempt: 2 }), api, repo: REPO });
    expect(result).toEqual({ action: 'commented', number: 55 });
    expect(calls.find((c) => c.path.endsWith('/comments')).body.body).toContain('re-run once and failed again');
  });

  it('never re-runs a workflow that writes, even on a first-attempt scheduled failure', async () => {
    for (const name of [
      'OPS — D1 Backup Scheduled Daily Export (#3268 Phase 3)',
      'OPS — D1 Backup Scheduled Quarterly Restore Drill (#3268 Phase 4)',
      'OPS — Scheduled Content Publish (#4253)',
      'OPS — Snapshot Backup',
      'D1 Migrations',
      'OPS — B2 D1 Daily Sync',
      'OPS — Post-Merge Self-Healing',
      'Gehrig Content Discovery (#3551 / #3552 / #2270 perpetual collection)',
      'GATE — Quality Checks',
    ]) {
      const { api, calls } = makeApi();
      const result = await handleWorkflowFailure({ run: run({ name }), api, repo: REPO });
      expect(result.action, name).toBe('created');
      expect(calls.some((c) => c.path.endsWith('/rerun-failed-jobs')), name).toBe(false);
    }
  });

  it('only re-runs scheduled runs', async () => {
    for (const event of ['push', 'workflow_dispatch', 'workflow_run', undefined]) {
      const { api, calls } = makeApi();
      await handleWorkflowFailure({ run: run({ event }), api, repo: REPO });
      expect(calls.some((c) => c.path.endsWith('/rerun-failed-jobs')), String(event)).toBe(false);
    }
  });

  it('does not re-run when the attempt is unknown or not the first', () => {
    expect(shouldRerunOnce(run({ attempt: undefined }))).toBe(false);
    expect(shouldRerunOnce(run({ attempt: 0 }))).toBe(false);
    expect(shouldRerunOnce(run({ attempt: 2 }))).toBe(false);
    expect(shouldRerunOnce(run({ attempt: 3 }))).toBe(false);
    expect(shouldRerunOnce(run())).toBe(true);
  });

  it('a successful run is still skipped', async () => {
    const { api, calls } = makeApi();
    expect(await handleWorkflowFailure({ run: run({ conclusion: 'success' }), api, repo: REPO })).toEqual({ action: 'skipped', reason: 'not_failure' });
    expect(calls).toEqual([]);
  });

  it('leaves an Issue body unchanged when no re-run is involved', () => {
    const plain = renderIssueBody(run({ name: 'D1 Migrations', attempt: 1 }), []);
    expect(plain).not.toMatch(/Automatic re-run/);
    expect(renderComment(run({ name: 'D1 Migrations', attempt: 1 }), [])).not.toMatch(/Automatic re-run/);
  });

  it('every workflow allowed to re-run is on the watch list, and none of them writes', () => {
    const watcher = fs.readFileSync('.github/workflows/ops-workflow-failure-exception-issues.yml', 'utf8');
    for (const name of RERUN_ONCE_WORKFLOWS) expect(watcher, name).toContain(`"${name}"`);
    expect(RERUN_ONCE_WORKFLOWS).toHaveLength(6);
  });
});

describe('the watcher workflow (#4681)', () => {
  const text = fs.readFileSync('.github/workflows/ops-workflow-failure-exception-issues.yml', 'utf8');

  it('has actions: write for the re-run and nothing wider', () => {
    const block = text.match(/^permissions:\n((?:  .+\n)+)/m)[1];
    const entries = block.trim().split('\n').map((l) => l.trim().split(/\s+#/)[0]).sort();
    expect(entries).toEqual(['actions: write', 'contents: read', 'issues: write']);
  });

  it('passes the run attempt to the script', () => {
    expect(text).toMatch(/RUN_ATTEMPT: \$\{\{ github\.event\.workflow_run\.run_attempt \}\}/);
  });

  it('still runs only for failures on the default branch', () => {
    expect(text).toMatch(/github\.event\.workflow_run\.conclusion == 'failure'/);
    expect(text).toMatch(/head_branch == github\.event\.repository\.default_branch/);
  });
});
