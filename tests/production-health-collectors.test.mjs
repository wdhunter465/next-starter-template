import { describe, expect, it } from 'vitest';
import {
  applyStaleness,
  buildNextCache,
  buildResultMarkdown,
  classifyResult,
  evidenceFingerprint,
  runAllHealthChecks,
  TARGETS,
} from '../scripts/ci/production_health_collectors.mjs';

const d1Target = TARGETS.find((t) => t.name === 'd1_health');
const genericTarget = TARGETS.find((t) => t.name === 'faq_list');

function jsonResponse(status, body) {
  return { status, json: async () => body };
}

describe('classifyResult', () => {
  it('is healthy on ok:true with no extraCheck rule', () => {
    expect(classifyResult({ target: genericTarget, status: 200, json: { ok: true, items: [] } })).toEqual({
      state: 'healthy',
      reason: '',
    });
  });

  it('is degraded on ok:false, using only a fixed reason string', () => {
    const result = classifyResult({
      target: genericTarget,
      status: 200,
      json: { ok: false, error: 'do-not-leak-this-server-message' },
    });
    expect(result.state).toBe('degraded');
    expect(result.reason).not.toContain('do-not-leak-this-server-message');
  });

  it('is unavailable on 5xx', () => {
    expect(classifyResult({ target: genericTarget, status: 503, json: null })).toEqual({
      state: 'unavailable',
      reason: 'http 503',
    });
  });

  it('is missing-evidence on 4xx (the probe request itself was rejected)', () => {
    const result = classifyResult({ target: genericTarget, status: 404, json: null });
    expect(result.state).toBe('missing-evidence');
  });

  it('is missing-evidence when the body is not valid JSON', () => {
    const result = classifyResult({ target: genericTarget, status: 200, json: null, parseError: true });
    expect(result.state).toBe('missing-evidence');
  });

  it('is missing-evidence when the body has no boolean ok field', () => {
    const result = classifyResult({ target: genericTarget, status: 200, json: { items: [] } });
    expect(result.state).toBe('missing-evidence');
  });

  it('is unavailable on network error, using only the fixed vocabulary', () => {
    const result = classifyResult({ target: genericTarget, status: 0, networkError: 'timeout' });
    expect(result).toEqual({ state: 'unavailable', reason: 'network error: timeout' });
  });

  it('applies d1_health\'s stronger rule: db_ok:false is unavailable even though ok:true', () => {
    const result = classifyResult({ target: d1Target, status: 200, json: { ok: true, db_ok: false } });
    expect(result).toEqual({ state: 'unavailable', reason: 'db_ok=false' });
  });

  it('d1_health falls through to healthy when db_ok:true', () => {
    const result = classifyResult({ target: d1Target, status: 200, json: { ok: true, db_ok: true } });
    expect(result.state).toBe('healthy');
  });
});

describe('applyStaleness', () => {
  const now = new Date('2026-08-08T12:00:00Z');

  it('upgrades a non-healthy result to stale when a recent healthy baseline exists', () => {
    const result = applyStaleness({ state: 'unavailable', reason: 'http 500' }, '2026-08-08T06:00:00Z', now);
    expect(result.state).toBe('stale');
  });

  it('leaves the raw state when the baseline is outside the freshness window', () => {
    const result = applyStaleness({ state: 'unavailable', reason: 'http 500' }, '2026-08-01T00:00:00Z', now);
    expect(result.state).toBe('unavailable');
  });

  it('leaves the raw state when there is no prior baseline at all', () => {
    const result = applyStaleness({ state: 'unavailable', reason: 'http 500' }, undefined, now);
    expect(result.state).toBe('unavailable');
  });

  it('never downgrades an already-healthy result', () => {
    const result = applyStaleness({ state: 'healthy', reason: '' }, '2026-01-01T00:00:00Z', now);
    expect(result.state).toBe('healthy');
  });
});

describe('buildNextCache', () => {
  it('records a fresh last_healthy_at only for currently-healthy checks', () => {
    const now = new Date('2026-08-08T12:00:00Z');
    const next = buildNextCache(
      [
        { name: 'a', state: 'healthy' },
        { name: 'b', state: 'degraded' },
      ],
      { b: { last_healthy_at: '2026-08-01T00:00:00Z' } },
      now,
    );
    expect(next.a.last_healthy_at).toBe(now.toISOString());
    expect(next.b.last_healthy_at).toBe('2026-08-01T00:00:00Z');
  });
});

describe('evidenceFingerprint', () => {
  it('is deterministic and check/state-scoped', () => {
    expect(evidenceFingerprint('faq_list', 'degraded')).toBe('production-health:faq_list:degraded');
  });
});

describe('buildResultMarkdown', () => {
  it('produces one table row per result and never breaks the table on pipe/newline in reason', () => {
    const results = [
      { name: 'a', state: 'degraded', reason: 'contains | a pipe', status_code: 200, timing_ms: 10 },
      { name: 'b', state: 'unavailable', reason: 'line one\nline two', status_code: 500, timing_ms: 5 },
    ];
    const md = buildResultMarkdown(results, { checkedAt: '2026-08-08T12:00:00Z' });
    const tableLines = md.split('\n').filter((line) => line.startsWith('| `'));
    expect(tableLines).toHaveLength(2);
    for (const line of tableLines) {
      // exactly 4 interior "| " separators for a 5-column row once escaped pipes are excluded
      expect(line.replace(/\\\|/g, '')).toContain('|');
    }
    expect(md).not.toContain('line one\nline two');
  });
});

describe('runAllHealthChecks (end-to-end against a stubbed fetch)', () => {
  it('classifies every target and never leaks a raw thrown error message into the result', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('friends')) throw new Error('super-secret-internal-detail');
      if (url.includes('health')) return jsonResponse(200, { ok: true, db_ok: true });
      return jsonResponse(200, { ok: true, items: [] });
    };
    const results = await runAllHealthChecks({ baseUrl: 'https://example.invalid', fetchImpl, delayMs: 0 });
    expect(results).toHaveLength(TARGETS.length);
    const friends = results.find((r) => r.name === 'friends_list');
    expect(friends.state).toBe('unavailable');
    expect(friends.reason).not.toContain('super-secret-internal-detail');
    expect(results.every((r) => r.name && r.fingerprint)).toBe(true);
  });
});
