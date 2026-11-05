import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { decideDiscoveryExit, parseRetryAfterMs, runDiscovery } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';
import {
  countConsecutiveFailures,
  countSourceOutages,
  decideGuard,
  decideOutage,
} from '../scripts/ci/gehrig_discovery_summary.mjs';

const SOURCES = ['openverse', 'loc', 'wikimedia'];

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function openverseHit() {
  return jsonResponse(200, {
    results: [{ id: 'ov-1', title: 'Lou Gehrig', license: 'cc0', provider: 'test' }],
  });
}

function wikimediaEmpty() {
  return jsonResponse(200, { query: { search: [] } });
}

function locHit() {
  return jsonResponse(200, { results: [{ id: 'loc-1', title: 'Lou Gehrig LOC item' }] });
}

describe('Gehrig discovery source errors (#4588)', () => {
  let outDir;

  beforeEach(() => {
    process.env.DISCOVERY_RETRY_BASE_DELAY_MS = '0';
    process.env.DISCOVERY_LOC_INTERVAL_MS = '0'; // #5074: no request spacing in tests
    process.env.DISCOVERY_WIKIMEDIA_INTERVAL_MS = '0';
    process.env.DISCOVERY_LOC_RETRY_BASE_DELAY_MS = '0';
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gehrig-discovery-'));
  });

  afterEach(() => {
    delete process.env.DISCOVERY_RETRY_BASE_DELAY_MS;
    delete process.env.DISCOVERY_LOC_INTERVAL_MS;
    delete process.env.DISCOVERY_WIKIMEDIA_INTERVAL_MS;
    delete process.env.DISCOVERY_LOC_RETRY_BASE_DELAY_MS;
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  async function discover(fetchImpl) {
    return runDiscovery(
      {
        query: 'Lou Gehrig',
        sources: SOURCES,
        limit: 10,
        out: path.join(outDir, 'candidates.json'),
      },
      fetchImpl,
    );
  }

  it('reproduces the 2026-10-12 LOC 503 without dropping the other sources', async () => {
    const locAttempts = [];
    const result = await discover(async (url) => {
      const href = String(url);
      if (href.includes('loc.gov')) {
        locAttempts.push(href);
        return jsonResponse(503, {});
      }
      if (href.includes('api.openverse.org')) return openverseHit();
      if (href.includes('commons.wikimedia.org')) return wikimediaEmpty();
      throw new Error(`unexpected url ${href}`);
    });

    expect(locAttempts).toHaveLength(3);
    expect(result.exitCode).toBe(0);
    expect(decideDiscoveryExit()).toBe(0);
    expect(result.candidates.map((candidate) => candidate.source_name)).toEqual(['Openverse']);
    const locRun = result.searchRuns.find((run) => run.source_domain === 'loc.gov');
    expect(locRun.status).toBe('source_error');
    expect(locRun.error_summary).toMatch(/HTTP 503/);
    expect(result.searchRuns.find((run) => run.source_domain === 'openverse.org').status).toBe('completed');
    expect(countSourceOutages(result.searchRuns)).toBe(1);
  });

  it('records source_error for every source when all of them stay down', async () => {
    const result = await discover(async () => jsonResponse(503, {}));

    expect(result.exitCode).toBe(0);
    expect(result.candidates).toHaveLength(0);
    expect(result.errors).toHaveLength(3);
    expect(result.searchRuns.map((run) => run.status)).toEqual(['source_error', 'source_error', 'source_error']);
    expect(decideOutage({ sourceErrorCount: result.errors.length, consecutivePriorFailures: 0 })).toBe('fail');
  });

  it('keeps a source that recovers on retry', async () => {
    let locAttempts = 0;
    const result = await discover(async (url) => {
      const href = String(url);
      if (href.includes('loc.gov')) {
        locAttempts += 1;
        if (locAttempts < 3) return jsonResponse(503, {});
        return locHit();
      }
      if (href.includes('api.openverse.org')) return openverseHit();
      if (href.includes('commons.wikimedia.org')) return wikimediaEmpty();
      throw new Error(`unexpected url ${href}`);
    });

    expect(locAttempts).toBe(3);
    expect(result.exitCode).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.candidates.map((candidate) => candidate.source_name).sort()).toEqual(['Library of Congress', 'Openverse']);
    expect(result.searchRuns.find((run) => run.source_domain === 'loc.gov').status).not.toBe('source_error');
  });
});

describe('Gehrig discovery halt (#4588)', () => {
  it('counts consecutive failures and halts only on the third', () => {
    expect(countConsecutiveFailures(['failure', 'failure', 'success'])).toBe(2);
    expect(countConsecutiveFailures(['success', 'failure'])).toBe(0);
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 1 })).toBe('fail');
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 2 })).toBe('halt');
    expect(decideOutage({ sourceErrorCount: 0, consecutivePriorFailures: 2 })).toBe('pass');
  });

  it('stays halted until a newer re-enable marker exists', () => {
    expect(decideGuard({ haltAt: '2026-10-19T13:00:00Z', reenableAt: null, reenableRequested: false })).toBe('halted');
    expect(
      decideGuard({
        haltAt: '2026-10-19T13:00:00Z',
        reenableAt: '2026-10-20T13:00:00Z',
        reenableRequested: false,
      }),
    ).toBe('run');
    expect(decideGuard({ haltAt: '2026-10-19T13:00:00Z', reenableAt: null, reenableRequested: true })).toBe('run');
  });

  it('wires this job only: fail after import, halt artifact, one halt issue', () => {
    const workflow = fs.readFileSync('.github/workflows/gehrig-content-discovery.yml', 'utf8');
    const discoveryAt = workflow.indexOf('- name: Run discovery against approved sources');
    const importAt = workflow.indexOf('- name: Import discovered candidates into production D1 (metadata only)');
    const outageAt = workflow.indexOf('- name: Report persistent source outage');
    expect(discoveryAt).toBeGreaterThan(-1);
    expect(importAt).toBeGreaterThan(discoveryAt);
    expect(outageAt).toBeGreaterThan(importAt);
    expect(workflow).toContain('gehrig-discovery-halted');
    const summary = fs.readFileSync('scripts/ci/gehrig_discovery_summary.mjs', 'utf8');
    expect(summary).toContain('OPS EXCEPTION: Gehrig Content Discovery halted after 3 consecutive failures');
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('actions: read');
    expect(workflow).not.toContain('runner-health-halted');
  });

  it('stops asking a Library of Congress host that refused us, and keeps the other sources running (#5082)', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gehrig-discovery-'));
    const env = { DISCOVERY_RETRY_BASE_DELAY_MS: '0', DISCOVERY_LOC_INTERVAL_MS: '0', DISCOVERY_WIKIMEDIA_INTERVAL_MS: '0', DISCOVERY_LOC_RETRY_BASE_DELAY_MS: '0', DISCOVERY_QUERY_PAUSE_MS: '0' };
    Object.assign(process.env, env);
    const locCalls = [];
    const wikimediaCalls = [];
    let result;
    try {
    result = await runDiscovery(
      {
        query: 'Lou Gehrig|Gehrig Eleanor Gehrig wedding|Gehrig funeral 1941',
        sources: ['loc', 'wikimedia'],
        limit: 10,
        out: path.join(outDir, 'candidates.json'),
      },
      async (url) => {
        const href = String(url);
        if (href.includes('loc.gov')) {
          locCalls.push(href);
          return jsonResponse(429, {});
        }
        if (href.includes('commons.wikimedia.org')) {
          wikimediaCalls.push(href);
          return wikimediaEmpty();
        }
        throw new Error(`unexpected url ${href}`);
      },
    );
    } finally {
      for (const key of Object.keys(env)) delete process.env[key];
      fs.rmSync(outDir, { recursive: true, force: true });
    }
    // First query: three attempts, then the host is marked refused. Queries two and three send nothing.
    expect(locCalls).toHaveLength(3);
    const locRuns = result.searchRuns.filter((run) => run.source_domain === 'loc.gov');
    expect(locRuns).toHaveLength(3);
    for (const run of locRuns) expect(run.error_summary).toMatch(/HTTP 429/);
    expect(locRuns[1].error_summary).toMatch(/not sent/);
    // Wikimedia is a different host family and runs every query.
    expect(wikimediaCalls.length).toBeGreaterThanOrEqual(3);
    for (const run of result.searchRuns.filter((r) => r.source_domain === 'commons.wikimedia.org')) expect(run.status).toBe('no_results');
  });

  it('reads Retry-After as seconds or as an HTTP date (#5082)', () => {
    expect(parseRetryAfterMs('30')).toBe(30000);
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs('Thu, 05 Nov 2026 10:00:30 GMT', Date.parse('Thu, 05 Nov 2026 10:00:00 GMT'))).toBe(30000);
    expect(parseRetryAfterMs('Thu, 05 Nov 2026 09:00:00 GMT', Date.parse('Thu, 05 Nov 2026 10:00:00 GMT'))).toBe(0);
    for (const bad of [null, undefined, '', 'soon']) expect(parseRetryAfterMs(bad)).toBeNull();
  });
});
