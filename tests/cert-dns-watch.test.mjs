import { describe, expect, it } from 'vitest';

import {
  EXCEPTION_LABELS,
  certificateFinding,
  dnsFinding,
  handleCertDnsWatch,
  redirectFinding,
} from '../scripts/ops/cert-dns-watch.mjs';

const REPO = 'wdhunter465/next-starter-template';
const NOW = new Date('2026-10-26T00:00:00Z');

function daysFromNow(days) {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

function makeApi({ openIssues = [] } = {}) {
  const calls = [];
  const api = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'GET' && path.includes('/issues?')) return openIssues;
    if (method === 'POST' && path.endsWith('/issues')) return { number: 920 };
    if (method === 'POST' && path.endsWith('/comments')) return { id: 1 };
    throw new Error(`Unexpected call ${method} ${path}`);
  };
  return { api, calls };
}

describe('certificate and apex redirect watch (#4688)', () => {
  it('flags a certificate inside 30 days and accepts one outside that window', () => {
    expect(certificateFinding('www.lougehrigfanclub.com', daysFromNow(29), NOW).ok).toBe(false);
    expect(certificateFinding('www.lougehrigfanclub.com', daysFromNow(31), NOW).ok).toBe(true);
  });

  it('flags a hostname with no DNS answer', () => {
    expect(dnsFinding('www.lougehrigfanclub.com', []).ok).toBe(false);
    expect(dnsFinding('www.lougehrigfanclub.com', ['192.0.2.1']).ok).toBe(true);
  });

  it('accepts an apex redirect to www and rejects any other answer', () => {
    expect(redirectFinding(301, 'https://www.lougehrigfanclub.com/', 'www.lougehrigfanclub.com').ok).toBe(true);
    expect(redirectFinding(200, null, 'www.lougehrigfanclub.com').ok).toBe(false);
    expect(redirectFinding(301, 'https://example.com/', 'www.lougehrigfanclub.com').ok).toBe(false);
  });

  it('opens one Operations Issue when a certificate or the redirect fails', async () => {
    const { api, calls } = makeApi();
    const result = await handleCertDnsWatch({
      findings: {
        certificates: [certificateFinding('www.lougehrigfanclub.com', daysFromNow(10), NOW)],
        redirect: redirectFinding(301, 'https://www.lougehrigfanclub.com/', 'www.lougehrigfanclub.com'),
      },
      api,
      repo: REPO,
    });
    expect(result).toEqual({ action: 'created', number: 920 });
    const created = calls.find((call) => call.method === 'POST' && call.path.endsWith('/issues'));
    expect(created.body.labels).toEqual(EXCEPTION_LABELS);
    expect(created.body.body).toContain('www.lougehrigfanclub.com');
    expect(created.body.body).toContain('<!-- ops-cert-dns-watch -->');
  });

  it('stays quiet when every check passes', async () => {
    const { api, calls } = makeApi();
    const result = await handleCertDnsWatch({
      findings: {
        certificates: HOST_FINDINGS_OK(),
        redirect: redirectFinding(301, 'https://www.lougehrigfanclub.com/', 'www.lougehrigfanclub.com'),
      },
      api,
      repo: REPO,
    });
    expect(result).toEqual({ action: 'quiet' });
    expect(calls).toEqual([]);
  });

  it('comments on the open Issue instead of opening a second one', async () => {
    const { api, calls } = makeApi({
      openIssues: [{ number: 80, body: '<!-- ops-cert-dns-watch -->\nexisting' }],
    });
    const result = await handleCertDnsWatch({
      findings: {
        certificates: [certificateFinding('lougehrigfanclub.com', daysFromNow(5), NOW)],
        redirect: redirectFinding(200, null, 'www.lougehrigfanclub.com'),
      },
      api,
      repo: REPO,
    });
    expect(result).toEqual({ action: 'commented', number: 80 });
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/issues'))).toBe(false);
  });
});

function HOST_FINDINGS_OK() {
  return [
    certificateFinding('www.lougehrigfanclub.com', daysFromNow(60), NOW),
    certificateFinding('lougehrigfanclub.com', daysFromNow(60), NOW),
    certificateFinding('next-starter-template-6yr.pages.dev', daysFromNow(60), NOW),
  ];
}
