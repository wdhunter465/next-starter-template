import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALERT_ONLY,
  FAILURE_LIMIT,
  SELF,
  consecutiveFailures,
  findRecord,
  isScheduled,
  listScheduledWorkflows,
  markerFor,
  lastRunMarker,
  sweep,
} from '../scripts/ops/halt-repeated-failures.mjs';

const run = (id, conclusion, event = 'schedule') => ({
  id,
  conclusion,
  event,
  created_at: `2026-10-15T0${id % 10}:00:00Z`,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
});

// A fake GitHub: workflows by file, runs newest first, existing Issues.
function fakeApi({ workflows, runs, issues = [] }) {
  const calls = [];
  const state = { issues: [...issues], nextIssue: Math.max(899, ...issues.map((i) => i.number)) + 1 };
  async function api(method, route, body) {
    calls.push({ method, route, body });
    let match;
    if (method === 'GET' && (match = route.match(/\/actions\/workflows\/([^/?]+)\/runs/))) {
      return { workflow_runs: runs[match[1]] || [] };
    }
    if (method === 'GET' && (match = route.match(/\/actions\/workflows\/([^/?]+)$/))) {
      if (!workflows[match[1]]) throw new Error('404');
      return workflows[match[1]];
    }
    if (method === 'GET' && route.includes('/issues?')) {
      const page = Number((route.match(/[?&]page=(\d+)/) || [])[1] || 1);
      return page === 1 ? state.issues : [];
    }
    if (method === 'POST' && route.endsWith('/issues')) {
      const issue = { number: state.nextIssue++, state: 'open', ...body };
      state.issues.unshift(issue);
      return issue;
    }
    if (method === 'PATCH') {
      const number = Number(route.split('/').pop());
      Object.assign(state.issues.find((i) => i.number === number), body);
      return {};
    }
    if (method === 'POST') return {};
    if (method === 'PUT') {
      if (workflows.__disableFails) throw new Error('403');
      return null;
    }
    throw new Error(`unexpected ${method} ${route}`);
  }
  return { api, calls, state };
}

const active = (name) => ({ state: 'active', name });

describe('consecutiveFailures', () => {
  it('counts only the newest unbroken failures', () => {
    expect(consecutiveFailures([run(5, 'failure'), run(4, 'failure'), run(3, 'success'), run(2, 'failure')])).toHaveLength(2);
  });
  it('stops counting at the limit', () => {
    expect(consecutiveFailures([run(6, 'failure'), run(5, 'failure'), run(4, 'failure'), run(3, 'failure')])).toHaveLength(FAILURE_LIMIT);
  });
  it('ignores cancelled and skipped runs without breaking the chain', () => {
    const runs = [run(6, 'failure'), run(5, 'cancelled'), run(4, 'failure'), run(3, 'skipped'), run(2, 'timed_out')];
    expect(consecutiveFailures(runs)).toHaveLength(3);
  });
  it('treats a success as the end of the chain, including a manual dispatch success', () => {
    expect(consecutiveFailures([run(4, 'success', 'workflow_dispatch'), run(3, 'failure'), run(2, 'failure'), run(1, 'failure')])).toHaveLength(0);
  });
});

