import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_MS,
  LIVENESS_JOBS,
  assessCacheControl,
  checkRoute,
  failingMarker,
  judgeRoute,
  renderReport,
  runEdgeChecks,
  runHealth,
  shouldSkipLiveness,
} from '../scripts/ops/production-edge-health.mjs';
import { runCheck } from '../scripts/ops/scheduled-job-health.mjs';

const fresh = { name: 'home', url: 'https://example.test/', status: 200, cacheControl: 'public, max-age=0, must-revalidate', elapsedMs: 400 };

describe('assessCacheControl', () => {
  it('accepts the Cloudflare Pages revalidate policy', () => {
    expect(assessCacheControl('public, max-age=0, must-revalidate')).toMatchObject({ ok: true });
  });

  it('fails when the header is missing', () => {
    expect(assessCacheControl('')).toMatchObject({ ok: false, reason: 'cache-control header is missing' });
    expect(assessCacheControl(null)).toMatchObject({ ok: false });
  });

  it('fails when a long max-age has no revalidation', () => {
    expect(assessCacheControl('public, max-age=31536000')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('stale content'),
    });
  });
});

describe('judgeRoute', () => {
  it('passes a fast revalidated response', () => {
    expect(judgeRoute(fresh)).toMatchObject({ ok: true });
  });

  it('fails a non-2xx response', () => {
    expect(judgeRoute({ ...fresh, status: 503 })).toMatchObject({ ok: false, reason: 'HTTP 503' });
  });

  it('fails a response slower than the baseline', () => {
    expect(judgeRoute({ ...fresh, elapsedMs: BASELINE_MS + 1 })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('baseline'),
    });
  });

  it('fails a missing cache-control header even when the status is 200', () => {
    expect(judgeRoute({ ...fresh, cacheControl: '' })).toMatchObject({ ok: false, reason: 'cache-control header is missing' });
  });
});

describe('checkRoute', () => {
  it('reads cache-control from the response', async () => {
    const fetchImpl = async () => ({
      status: 200,
      headers: { get: (name) => (name === 'cache-control' ? 'public, max-age=0, must-revalidate' : null) },
    });
    const result = await checkRoute({ name: 'home', url: 'https://example.test/' }, { fetchImpl, baselineMs: 8000 });
    expect(result.ok).toBe(true);
    expect(result.cacheControl).toContain('must-revalidate');
  });

  it('fails the route when fetch throws', async () => {
    const fetchImpl = async () => { throw new Error('network down'); };
    const result = await checkRoute({ name: 'faq', url: 'https://example.test/faq/' }, { fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: 'network down' });
  });
});

describe('report', () => {
  it('names the failing route in the marker', async () => {
    const edge = await runEdgeChecks([{ name: 'home', url: 'https://example.test/' }], {
      fetchImpl: async () => ({ status: 500, headers: { get: () => '' } }),
    });
    expect(edge.ok).toBe(false);
    expect(failingMarker({ edge, liveness: null })).toBe('<!-- production-edge-health:failing=home -->');
    expect(renderReport({ edge, liveness: null })).toContain('FAIL');
  });
});

describe('monitor liveness', () => {
  const now = new Date('2026-10-18T12:00:00Z');

  it('fails when scheduled-job health has been silent past its window', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('/runs')) {
        return { status: 200, ok: true, json: async () => ({ workflow_runs: [{ updated_at: '2026-10-17T00:00:00Z' }] }) };
      }
      return { status: 200, ok: true, json: async () => ({ state: 'active', created_at: '2026-01-01T00:00:00Z' }) };
    };
    const liveness = await runCheck(LIVENESS_JOBS, { repository: 'o/r', branch: 'main', headers: {}, fetchImpl }, now);
    expect(liveness.ok).toBe(false);
    expect(liveness.results[0].reason).toContain('last success');
  });

  it('passes a recent scheduled-job health success', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('/runs')) {
        return { status: 200, ok: true, json: async () => ({ workflow_runs: [{ updated_at: '2026-10-18T10:00:00Z' }] }) };
      }
      return { status: 200, ok: true, json: async () => ({ state: 'active', created_at: '2026-01-01T00:00:00Z' }) };
    };
    const liveness = await runCheck(LIVENESS_JOBS, { repository: 'o/r', branch: 'main', headers: {}, fetchImpl }, now);
    expect(liveness.ok).toBe(true);
  });
});

describe('watch list', () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/ops-workflow-failure-exception-issues.yml'), 'utf8');

  it('opens an Operations exception when backup, sync, or edge health fails', () => {
    for (const name of [
      'OPS — D1 Backup Scheduled Daily Export (#3268 Phase 3)',
      'OPS — B2 D1 Daily Sync',
      'OPS — B2 S3 Smoke Test',
      'OPS — Matchup Pair Monitor',
      'OPS — Production Edge Health',
    ]) {
      expect(workflow).toContain(`"${name}"`);
    }
  });
});

