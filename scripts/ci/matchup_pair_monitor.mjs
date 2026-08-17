#!/usr/bin/env node
/**
 * Weekly Photo Matchup pair monitor (#3031)
 *
 * - Snapshot live pair (ids + URL names) for the current week_start
 * - Detect mid-week drift vs Monday/baseline snapshot
 * - On drift (auto mode): replace BOTH photos via remote D1, clear votes to 0–0,
 *   adopt the new pair as baseline
 *
 * Modes (MATCHUP_MONITOR_MODE):
 *   auto           — snapshot if missing/new week; remediate on drift (default)
 *   adopt-current  — write baseline from live pair without remediating
 *   watch-only     — report drift; do not mutate D1
 *
 * Env:
 *   MATCHUP_PUBLIC_URL   — default https://www.lougehrigfanclub.com/api/matchup/current
 *   MATCHUP_BASELINE_PATH — JSON baseline file (Actions cache restore path)
 *   MATCHUP_MONITOR_MODE — auto | adopt-current | watch-only
 *   DRY_RUN=1            — skip D1 writes
 *   D1_DATABASE_NAME / CLOUDFLARE_* — required for remediate
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_PUBLIC_URL = 'https://www.lougehrigfanclub.com/api/matchup/current';

export function urlName(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url, 'https://example.invalid');
    const base = path.basename(u.pathname);
    return decodeURIComponent(base || u.pathname || url).trim();
  } catch {
    const cleaned = url.split('?')[0].split('#')[0];
    return path.basename(cleaned) || cleaned;
  }
}

export function normalizeLivePair(payload) {
  if (!payload || payload.ok !== true) {
    throw new Error(`matchup current response not ok: ${JSON.stringify(payload)}`);
  }
  const weekStart = String(payload.week_start || '').trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!weekStart || items.length < 2) {
    return {
      week_start: weekStart || null,
      matchup_id: payload.matchup_id ?? null,
      photo_a_id: null,
      photo_b_id: null,
      photo_a_url: null,
      photo_b_url: null,
      photo_a_name: null,
      photo_b_name: null,
      empty: true,
    };
  }
  const a = items[0];
  const b = items[1];
  const aUrl = String(a?.url || '');
  const bUrl = String(b?.url || '');
  return {
    week_start: weekStart,
    matchup_id: payload.matchup_id == null ? null : Number(payload.matchup_id),
    photo_a_id: Number(a?.id),
    photo_b_id: Number(b?.id),
    photo_a_url: aUrl,
    photo_b_url: bUrl,
    photo_a_name: urlName(aUrl),
    photo_b_name: urlName(bUrl),
    empty: false,
  };
}

export function pairsEqual(baseline, live) {
  if (!baseline || !live) return false;
  if (baseline.week_start !== live.week_start) return false;
  if (baseline.empty || live.empty) return Boolean(baseline.empty && live.empty);
  const idMatch =
    Number(baseline.photo_a_id) === Number(live.photo_a_id) &&
    Number(baseline.photo_b_id) === Number(live.photo_b_id);
  const nameMatch =
    String(baseline.photo_a_name || '') === String(live.photo_a_name || '') &&
    String(baseline.photo_b_name || '') === String(live.photo_b_name || '');
  return idMatch && nameMatch;
}

export function decideMonitorAction({ mode, baseline, live }) {
  const m = String(mode || 'auto').trim().toLowerCase();
  if (live.empty) {
    return { action: 'noop_empty', reason: 'live_pair_empty', writeBaseline: false, remediate: false };
  }
  if (m === 'adopt-current') {
    return { action: 'adopt', reason: 'operator_adopt_current', writeBaseline: true, remediate: false };
  }
  if (!baseline || baseline.week_start !== live.week_start) {
    return { action: 'snapshot', reason: 'missing_or_new_week_baseline', writeBaseline: true, remediate: false };
  }
  if (pairsEqual(baseline, live)) {
    return { action: 'ok', reason: 'pair_matches_baseline', writeBaseline: false, remediate: false };
  }
  if (m === 'watch-only') {
    return { action: 'drift_watch', reason: 'pair_drift_detected', writeBaseline: false, remediate: false };
  }
  return { action: 'drift_remediate', reason: 'pair_drift_detected', writeBaseline: true, remediate: true };
}

export function buildBaselineRecord(live, { adoptedAt = new Date().toISOString(), source = 'monitor' } = {}) {
  return {
    schema_version: 1,
    source_issue: '#3031',
    adopted_at: adoptedAt,
    source,
    week_start: live.week_start,
    matchup_id: live.matchup_id,
    photo_a_id: live.photo_a_id,
    photo_b_id: live.photo_b_id,
    photo_a_url: live.photo_a_url,
    photo_b_url: live.photo_b_url,
    photo_a_name: live.photo_a_name,
    photo_b_name: live.photo_b_name,
  };
}

export function readBaseline(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return null;
  const parsed = JSON.parse(raw);
  if (!parsed?.week_start) return null;
  return parsed;
}

export function writeBaseline(filePath, record) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

export async function fetchLivePair(publicUrl = DEFAULT_PUBLIC_URL, fetchImpl = fetch) {
  const response = await fetchImpl(publicUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'lgfc-matchup-pair-monitor/1.0' },
  });
  if (!response.ok) {
    throw new Error(`GET ${publicUrl} failed: ${response.status}`);
  }
  return normalizeLivePair(await response.json());
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', 'wrangler'];
}

export function parseWranglerJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
  // wrangler may print non-JSON banners; find last JSON array/object
  const startArr = text.lastIndexOf('[');
  const startObj = text.lastIndexOf('{');
  const start = Math.max(startArr, startObj);
  if (start < 0) return null;
  return JSON.parse(text.slice(start));
}

export function extractD1Rows(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    // [{ results: [...] }] or [[{...}]]
    for (const entry of parsed) {
      if (entry && Array.isArray(entry.results)) return entry.results;
      if (Array.isArray(entry)) return entry;
    }
    if (parsed.length && typeof parsed[0] === 'object' && !Array.isArray(parsed[0]) && 'id' in parsed[0]) {
      return parsed;
    }
  }
  if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

export function wranglerD1Command(sql, { dbName, dryRun = false, spawn = spawnSync } = {}) {
  if (dryRun) {
    return { dryRun: true, sql, rows: [] };
  }
  const cmd = resolveWranglerCmd();
  const args = [...cmd.slice(1), 'd1', 'execute', dbName, '--remote', '--command', sql, '--json'];
  const bin = cmd[0];
  const result = spawn(bin, args, {
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  const parsed = parseWranglerJson(result.stdout);
  return { dryRun: false, sql, rows: extractD1Rows(parsed), raw: parsed };
}

export function pickReplacementPairIds(candidateIds, excludeIds) {
  const exclude = new Set([...excludeIds].map(Number));
  const pool = candidateIds.map(Number).filter((id) => Number.isFinite(id) && id > 0 && !exclude.has(id));
  if (pool.length < 2) return null;
  // deterministic shuffle via Fisher-Yates with Math.random (runtime)
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return [shuffled[0], shuffled[1]];
}

export function remediateBothSlotsViaD1(
  live,
  {
    dbName,
    dryRun = false,
    d1 = wranglerD1Command,
  } = {},
) {
  if (!live?.matchup_id) {
    throw new Error('cannot remediate without matchup_id');
  }
  const exclude = [live.photo_a_id, live.photo_b_id];
  const candidates = d1(
    `SELECT id FROM photos WHERE url IS NOT NULL AND TRIM(url) != '' AND is_matchup_eligible >= 0 AND COALESCE(is_memorabilia, 0) = 0 AND rights_hold = 0 AND publication_eligible = 1 ORDER BY RANDOM() LIMIT 40;`,
    { dbName, dryRun },
  );
  let ids = (candidates.rows || []).map((r) => Number(r.id));
  if (ids.length < 2) {
    const fallback = d1(
      `SELECT id FROM photos WHERE url IS NOT NULL AND TRIM(url) != '' AND is_matchup_eligible >= 0 AND rights_hold = 0 AND publication_eligible = 1 ORDER BY RANDOM() LIMIT 40;`,
      { dbName, dryRun },
    );
    ids = (fallback.rows || []).map((r) => Number(r.id));
  }
  if (dryRun) {
    // synthetic pick for dry-run decision path when D1 returns empty
    ids = ids.length >= 2 ? ids : [900001, 900002];
  }
  const picked = pickReplacementPairIds(ids, exclude);
  if (!picked) {
    throw new Error('no eligible replacement pair available');
  }
  const [nextA, nextB] = picked;
  d1(
    `UPDATE weekly_matchups SET photo_a_id = ${nextA}, photo_b_id = ${nextB}, status = 'active' WHERE id = ${Number(live.matchup_id)};`,
    { dbName, dryRun },
  );
  d1(`DELETE FROM weekly_votes WHERE week_start = '${String(live.week_start).replace(/'/g, "''")}';`, {
    dbName,
    dryRun,
  });

  const refreshed = d1(
    `SELECT m.id AS matchup_id, m.week_start AS week_start, m.photo_a_id AS photo_a_id, m.photo_b_id AS photo_b_id, a.url AS photo_a_url, b.url AS photo_b_url FROM weekly_matchups m JOIN photos a ON a.id = m.photo_a_id AND a.rights_hold = 0 AND a.publication_eligible = 1 JOIN photos b ON b.id = m.photo_b_id AND b.rights_hold = 0 AND b.publication_eligible = 1 WHERE m.id = ${Number(live.matchup_id)} LIMIT 1;`,
    { dbName, dryRun },
  );
  const row = dryRun
    ? {
        matchup_id: live.matchup_id,
        week_start: live.week_start,
        photo_a_id: nextA,
        photo_b_id: nextB,
        photo_a_url: `/dry-run/${nextA}.jpg`,
        photo_b_url: `/dry-run/${nextB}.jpg`,
      }
    : refreshed.rows?.[0];
  if (!row) throw new Error('remediate succeeded but could not re-read matchup');

  return normalizeLivePair({
    ok: true,
    week_start: row.week_start,
    matchup_id: row.matchup_id,
    items: [
      { id: Number(row.photo_a_id), url: String(row.photo_a_url) },
      { id: Number(row.photo_b_id), url: String(row.photo_b_url) },
    ],
  });
}

function writeGithubOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  fs.appendFileSync(out, `${name}=${String(value).replace(/\n/g, '%0A')}\n`);
}

function writeStepSummary(lines) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  fs.appendFileSync(summary, `${lines.join('\n')}\n`);
}

export async function runMonitor(env = process.env, deps = {}) {
  const mode = String(env.MATCHUP_MONITOR_MODE || 'auto').trim().toLowerCase();
  const publicUrl = env.MATCHUP_PUBLIC_URL || DEFAULT_PUBLIC_URL;
  const baselinePath =
    env.MATCHUP_BASELINE_PATH || path.resolve(process.cwd(), '.cache/matchup-pair-baseline.json');
  const dryRun = String(env.DRY_RUN || '0') === '1';
  const dbName = env.D1_DATABASE_NAME || env.D1_DATABASE_ID || 'lgfc_lite';

  const fetchImpl = deps.fetchImpl || fetch;
  const d1 = deps.d1 || wranglerD1Command;

  const live = await (deps.fetchLivePair
    ? deps.fetchLivePair(publicUrl, fetchImpl)
    : fetchLivePair(publicUrl, fetchImpl));
  const baseline = deps.baseline !== undefined ? deps.baseline : readBaseline(baselinePath);
  const decision = decideMonitorAction({ mode, baseline, live });

  const result = {
    mode,
    decision,
    baseline,
    live,
    remediated: false,
    new_baseline: null,
    dry_run: dryRun,
  };

  if (decision.action === 'noop_empty') {
    writeGithubOutput('action', decision.action);
    writeGithubOutput('drift', 'false');
    writeGithubOutput('remediated', 'false');
    writeStepSummary([
      '## Matchup pair monitor',
      `- Mode: ${mode}`,
      `- Action: ${decision.action} (${decision.reason})`,
      '- Live pair empty — no baseline write.',
    ]);
    return result;
  }

  if (decision.action === 'ok') {
    writeGithubOutput('action', decision.action);
    writeGithubOutput('drift', 'false');
    writeGithubOutput('remediated', 'false');
    writeGithubOutput('week_start', live.week_start);
    writeStepSummary([
      '## Matchup pair monitor',
      `- Mode: ${mode}`,
      `- Week: ${live.week_start}`,
      `- Pair: ${live.photo_a_name} / ${live.photo_b_name}`,
      '- Status: matches baseline',
    ]);
    return result;
  }

  if (decision.action === 'drift_watch') {
    writeGithubOutput('action', decision.action);
    writeGithubOutput('drift', 'true');
    writeGithubOutput('remediated', 'false');
    writeGithubOutput('week_start', live.week_start);
    writeGithubOutput('from_a', baseline?.photo_a_name || '');
    writeGithubOutput('from_b', baseline?.photo_b_name || '');
    writeGithubOutput('to_a', live.photo_a_name || '');
    writeGithubOutput('to_b', live.photo_b_name || '');
    writeStepSummary([
      '## Matchup pair monitor — DRIFT (watch-only)',
      `- Week: ${live.week_start}`,
      `- Baseline: ${baseline.photo_a_name} / ${baseline.photo_b_name}`,
      `- Live: ${live.photo_a_name} / ${live.photo_b_name}`,
      '- No D1 mutation (watch-only).',
    ]);
    return result;
  }

  let adopted = live;
  if (decision.remediate) {
    adopted = remediateBothSlotsViaD1(live, { dbName, dryRun, d1 });
    result.remediated = true;
    result.remediate_from = live;
    result.remediate_to = adopted;
  }

  if (decision.writeBaseline) {
    const record = buildBaselineRecord(adopted, {
      source: decision.remediate ? 'ci_remediate_both' : decision.action === 'adopt' ? 'adopt_current' : 'monday_snapshot',
    });
    if (!deps.skipWrite) writeBaseline(baselinePath, record);
    result.new_baseline = record;
  }

  writeGithubOutput('action', decision.action);
  writeGithubOutput('drift', decision.action.startsWith('drift') ? 'true' : 'false');
  writeGithubOutput('remediated', result.remediated ? 'true' : 'false');
  writeGithubOutput('week_start', adopted.week_start || '');
  writeGithubOutput('photo_a_name', adopted.photo_a_name || '');
  writeGithubOutput('photo_b_name', adopted.photo_b_name || '');
  if (result.remediated) {
    writeGithubOutput('from_a', live.photo_a_name || '');
    writeGithubOutput('from_b', live.photo_b_name || '');
    writeGithubOutput('to_a', adopted.photo_a_name || '');
    writeGithubOutput('to_b', adopted.photo_b_name || '');
  } else {
    writeGithubOutput('from_a', baseline?.photo_a_name || '');
    writeGithubOutput('from_b', baseline?.photo_b_name || '');
    writeGithubOutput('to_a', adopted.photo_a_name || '');
    writeGithubOutput('to_b', adopted.photo_b_name || '');
  }

  writeStepSummary([
    '## Matchup pair monitor',
    `- Mode: ${mode}`,
    `- Action: ${decision.action} (${decision.reason})`,
    `- Week: ${adopted.week_start}`,
    `- Pair: ${adopted.photo_a_name} / ${adopted.photo_b_name}`,
    result.remediated
      ? `- Remediated both slots (votes reset 0–0)${dryRun ? ' [DRY_RUN]' : ''}: ${live.photo_a_name}/${live.photo_b_name} → ${adopted.photo_a_name}/${adopted.photo_b_name}`
      : '- Baseline written',
  ]);

  return result;
}

function isMain() {
  const entry = process.argv[1] && path.resolve(process.argv[1]);
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
  runMonitor()
    .then((result) => {
      console.log(JSON.stringify({ ok: true, ...result, baseline: undefined }, null, 2));
    })
    .catch((err) => {
      console.error('[matchup_pair_monitor]', err);
      process.exitCode = 1;
    });
}
