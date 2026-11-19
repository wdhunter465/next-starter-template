// @vitest-environment node
// #5331: the social post evidence endpoint appends validated record versions and never updates them.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet as evidenceGet, onRequestPost as evidencePost } from '../../functions/api/social/evidence';
import { validateEvidenceRecord as workerValidate } from '../../functions/_lib/social-evidence';
import { sha256Hex, toNewYorkIso, validateEvidenceRecord as nodeValidate } from '../../scripts/ops/social-evidence.mjs';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  const prepare = (sql: string) => {
    const stmt = sqlite.prepare(sql);
    const bound = (...args: SQLInputValue[]) => ({
      async first() {
        return stmt.get(...args) ?? null;
      },
      async all() {
        return { results: stmt.all(...args) };
      },
      async run() {
        stmt.run(...args);
        return { success: true };
      },
    });
    return { bind: bound };
  };
  return { sqlite, db: { prepare } };
}

const TOKEN = 'bridge-token';
const POST = '2026-11-09-daily';

const req = (method: string, body?: unknown, query = '', token = TOKEN) =>
  new Request(`https://example.test/api/social/evidence${query}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function validRecord(overrides: Record<string, any> = {}) {
  const text = overrides.text ?? 'A same-day social evidence record for Lou Gehrig Fan Club.';
  const created = overrides.created_at_utc ?? '2026-11-09T15:04:04Z';
  return {
    schema: 'social_post_evidence/1',
    post_id: POST,
    platform: 'x',
    origin: 'queue',
    version: 1,
    scheduled_for: '2026-11-09T10:00:00-05:00',
    text,
    text_sha256: sha256Hex(text),
    photo: {
      photo_id: 858,
      variant: 'original',
      image_url: 'https://www.lougehrigfanclub.com/api/social/image/2026-11-09-daily',
      image_sha256: '0'.repeat(64),
      image_bytes: 1234,
      width: 1024,
      height: 768,
      alt_text: 'Lou Gehrig at the ballpark.',
    },
    status: 'confirmed',
    attempts: [{ at_utc: created, by: 'test', outcome: 'ok', detail: 'recorded' }],
    platform_record: { post_id: 'platform-1', url: null, created_at_utc: created, created_at_new_york: toNewYorkIso(created) },
    verified: { on: '2026-11-09', by: 'test', method: 'unit test' },
    ...overrides,
  };
}

describe('social evidence endpoint', () => {
  it('rejects missing or wrong bridge tokens', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };

    expect((await evidencePost({ request: req('POST', validRecord(), '', ''), env })).status).toBe(401);
    expect((await evidenceGet({ request: req('GET', undefined, `?post_id=${POST}`, 'wrong'), env })).status).toBe(401);
  });

  it('appends a valid record and returns stored versions', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };

    const created = await evidencePost({ request: req('POST', validRecord()), env });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ ok: true, post_id: POST, platform: 'x', version: 1 });

    const listed = await (await evidenceGet({ request: req('GET', undefined, `?post_id=${POST}`), env })).json();
    expect(listed.rows).toHaveLength(1);
    expect(listed.rows[0]).toMatchObject({ post_id: POST, platform: 'x', version: 1, origin: 'queue', status: 'confirmed' });
    expect(listed.rows[0].record_json).toMatchObject({ schema: 'social_post_evidence/1', post_id: POST, version: 1 });
  });

  it('appends the next version, rejects a duplicate version, and leaves the original row unchanged', async () => {
    const { sqlite, db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };

    expect((await evidencePost({ request: req('POST', validRecord({ note: 'first version' })), env })).status).toBe(201);
    const second = validRecord({
      version: 2,
      supersedes: 1,
      status: 'handed_off',
      attempts: [{ at_utc: '2026-11-09T16:00:00Z', by: 'test', outcome: 'handed_off', detail: 'handoff recorded' }],
      platform_record: null,
      note: 'second version',
    });
    expect((await evidencePost({ request: req('POST', second), env })).status).toBe(201);

    const duplicate = await evidencePost({ request: req('POST', { ...second, note: 'changed duplicate' }), env });
    expect(duplicate.status).toBe(409);

    const rows = sqlite
      .prepare('SELECT version, status, record_json FROM social_post_evidence WHERE post_id = ? AND platform = ? ORDER BY version')
      .all(POST, 'x') as Array<{ version: number; status: string; record_json: string }>;
    expect(rows.map((row) => [row.version, row.status])).toEqual([
      [1, 'confirmed'],
      [2, 'handed_off'],
    ]);
    expect(JSON.parse(rows[1].record_json).note).toBe('second version');
  });

  it('rejects invalid records, contact-like unknown fields, and queue records for unknown posts', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };

    const badHash = await evidencePost({ request: req('POST', validRecord({ text_sha256: 'f'.repeat(64) })), env });
    expect(badHash.status).toBe(400);
    expect(await badHash.json()).toMatchObject({ error: 'invalid evidence record' });

    const contact = await evidencePost({ request: req('POST', validRecord({ operator_email: 'person@example.test' })), env });
    expect(contact.status).toBe(400);
    expect((await contact.json()).problems.join('\n')).toMatch(/contact data/);

    const unknown = await evidencePost({ request: req('POST', validRecord({ post_id: '2099-01-01-daily' })), env });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ error: 'unknown post_id' });
  });

  it('rejects duplicate ad hoc versions and accepts an ad hoc id shape', async () => {
    const { db } = makeDb();
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN };
    const record = validRecord({
      post_id: 'adhoc-2026-11-09-1',
      origin: 'ad_hoc',
      note: 'Bill asked for this post to announce the event because the daily queue did not cover it.',
    });

    expect((await evidencePost({ request: req('POST', record), env })).status).toBe(201);
    expect((await evidencePost({ request: req('POST', record), env })).status).toBe(409);
  });

  it('keeps the Worker validator aligned with the shared Node validator for record-shape fixtures', async () => {
    const good = validRecord();
    const bad = { ...good, attempts: [{ at_utc: 'not a date', by: '', outcome: 'nope' }] };

    expect(await workerValidate(good)).toEqual(nodeValidate(good));
    expect(await workerValidate(bad)).toEqual(nodeValidate(bad));
  });
});