describe('bootstrap run (#5058)', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const home = [{ name: 'home', url: 'https://example.test/' }];
  const healthyEdge = async () => ({
    status: 200,
    headers: { get: (name) => (name === 'cache-control' ? 'public, max-age=0, must-revalidate' : null) },
  });
  const brokenEdge = async () => ({ status: 500, headers: { get: () => '' } });
  // Scheduled Job Health last succeeded two days ago: past its 6 h window.
  const staleJobHealth = async (url) => {
    if (url.includes('/runs')) {
      return { status: 200, ok: true, json: async () => ({ workflow_runs: [{ updated_at: '2026-10-31T12:00:00Z' }] }) };
    }
    return { status: 200, ok: true, json: async () => ({ state: 'active', created_at: '2026-01-01T00:00:00Z' }) };
  };
  const context = { repository: 'o/r', branch: 'main', headers: {}, fetchImpl: staleJobHealth };

  it('reads the skip from the flag or from SKIP_LIVENESS=true, and defaults to required', () => {
    expect(shouldSkipLiveness(['node', 'x', '--skip-liveness'], {})).toBe(true);
    expect(shouldSkipLiveness([], { SKIP_LIVENESS: 'true' })).toBe(true);
    expect(shouldSkipLiveness([], { SKIP_LIVENESS: 'TRUE' })).toBe(true);
    expect(shouldSkipLiveness([], { SKIP_LIVENESS: 'false' })).toBe(false);
    expect(shouldSkipLiveness([], { SKIP_LIVENESS: '' })).toBe(false);
    expect(shouldSkipLiveness(['node', 'x', '--escalate'], {})).toBe(false);
  });

  it('with the skip, a healthy edge passes even when scheduled-job health is stale', async () => {
    const result = await runHealth({ routes: home, edgeOptions: { fetchImpl: healthyEdge }, context, skipLiveness: true, now });
    expect(result.ok).toBe(true);
    expect(result.liveness).toBeNull();
    expect(result.livenessSkipped).toBe(true);
  });

  it('without the skip, stale scheduled-job health still fails the run', async () => {
    const result = await runHealth({ routes: home, edgeOptions: { fetchImpl: healthyEdge }, context, skipLiveness: false, now });
    expect(result.ok).toBe(false);
    expect(result.liveness.ok).toBe(false);
    expect(result.livenessSkipped).toBe(false);
  });

  it('the skip never hides an unhealthy edge', async () => {
    const result = await runHealth({ routes: home, edgeOptions: { fetchImpl: brokenEdge }, context, skipLiveness: true, now });
    expect(result.ok).toBe(false);
    expect(result.edge.ok).toBe(false);
  });

  it('a local run with no GitHub context has no liveness section and no skip note', async () => {
    const result = await runHealth({ routes: home, edgeOptions: { fetchImpl: healthyEdge }, context: null, skipLiveness: true, now });
    expect(result).toMatchObject({ ok: true, liveness: null, livenessSkipped: false });
  });

  it('says in the report that liveness was skipped, and still decides on the routes', async () => {
    const pass = await runHealth({ routes: home, edgeOptions: { fetchImpl: healthyEdge }, context, skipLiveness: true, now });
    const passReport = renderReport(pass);
    expect(passReport).toContain('Overall: PASS');
    expect(passReport).toContain('SKIPPED');
    expect(passReport).toContain('A scheduled run always requires liveness');

    const fail = await runHealth({ routes: home, edgeOptions: { fetchImpl: brokenEdge }, context, skipLiveness: true, now });
    expect(renderReport(fail)).toContain('Overall: FAIL');
  });

  it('the workflow takes the input only on a manual run and passes it through env, not run', () => {
    const wf = fs.readFileSync(path.join(process.cwd(), '.github/workflows/ops-production-edge-health.yml'), 'utf8');
    expect(wf).toMatch(/schedule:\s*\n\s*- cron:/);
    expect(wf).toMatch(/skip_liveness:\s*\n\s*description:[^\n]*\n\s*type: boolean\s*\n\s*default: false/);
    expect(wf).toContain("SKIP_LIVENESS: ${{ github.event_name == 'workflow_dispatch' && inputs.skip_liveness && 'true' || 'false' }}");
    const runLines = wf.split('\n').filter((line) => /^\s*run:/.test(line));
    expect(runLines).toEqual(['        run: node scripts/ops/production-edge-health.mjs --escalate']);
    for (const line of runLines) expect(line).not.toContain('${{');
  });
});
