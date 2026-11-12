import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateEvidenceRecord } from '../scripts/ops/social-evidence.mjs';
import { buildCreatePostArgs, jpegSize, pngSize, recordLedger, run, selectXPosts } from '../scripts/ops/social-post-x.mjs';

const real = JSON.parse(readFileSync('data/social-post-queue.json', 'utf8'));
const T = (s) => Date.parse(s);

function fakeSite(rowsByPost = {}) {
  const writes = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (init.method === 'POST') {
      const row = JSON.parse(init.body);
      writes.push(row);
      return json(201, { ok: true });
    }
    return json(200, { ok: true, rows: rowsByPost[u.searchParams.get('post_id')] ?? [] });
  };
  return { fetchImpl, writes };
}

const env = { SCHEDULED_CONTENT_BRIDGE_TOKEN: 't', BUFFER_API_KEY: 'k' };

describe('X posting', () => {
  it('leaves posts before automation_starts_at to the manual process', () => {
    expect(real.automation_starts_at).toBeTruthy();
    expect(selectXPosts(real, T('2026-11-09T15:30:00Z'))).toEqual([]);
    expect(selectXPosts(real, T('2026-11-10T15:30:00Z')).map((p) => p.id)).toEqual(['2026-11-10-daily']);
  });

  it('builds a Buffer post with the published-only image and alt text', () => {
    const args = buildCreatePostArgs(real.posts[1], 'c1', 'https://example.test');
    expect(args).toMatchObject({ channelId: 'c1', schedulingType: 'automatic', mode: 'shareNow' });
    expect(args.assets[0].image.url).toBe('https://example.test/api/social/image/2026-11-10-daily');
    expect(args.assets[0].image.metadata.altText).toBe(real.posts[1].alt_text);
  });

  it('dry run reads the ledger, posts nothing and writes nothing', async () => {
    const { fetchImpl, writes } = fakeSite();
    const report = await run({ ...env, NOW: '2026-11-10T15:30:00Z' }, { fetch: fetchImpl });
    expect(report.mode).toBe('dry-run');
    expect(report.skipped[0]).toMatchObject({ id: '2026-11-10-daily', reason: 'dry run' });
    expect(writes).toEqual([]);
  });

  it('posts once, records the ledger, and a post already in the ledger is not sent again', async () => {
    const calls = [];
    const client = { callTool: async (name, args) => (calls.push({ name, args }), { id: 'buf-1' }) };
    const first = fakeSite();
    const r1 = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:30:00Z' }, { fetch: first.fetchImpl, client });
    expect(r1.posted).toEqual([{ id: '2026-11-10-daily', platform_post_id: 'buf-1' }]);
    expect(first.writes[0]).toMatchObject({ post_id: '2026-11-10-daily', platform: 'x', status: 'posted', platform_post_id: 'buf-1' });

    const second = fakeSite({ '2026-11-10-daily': [{ platform: 'x', status: 'posted' }] });
    const r2 = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:45:00Z' }, { fetch: second.fetchImpl, client });
    expect(r2.skipped[0].reason).toBe('already posted');
    expect(calls).toHaveLength(1);
  });

  it('records a failed row and reports the failure when Buffer errors', async () => {
    const client = { callTool: async () => { throw new Error('buffer down'); } };
    const site = fakeSite();
    const report = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:30:00Z' }, { fetch: site.fetchImpl, client });
    expect(report.failed[0]).toMatchObject({ id: '2026-11-10-daily', step: 'buffer' });
    expect(site.writes[0]).toMatchObject({ status: 'failed', platform: 'x' });
  });

  it('retries a failed ledger write and accepts a 409', async () => {
    let n = 0;
    const fetchImpl = async () => new Response('{}', { status: ++n < 3 ? 500 : 409 });
    expect((await recordLedger(fetchImpl, 'https://x.test', 't', {})).status).toBe(409);
    expect(n).toBe(3);
  });
});

