// #4687 (gap 7 of #4657): alert email only for an outage and a failed deploy; inert until configured.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { ALERT_KINDS, MAILCHANNELS_URL, parseRecipients, sendAlertEmail } from '../scripts/ops/alert-email.mjs';
import { emailOutageOnce } from '../scripts/ops/site-uptime-probe.mjs';

const ROOT = process.cwd();
const CONFIG = { ALERT_EMAIL_TO: 'a@example.com, b@example.org', ALERT_EMAIL_FROM: 'alerts@example.com', ALERT_MAILCHANNELS_API_KEY: 'k' };
const ok202 = () => vi.fn(async () => new Response('', { status: 202 }));

describe('sendAlertEmail', () => {
  it('only the two decision-3 kinds exist', () => {
    expect([...ALERT_KINDS]).toEqual(['outage', 'failed_deploy']);
  });

  it('refuses any other alert kind before doing anything', async () => {
    const fetchImpl = ok202();
    for (const kind of ['', 'recovery', 'ci_failure', 'job_health', 'slow', undefined]) {
      await expect(sendAlertEmail({ kind, subject: 's', text: 't', env: CONFIG, fetchImpl })).rejects.toThrow(/refused/);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is inert when recipients, sender or key is missing', async () => {
    const fetchImpl = ok202();
    for (const drop of ['ALERT_EMAIL_TO', 'ALERT_EMAIL_FROM', 'ALERT_MAILCHANNELS_API_KEY']) {
      const env = { ...CONFIG, [drop]: '' };
      expect(await sendAlertEmail({ kind: 'outage', subject: 's', text: 't', env, fetchImpl })).toEqual({ sent: false, reason: 'not_configured' });
    }
    expect(await sendAlertEmail({ kind: 'outage', subject: 's', text: 't', env: { ...CONFIG, ALERT_EMAIL_TO: 'not-an-address' }, fetchImpl })).toEqual({ sent: false, reason: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends one message to every valid recipient with the key in a header', async () => {
    const fetchImpl = ok202();
    const result = await sendAlertEmail({ kind: 'failed_deploy', subject: 'Deploy failed', text: 'body', env: CONFIG, fetchImpl });
    expect(result).toEqual({ sent: true, recipients: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(MAILCHANNELS_URL);
    expect(init.headers['X-Api-Key']).toBe('k');
    const payload = JSON.parse(init.body);
    expect(payload.personalizations[0].to).toEqual([{ email: 'a@example.com' }, { email: 'b@example.org' }]);
    expect(payload.subject).toBe('Deploy failed');
    expect(init.body).not.toContain('"k"');
  });

  it('never throws on a send failure', async () => {
    expect(await sendAlertEmail({ kind: 'outage', subject: 's', text: 't', env: CONFIG, fetchImpl: async () => new Response('', { status: 500 }) })).toEqual({ sent: false, reason: 'mailchannels_500' });
    expect((await sendAlertEmail({ kind: 'outage', subject: 's', text: 't', env: CONFIG, fetchImpl: async () => { throw new Error('boom'); } })).sent).toBe(false);
  });

  it('parses recipients and drops anything that is not an address', () => {
    expect(parseRecipients(' a@x.com,,bad, b@y.org ,c@@z.com')).toEqual(['a@x.com', 'b@y.org']);
    expect(parseRecipients(undefined)).toEqual([]);
  });
});

describe('outage email: once, on the second failing run', () => {
  const ctx = { repository: 'o/r', headers: { Authorization: 'x' } };
  const open = { number: 7 };

  it('sends once and notes it on the Issue', async () => {
    const send = vi.fn(async () => ({ sent: true, recipients: 2 }));
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push([url, init?.method ?? 'GET']);
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const result = await emailOutageOnce(ctx, open, 'REPORT', { send, fetchImpl });
    expect(result).toEqual({ emailed: true, reason: 'sent' });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'outage' }));
    expect(calls.at(-1)).toEqual(['https://api.github.com/repos/o/r/issues/7/comments', 'POST']);
  });

  it('does not send again once the Issue carries the emailed note', async () => {
    const send = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ body: '<!-- site-uptime-probe:emailed -->\nsent' }]), { status: 200 }));
    expect(await emailOutageOnce(ctx, open, 'R', { send, fetchImpl })).toEqual({ emailed: false, reason: 'already_emailed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('writes no note when nothing was sent (not configured), so a later configured run can still send', async () => {
    const send = vi.fn(async () => ({ sent: false, reason: 'not_configured' }));
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => { calls.push(init?.method ?? 'GET'); return new Response('[]', { status: 200 }); });
    expect(await emailOutageOnce(ctx, open, 'R', { send, fetchImpl })).toEqual({ emailed: false, reason: 'not_configured' });
    expect(calls).toEqual(['GET']);
  });

  it('never throws', async () => {
    expect(await emailOutageOnce(ctx, open, 'R', { send: vi.fn(), fetchImpl: async () => { throw new Error('x'); } })).toEqual({ emailed: false, reason: 'error' });
  });
});

describe('nothing else can send', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel, out); } else out.push(rel);
    }
    return out;
  };

  it('only the uptime probe and the deploy failure alert import the sender, each with its own kind', () => {
    const importers = [...walk('scripts'), ...walk('functions'), ...walk('src')]
      .filter((f) => /\.(mjs|js|ts|tsx)$/.test(f) && f !== 'scripts/ops/alert-email.mjs' && read(f).includes('alert-email'))
      .sort();
    expect(importers).toEqual(['scripts/ops/pages-deploy-failure-alert.mjs', 'scripts/ops/site-uptime-probe.mjs']);
    expect(read('scripts/ops/site-uptime-probe.mjs')).toMatch(/kind: 'outage'/);
    expect(read('scripts/ops/pages-deploy-failure-alert.mjs')).toMatch(/kind: 'failed_deploy'/);
    for (const f of importers) expect([...read(f).matchAll(/kind: '([a-z_]+)'/g)].map((m) => m[1]).every((k) => ALERT_KINDS.includes(k))).toBe(true);
  });

  it('only those two workflows are given the alert credential', () => {
    const holders = walk('.github/workflows')
      .filter((f) => /ALERT_MAILCHANNELS_API_KEY/.test(read(f)))
      .sort();
    expect(holders).toEqual(['.github/workflows/ops-pages-deploy-failure.yml', '.github/workflows/ops-site-uptime-probe.yml']);
  });

  it('the deploy alert emails only when the failure Issue is first created', () => {
    const src = read('scripts/ops/pages-deploy-failure-alert.mjs');
    expect(src).toMatch(/if \(result\.action === 'created'\)[\s\S]*sendAlertEmail/);
  });
});
