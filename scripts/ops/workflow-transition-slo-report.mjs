#!/usr/bin/env node
/**
 * workflow-transition-slo-report.mjs
 *
 * Phase 2 collector / publisher for #2679 workflow transition SLO.
 * Generates a deterministic daily scorecard from GitHub-native evidence.
 *
 * Modes:
 *   report   — fetch GitHub evidence and write markdown + JSON under ops-artifacts/
 *   self-test — offline checks (no network)
 *
 * Safety:
 *   - Read-only against GitHub (no Issue/PR mutation)
 *   - Live repo slug locked to wdhunter465/next-starter-template
 *   - Missing evidence → measurement_failure (never silent pass)
 *   - Does not authorize auto-merge or bypass protected decisions
 *
 * Requirements: gh CLI (report mode), Node 18+
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_LGFC_REPO = 'wdhunter465/next-starter-template';
const ALLOWED_REPOS = new Set([DEFAULT_LGFC_REPO]);
const OUTPUT_DIR = 'ops-artifacts/workflow-transition-slo';

/** @type {ReadonlyArray<{id:string,targetSeconds:number,title:string}>} */
export const TRANSITIONS = Object.freeze([
  { id: 'T1', targetSeconds: 120, title: 'Wake event → runner delivery ack' },
  { id: 'T2', targetSeconds: 120, title: 'Delivery ack → Bridge/dispatch start or fallback' },
  { id: 'T3', targetSeconds: 300, title: 'Cursor handoff → controller acknowledgment' },
  { id: 'T4', targetSeconds: 600, title: 'Actionable review finding → Cursor remediation resume' },
  { id: 'T5', targetSeconds: 900, title: 'Clean component PR → component-branch integration' },
  { id: 'T6', targetSeconds: 600, title: 'Component integration → verified merge reconciliation' },
  { id: 'T7', targetSeconds: 600, title: 'Verified child completion → successor activation/wake' },
  { id: 'T8', targetSeconds: 300, title: 'Auth/capacity failure → deduplicated operator alert' },
]);

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  return args.includes(`--${name}`) ? true : fallback;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function resolveRepo() {
  const requested = getArg('repo', DEFAULT_LGFC_REPO);
  if (!ALLOWED_REPOS.has(requested)) {
    fail(
      `Refusing repo '${requested}'. Only ${DEFAULT_LGFC_REPO} is allowed (live LGFC owner).`,
    );
  }
  return requested;
}

function runGh(ghArgs) {
  try {
    return execFileSync('gh', ghArgs, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 64,
    });
  } catch (error) {
    const err = new Error(`gh command failed: gh ${ghArgs.join(' ')}\n${error.message}`);
    err.cause = error;
    throw err;
  }
}

export function parseIsoRequired(value, name) {
  if (!value) fail(`Missing --${name}=<ISO timestamp>`);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) fail(`Invalid --${name}=${value}`);
  return new Date(ms);
}

/**
 * Default window: 24h ending at windowEnd (default now).
 * @param {Date} windowEnd
 * @param {number} hours
 */
export function computeWindow(windowEnd, hours = 24) {
  const end = new Date(windowEnd.getTime());
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return { start, end };
}

export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

/**
 * @param {Array<{durationSeconds:number|null,status:string}>} samples
 * @param {number} targetSeconds
 */
export function scoreTransition(samples, targetSeconds) {
  const measured = samples.filter((s) => s.status === 'measured' && typeof s.durationSeconds === 'number');
  const failures = samples.filter((s) => s.status === 'measurement_failure');
  const holds = samples.filter((s) => s.status === 'hold_excluded');
  const protectedWaits = samples.filter((s) => s.status === 'protected_decision');
  const durations = measured.map((s) => s.durationSeconds).sort((a, b) => a - b);
  const breaches = measured.filter((s) => s.durationSeconds > targetSeconds);
  const compliance =
    measured.length === 0 ? null : Number((((measured.length - breaches.length) / measured.length) * 100).toFixed(1));

  return {
    samples: samples.length,
    measured: measured.length,
    measurement_failures: failures.length,
    hold_excluded: holds.length,
    protected_decision: protectedWaits.length,
    breaches: breaches.length,
    compliance_pct: compliance,
    median_seconds: percentile(durations, 0.5),
    p95_seconds: percentile(durations, 0.95),
    max_seconds: durations.length ? durations[durations.length - 1] : null,
    target_seconds: targetSeconds,
  };
}

function emptySample(transitionId, reason) {
  return {
    transitionId,
    status: 'measurement_failure',
    reason,
    durationSeconds: null,
    startAt: null,
    endAt: null,
    refs: [],
  };
}