describe('X same-day evidence capture (#5202)', () => {
  const POST_ID = '2026-11-10-daily';
  const BUF = 'a'.repeat(24);
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x00, 0x04, 0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // a JPEG header, 1024 x 768
  const sha = createHash('sha256').update(bytes).digest('hex');
  const sleep = async () => {};

  function site(rowsByPost = {}) {
    const inner = fakeSite(rowsByPost);
    const fetchImpl = async (url, init) => {
      if (String(url).includes('/api/social/image/')) return new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });
      return inner.fetchImpl(url, init);
    };
    return { fetchImpl, writes: inner.writes };
  }
  const buffer = ({ createId = BUF, statuses = ['sent'], error } = {}) => {
    const calls = [];
    let read = 0;
    return {
      calls,
      callTool: async (name) => {
        calls.push(name);
        if (name === 'create_post') {
          if (error) throw new Error(error);
          return { id: createId };
        }
        const status = statuses[Math.min(read, statuses.length - 1)];
        read += 1;
        return { post: { id: createId, status, sentAt: status === 'sent' ? '2026-11-10T15:04:04.649Z' : undefined, error: status === 'error' ? 'Rejected by X' : undefined, assets: [{ image: { width: 1024, height: 768 } }] } };
      },
    };
  };
  const dayFile = (dir) => join(dir, 'data/social-audit/2026/11/2026-11-10.json');
  const readDay = (dir) => JSON.parse(readFileSync(dayFile(dir), 'utf8'));
  const runApply = (dir, deps, now = '2026-11-10T15:30:00Z') => run({ ...env, APPLY: 'true', NOW: now, AUDIT_DIR: dir }, { sleep, ...deps });

  it('records a confirmed, valid record the same day with the image hash and the Buffer id and time', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-'));
    const s = site();
    const report = await runApply(dir, { fetch: s.fetchImpl, client: buffer() });
    expect(report.failed).toEqual([]);
    const day = readDay(dir);
    expect(day.records).toHaveLength(1);
    const r = day.records[0];
    expect(validateEvidenceRecord(r)).toEqual([]);
    expect(r).toMatchObject({ post_id: POST_ID, platform: 'x', status: 'confirmed', version: 1 });
    expect(r.platform_record).toMatchObject({ post_id: BUF, created_at_utc: '2026-11-10T15:04:04.649Z', created_at_new_york: '2026-11-10T10:04:04-05:00' });
    expect(r.photo.image_sha256).toBe(sha);
    expect(r.photo).toMatchObject({ width: 1024, height: 768, image_bytes: bytes.length });
    rmSync(dir, { recursive: true });
  });

  it('records a failed attempt, and the retry becomes version 2 keeping the failed attempt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-'));
    const s = site();
    const first = await runApply(dir, { fetch: s.fetchImpl, client: buffer({ error: 'buffer down' }) });
    expect(first.failed).toHaveLength(1);
    expect(first.failed[0].step).toBe('buffer');
    expect(readDay(dir).records[0]).toMatchObject({ status: 'failed', version: 1 });
    expect(readDay(dir).records[0].attempts[0]).toMatchObject({ outcome: 'error' });

    const retrySite = site({ [POST_ID]: [{ platform: 'x', status: 'failed' }] });
    const second = await runApply(dir, { fetch: retrySite.fetchImpl, client: buffer() }, '2026-11-10T16:00:00Z');
    expect(second.failed).toEqual([]);
    const day = readDay(dir);
    expect(day.records).toHaveLength(2);
    expect(day.records[0].status).toBe('failed');
    expect(day.records[1]).toMatchObject({ status: 'confirmed', version: 2, supersedes: 1 });
    expect(day.records[1].attempts).toHaveLength(2);
    expect(day.records[1].attempts[0].outcome).toBe('error');
    rmSync(dir, { recursive: true });
  });

  it('records a failed record and reports it when Buffer accepts the post but then reports an error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-'));
    const s = site();
    const report = await runApply(dir, { fetch: s.fetchImpl, client: buffer({ statuses: ['error'] }) });
    expect(report.failed).toEqual([{ id: POST_ID, step: 'buffer-send', error: 'Rejected by X' }]);
    expect(readDay(dir).records[0]).toMatchObject({ status: 'failed' });
    rmSync(dir, { recursive: true });
  });

  it('records handed_off when Buffer is still sending, and the next tick confirms it as version 2', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-'));
    const client = buffer({ statuses: ['sending', 'sending', 'sending', 'sending', 'sending', 'sent'] });
    await runApply(dir, { fetch: site().fetchImpl, client });
    expect(readDay(dir).records[0]).toMatchObject({ status: 'handed_off', version: 1 });

    const posted = site({ [POST_ID]: [{ platform: 'x', status: 'posted' }] });
    const report = await runApply(dir, { fetch: posted.fetchImpl, client }, '2026-11-10T15:45:00Z');
    expect(report.failed).toEqual([]);
    expect(readDay(dir).records[1]).toMatchObject({ status: 'confirmed', version: 2, supersedes: 1 });
    expect(client.calls.filter((c) => c === 'create_post')).toHaveLength(1);
    rmSync(dir, { recursive: true });
  });

  it('fails loudly when the record cannot be written, and never posts twice', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-'));
    const blocked = join(dir, 'blocked');
    writeFileSync(blocked, 'a file, not a folder');
    const client = buffer();
    const s = site();
    const report = await runApply(blocked, { fetch: s.fetchImpl, client });
    expect(report.failed.map((f) => f.step)).toEqual(['audit-write']);
    expect(report.posted).toHaveLength(1);
    expect(s.writes[0]).toMatchObject({ status: 'posted' });

    const again = site({ [POST_ID]: [{ platform: 'x', status: 'posted' }] });
    await runApply(blocked, { fetch: again.fetchImpl, client }, '2026-11-10T15:45:00Z');
    expect(client.calls.filter((c) => c === 'create_post')).toHaveLength(1);
    rmSync(dir, { recursive: true });
  });

  it('a dry run shows the record it would write and writes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-'));
    const report = await run({ ...env, NOW: '2026-11-10T15:30:00Z', AUDIT_DIR: dir }, { fetch: site().fetchImpl });
    expect(report.skipped[0].would_record.file).toBe('data/social-audit/2026/11/2026-11-10.json');
    expect(existsSync(dayFile(dir))).toBe(false);
    rmSync(dir, { recursive: true });
  });

  it('writes nothing and changes nothing when AUDIT_DIR is not set', async () => {
    const report = await run({ ...env, APPLY: 'true', NOW: '2026-11-10T15:30:00Z' }, { fetch: site().fetchImpl, client: buffer() });
    expect(report.evidence).toEqual([]);
    expect(report.posted).toHaveLength(1);
  });

  it('reads a JPEG size from its frame header', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x00, 0x04, 0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(jpegSize(jpeg)).toEqual({ width: 1024, height: 768 });
    expect(jpegSize(Buffer.from('not a jpeg'))).toBeNull();
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(pngSize(png)).toEqual({ width: 640, height: 480 });
  });
});
