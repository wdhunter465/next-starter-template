// #4906: scheduled Club Home regeneration. Dry run by default; freeze and minimum-stories guards; bridge token only.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../functions/_lib/content-inventory-club-home.ts', () => ({
  CLUB_HOME_SECTION: 'club_home',
  getActiveClubHomeEdition: vi.fn(async () => ({ active: { activated_at: '2026-11-09T11:00:00Z' }, edition: { id: 5 } })),
  regenerateClubHomeEdition: vi.fn(async () => ({ ok: true, edition_id: 6, previous_edition_id: 5, placements: new Array(7).fill({}) })),
}));
vi.mock('../functions/_lib/content-inventory-public.ts', () => ({ countPublishedInventoryForSection: vi.fn(async () => 12) }));
vi.mock('../functions/_lib/d1.ts', () => ({ requireTables: vi.fn(async () => ({ ok: true })) }));

import { onRequestPost, inFreeze, MIN_ELIGIBLE_STORIES, FREEZE_START, FREEZE_END } from '../functions/api/scheduled-content/club-home-regenerate.ts';
import * as lib from '../functions/_lib/content-inventory-club-home.ts';
import * as pub from '../functions/_lib/content-inventory-public.ts';
import { main, parseArgs, renderReport } from '../scripts/ops/club-home-regenerate.mjs';

const ROOT = process.cwd();
const TOKEN = 'regen-token';
const env = (extra = {}) => ({ DB: {}, SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, ...extra });
const call = (body, { token = TOKEN, e = env(), now = new Date('2026-11-16T11:00:00Z') } = {}) =>
  onRequestPost({
    env: e,
    now,
    request: new Request('https://www.lougehrigfanclub.com/api/scheduled-content/club-home-regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  });

beforeEach(() => {
  vi.mocked(lib.regenerateClubHomeEdition).mockClear();
  vi.mocked(pub.countPublishedInventoryForSection).mockResolvedValue(12);
});

describe('POST /api/scheduled-content/club-home-regenerate', () => {
  it('refuses no token, a wrong token and no configuration, and never regenerates', async () => {
    expect((await call({ apply: true }, { token: null })).status).toBe(401);
    expect([401, 403]).toContain((await call({ apply: true }, { token: 'x' })).status);
    expect((await call({ apply: true }, { e: env({ SCHEDULED_CONTENT_BRIDGE_TOKEN: '' }) })).status).toBe(503);
    expect((await call({ apply: true }, { e: { SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN } })).status).toBe(503);
    expect(lib.regenerateClubHomeEdition).not.toHaveBeenCalled();
  });

  it('is a dry run by default and when apply is not exactly true', async () => {
    for (const body of [undefined, {}, { apply: false }, { apply: 'true' }, { apply: 1 }]) {
      const out = await (await call(body)).json();
      expect(out).toMatchObject({ ok: true, applied: false, eligible_stories: 12, active_edition_id: 5 });
    }
    expect(lib.regenerateClubHomeEdition).not.toHaveBeenCalled();
  });

  it('regenerates with apply true outside the freeze with enough stories', async () => {
    const out = await (await call({ apply: true })).json();
    expect(out).toMatchObject({ ok: true, applied: true, edition_id: 6, previous_edition_id: 5, placements: 7 });
    expect(lib.regenerateClubHomeEdition).toHaveBeenCalledTimes(1);
    expect(vi.mocked(lib.regenerateClubHomeEdition).mock.calls[0][1].createdBy).toBe('scheduled-regenerate');
  });

  it('skips with fewer than 7 eligible stories', async () => {
    vi.mocked(pub.countPublishedInventoryForSection).mockResolvedValue(MIN_ELIGIBLE_STORIES - 1);
    const out = await (await call({ apply: true })).json();
    expect(out).toMatchObject({ ok: true, applied: false, skipped: 'fewer_than_7_eligible' });
    expect(lib.regenerateClubHomeEdition).not.toHaveBeenCalled();
  });

  it('skips inside the launch freeze, including both edge days, and applies the day after', async () => {
    for (const day of [FREEZE_START, '2027-03-25', FREEZE_END]) {
      const out = await (await call({ apply: true }, { now: new Date(`${day}T11:00:00Z`) })).json();
      expect(out).toMatchObject({ applied: false, skipped: 'launch_freeze', freeze: true });
    }
    expect(inFreeze('2026-12-30')).toBe(false);
    expect(inFreeze('2027-06-03')).toBe(false);
    expect(lib.regenerateClubHomeEdition).not.toHaveBeenCalled();
  });

  it('reports a failed regeneration with its status and does not claim success', async () => {
    vi.mocked(lib.regenerateClubHomeEdition).mockResolvedValueOnce({ ok: false, error: 'busy', status: 409, building_edition_id: 9 });
    const res = await call({ apply: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, error: 'busy', building_edition_id: 9 });
  });

  it('exports only the POST handler and its constants', async () => {
    const mod = await import('../functions/api/scheduled-content/club-home-regenerate.ts');
    expect(Object.keys(mod).sort()).toEqual(['FREEZE_END', 'FREEZE_START', 'MIN_ELIGIBLE_STORIES', 'inFreeze', 'onRequestPost']);
  });
});

describe('scripts/ops/club-home-regenerate.mjs', () => {
  it('parses --apply only', () => {
    expect(parseArgs([])).toEqual({ apply: false });
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
  });

  it('sends the bearer token and only the apply flag; skips are exit 0; failures exit 1', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = vi.fn(async () => new Response(JSON.stringify({ ok: true, applied: false, skipped: 'launch_freeze', eligible_stories: 12, active_edition_id: 5 }), { status: 200 }));
    expect(await main({ SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, BASE_URL: 'https://x.test' }, ['--apply'], ok)).toBe(0);
    const [url, init] = ok.mock.calls[0];
    expect(url).toBe('https://x.test/api/scheduled-content/club-home-regenerate');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body)).toEqual({ apply: true });
    expect(log.mock.calls[0][0]).toMatch(/Skipped \(launch_freeze\)/);
    const bad = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'busy' }), { status: 409 }));
    expect(await main({ SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN }, [], bad)).toBe(1);
    await expect(main({}, [], bad)).rejects.toThrow(/required/);
    log.mockRestore();
    err.mockRestore();
  });

  it('renders each outcome', () => {
    expect(renderReport({ applied: true, edition_id: 6, previous_edition_id: 5, placements: 7, eligible_stories: 12 })).toMatch(/new edition 6 \(was 5\), 7 placements/);
    expect(renderReport({ applied: false, eligible_stories: 3, active_edition_id: null })).toMatch(/Dry run: nothing changed/);
  });
});

describe('workflow gate', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/ops-club-home-edition-regenerate.yml'), 'utf8');
  it('scheduled runs apply only with CLUB_HOME_REGEN_APPLY=true; manual only with apply=true', () => {
    expect(wf).toMatch(/schedule' && vars\.CLUB_HOME_REGEN_APPLY == 'true' && 'true'/);
    expect(wf).toMatch(/workflow_dispatch' && inputs\.apply/);
  });
  it('is weekly, has least privilege and adds no secret beyond the bridge token', () => {
    expect(wf).toMatch(/cron: '0 11 \* \* 1'/);
    expect(wf).toMatch(/permissions:\n  contents: read\n  issues: write/);
    expect([...wf.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1])).toEqual(['SCHEDULED_CONTENT_BRIDGE_TOKEN']);
  });
});
