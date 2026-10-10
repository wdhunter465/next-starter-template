import { describe, expect, it } from 'vitest';
import { checkOnce, checkTarget, failingMarker, renderReport, runProbe } from '../scripts/ops/site-uptime-probe.mjs';

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

  it('reports overall pass when all targets pass', async () => {
    const probe = await runProbe(targets, { fetchImpl: async () => response(200), retryDelayMs: 0 });
    expect(probe.ok).toBe(true);
    expect(renderReport(probe)).toContain('- Overall: PASS');
  });
});
