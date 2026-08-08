#!/usr/bin/env node
/**
 * #2915 (#2780 Task 002) — zero-cost, read-only Production health collectors.
 *
 * Hits a curated set of public, unauthenticated, read-only GET endpoints (the
 * uncovered gaps recorded in #2914's service/journey map) and normalizes each
 * result into one of five deterministic health states: healthy, degraded,
 * unavailable, stale, or missing-evidence.
 *
 * Every check in TARGETS is a plain GET with no request body and no write
 * intent. This script contains no code path that sends a mutating HTTP verb.
 * Member signup/login synthetic checks are deliberately NOT included here:
 * exercising them for real would either mutate Production (signup) or
 * require a separately-authorized canary test account (login) — both are
 * out of bounds for a zero-mutation collector and are recorded as an open
 * item in docs/ops/reports/production-monitoring-service-journey-map-2914.md
 * rather than forced.
 *
 * Evidence redaction: results never include response bodies, only status
 * code, timing, the normalized state, and a short reason string. `reason`
 * is built from fixed strings and HTTP status codes only — never from
 * response body content — so it cannot carry PII forward even indirectly.
 *
 * Staleness uses a persisted last-known-good cache (same actions/cache
 * pattern as scripts/ci/matchup_pair_monitor.mjs's baseline file): if a
 * check's current run isn't healthy but a recent last-healthy timestamp
 * exists, the reported state is "stale" (trust recent evidence) rather than
 * immediately "unavailable". Disabling/rolling back this collector is the
 * standard GitHub Actions mechanism (disable the workflow or remove its
 * schedule trigger) — the same proven mechanism every other OPS runtime
 * workflow in this repo already relies on; no bespoke toggle is needed.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const HEALTH_STATES = ['healthy', 'degraded', 'unavailable', 'stale', 'missing-evidence'];
export const STALE_FRESHNESS_HOURS = 24;
export const REQUEST_TIMEOUT_MS = 10_000;
export const INTER_REQUEST_DELAY_MS = 250;

export const RESULT_JSON_PATH = 'production-health-collectors-2915-result.json';
export const RESULT_MD_PATH = 'production-health-collectors-2915-result.md';

/**
 * Every target is a read-only GET against a public, unauthenticated endpoint.
 * `extraCheck` lets a target apply a stronger rule than the generic
 * `ok === true` -> healthy default (used only by d1_health, whose db_ok
 * field is a real P1 signal per #2914's map).
 */
export const TARGETS = [
  {
    name: 'd1_health',
    path: '/api/health',
    description: 'D1 database availability (#2914: P1 gap — no scheduled check existed)',
    extraCheck(json) {
      if (json?.db_ok === false) return { state: 'unavailable', reason: 'db_ok=false' };
      return null;
    },
  },
  {
    name: 'faq_list',
    path: '/api/faq/list?limit=1',
    description: 'Public FAQ read path (#2914: P3 gap)',
  },
  {
    name: 'events_next',
    path: '/api/events/next?limit=1',
    description: 'Public events calendar read path (#2914: P3 gap)',
  },
  {
    name: 'photos_list',
    path: '/api/photos/list?limit=1',
    description: 'Public photo archive read path (#2914: P3 gap)',
  },
  {
    name: 'milestones_list',
    path: '/api/milestones/list?limit=1',
    description: 'Public milestones timeline read path (#2914: P3 gap)',
  },
  {
    name: 'friends_list',
    path: '/api/friends/list?limit=1',
    description: 'Public friends-of-the-club directory read path (#2914: P3 gap)',
  },
  {
    name: 'cms_get',
    path: '/api/cms/get?page=home',
    description: 'Public CMS content-block read path (#2914: P3 gap)',
  },
  {
    name: 'search',
    path: '/api/search?q=club',
    description: 'Public search read path, exercised with a real query so it touches D1 (#2914: P3 gap)',
  },
];

export function evidenceFingerprint(name, state) {
  return `production-health:${name}:${state}`;
}