describe('isScheduled / listScheduledWorkflows', () => {
  it('detects a schedule trigger and skips gates', () => {
    expect(isScheduled('name: x\non:\n  schedule:\n    - cron: "0 * * * *"\n  workflow_dispatch: {}\n')).toBe(true);
    expect(isScheduled('name: x\non:\n  pull_request:\n  push:\n')).toBe(false);
    expect(isScheduled('name: x\non:\n  workflow_run:\n    workflows: ["a"]\n')).toBe(false);
  });
  it('never lists the sweeper itself', () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-halt-'));
    try {
      fs.writeFileSync(path.join(dir, SELF), 'on:\n  schedule:\n    - cron: "0 * * * *"\n');
      fs.writeFileSync(path.join(dir, 'a.yml'), 'on:\n  schedule:\n    - cron: "0 * * * *"\n');
      fs.writeFileSync(path.join(dir, 'b.yml'), 'on:\n  pull_request:\n');
      expect(listScheduledWorkflows(dir)).toEqual(['a.yml']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it('the real workflow directory lists the sweeper as excluded and every alert-only file as existing', () => {
    const dir = path.join(process.cwd(), '.github', 'workflows');
    expect(fs.existsSync(path.join(dir, SELF))).toBe(true);
    expect(listScheduledWorkflows(dir)).not.toContain(SELF);
    for (const file of ALERT_ONLY) expect(fs.existsSync(path.join(dir, file)), file).toBe(true);
  });
  it('the sweeper requests only the permissions it needs', () => {
    const text = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', SELF), 'utf8');
    expect(text).toMatch(/actions: write/);
    expect(text).toMatch(/issues: write/);
    expect(text).toMatch(/contents: read/);
    expect(text).not.toMatch(/secrets\./);
  });
});

describe('sweep', () => {
  const base = { repo: 'o/r', branch: 'main' };

  it('does nothing after only two failures', async () => {
    const { api, calls } = fakeApi({ workflows: { 'a.yml': active('A') }, runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'success')] } });
    const out = await sweep({ ...base, files: ['a.yml'], api });
    expect(out).toEqual([{ file: 'a.yml', action: 'ok' }]);
    expect(calls.some((c) => c.method === 'POST' || c.method === 'PUT')).toBe(false);
  });

  it('opens one Operations Issue and disables the workflow after three failures, in that order', async () => {
    const { api, calls, state } = fakeApi({ workflows: { 'a.yml': active('A') }, runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    const out = await sweep({ ...base, files: ['a.yml'], api });
    expect(out).toEqual([{ file: 'a.yml', action: 'halted', number: 900 }]);
    const writes = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.route.split('/').slice(-1)[0]}`);
    expect(writes).toEqual(['POST issues', 'PUT disable']);
    expect(state.issues[0].labels).toEqual(['team:operations', 'ops-exception', 'ops-halted']);
    expect(state.issues[0].body).toContain(markerFor('a.yml'));
    expect(state.issues[0].body).toContain(lastRunMarker(3));
    expect(state.issues[0].body).toContain('actions/runs/3');
    expect(state.issues[0].body).toContain('Enable workflow');
  });

  it('does not halt again on the next sweep while the same failures are the newest', async () => {
    const f = fakeApi({ workflows: { 'a.yml': active('A') }, runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    await sweep({ ...base, files: ['a.yml'], api: f.api });
    // person re-enables and closes the Issue; old failures are still the newest runs
    f.state.issues[0].state = 'closed';
    const again = await sweep({ ...base, files: ['a.yml'], api: f.api });
    expect(again).toEqual([{ file: 'a.yml', action: 'ok' }]);
    expect(f.state.issues).toHaveLength(1);
  });

  it('halts again only after three new failures past the recorded run', async () => {
    const f = fakeApi({ workflows: { 'a.yml': active('A') }, runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    await sweep({ ...base, files: ['a.yml'], api: f.api });
    f.state.issues[0].state = 'closed';
    const fresh = fakeApi({
      workflows: { 'a.yml': active('A') },
      runs: { 'a.yml': [run(13, 'failure'), run(12, 'failure'), run(11, 'failure'), run(3, 'failure'), run(2, 'failure')] },
      issues: f.state.issues,
    });
    const out = await sweep({ ...base, files: ['a.yml'], api: fresh.api });
    expect(out[0]).toMatchObject({ action: 'halted', number: 901 });
  });

  it('refreshes the record and comments when the earlier Issue is still open', async () => {
    const f = fakeApi({ workflows: { 'a.yml': active('A') }, runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    await sweep({ ...base, files: ['a.yml'], api: f.api });
    const fresh = fakeApi({
      workflows: { 'a.yml': active('A') },
      runs: { 'a.yml': [run(23, 'failure'), run(22, 'failure'), run(21, 'failure'), run(3, 'failure')] },
      issues: f.state.issues,
    });
    const out = await sweep({ ...base, files: ['a.yml'], api: fresh.api });
    expect(out[0]).toMatchObject({ action: 'halted', number: 900 });
    expect(fresh.state.issues).toHaveLength(1);
    expect(fresh.state.issues[0].body).toContain(lastRunMarker(23));
    expect(fresh.calls.some((c) => c.method === 'POST' && c.route.endsWith('/900/comments'))).toBe(true);
  });

  it('alerts but never disables a Production-protecting job', async () => {
    const file = [...ALERT_ONLY][0];
    const { api, calls, state } = fakeApi({ workflows: { [file]: active('Backup') }, runs: { [file]: [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    const out = await sweep({ ...base, files: [file], api });
    expect(out[0]).toMatchObject({ file, action: 'alerted' });
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(state.issues[0].labels).toEqual(['team:operations', 'ops-exception']);
    // the same three failures are already covered by the alert: no second Issue
    const second = await sweep({ ...base, files: [file], api });
    expect(second[0]).toMatchObject({ action: 'ok' });
    expect(state.issues).toHaveLength(1);
  });

  it('an alert-only job that keeps failing past the open alert does not open another Issue', async () => {
    const file = [...ALERT_ONLY][0];
    const f = fakeApi({ workflows: { [file]: active('Backup') }, runs: { [file]: [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    await sweep({ ...base, files: [file], api: f.api });
    const later = fakeApi({
      workflows: { [file]: active('Backup') },
      runs: { [file]: [run(13, 'failure'), run(12, 'failure'), run(11, 'failure'), run(3, 'failure')] },
      issues: f.state.issues,
    });
    const out = await sweep({ ...base, files: [file], api: later.api });
    expect(out[0]).toMatchObject({ action: 'alert-already-open', number: 900 });
    expect(later.state.issues).toHaveLength(1);
    expect(later.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('skips a workflow that is already disabled', async () => {
    const { api, calls } = fakeApi({ workflows: { 'a.yml': { state: 'disabled_manually', name: 'A' } }, runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] } });
    const out = await sweep({ ...base, files: ['a.yml'], api });
    expect(out[0]).toMatchObject({ action: 'skipped' });
    expect(calls.some((c) => c.method !== 'GET')).toBe(false);
  });

  it('records a failed disable on the Issue instead of hiding it', async () => {
    const { api, calls } = fakeApi({
      workflows: { 'a.yml': active('A'), __disableFails: true },
      runs: { 'a.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] },
    });
    const out = await sweep({ ...base, files: ['a.yml'], api });
    expect(out[0]).toMatchObject({ action: 'halt-failed' });
    expect(calls.some((c) => c.method === 'POST' && c.route.endsWith('/900/comments'))).toBe(true);
  });

  it('an API error on one workflow does not stop the others and does not halt anything', async () => {
    const f = fakeApi({
      workflows: { 'a.yml': active('A'), 'b.yml': active('B') },
      runs: { 'b.yml': [run(3, 'failure'), run(2, 'failure'), run(1, 'failure')] },
    });
    const flaky = async (method, route, body) => {
      if (route.includes('/a.yml/runs')) throw new Error('500');
      return f.api(method, route, body);
    };
    const out = await sweep({ ...base, files: ['a.yml', 'b.yml'], api: flaky });
    expect(out[0]).toMatchObject({ file: 'a.yml', action: 'skipped' });
    expect(out[1]).toMatchObject({ file: 'b.yml', action: 'halted' });
  });
});

describe('findRecord', () => {
  it('reads the covered run id from the newest matching Issue', () => {
    const issues = [{ number: 5, state: 'closed', body: `${markerFor('a.yml')}\n${lastRunMarker(77)}` }, { number: 2, state: 'open', body: markerFor('a.yml') }];
    expect(findRecord(issues, 'a.yml')).toMatchObject({ number: 5, state: 'closed', lastRunId: 77 });
    expect(findRecord(issues, 'b.yml')).toBeNull();
  });
});
