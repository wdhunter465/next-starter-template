#!/usr/bin/env node
/**
 * #2916 (#2780 Task 003) — deduplicated Operations Issue routing for #2915's
 * Production health collector results.
 *
 * Reads production-health-collectors-2915-result.json (written by
 * scripts/ci/production_health_collectors.mjs), and for every non-healthy
 * check, creates or updates ONE stable, per-check GitHub Issue — reusing
 * scripts/ci/ops_runtime_escalation.mjs's upsertOpsRuntimeIssue, the same
 * idempotent create-or-update-by-title primitive this repo already relies
 * on elsewhere (matchup-pair-monitor, b2-d1-daily-sync). The issue title is
 * stable per check (independent of the current state), so a check bouncing
 * between degraded/unavailable/stale updates the SAME issue rather than
 * spawning duplicates — this is what makes "duplicate alerts do not spam"
 * true by construction, not by a separate dedup pass.
 *
 * When a previously-unhealthy check recovers to healthy, this script finds
 * the matching open issue (if any) and closes it with a resolution comment
 * — "false positives release cleanly" per #2916's acceptance criteria.
 *
 * Monitoring/Hold: if an open issue for a check already carries the
 * `monitoring-hold` label, this script skips updating or closing it,
 * leaving the human-applied hold in force. This is the only operator
 * override recognized here.
 *
 * This script's only side effect is GitHub Issues API calls (create,
 * update body/comment, close). It has no code path that touches
 * Production D1/B2/deploy state — "no unbounded auto-remediation exists"
 * is true because there is no remediation code here at all, only routing.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { upsertOpsRuntimeIssue } from './ops_runtime_escalation.mjs';

export const ROUTING_MARKER = '<!-- production-health-routing-2916 -->';
export const HOLD_LABEL = 'monitoring-hold';
export const RUNBOOK_PATH = 'docs/ops/reports/production-monitoring-incident-runbook-2916.md';

/**
 * Severity/owner grounded in docs/ops/reports/production-monitoring-service-journey-map-2914.md.
 * d1_health is the one P1 (D1 availability gates everything else); the
 * remaining #2915 targets are all P3 per that map's read-path gap rows.
 */
export const CHECK_METADATA = {
  d1_health: { severity: 'P1', owner: 'Bill/Day-2 Operations (incident); Implementation/Operations (remediation)' },
  faq_list: { severity: 'P3', owner: 'Implementation/Operations' },
  events_next: { severity: 'P3', owner: 'Implementation/Operations' },
  photos_list: { severity: 'P3', owner: 'Implementation/Operations' },
  milestones_list: { severity: 'P3', owner: 'Implementation/Operations' },
  friends_list: { severity: 'P3', owner: 'Implementation/Operations' },
  cms_get: { severity: 'P3', owner: 'Implementation/Operations' },
  search: { severity: 'P3', owner: 'Implementation/Operations' },
};

function metadataFor(checkName) {
  return CHECK_METADATA[checkName] || { severity: 'P3', owner: 'Implementation/Operations' };
}

/** Stable per-check title — deliberately does NOT include the current state, so the same issue is reused across state transitions instead of forking. */
export function issueTitle(checkName) {
  return `OPS — Production health: ${checkName}`;
}

export function issueLabels(severity) {
  const severityLabel = `severity:${String(severity || 'p3').toLowerCase()}`;
  return ['ops-runtime-finding', 'production-health', severityLabel];
}

export function buildIssueBody({ result, runUrl, checkedAt }) {
  const metadata = metadataFor(result.name);
  return [
    ROUTING_MARKER,
    `## Production health finding: \`${result.name}\``,
    '',
    `- State: **${result.state}**`,
    `- Reason: ${result.reason || '—'}`,
    `- Severity: ${metadata.severity}`,
    `- Owner: ${metadata.owner}`,
    `- Fingerprint: \`${result.fingerprint}\``,
    `- Checked at: ${checkedAt}`,
    `- Run: ${runUrl || 'unknown'}`,
    '',
    `See \`${RUNBOOK_PATH}\` for the expected response for this state and severity.`,
    '',
    'This issue is reused (updated in place) across runs while the check stays',
    'unhealthy — it will not be duplicated. It closes automatically with a',
    'resolution comment once the check reports healthy again. Add the',
    `\`${HOLD_LABEL}\` label to suppress further updates/auto-close while this`,
    'is under active investigation.',
  ].join('\n');
}

