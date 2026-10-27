// Query plan and cursor for hourly Gehrig discovery (#4787).
// A missing or corrupt cursor returns to the first step. A rate limit or a source
// error repeats the same step. Zero results advances. The plan is the only bound.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'gehrig-discovery-query-plan.json');
const PRE_1931_END = '1930-12-31';

export function loadQueryPlan(path = PLAN_PATH) {
  const plan = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) throw new Error('Discovery query plan has no steps');
  return plan;
}

export function resolveCursor(raw, plan) {
  const start = { version: 1, index: 0, reset: true };
  let parsed = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return start;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return start;
    }
  }
  if (!parsed || typeof parsed !== 'object') return start;
  if (parsed.version !== 1 || !Number.isInteger(parsed.index) || parsed.index < 0 || parsed.index >= plan.steps.length) return start;
  return { version: 1, index: parsed.index, reset: false };
}

export function stepAt(plan, cursor) {
  const resolved = cursor && cursor.version === 1 && Number.isInteger(cursor.index) ? cursor : resolveCursor(cursor, plan);
  const step = plan.steps[resolved.index];
  return { ...step, dateEnd: step.pre1931 ? plan.dateEnd || PRE_1931_END : null, index: resolved.index, reset: Boolean(resolved.reset) };
}

export function cursorAfter(plan, cursor, outcome) {
  const resolved = resolveCursor(cursor, plan);
  if (outcome === 'rate_limited' || outcome === 'source_error') return { version: 1, index: resolved.index };
  const next = (resolved.index + 1) % plan.steps.length;
  return { version: 1, index: next };
}

export function buildDiscoveryUrl(source, { query, limit, page = 1, dateEnd = null } = {}) {
  const q = encodeURIComponent(query);
  if (source === 'openverse') {
    const pageParam = page > 1 ? `&page=${page}` : '';
    return `https://api.openverse.org/v1/images/?q=${q}&page_size=${limit}${pageParam}`;
  }
  if (source === 'loc') {
    const year = dateEnd ? dateEnd.slice(0, 4) : '';
    const dates = year ? `&dates=1903/${year}` : '';
    const sp = page > 1 ? `&sp=${page}` : '';
    return `https://www.loc.gov/photos/?q=${q}&fo=json&c=${limit}${dates}${sp}`;
  }
  if (source === 'wikimedia') {
    const offset = page > 1 ? `&sroffset=${(page - 1) * limit}` : '';
    return `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${q}&srnamespace=6&srlimit=${limit}&format=json&origin=*${offset}`;
  }
  throw new Error(`No discovery URL for source ${source}`);
}
