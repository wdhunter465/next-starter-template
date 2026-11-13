// Scorecard page for the report site (#4976). Read-only: GITHUB_TOKEN only,
// no Production access. The page is rebuilt with every dashboard build but the
// numbers are recomputed at most once a day: a build reuses the last published
// scorecard-data.json while it is younger than MAX_AGE_HOURS. A failure never
// breaks the dashboard build; it shows the last good scorecard, or a notice.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applyReportNav } from './report-nav.mjs';

export const MAX_AGE_HOURS = 23;
const HOUR_MS = 60 * 60 * 1000;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function previousDataUrl(env = process.env) {
  const repository = env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template';
  const [owner, repo] = repository.split('/');
  return `https://${owner}.github.io/${repo}/pmo-dashboard/scorecard-data.json`;
}

function validSaved(saved) {
  return Boolean(saved && typeof saved.generatedAt === 'string' && saved.card && Array.isArray(saved.card.rows) && saved.card.window);
}

async function loadPrevious(url, fetchImpl) {
  if (!fetchImpl) return null;
  try {
    const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const saved = await response.json();
    return validSaved(saved) ? { generatedAt: saved.generatedAt, card: saved.card } : null;
  } catch {
    return null;
  }
}

function ageHours(iso, now) {
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? Infinity : (now.getTime() - then) / HOUR_MS;
}

export async function resolveScorecard({ now = new Date(), fetchImpl, previousUrl, collect, maxAgeHours = MAX_AGE_HOURS } = {}) {
  const previous = await loadPrevious(previousUrl, fetchImpl);
  if (previous && ageHours(previous.generatedAt, now) < maxAgeHours) return { ...previous, status: 'reused' };
  if (!collect) {
    return previous
      ? { ...previous, status: 'stale', note: 'Not refreshed in this build: no GitHub token was available.' }
      : { generatedAt: now.toISOString(), card: null, status: 'unavailable', note: 'The scorecard was not generated in this build: no GitHub token was available.' };
  }
  try {
    return { generatedAt: now.toISOString(), card: await collect(now), status: 'fresh' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return previous
      ? { ...previous, status: 'stale', note: `Refresh failed (${reason}). Showing the last good scorecard.` }
      : { generatedAt: now.toISOString(), card: null, status: 'unavailable', note: `The scorecard could not be generated (${reason}).` };
  }
}

// Weekly social posting trend (#5219). The history is one row per week per platform on the
// `scorecard-history` data branch (public, append-only, kept at least 10 years). The chart is
// stacked bars per platform: confirmed, handed off (not verified), not logged, failed or missing.
// Status colors are the fixed status palette; every colour is also named in the legend, in each
// bar's tooltip and in the table, so colour is never the only carrier of meaning.
export const HISTORY_BRANCH = 'scorecard-history';
export const HISTORY_FILE = 'social-weekly.jsonl';
export const MAX_WEEKLY_BARS = 26;
const PLATFORMS = [
  ['x', 'X'],
  ['facebook', 'Facebook Page'],
  ['instagram', 'Instagram'],
  ['pinterest', 'Pinterest'],
];
const SEGMENTS = [
  ['confirmed', 'Confirmed', '#0ca30c'],
  ['handed_off', 'Handed off, not verified', '#fab219'],
  ['not_logged', 'Not logged', '#8c959f'],
  ['problem', 'Failed or missing', '#d03b3b'],
];

export function historyUrl(env = process.env) {
  const repository = env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template';
  return `https://raw.githubusercontent.com/${repository}/${HISTORY_BRANCH}/${HISTORY_FILE}`;
}

export function parseHistoryText(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const row = JSON.parse(line);
        return row && typeof row.week_start === 'string' && typeof row.platform === 'string' ? [row] : [];
      } catch {
        return [];
      }
    });
}

export async function loadHistory(url, fetchImpl) {
  if (!fetchImpl) return [];
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return [];
    const text = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
    return parseHistoryText(text);
  } catch {
    return [];
  }
}

