#!/usr/bin/env node
/**
 * #2917 (#2780 Task 004) — offline controlled failure / recovery exercise for
 * Production health collectors + routing.
 *
 * This runner NEVER hits live Production and NEVER opens real GitHub Issues.
 * It seeds deterministic collector-shaped results, drives
 * `routeResults` through create → update → recover → close (and hold /
 * disable paths), and writes a durable exercise evidence JSON/MD pair.
 *
 * Rollback proof (documented + machine-checked here):
 * - Disable collectors by skipping the collect phase (empty/missing result →
 *   routing refuses to run / no Issue upserts).
 * - Disable routing by skipping `routeResults` while collectors still produce
 *   evidence (manual Ops Issue intake remains available — routing is not the
 *   only way an operator can open an Ops Issue).
 * - `monitoring-hold` preserves operator control without auto-close.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  buildRoutingSummary,
  routeResults,
} from './production_health_routing.mjs';

export const EXERCISE_JSON_PATH = 'production-health-failure-exercise-2917-result.json';
export const EXERCISE_MD_PATH = 'production-health-failure-exercise-2917-result.md';

export function seededUnhealthyResults() {
  return [
    {
      name: 'd1_health',
      state: 'unavailable',
      reason: 'db_ok=false',
      status_code: 200,
      timing_ms: 8,
      fingerprint: 'production-health:d1_health:unavailable',
    },
    {
      name: 'faq_list',
      state: 'degraded',
      reason: 'endpoint responded ok:false',
      status_code: 200,
      timing_ms: 11,
      fingerprint: 'production-health:faq_list:degraded',
    },
    {
      name: 'photos_list',
      state: 'stale',
      reason: 'using last-known-good within freshness window',
      status_code: 503,
      timing_ms: 5,
      fingerprint: 'production-health:photos_list:stale',
    },
  ];
}

export function seededHealthyResults() {
  return seededUnhealthyResults().map((row) => ({
    ...row,
    state: 'healthy',
    reason: '',
    status_code: 200,
    fingerprint: `production-health:${row.name}:healthy`,
  }));
}

/**
 * In-memory GitHub Issue stand-in used by the offline exercise.
 * Manual intake simulation: `manualOpen` creates an issue without routing.
 */
export function createOfflineIssueStore() {
  const issues = new Map();
  let nextNumber = 1;

  return {
    issues,
    async upsert({ title, body, labels }) {
      const existing = [...issues.values()].find((issue) => issue.title === title && issue.state === 'open');
      if (existing) {
        existing.body = body;
        existing.labels = labels.map((name) => ({ name }));
        existing.comments.push({ type: 'update', at: new Date().toISOString() });
        return { action: 'updated', issue: existing.html_url };
      }
      const number = nextNumber++;
      const html_url = `https://example.test/issues/${number}`;
      issues.set(number, {
        number,
        title,
        body,
        labels: labels.map((name) => ({ name })),
        state: 'open',
        html_url,
        comments: [{ type: 'create', at: new Date().toISOString() }],
        source: 'routing',
      });
      return { action: 'created', issue: html_url };
    },
    async findOpen({ title }) {
      return [...issues.values()].find((issue) => issue.title === title && issue.state === 'open');
    },
    async close({ issueNumber, resolutionBody }) {
      const issue = issues.get(issueNumber);
      if (!issue) throw new Error(`missing issue ${issueNumber}`);
      issue.comments.push({ type: 'resolution', body: resolutionBody, at: new Date().toISOString() });
      issue.state = 'closed';
    },
    manualOpen({ title, body }) {
      const number = nextNumber++;
      const html_url = `https://example.test/issues/${number}`;
      issues.set(number, {
        number,
        title,
        body,
        labels: [{ name: 'ops-runtime-finding' }],
        state: 'open',
        html_url,
        comments: [{ type: 'manual-intake', at: new Date().toISOString() }],
        source: 'manual',
      });
      return { number, html_url };
    },
    applyHold(issueNumber) {
      const issue = issues.get(issueNumber);
      if (!issue) throw new Error(`missing issue ${issueNumber}`);
      if (!issue.labels.some((label) => label.name === 'monitoring-hold')) {
        issue.labels.push({ name: 'monitoring-hold' });
      }
    },
  };
}

