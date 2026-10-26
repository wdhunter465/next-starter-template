import { describe, expect, it } from 'vitest';
import { PUBLIC_SITEMAP_ROUTES } from '../src/lib/publicSiteMetadata';
import { checkOnce, checkTarget, DEFAULT_TARGETS, failingMarker, renderReport, runProbe } from '../scripts/ops/site-uptime-probe.mjs';

function response(status, json) {
  return { status, json: async () => (json === undefined ? JSON.parse('not json') : json) };
}

describe('checkOnce', () => {
  it('passes on HTTP 2xx', async () => {
    const result = await checkOnce({ url: 'https://example.test/' }, { fetchImpl: async () => response(200) });
    expect(result).toMatchObject({ ok: true, status: 200 });
  });

  it('fails on non-2xx', async () => {
    const result = await checkOnce({ url: 'https://example.test/' }, { fetchImpl: async () => response(522) });
    expect(result).toMatchObject({ ok: false, status: 522, reason: 'HTTP 522' });
  });

  it('fails on timeout', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const result = await checkOnce({ url: 'https://example.test/' }, { fetchImpl: async () => { throw timeout; }, timeoutMs: 50 });
    expect(result).toMatchObject({ ok: false, status: 0, reason: 'timeout after 50 ms' });
  });

  it('accepts a signed-out redirect and rejects HTTP 200', async () => {
    const target = { url: 'https://www.lougehrigfanclub.com/fanclub', expectRedirect: true };
    expect(await checkOnce(target, { fetchImpl: async () => response(302) })).toMatchObject({ ok: true, status: 302 });
    expect(await checkOnce(target, { fetchImpl: async () => response(200) })).toMatchObject({
      ok: false,
      reason: 'expected a sign-in redirect, got HTTP 200',
    });
  });

  it('checks expected JSON fields', async () => {
    const target = { url: 'https://example.test/api/health', expectJson: { ok: true, db_ok: true } };
    expect(await checkOnce(target, { fetchImpl: async () => response(200, { ok: true, db_ok: true }) })).toMatchObject({ ok: true });
    expect(await checkOnce(target, { fetchImpl: async () => response(200, { ok: true, db_ok: false }) }))
      .toMatchObject({ ok: false, reason: 'db_ok is false, expected true' });
    expect(await checkOnce(target, { fetchImpl: async () => response(200) })).toMatchObject({ ok: false, reason: 'response is not JSON' });
  });
});

describe('checkTarget retry', () => {
  it('passes when a retry succeeds', async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls === 1 ? response(503) : response(200));
    const result = await checkTarget({ name: 'x', url: 'https://example.test/' }, { fetchImpl, retryDelayMs: 0 });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
  });

  it('fails only after every attempt fails', async () => {
    const result = await checkTarget({ name: 'x', url: 'https://example.test/' }, { fetchImpl: async () => response(503), retryDelayMs: 0 });
    expect(result).toMatchObject({ ok: false, attempts: 2, reason: 'HTTP 503' });
  });
});

describe('runProbe and reporting', () => {
  const targets = [
    { name: 'a', url: 'https://a.test/' },
    { name: 'b', url: 'https://b.test/' },
  ];

  it('reports overall failure when any target fails', async () => {
    const fetchImpl = async (url) => (url.startsWith('https://b') ? response(522) : response(200));
    const probe = await runProbe(targets, { fetchImpl, retryDelayMs: 0 });
    expect(probe.ok).toBe(false);
    const report = renderReport(probe, '2026-10-10T00:00:00Z');
    expect(report).toContain('- Overall: FAIL');
    expect(report).toContain('| b | https://b.test/ | FAIL — HTTP 522 | 2 |');
    expect(failingMarker(probe)).toBe('<!-- site-uptime-probe:failing=b -->');
  });

  it('reports an advisory target failure without failing the run', async () => {
    const withAdvisory = [...targets, { name: 'apex', url: 'https://apex.test/', advisoryIssue: 4542 }];
    const fetchImpl = async (url) => (url.startsWith('https://apex') ? response(522) : response(200));
    const probe = await runProbe(withAdvisory, { fetchImpl, retryDelayMs: 0 });
    expect(probe.ok).toBe(true);
    const report = renderReport(probe, '2026-10-10T00:00:00Z');
    expect(report).toContain('- Overall: PASS');
    expect(report).toContain('| apex | https://apex.test/ | ADVISORY FAIL — HTTP 522 (tracked in #4542) | 2 |');
    expect(failingMarker(probe)).toBe('<!-- site-uptime-probe:failing= -->');
  });

  it('still fails the run when a required target fails alongside an advisory one', async () => {
    const withAdvisory = [...targets, { name: 'apex', url: 'https://apex.test/', advisoryIssue: 4542 }];
    const fetchImpl = async (url) => (url.startsWith('https://a.') ? response(200) : response(522));
    const probe = await runProbe(withAdvisory, { fetchImpl, retryDelayMs: 0 });
    expect(probe.ok).toBe(false);
    expect(failingMarker(probe)).toBe('<!-- site-uptime-probe:failing=b -->');
  });

  it('probes every public sitemap route and the signed-out fanclub redirect', () => {
    const probed = new Set(DEFAULT_TARGETS.map((target) => new URL(target.url).pathname));
    for (const route of PUBLIC_SITEMAP_ROUTES) {
      expect(probed.has(route), `sitemap route ${route} is not probed`).toBe(true);
    }
    const fanclub = DEFAULT_TARGETS.find((target) => new URL(target.url).pathname === '/fanclub');
    expect(fanclub?.expectRedirect).toBe(true);
  });

  it('reports overall pass when all targets pass', async () => {
    const probe = await runProbe(targets, { fetchImpl: async () => response(200), retryDelayMs: 0 });
    expect(probe.ok).toBe(true);
    expect(renderReport(probe)).toContain('- Overall: PASS');
  });
});
