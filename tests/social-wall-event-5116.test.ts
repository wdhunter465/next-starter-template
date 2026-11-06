// #5116: logging when the social wall falls back. The real endpoint runs against a real-schema
// in-memory SQLite database (every migration applied); only the call to Elfsight is replaced.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SOCIAL_WALL_WIDGET_ID } from '@/lib/socialFallbacks';
import {
  currentWidgetReason,
  reasonFromBoot,
  REASON_CACHE_MS,
  REASON_CLIENT_RENDER_FAILED,
  REASON_UNREACHABLE,
  resetWidgetReasonCache,
  SOCIAL_WALL_ELFSIGHT_WIDGET_UUID,
} from '../functions/_lib/social-wall-status';

const bootBody = (widget: Record<string, unknown>) => ({ status: 1, data: { widgets: { [SOCIAL_WALL_ELFSIGHT_WIDGET_UUID]: widget }, assets: [] } });

// The exact response Elfsight gave for the club's widget on 2026-11-06.
const LIMIT_REACHED = bootBody({ status: 0, reason: 'APP_VIEWS_LIMIT_REACHED' });

function migrate(sqlite: DatabaseSync) {
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
}

function d1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return { success: true, meta: { changes: Number(info.changes) } };
        },
      });
      return { bind: bound, ...bound() };
    },
  };
}

const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);
const { onRequestPost, MAX_PER_MINUTE } = await import('../functions/api/social-wall-event');

function elfsight(body: unknown, ok = true) {
  fetchSpy.mockResolvedValue({ ok, json: async () => body });
}

function call(sqlite: DatabaseSync) {
  return onRequestPost({ env: { DB: d1(sqlite) }, request: new Request('https://www.lougehrigfanclub.com/api/social-wall-event', { method: 'POST' }) } as any);
}

beforeEach(() => {
  fetchSpy.mockReset();
  resetWidgetReasonCache();
});