function parseWorkflowRuns(repo, workflowFile, createdFrom, createdTo) {
  // Prefer REST via `gh api` to avoid GraphQL secondary limits on `gh run list`.
  const [owner, name] = repo.split('/');
  const raw = runGh([
    'api',
    `repos/${owner}/${name}/actions/workflows/${workflowFile}/runs?per_page=50`,
    '--jq',
    '.workflow_runs',
  ]);
  /** @type {Array<any>} */
  const runs = JSON.parse(raw || '[]');
  const fromMs = createdFrom.getTime();
  const toMs = createdTo.getTime();
  return runs
    .filter((run) => {
      const t = Date.parse(run.created_at || '');
      return !Number.isNaN(t) && t >= fromMs && t <= toMs;
    })
    .map((run) => ({
      databaseId: run.id,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      status: run.status,
      conclusion: run.conclusion,
      event: run.event,
      displayTitle: run.display_title,
      url: run.html_url,
      headBranch: run.head_branch,
    }));
}

function collectT1(repo, window) {
  const workflows = ['lgfc-cursor-dispatch.yml', 'cursor-local-wake.yml'];
  /** @type {Array<any>} */
  const samples = [];
  for (const workflow of workflows) {
    let runs = [];
    try {
      runs = parseWorkflowRuns(repo, workflow, window.start, window.end);
    } catch {
      samples.push(emptySample('T1', `unable to list runs for ${workflow}`));
      continue;
    }
    for (const run of runs) {
      if (run.status !== 'completed') {
        samples.push({
          transitionId: 'T1',
          status: 'measurement_failure',
          reason: `run ${run.databaseId} not completed (${run.status})`,
          durationSeconds: null,
          startAt: run.createdAt,
          endAt: null,
          refs: [run.url],
        });
        continue;
      }
      const startMs = Date.parse(run.createdAt);
      const endMs = Date.parse(run.updatedAt);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        samples.push(emptySample('T1', `run ${run.databaseId} missing timestamps`));
        continue;
      }
      // Proxy: workflow created_at → completed updated_at. Exact job-deliver
      // completed_at requires deeper job API; mark measured with noted proxy.
      samples.push({
        transitionId: 'T1',
        status: 'measured',
        reason: `proxy: workflow ${workflow} run duration (job-level deliver completed_at preferred when available)`,
        durationSeconds: Math.max(0, Math.round((endMs - startMs) / 1000)),
        startAt: run.createdAt,
        endAt: run.updatedAt,
        refs: [`${workflow}#${run.databaseId}`, run.url],
        conclusion: run.conclusion,
      });
    }
  }
  if (samples.length === 0) {
    samples.push(
      emptySample(
        'T1',
        'no wake/dispatch workflow runs in window (or evidence unavailable)',
      ),
    );
  }
  return samples;
}

function collectT5T6(repo, window) {
  const [owner, name] = repo.split('/');
  /** @type {Array<any>} */
  let prs = [];
  try {
    const raw = runGh([
      'api',
      `repos/${owner}/${name}/pulls?state=closed&per_page=50&sort=updated&direction=desc`,
      '--jq',
      '[.[] | select(.merged_at != null) | {number,title,mergedAt:.merged_at,baseRefName:.base.ref,url:.html_url}]',
    ]);
    prs = JSON.parse(raw || '[]');
  } catch (error) {
    return {
      t5: [emptySample('T5', `unable to list merged PRs: ${error.message || error}`)],
      t6: [emptySample('T6', `unable to list merged PRs: ${error.message || error}`)],
    };
  }
  const fromMs = window.start.getTime();
  const toMs = window.end.getTime();
  const inWindow = prs.filter((pr) => {
    const t = Date.parse(pr.mergedAt || '');
    return !Number.isNaN(t) && t >= fromMs && t <= toMs;
  });

  /** @type {Array<any>} */
  const t5 = [];
  /** @type {Array<any>} */
  const t6 = [];

  for (const pr of inWindow) {
    const base = String(pr.baseRefName || '');
    if (base.startsWith('component/')) {
      t5.push({
        transitionId: 'T5',
        status: 'measurement_failure',
        reason:
          'component merge observed but eligibility-success→merged_at interval not reconstructed in this collector revision',
        durationSeconds: null,
        startAt: null,
        endAt: pr.mergedAt,
        refs: [`#${pr.number}`, pr.url],
      });
    }
    t6.push({
      transitionId: 'T6',
      status: 'measurement_failure',
      reason: 'post-merge verification success not correlated to merge SHA in this collector revision',
      durationSeconds: null,
      startAt: pr.mergedAt,
      endAt: null,
      refs: [`#${pr.number}`, pr.url],
    });
  }

  if (t5.length === 0) {
    t5.push(emptySample('T5', 'no component/** merges in window'));
  }
  if (t6.length === 0) {
    t6.push(emptySample('T6', 'no merged PRs in window for T6 correlation'));
  }
  return { t5, t6 };
}

