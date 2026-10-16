import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JOBS, evaluateJob, failingMarker, fetchJobStatus, renderReport, runCheck } from '../scripts/ops/scheduled-job-health.mjs';

const NOW = new Date('2026-10-12T12:00:00Z');
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
const WORKFLOWS_DIR = path.join(process.cwd(), '.github', 'workflows');
const SELF = 'ops-scheduled-job-health.yml';

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function fakeGitHub(byFile) {
  return async (url) => {
    const match = url.match(/workflows\/([^/?]+)(\/runs)?/);
    const entry = byFile[match[1]];
    if (!entry) return jsonResponse(404, {});
    if (!match[2]) return jsonResponse(200, { state: entry.state, created_at: entry.createdAt });
    return jsonResponse(200, { workflow_runs: entry.lastSuccessAt ? [{ updated_at: entry.lastSuccessAt }] : [] });
  };
}

describe('evaluateJob', () => {
  const job = { file: 'daily.yml', maxAgeHours: 30 };

  it('passes an enabled job inside its window', () => {
    expect(evaluateJob(job, { state: 'active', lastSuccessAt: hoursAgo(5) }, NOW)).toMatchObject({ ok: true });
  });

  it('fails a job whose last success is older than its window', () => {
    expect(evaluateJob(job, { state: 'active', lastSuccessAt: hoursAgo(31) }, NOW))
      .toMatchObject({ ok: false, reason: 'last success 31 h ago (limit 30 h)' });
  });

  it('fails a disabled job even when it succeeded recently', () => {
    expect(evaluateJob(job, { state: 'disabled_manually', lastSuccessAt: hoursAgo(1) }, NOW))
      .toMatchObject({ ok: false, reason: 'workflow state is disabled_manually' });
  });

  it('fails a job with no successful run', () => {
    expect(evaluateJob(job, { state: 'active', lastSuccessAt: null }, NOW))
      .toMatchObject({ ok: false, reason: 'no successful run on the default branch' });
  });

  it('passes a newly added job that has no run yet and is still inside its first window (#4635)', () => {
    const result = evaluateJob(job, { state: 'active', lastSuccessAt: null, createdAt: hoursAgo(10) }, NOW);
    expect(result).toMatchObject({ ok: true, pending: true, reason: 'awaiting first run (added 10 h ago)' });
  });

  it('fails a job with no run once its first window has passed (#4635)', () => {
    expect(evaluateJob(job, { state: 'active', lastSuccessAt: null, createdAt: hoursAgo(31) }, NOW))
      .toMatchObject({ ok: false, reason: 'no successful run on the default branch' });
  });

  it('does not grant the grace window to a job that has succeeded and gone stale (#4635)', () => {
    expect(evaluateJob(job, { state: 'active', lastSuccessAt: hoursAgo(40), createdAt: hoursAgo(5) }, NOW))
      .toMatchObject({ ok: false });
  });

  it('fails a missing workflow', () => {
    expect(evaluateJob(job, { state: null, lastSuccessAt: null }, NOW)).toMatchObject({ ok: false, reason: 'workflow not found' });
  });

  it('checks only the enabled state when maxAgeHours is null', () => {
    const watcher = { file: 'watcher.yml', maxAgeHours: null };
    expect(evaluateJob(watcher, { state: 'active', lastSuccessAt: null }, NOW)).toMatchObject({ ok: true });
    expect(evaluateJob(watcher, { state: 'disabled_inactivity', lastSuccessAt: null }, NOW)).toMatchObject({ ok: false });
  });
});

describe('runCheck against a broken fixture', () => {
  const jobs = [
    { file: 'healthy.yml', maxAgeHours: 3 },
    { file: 'stale.yml', maxAgeHours: 30 },
    { file: 'off.yml', maxAgeHours: 30 },
    { file: 'gone.yml', maxAgeHours: 30 },
  ];
  const fetchImpl = fakeGitHub({
    'healthy.yml': { state: 'active', lastSuccessAt: hoursAgo(1) },
    'stale.yml': { state: 'active', lastSuccessAt: hoursAgo(72) },
    'off.yml': { state: 'disabled_manually', lastSuccessAt: hoursAgo(1) },
  });
  const context = { repository: 'o/r', headers: {}, branch: 'main', fetchImpl };

  it('reports every broken job and fails overall', async () => {
    const check = await runCheck(jobs, context, NOW);
    expect(check.ok).toBe(false);
    expect(check.results.filter((r) => !r.ok).map((r) => r.file)).toEqual(['stale.yml', 'off.yml', 'gone.yml']);
    const report = renderReport(check, NOW.toISOString());
    expect(report).toContain('- Overall: FAIL');
    expect(report).toContain('| stale.yml | 30 h |');
    expect(report).toContain('FAIL — workflow state is disabled_manually');
    expect(failingMarker(check)).toBe('<!-- scheduled-job-health:failing=gone.yml,off.yml,stale.yml -->');
  });

  it('passes when every job is healthy', async () => {
    const check = await runCheck([jobs[0]], context, NOW);
    expect(check.ok).toBe(true);
    expect(renderReport(check)).toContain('- Overall: PASS');
  });

  it('queries successful runs on the given branch', async () => {
    const urls = [];
    const spy = async (url, init) => { urls.push(url); return fetchImpl(url, init); };
    await fetchJobStatus(jobs[0], { ...context, fetchImpl: spy });
    expect(urls[1]).toContain('/actions/workflows/healthy.yml/runs?branch=main&status=success&per_page=1');
  });

  it('throws on an API error instead of reporting a false pass', async () => {
    const failing = async () => jsonResponse(500, {});
    await expect(fetchJobStatus(jobs[0], { ...context, fetchImpl: failing })).rejects.toThrow('failed: 500');
  });
});

describe('JOBS covers the repository', () => {
  const scheduled = fs.readdirSync(WORKFLOWS_DIR)
    .filter((file) => file.endsWith('.yml') && file !== SELF)
    .filter((file) => /^\s*schedule:\s*$/m.test(fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8')));

  it('lists every scheduled workflow', () => {
    const listed = new Set(JOBS.map((job) => job.file));
    expect(scheduled.filter((file) => !listed.has(file))).toEqual([]);
  });

  it('lists only workflow files that exist', () => {
    expect(JOBS.filter((job) => !fs.existsSync(path.join(WORKFLOWS_DIR, job.file))).map((job) => job.file)).toEqual([]);
  });
});