export async function runFailureExercise({ store = createOfflineIssueStore() } = {}) {
  const phases = [];

  // Phase A — seeded failures route to create
  const createOutcomes = await routeResults(seededUnhealthyResults(), {
    token: 'offline',
    owner: 'o',
    repo: 'r',
    runUrl: 'https://example.test/runs/exercise-create',
    checkedAt: '2026-08-08T12:00:00Z',
    upsert: (args) => store.upsert(args),
    findOpen: (args) => store.findOpen(args),
    close: (args) => store.close(args),
  });
  phases.push({ name: 'seeded_failures_create', outcomes: createOutcomes });

  // Phase B — still unhealthy → update same issues (no duplicates)
  const updateOutcomes = await routeResults(seededUnhealthyResults(), {
    token: 'offline',
    owner: 'o',
    repo: 'r',
    runUrl: 'https://example.test/runs/exercise-update',
    checkedAt: '2026-08-08T13:00:00Z',
    upsert: (args) => store.upsert(args),
    findOpen: (args) => store.findOpen(args),
    close: (args) => store.close(args),
  });
  phases.push({ name: 'seeded_failures_update', outcomes: updateOutcomes });

  // Phase C — recovery closes the loop
  const recoverOutcomes = await routeResults(seededHealthyResults(), {
    token: 'offline',
    owner: 'o',
    repo: 'r',
    runUrl: 'https://example.test/runs/exercise-recover',
    checkedAt: '2026-08-08T14:00:00Z',
    upsert: (args) => store.upsert(args),
    findOpen: (args) => store.findOpen(args),
    close: (args) => store.close(args),
  });
  phases.push({ name: 'recovery_close', outcomes: recoverOutcomes });

  // Phase D — monitoring-hold suppresses auto-close
  await routeResults(seededUnhealthyResults().slice(0, 1), {
    token: 'offline',
    owner: 'o',
    repo: 'r',
    upsert: (args) => store.upsert(args),
    findOpen: (args) => store.findOpen(args),
    close: (args) => store.close(args),
  });
  const heldIssue = await store.findOpen({ title: 'OPS — Production health: d1_health' });
  store.applyHold(heldIssue.number);
  const holdOutcomes = await routeResults(seededHealthyResults().slice(0, 1), {
    token: 'offline',
    owner: 'o',
    repo: 'r',
    upsert: (args) => store.upsert(args),
    findOpen: (args) => store.findOpen(args),
    close: (args) => store.close(args),
  });
  phases.push({ name: 'monitoring_hold_blocks_close', outcomes: holdOutcomes });

  // Phase E — collector disable: no result file / empty results → no routing upserts
  const collectorDisabledUpserts = [];
  const collectorDisabledOutcomes = await routeResults([], {
    token: 'offline',
    owner: 'o',
    repo: 'r',
    upsert: async (args) => {
      collectorDisabledUpserts.push(args);
      return store.upsert(args);
    },
    findOpen: (args) => store.findOpen(args),
    close: (args) => store.close(args),
  });
  phases.push({
    name: 'collector_disable_no_results',
    outcomes: collectorDisabledOutcomes,
    upsertCalls: collectorDisabledUpserts.length,
  });

  // Phase F — routing disable + manual intake still works
  const manual = store.manualOpen({
    title: 'OPS — Manual intake preserved during routing disable',
    body: 'Operator-opened Issue proving routing disable does not block manual Ops intake.',
  });
  phases.push({
    name: 'routing_disable_manual_intake',
    outcomes: [],
    manualIssue: manual,
    routingInvoked: false,
  });

  const openFromRouting = [...store.issues.values()].filter(
    (issue) => issue.state === 'open' && issue.source === 'routing',
  ).length;
  const openManual = [...store.issues.values()].filter(
    (issue) => issue.state === 'open' && issue.source === 'manual',
  ).length;

  return {
    ok: true,
    exercise: '#2917',
    mode: 'offline-fixture',
    productionMutation: false,
    liveGitHubCalls: false,
    phases,
    summary: {
      openRoutingIssues: openFromRouting,
      openManualIssues: openManual,
      totalIssuesTracked: store.issues.size,
    },
    routingMarkdown: buildRoutingSummary(recoverOutcomes),
  };
}

export function renderExerciseMarkdown(report) {
  const lines = [
    '<!-- production-health-failure-exercise-2917 -->',
    '## #2917 Production health failure exercise',
    '',
    `- Mode: ${report.mode}`,
    `- Production mutation: ${report.productionMutation}`,
    `- Live GitHub API calls: ${report.liveGitHubCalls}`,
    `- Open routing issues after exercise: ${report.summary.openRoutingIssues}`,
    `- Open manual-intake issues: ${report.summary.openManualIssues}`,
    '',
    '| Phase | Outcome summary |',
    '| --- | --- |',
    ...report.phases.map((phase) => {
      const counts = (phase.outcomes || []).reduce((acc, o) => {
        acc[o.action] = (acc[o.action] || 0) + 1;
        return acc;
      }, {});
      const detail =
        Object.entries(counts)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ') ||
        (phase.manualIssue ? `manual=${phase.manualIssue.html_url}` : 'n/a');
      return `| \`${phase.name}\` | ${detail} |`;
    }),
  ];
  return `${lines.join('\n')}\n`;
}

export async function main() {
  const report = await runFailureExercise();
  fs.writeFileSync(EXERCISE_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(EXERCISE_MD_PATH, renderExerciseMarkdown(report));
  console.log(renderExerciseMarkdown(report));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
