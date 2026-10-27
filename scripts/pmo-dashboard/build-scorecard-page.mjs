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

export function renderScorecardHtml(result) {
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scorecard</title><link rel="stylesheet" href="assets/pmo-dashboard.css"></head><body><!--REPORT-NAV--><header><p class="eyebrow">Generated from GitHub issues, runs and pull requests</p><h1>Scorecard</h1><p class="meta">Last 7 days: ${windowText}. Generated ${escapeHtml(generatedAt)}. Refreshed daily. Data status: ${escapeHtml(status)}.</p><p>Operations scorecard: uptime probes, scheduled-job health, merged pull requests and their checks, outage restore time, the Operations queue, the daily D1 backup, and open Priority 1 projects. The weekly copy is also posted on the standing "Weekly scorecard" Issue (#4605). This page is reporting-only.</p></header><main id="scorecard">${notice}${table}</main></body></html>`;
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
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'scorecard.html'), applyReportNav(renderScorecardHtml(result), 'scorecard'));
  if (result.card) {
    await writeFile(path.join(outDir, 'scorecard-data.json'), `${JSON.stringify({ generatedAt: result.generatedAt, card: result.card }, null, 2)}\n`);
  }
  return result;
}
