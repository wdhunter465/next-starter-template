import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildBaselineRecord,
  decideMonitorAction,
  normalizeLivePair,
  pairsEqual,
  pickReplacementPairIds,
  remediateBothSlotsViaD1,
  urlName,
  readBaseline,
  runMonitor,
} from '../scripts/ci/matchup_pair_monitor.mjs';

import { buildMatchupDriftFindingsBody as buildFindings } from '../scripts/ci/ops_matchup_drift_findings.mjs';

describe('matchup pair monitor helpers', () => {
  it('extracts URL basenames', () => {
    expect(urlName('https://cdn.example/photos/Gehrig_A.jpg?x=1')).toBe('Gehrig_A.jpg');
    expect(urlName('/photos/B%20two.png')).toBe('B two.png');
  });

  it('normalizes live pair payloads', () => {
    const live = normalizeLivePair({
      ok: true,
      week_start: '2026-08-03',
      matchup_id: 12,
      items: [
        { id: 1, url: 'https://cdn.example/a.jpg' },
        { id: 2, url: 'https://cdn.example/b.jpg' },
      ],
    });
    expect(live).toMatchObject({
      week_start: '2026-08-03',
      photo_a_id: 1,
      photo_b_id: 2,
      photo_a_name: 'a.jpg',
      photo_b_name: 'b.jpg',
      empty: false,
    });
  });

  it('detects equal vs drifted pairs', () => {
    const a = buildBaselineRecord(
      normalizeLivePair({
        ok: true,
        week_start: '2026-08-03',
        matchup_id: 1,
        items: [
          { id: 10, url: '/a.jpg' },
          { id: 20, url: '/b.jpg' },
        ],
      }),
    );
    const same = normalizeLivePair({
      ok: true,
      week_start: '2026-08-03',
      matchup_id: 1,
      items: [
        { id: 10, url: '/a.jpg' },
        { id: 20, url: '/b.jpg' },
      ],
    });
    const drifted = normalizeLivePair({
      ok: true,
      week_start: '2026-08-03',
      matchup_id: 1,
      items: [
        { id: 10, url: '/a.jpg' },
        { id: 99, url: '/other.jpg' },
      ],
    });
    expect(pairsEqual(a, same)).toBe(true);
    expect(pairsEqual(a, drifted)).toBe(false);
  });

  it('decides snapshot, ok, remediate, watch, and adopt', () => {
    const live = normalizeLivePair({
      ok: true,
      week_start: '2026-08-03',
      matchup_id: 1,
      items: [
        { id: 1, url: '/a.jpg' },
        { id: 2, url: '/b.jpg' },
      ],
    });
    expect(decideMonitorAction({ mode: 'auto', baseline: null, live }).action).toBe('snapshot');
    const baseline = buildBaselineRecord(live);
    expect(decideMonitorAction({ mode: 'auto', baseline, live }).action).toBe('ok');
    const drifted = { ...live, photo_b_id: 9, photo_b_name: 'x.jpg', photo_b_url: '/x.jpg' };
    expect(decideMonitorAction({ mode: 'auto', baseline, live: drifted }).action).toBe('drift_remediate');
    expect(decideMonitorAction({ mode: 'watch-only', baseline, live: drifted }).action).toBe('drift_watch');
    expect(decideMonitorAction({ mode: 'adopt-current', baseline, live: drifted }).action).toBe('adopt');
  });

  it('picks two replacement ids excluding current', () => {
    const picked = pickReplacementPairIds([1, 2, 3, 4], [1, 2]);
    expect(picked).toHaveLength(2);
    expect(picked[0]).not.toBe(1);
    expect(picked[1]).not.toBe(2);
    expect(picked[0]).not.toBe(picked[1]);
  });

  it('remediates both slots through injected D1', () => {
    const live = normalizeLivePair({
      ok: true,
      week_start: '2026-08-03',
      matchup_id: 7,
      items: [
        { id: 1, url: '/a.jpg' },
        { id: 2, url: '/b.jpg' },
      ],
    });
    const calls = [];
    const d1 = (sql) => {
      calls.push(sql);
      if (sql.startsWith('SELECT id FROM photos')) {
        return { rows: [{ id: 3 }, { id: 4 }, { id: 5 }] };
      }
      if (sql.startsWith('SELECT m.id')) {
        return {
          rows: [
            {
              matchup_id: 7,
              week_start: '2026-08-03',
              photo_a_id: 3,
              photo_b_id: 4,
              photo_a_url: '/c.jpg',
              photo_b_url: '/d.jpg',
            },
          ],
        };
      }
      return { rows: [] };
    };
    const next = remediateBothSlotsViaD1(live, { dbName: 'lgfc_lite', d1 });
    expect(next.photo_a_name).toBe('c.jpg');
    expect(next.photo_b_name).toBe('d.jpg');
    expect(calls.some((s) => s.includes('UPDATE weekly_matchups'))).toBe(true);
    expect(calls.some((s) => s.includes('DELETE FROM weekly_votes'))).toBe(true);
  });

  it('runMonitor snapshots missing baseline without remediating', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matchup-mon-'));
    const baselinePath = path.join(dir, 'baseline.json');
    const livePayload = {
      ok: true,
      week_start: '2026-08-03',
      matchup_id: 1,
      items: [
        { id: 10, url: 'https://cdn.example/A.jpg' },
        { id: 20, url: 'https://cdn.example/B.jpg' },
      ],
    };
    const result = await runMonitor(
      { MATCHUP_MONITOR_MODE: 'auto', MATCHUP_BASELINE_PATH: baselinePath },
      {
        fetchLivePair: async () => normalizeLivePair(livePayload),
        d1: () => ({ rows: [] }),
      },
    );
    expect(result.decision.action).toBe('snapshot');
    expect(result.remediated).toBe(false);
    expect(readBaseline(baselinePath)?.photo_a_name).toBe('A.jpg');
  });

  it('writes findings body for remediated drift', () => {
    const body = buildFindings({
      weekStart: '2026-08-03',
      fromA: 'old-a.jpg',
      fromB: 'old-b.jpg',
      toA: 'new-a.jpg',
      toB: 'new-b.jpg',
      remediated: true,
    });
    expect(body).toContain('ops-matchup-pair-drift-findings');
    expect(body).toContain('both');
    expect(body).toContain('0–0');
    expect(body).toContain('adopt-current');
  });
});

describe('matchup pair monitor photo gate (#5473)', () => {
  it('uses the shared public-photo rule, not the retired rights_hold and publication_eligible test', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/ci/matchup_pair_monitor.mjs'), 'utf8');
    expect(source).not.toMatch(/rights_hold\s*=\s*0/);
    expect(source).not.toMatch(/publication_eligible\s*=\s*1/);
    expect(source).toContain("NOT IN ('blocked', 'copyright_restricted')");
  });
});