describe('reading Elfsight\'s reason (#5116)', () => {
  it('reads the real limit-reached response', () => {
    expect(reasonFromBoot(LIMIT_REACHED)).toBe('APP_VIEWS_LIMIT_REACHED');
  });

  it('keeps Elfsight\'s own reason for other conditions', () => {
    expect(reasonFromBoot(bootBody({ status: 0, reason: 'WIDGET_DISABLED' }))).toBe('WIDGET_DISABLED');
  });

  it('calls a working widget that did not render a client render failure', () => {
    expect(reasonFromBoot(bootBody({ status: 1 }))).toBe(REASON_CLIENT_RENDER_FAILED);
  });

  it('treats anything unexpected as unreachable and never stores free text', () => {
    for (const body of [null, {}, { data: {} }, 'x', bootBody({ status: 0 }), bootBody({ status: 0, reason: 'drop table; --' }), bootBody({ status: 0, reason: 'x'.repeat(500) })]) {
      expect(reasonFromBoot(body)).toBe(REASON_UNREACHABLE);
    }
  });

  it('asks Elfsight once per five minutes, not once per visitor', async () => {
    elfsight(LIMIT_REACHED);
    const t0 = 1_000_000;
    expect(await currentWidgetReason({ now: t0 })).toBe('APP_VIEWS_LIMIT_REACHED');
    expect(await currentWidgetReason({ now: t0 + 60_000 })).toBe('APP_VIEWS_LIMIT_REACHED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await currentWidgetReason({ now: t0 + REASON_CACHE_MS + 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('never throws when Elfsight is down or slow', async () => {
    fetchSpy.mockRejectedValue(new Error('boom'));
    expect(await currentWidgetReason()).toBe(REASON_UNREACHABLE);
    resetWidgetReasonCache();
    elfsight({}, false);
    expect(await currentWidgetReason()).toBe(REASON_UNREACHABLE);
  });

  it('uses the same widget as the page', () => {
    expect(SOCIAL_WALL_WIDGET_ID).toBe(`elfsight-app-${SOCIAL_WALL_ELFSIGHT_WIDGET_UUID}`);
  });
});

describe('POST /api/social-wall-event (#5116)', () => {
  it('records one row with the time, Elfsight\'s reason and the widget id, and nothing else', async () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite);
    elfsight(LIMIT_REACHED);

    const res = await call(sqlite);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, logged: true });

    const rows = sqlite.prepare(`SELECT * FROM social_wall_events`).all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['id', 'occurred_at', 'reason', 'widget_id']);
    expect(rows[0]).toMatchObject({ reason: 'APP_VIEWS_LIMIT_REACHED', widget_id: SOCIAL_WALL_ELFSIGHT_WIDGET_UUID });
    expect(String(rows[0].occurred_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('takes nothing from the request: a hostile body or header changes nothing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite);
    elfsight(LIMIT_REACHED);
    const res = await onRequestPost({
      env: { DB: d1(sqlite) },
      request: new Request('https://www.lougehrigfanclub.com/api/social-wall-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'secret-agent', 'CF-Connecting-IP': '198.51.100.7' },
        body: JSON.stringify({ reason: "x'); DROP TABLE social_wall_events;--", email: 'a@b.c' }),
      }),
    } as any);
    expect(res.status).toBe(202);
    const rows = sqlite.prepare(`SELECT reason FROM social_wall_events`).all();
    expect(rows).toEqual([{ reason: 'APP_VIEWS_LIMIT_REACHED' }]);
    expect(JSON.stringify(sqlite.prepare(`SELECT * FROM social_wall_events`).all())).not.toMatch(/secret-agent|198\.51|a@b\.c/);
  });

  it('caps writes at the per-minute limit so a script cannot flood the table', async () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite);
    elfsight(LIMIT_REACHED);
    for (let i = 0; i < MAX_PER_MINUTE + 15; i += 1) await call(sqlite);
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM social_wall_events`).get()).toEqual({ n: MAX_PER_MINUTE });
  });

  it('still logs, as unreachable, when Elfsight does not answer, and answers 202', async () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite);
    fetchSpy.mockRejectedValue(new Error('timeout'));
    const res = await call(sqlite);
    expect(res.status).toBe(202);
    expect(sqlite.prepare(`SELECT reason FROM social_wall_events`).all()).toEqual([{ reason: REASON_UNREACHABLE }]);
  });

  it('answers 202 and writes nothing when the table is not migrated yet', async () => {
    const sqlite = new DatabaseSync(':memory:');
    const res = await call(sqlite);
    expect(res.status).toBe(202);
  });
});

describe('social_wall_monthly view (#5116)', () => {
  it('gives the first day the limit was reached and how many fallbacks followed, per month', () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite);
    const insert = sqlite.prepare(`INSERT INTO social_wall_events (occurred_at, reason, widget_id) VALUES (?, ?, 'w')`);
    insert.run('2026-11-06T13:00:00.000Z', 'APP_VIEWS_LIMIT_REACHED');
    insert.run('2026-11-06T15:30:00.000Z', 'APP_VIEWS_LIMIT_REACHED');
    insert.run('2026-11-20T09:00:00.000Z', 'APP_VIEWS_LIMIT_REACHED');
    insert.run('2026-11-21T09:00:00.000Z', 'CLIENT_RENDER_FAILED');
    insert.run('2026-12-01T00:10:00.000Z', 'APP_VIEWS_LIMIT_REACHED');

    const rows = sqlite.prepare(`SELECT * FROM social_wall_monthly ORDER BY month, reason`).all();
    expect(rows).toEqual([
      { month: '2026-11', reason: 'APP_VIEWS_LIMIT_REACHED', events: 3, first_at: '2026-11-06T13:00:00.000Z', last_at: '2026-11-20T09:00:00.000Z' },
      { month: '2026-11', reason: 'CLIENT_RENDER_FAILED', events: 1, first_at: '2026-11-21T09:00:00.000Z', last_at: '2026-11-21T09:00:00.000Z' },
      { month: '2026-12', reason: 'APP_VIEWS_LIMIT_REACHED', events: 1, first_at: '2026-12-01T00:10:00.000Z', last_at: '2026-12-01T00:10:00.000Z' },
    ]);
  });
});