function collectUninstrumented(transitionId, detail) {
  return [emptySample(transitionId, detail)];
}

export function buildReportModel({ window, generator, samplesByTransition, dataComplete }) {
  const scorecard = {};
  for (const t of TRANSITIONS) {
    const samples = samplesByTransition[t.id] || [];
    scorecard[t.id] = {
      title: t.title,
      ...scoreTransition(samples, t.targetSeconds),
    };
  }

  const breaches = [];
  const measurementFailures = [];
  for (const t of TRANSITIONS) {
    for (const sample of samplesByTransition[t.id] || []) {
      if (
        sample.status === 'measured' &&
        typeof sample.durationSeconds === 'number' &&
        sample.durationSeconds > t.targetSeconds
      ) {
        breaches.push({ ...sample, targetSeconds: t.targetSeconds });
      }
      if (sample.status === 'measurement_failure') {
        measurementFailures.push(sample);
      }
    }
  }

  const rootCause = {
    runner_host: 0,
    bridge_auth_capacity: 0,
    cursor_execution: 0,
    ci_checks: 0,
    review_defect: 0,
    controller_dispatcher: 0,
    protected_decision: 0,
    repository_contract_defect: measurementFailures.length,
  };

  return {
    header: {
      report_date: window.end.toISOString().slice(0, 10),
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
      generator,
      data_completeness: dataComplete ? 'partial' : 'incomplete',
      source_issue: 2679,
      notes:
        'Phase 2 collector: T1 uses workflow-run duration proxy; T2–T4/T7–T8 and full T5/T6 correlation remain measurement_failure until instrumentation gaps close (#3212 dispatch cutover noted).',
    },
    scorecard,
    breaches,
    root_cause_rollup: rootCause,
    avoidable_cursor_idle: {
      total_minutes: null,
      note: 'Not computed in this revision (requires eligible-work interval reconstruction).',
    },
    corrective_actions: [],
    trend: {
      note: 'No prior automated report baseline in artifact store for delta.',
    },
    measurement_failures: measurementFailures,
    samples_by_transition: samplesByTransition,
  };
}