export function buildResolutionComment({ result, runUrl, checkedAt }) {
  return [
    ROUTING_MARKER,
    `Resolved: \`${result.name}\` reported healthy at ${checkedAt} (run: ${runUrl || 'unknown'}).`,
    'Closing automatically. Reopen if this recurs.',
  ].join('\n');
}

async function request(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-production-health-routing',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function findOpenIssueByTitle({ token, owner, repo, title }) {
  const openIssues = await request(`/repos/${owner}/${repo}/issues?state=open&per_page=100`, token);
  return Array.isArray(openIssues)
    ? openIssues.find((issue) => issue.title === title && !issue.pull_request)
    : undefined;
}

function isOnHold(issue) {
  return Array.isArray(issue?.labels) && issue.labels.some((label) => (label.name || label) === HOLD_LABEL);
}

export async function closeResolvedIssue({ token, owner, repo, issueNumber, resolutionBody }) {
  await request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ body: resolutionBody }),
  });
  await request(`/repos/${owner}/${repo}/issues/${issueNumber}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  });
}

/**
 * Routes every collector result to a create/update/close/hold/noop outcome.
 * `upsert` and `findOpen`/`close` are injectable for tests; production code
 * uses the real GitHub-API-backed implementations by default.
 */
export async function routeResults(
  results,
  { token, owner, repo, runUrl = '', checkedAt = new Date().toISOString(), upsert = upsertOpsRuntimeIssue, findOpen = findOpenIssueByTitle, close = closeResolvedIssue } = {},
) {
  const outcomes = [];
  for (const result of results) {
    const title = issueTitle(result.name);
    const existing = await findOpen({ token, owner, repo, title });

    if (existing && isOnHold(existing)) {
      outcomes.push({ name: result.name, action: 'held', issue: existing.html_url });
      continue;
    }

    if (result.state === 'healthy') {
      if (existing) {
        await close({
          token,
          owner,
          repo,
          issueNumber: existing.number,
          resolutionBody: buildResolutionComment({ result, runUrl, checkedAt }),
        });
        outcomes.push({ name: result.name, action: 'closed', issue: existing.html_url });
      } else {
        outcomes.push({ name: result.name, action: 'noop', issue: null });
      }
      continue;
    }

    const metadata = metadataFor(result.name);
    const outcome = await upsert({
      token,
      owner,
      repo,
      title,
      body: buildIssueBody({ result, runUrl, checkedAt }),
      labels: issueLabels(metadata.severity),
    });
    outcomes.push({ name: result.name, action: outcome.action, issue: outcome.issue });
  }
  return outcomes;
}

export function buildRoutingSummary(outcomes) {
  const counts = outcomes.reduce((acc, o) => {
    acc[o.action] = (acc[o.action] || 0) + 1;
    return acc;
  }, {});
  const lines = [
    ROUTING_MARKER,
    '## #2916 Production health routing (#2780 Task 003)',
    '',
    `- Outcomes: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
    '',
    '| Check | Action | Issue |',
    '| --- | --- | --- |',
    ...outcomes.map((o) => `| \`${o.name}\` | ${o.action} | ${o.issue ? `[link](${o.issue})` : '—'} |`),
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

export async function main() {
  const resultPath = process.env.HEALTH_RESULT_JSON || 'production-health-collectors-2915-result.json';
  if (!fs.existsSync(resultPath)) {
    console.error(`FAIL-CLOSED: ${resultPath} not found — nothing to route.`);
    process.exitCode = 1;
    return;
  }
  const payload = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const results = Array.isArray(payload?.results) ? payload.results : [];

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    console.error('FAIL-CLOSED: GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required.');
    process.exitCode = 1;
    return;
  }
  const [owner, repo] = repository.split('/');
  const runUrl = process.env.OPS_ROUTING_RUN_URL || '';

  const outcomes = await routeResults(results, { token, owner, repo, runUrl, checkedAt: payload.checkedAt });
  const summary = buildRoutingSummary(outcomes);
  fs.writeFileSync('production-health-routing-2916-result.md', `${summary}\n`);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) fs.appendFileSync(summaryPath, `\n${summary}\n`);

  writeOutput('created_or_updated', String(outcomes.filter((o) => o.action === 'created' || o.action === 'updated').length));
  writeOutput('closed', String(outcomes.filter((o) => o.action === 'closed').length));
  writeOutput('held', String(outcomes.filter((o) => o.action === 'held').length));

  console.log(summary);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