function truncateReason(text, max = 160) {
  const value = String(text || '').trim();
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Classifies one HTTP outcome into a deterministic health state. Never inspects response body content beyond the `ok`/target-specific boolean fields already expected in this codebase's `{ ok: boolean, ... }` convention. */
export function classifyResult({ target, status, json, parseError, networkError }) {
  if (networkError) {
    return { state: 'unavailable', reason: truncateReason(`network error: ${networkError}`) };
  }
  if (status >= 500) {
    return { state: 'unavailable', reason: `http ${status}` };
  }
  if (status >= 400) {
    return { state: 'missing-evidence', reason: `http ${status} (probe request itself was rejected)` };
  }
  if (parseError) {
    return { state: 'missing-evidence', reason: 'response body was not valid JSON' };
  }
  if (typeof json?.ok !== 'boolean') {
    return { state: 'missing-evidence', reason: 'response had no boolean "ok" field' };
  }
  if (target.extraCheck) {
    const extra = target.extraCheck(json);
    if (extra) return extra;
  }
  if (json.ok === false) {
    return { state: 'degraded', reason: truncateReason(json.error) || 'endpoint responded ok:false' };
  }
  return { state: 'healthy', reason: '' };
}

async function fetchWithTimeout(url, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    const timingMs = Date.now() - startedAt;
    let json = null;
    let parseError = false;
    try {
      json = await response.json();
    } catch {
      parseError = true;
    }
    return { status: response.status, json, parseError, timingMs, networkError: null };
  } catch (error) {
    return {
      status: 0,
      json: null,
      parseError: false,
      timingMs: Date.now() - startedAt,
      networkError: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function applyStaleness(rawResult, lastHealthyAt, now = new Date()) {
  if (rawResult.state === 'healthy') return rawResult;
  if (!lastHealthyAt) return rawResult;
  const ageHours = (now.getTime() - new Date(lastHealthyAt).getTime()) / (1000 * 60 * 60);
  if (Number.isFinite(ageHours) && ageHours >= 0 && ageHours <= STALE_FRESHNESS_HOURS) {
    return {
      ...rawResult,
      state: 'stale',
      reason: `last known-good evidence is ${ageHours.toFixed(1)}h old (within ${STALE_FRESHNESS_HOURS}h freshness window); raw state was "${rawResult.state}": ${rawResult.reason}`,
    };
  }
  return rawResult;
}

export async function runAllHealthChecks({
  baseUrl,
  targets = TARGETS,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  delayMs = INTER_REQUEST_DELAY_MS,
  previousCache = {},
  now = new Date(),
} = {}) {
  const results = [];
  for (const target of targets) {
    const url = new URL(target.path, baseUrl).toString();
    const outcome = await fetchWithTimeout(url, timeoutMs, fetchImpl);
    const classified = classifyResult({ target, ...outcome });
    const withStaleness = applyStaleness(classified, previousCache[target.name]?.last_healthy_at, now);
    results.push({
      name: target.name,
      description: target.description,
      state: withStaleness.state,
      reason: withStaleness.reason,
      status_code: outcome.status,
      timing_ms: outcome.timingMs,
      fingerprint: evidenceFingerprint(target.name, withStaleness.state),
    });
    if (delayMs > 0 && target !== targets[targets.length - 1]) await sleep(delayMs);
  }
  return results;
}

export function buildNextCache(results, previousCache = {}, now = new Date()) {
  const next = { ...previousCache };
  for (const result of results) {
    if (result.state === 'healthy') {
      next[result.name] = { last_healthy_at: now.toISOString() };
    }
  }
  return next;
}

export function buildResultMarkdown(results, { checkedAt } = {}) {
  const stateCounts = HEALTH_STATES.reduce((acc, state) => {
    acc[state] = results.filter((r) => r.state === state).length;
    return acc;
  }, {});
  const lines = [
    '<!-- production-health-collectors-2915 -->',
    '## #2915 Production health collectors (#2780 Task 002)',
    '',
    `- Checked at: ${checkedAt || new Date().toISOString()}`,
    `- Checks run: ${results.length}`,
    `- State counts: ${HEALTH_STATES.map((s) => `${s}=${stateCounts[s]}`).join(', ')}`,
    '',
    '| Check | State | HTTP | Timing (ms) | Reason |',
    '| --- | --- | --- | --- | --- |',
    ...results.map(
      (r) => `| \`${r.name}\` | ${r.state} | ${r.status_code} | ${r.timing_ms} | ${r.reason || '—'} |`,
    ),
    '',
    'No response body content is captured — only HTTP status, timing, and the',
    'normalized state/reason above. Member signup and login are intentionally',
    'not synthetically checked here (would require either a Production write',
    'or a separately-authorized canary account) — see',
    '`docs/ops/reports/production-monitoring-service-journey-map-2914.md`.',
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

export async function main() {
  const baseUrlFile = process.env.PRODUCTION_BASE_URL_FILE || 'scripts/ci/production_base_url.txt';
  if (!fs.existsSync(baseUrlFile)) {
    console.error(`FAIL-CLOSED: ${baseUrlFile} not found — cannot determine Production base URL.`);
    process.exitCode = 1;
    return;
  }
  const baseUrl = fs.readFileSync(baseUrlFile, 'utf8').trim();
  if (!/^https:\/\//.test(baseUrl)) {
    console.error(`FAIL-CLOSED: ${baseUrlFile} does not contain an https:// URL.`);
    process.exitCode = 1;
    return;
  }

  const cachePath = process.env.HEALTH_CACHE_PATH || '.cache/production-health-2915-baseline.json';
  let previousCache = {};
  if (fs.existsSync(cachePath)) {
    try {
      previousCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {
      previousCache = {};
    }
  }

  const now = new Date();
  const results = await runAllHealthChecks({ baseUrl, previousCache, now });
  const nextCache = buildNextCache(results, previousCache, now);

  fs.mkdirSync('.cache', { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(nextCache, null, 2)}\n`);

  const resultPayload = { checkedAt: now.toISOString(), baseUrl, results };
  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(resultPayload, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(results, { checkedAt: now.toISOString() })}\n`);

  const unavailableCount = results.filter((r) => r.state === 'unavailable').length;
  const degradedCount = results.filter((r) => r.state === 'degraded').length;
  writeOutput('unavailable_count', String(unavailableCount));
  writeOutput('degraded_count', String(degradedCount));
  writeOutput('total_checks', String(results.length));

  console.log(
    `OK: ran ${results.length} checks — ${unavailableCount} unavailable, ${degradedCount} degraded.`,
  );

  if (unavailableCount > 0) {
    console.error(`FAIL: ${unavailableCount} check(s) reported "unavailable".`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