export function renderMarkdown(model) {
  const lines = [];
  lines.push(`# Workflow Transition SLO Daily Report`);
  lines.push('');
  lines.push(`- Report date: ${model.header.report_date}`);
  lines.push(`- Window: ${model.header.window_start} → ${model.header.window_end}`);
  lines.push(`- Generator: ${model.header.generator}`);
  lines.push(`- Data completeness: ${model.header.data_completeness}`);
  lines.push(`- Source issue: #${model.header.source_issue}`);
  lines.push(`- Notes: ${model.header.notes}`);
  lines.push('');
  lines.push('## SLO scorecard');
  lines.push('');
  lines.push('| ID | Compliance % | Samples | Measured | Failures | Breaches | Median s | p95 s | Max s | Target s |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const t of TRANSITIONS) {
    const row = model.scorecard[t.id];
    lines.push(
      `| ${t.id} | ${row.compliance_pct ?? 'n/a'} | ${row.samples} | ${row.measured} | ${row.measurement_failures} | ${row.breaches} | ${row.median_seconds ?? 'n/a'} | ${row.p95_seconds ?? 'n/a'} | ${row.max_seconds ?? 'n/a'} | ${row.target_seconds} |`,
    );
  }
  lines.push('');
  lines.push('## Breaches');
  lines.push('');
  if (!model.breaches.length) {
    lines.push('_None in measured samples._');
  } else {
    for (const b of model.breaches) {
      lines.push(
        `- ${b.transitionId}: ${b.durationSeconds}s > ${b.targetSeconds}s; start=${b.startAt}; end=${b.endAt}; refs=${(b.refs || []).join(', ')}`,
      );
    }
  }
  lines.push('');
  lines.push('## Root-cause rollup');
  lines.push('');
  for (const [code, count] of Object.entries(model.root_cause_rollup)) {
    lines.push(`- \`${code}\`: ${count}`);
  }
  lines.push('');
  lines.push('## Avoidable Cursor idle');
  lines.push('');
  lines.push(model.avoidable_cursor_idle.note);
  lines.push('');
  lines.push('## Corrective actions');
  lines.push('');
  lines.push(model.corrective_actions.length ? model.corrective_actions.map(String).join('\n') : '_None recorded by collector._');
  lines.push('');
  lines.push('## Trend');
  lines.push('');
  lines.push(model.trend.note);
  lines.push('');
  lines.push('## Measurement failures');
  lines.push('');
  const mf = model.measurement_failures.slice(0, 40);
  if (!mf.length) {
    lines.push('_None._');
  } else {
    for (const item of mf) {
      lines.push(`- ${item.transitionId}: ${item.reason}`);
    }
    if (model.measurement_failures.length > mf.length) {
      lines.push(`- … ${model.measurement_failures.length - mf.length} more`);
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('This report does not authorize automatic merge to `main` or bypass protected decisions.');
  lines.push('');
  return lines.join('\n');
}

function runSelfTest() {
  const end = new Date('2026-08-10T21:00:00.000Z');
  const window = computeWindow(end, 24);
  if (window.start.toISOString() !== '2026-08-09T21:00:00.000Z') {
    fail(`self-test window start mismatch: ${window.start.toISOString()}`);
  }

  const scored = scoreTransition(
    [
      { status: 'measured', durationSeconds: 60 },
      { status: 'measured', durationSeconds: 180 },
      { status: 'measurement_failure', durationSeconds: null },
    ],
    120,
  );
  if (scored.measured !== 2 || scored.breaches !== 1 || scored.compliance_pct !== 50) {
    fail(`self-test scorecard unexpected: ${JSON.stringify(scored)}`);
  }

  const model = buildReportModel({
    window,
    generator: 'self-test',
    dataComplete: false,
    samplesByTransition: {
      T1: [{ status: 'measured', durationSeconds: 30, transitionId: 'T1', reason: 'ok', refs: [] }],
      T2: [emptySample('T2', 'gap')],
      T3: [emptySample('T3', 'gap')],
      T4: [emptySample('T4', 'gap')],
      T5: [emptySample('T5', 'gap')],
      T6: [emptySample('T6', 'gap')],
      T7: [emptySample('T7', 'gap')],
      T8: [emptySample('T8', 'gap')],
    },
  });
  const md = renderMarkdown(model);
  if (!md.includes('## SLO scorecard') || !md.includes('measurement_failure')) {
    fail('self-test markdown missing required sections');
  }
  if (!md.includes('does not authorize automatic merge')) {
    fail('self-test markdown missing safety footer');
  }

  // Repo lock
  if (ALLOWED_REPOS.has('wdhunter645/next-starter-template')) {
    fail('draft slug must not be allowed');
  }

  console.log('self-test PASS');
}

function runReport() {
  const repo = resolveRepo();
  const windowEnd = getArg('window-end')
    ? parseIsoRequired(getArg('window-end'), 'window-end')
    : new Date();
  const hours = Number(getArg('hours', '24'));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
    fail('--hours must be a number between 1 and 168');
  }
  const window = computeWindow(windowEnd, hours);
  const generator = getArg('generator', 'scripts/ops/workflow-transition-slo-report.mjs');

  console.log(`Collecting SLO window ${window.start.toISOString()} → ${window.end.toISOString()} for ${repo}`);

  const t1 = collectT1(repo, window);
  const { t5, t6 } = collectT5T6(repo, window);
  const samplesByTransition = {
    T1: t1,
    T2: collectUninstrumented(
      'T2',
      'Bridge start timestamps not GitHub-visible; #3212 dispatch accept evidence not yet exported to this collector',
    ),
    T3: collectUninstrumented('T3', 'controller acknowledgment marker not uniformly schema’d'),
    T4: collectUninstrumented('T4', 'review-finding → handoff:ready resume correlation not implemented'),
    T5: t5,
    T6: t6,
    T7: collectUninstrumented('T7', 'successor activation not timestamp-linked to parent close'),
    T8: collectUninstrumented('T8', 'auth/capacity failure → deduped alert correlation not implemented'),
  };

  const model = buildReportModel({
    window,
    generator,
    samplesByTransition,
    dataComplete: false,
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const stamp = window.end.toISOString().replace(/[:.]/g, '-');
  const mdPath = join(OUTPUT_DIR, `slo-daily-${stamp}.md`);
  const jsonPath = join(OUTPUT_DIR, `slo-daily-${stamp}.json`);
  writeFileSync(mdPath, renderMarkdown(model), 'utf8');
  writeFileSync(jsonPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(
    `Scorecard summary: T1 measured=${model.scorecard.T1.measured} compliance=${model.scorecard.T1.compliance_pct ?? 'n/a'}; measurement_failures=${model.measurement_failures.length}`,
  );
}

function main() {
  const mode = getArg('mode', 'report');
  if (mode === 'self-test') {
    runSelfTest();
    return;
  }
  if (mode === 'report') {
    runReport();
    return;
  }
  fail(`Unknown --mode=${mode}. Use report or self-test.`);
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1].endsWith('workflow-transition-slo-report.mjs') : false;
if (invokedPath) {
  main();
}