const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Periods per platform, oldest first: weeks, or months once there are more than MAX_WEEKLY_BARS weeks. */
export function trendPeriods(rows) {
  const weeks = [...new Set(rows.map((r) => r.week_start))].sort();
  const monthly = weeks.length > MAX_WEEKLY_BARS;
  const bucket = monthly ? 'month' : 'week';
  const result = { bucket, platforms: {} };
  for (const [key] of PLATFORMS) {
    const periods = new Map();
    for (const r of rows.filter((x) => x.platform === key).sort((a, b) => a.week_start.localeCompare(b.week_start))) {
      const label = monthly ? r.week_start.slice(0, 7) : r.week_start;
      const p = periods.get(label) ?? { label, planned: 0, confirmed: 0, handed_off: 0, not_logged: 0, problem: 0, failed: 0, missing: 0 };
      p.planned += n0(r.planned);
      p.confirmed += n0(r.confirmed);
      p.handed_off += n0(r.handed_off);
      p.not_logged += n0(r.not_logged);
      p.failed += n0(r.failed);
      p.missing += n0(r.missing);
      p.problem += n0(r.failed) + n0(r.missing);
      periods.set(label, p);
    }
    result.platforms[key] = [...periods.values()];
  }
  return result;
}

function chartSvg(name, periods, yMax, bucket) {
  const W = 360;
  const H = 170;
  const L = 34;
  const R = 8;
  const T = 8;
  const B = 26;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const step = plotW / Math.max(periods.length, 1);
  const bw = Math.max(4, Math.min(28, step - 4));
  const every = Math.max(1, Math.ceil(periods.length / 6));
  const parts = [];
  parts.push(`<line x1="${L}" y1="${T + plotH}" x2="${W - R}" y2="${T + plotH}" stroke="#d0d7de"/>`);
  parts.push(`<text x="${L - 6}" y="${T + plotH + 3}" text-anchor="end">0</text>`);
  parts.push(`<text x="${L - 6}" y="${T + 9}" text-anchor="end">${yMax}</text>`);
  periods.forEach((p, i) => {
    const x = L + i * step + (step - bw) / 2;
    let base = T + plotH;
    const summary = `${p.label}: ${p.confirmed} of ${p.planned} confirmed, ${p.failed} failed, ${p.missing} missing, ${p.handed_off} handed off, ${p.not_logged} not logged`;
    for (const [field, label, color] of SEGMENTS) {
      const value = p[field];
      if (!value) continue;
      const h = (value / yMax) * plotH;
      base -= h;
      parts.push(`<rect x="${x.toFixed(1)}" y="${base.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" stroke="#fff" stroke-width="2"><title>${escapeHtml(`${p.label}: ${value} ${label.toLowerCase()}`)}</title></rect>`);
    }
    parts.push(`<rect x="${(L + i * step).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${plotH}" fill="transparent"><title>${escapeHtml(summary)}</title></rect>`);
    if (i % every === 0 || i === periods.length - 1) {
      parts.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${escapeHtml(bucket === 'month' ? p.label : p.label.slice(5))}</text>`);
    }
  });
  const last = periods[periods.length - 1];
  const aria = `${name}: posts per ${bucket}. Latest ${last.label}: ${last.confirmed} of ${last.planned} confirmed, ${last.failed + last.missing} failed or missing.`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(aria)}" width="100%">${parts.join('')}</svg>`;
}

export function renderTrendHtml(rows) {
  const style = '<style>.trend-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}figure.trend{margin:0;border:1px solid var(--border);border-radius:12px;padding:.75rem}figure.trend figcaption{font-weight:600;margin-bottom:.25rem}figure.trend svg text{font-size:10px;fill:#57606a}.legend{display:flex;flex-wrap:wrap;gap:.4rem 1.25rem;margin:.75rem 0;padding:0;list-style:none}.legend .sw{display:inline-block;width:.8rem;height:.8rem;border-radius:2px;margin-right:.4rem;vertical-align:-1px}</style>';
  const intro = '<h2>Social posting by platform, over time</h2><p class="meta">One bar per week (months once there are more than 26 weeks), from the weekly history kept on the public <code>scorecard-history</code> branch. A handed-off post is never counted as confirmed. Hover a bar for its counts; the table below has the same numbers.</p>';
  if (!rows.length) {
    return `<section id="social-trend">${style}${intro}<p class="empty" role="status">No weekly history yet. The first row is recorded on the next Monday scorecard run after the history branch exists.</p></section>`;
  }
  const { bucket, platforms } = trendPeriods(rows);
  const yMax = Math.max(1, ...Object.values(platforms).flatMap((list) => list.map((p) => p.planned)));
  const legend = `<ul class="legend">${SEGMENTS.map(([, label, color]) => `<li><span class="sw" style="background:${color}"></span>${escapeHtml(label)}</li>`).join('')}</ul>`;
  const figures = PLATFORMS.filter(([key]) => platforms[key].length)
    .map(([key, name]) => `<figure class="trend"><figcaption>${escapeHtml(name)}</figcaption>${chartSvg(name, platforms[key], yMax, bucket)}</figure>`)
    .join('');
  const body = PLATFORMS.flatMap(([key, name]) => platforms[key].slice(-52).map((p) => {
    const rate = p.planned ? `${((p.confirmed / p.planned) * 100).toFixed(1)}%` : '—';
    return `<tr><td>${escapeHtml(p.label)}</td><td>${escapeHtml(name)}</td><td>${p.planned}</td><td>${p.confirmed}</td><td>${p.failed}</td><td>${p.missing}</td><td>${p.handed_off}</td><td>${p.not_logged}</td><td>${rate}</td></tr>`;
  })).join('');
  const table = `<details><summary>Table view</summary><div class="table-wrap"><table class="scorecard"><thead><tr><th>${bucket === 'month' ? 'Month' : 'Week starting'}</th><th>Platform</th><th>Planned</th><th>Confirmed</th><th>Failed</th><th>Missing</th><th>Handed off</th><th>Not logged</th><th>Confirmed share</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
  return `<section id="social-trend">${style}${intro}${legend}<div class="trend-grid">${figures}</div>${table}</section>`;
}

export function renderScorecardHtml(result, history = []) {
  const { card, generatedAt, status, note } = result;
  const rows = card
    ? card.rows.map((row) => {
      const rag = String(row.rag || '—');
      const cls = ['green', 'amber', 'red'].includes(rag) ? ` rag-${rag}` : '';
      return `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.value)}</td><td><span class="rag${cls}">${escapeHtml(rag)}</span></td></tr>`;
    }).join('')
    : '';
  const windowText = card ? `${escapeHtml(card.window.start.slice(0, 10))} to ${escapeHtml(card.window.end.slice(0, 10))}` : 'not available';
  const notice = note ? `<p class="empty" role="status">${escapeHtml(note)}</p>` : '';
  const table = card
    ? `<div class="table-wrap"><table class="scorecard"><thead><tr><th>Row</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scorecard</title><link rel="stylesheet" href="assets/pmo-dashboard.css"></head><body><!--REPORT-NAV--><header><p class="eyebrow">Generated from GitHub issues, runs and pull requests</p><h1>Scorecard</h1><p class="meta">Last 7 days: ${windowText}. Generated ${escapeHtml(generatedAt)}. Refreshed daily. Data status: ${escapeHtml(status)}.</p><p>Operations scorecard: uptime probes, scheduled-job health, merged pull requests and their checks, outage restore time, the Operations queue, the daily D1 backup, and open Priority 1 projects. The weekly copy is also posted on the standing "Weekly scorecard" Issue (#4605). This page is reporting-only.</p></header><main id="scorecard">${notice}${table}${renderTrendHtml(history)}</main></body></html>`;
}

export async function generateScorecardPage({ outDir, env = process.env, now = new Date(), fetchImpl, collect } = {}) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  let useCollect = collect;
  let useFetch = fetchImpl;
  if (!useCollect && token) {
    const ops = await import('../ops/weekly-operations-scorecard.mjs');
    useCollect = async (at) => {
      const context = ops.githubContext();
      return ops.buildScorecard(await ops.collectFacts(context, at), at);
    };
  }
  if (!useFetch && token) useFetch = globalThis.fetch;
  const result = await resolveScorecard({ now, fetchImpl: useFetch, previousUrl: previousDataUrl(env), collect: useCollect });
  const history = await loadHistory(historyUrl(env), useFetch);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'scorecard.html'), applyReportNav(renderScorecardHtml(result, history), 'scorecard'));
  if (result.card) {
    await writeFile(path.join(outDir, 'scorecard-data.json'), `${JSON.stringify({ generatedAt: result.generatedAt, card: result.card }, null, 2)}\n`);
  }
  return result;
}
