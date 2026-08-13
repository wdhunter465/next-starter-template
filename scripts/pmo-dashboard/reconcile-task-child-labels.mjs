#!/usr/bin/env node
/**
 * Reconcile live pmo:task Issue labels to the July 2026 child-task contract.
 *
 * Safe automatic mutations:
 * - remove team:*, pmo:priority:*, eng:priority:*, ops:*, and pmo:stage:* from children
 * - closed Issues → exactly pmo:closed (drop other lifecycle labels)
 * - open Issues missing lifecycle → add pmo:active
 * - open Issues carrying pmo:closed → drop pmo:closed and ensure one open lifecycle
 *
 * Does not invent parent references or change portfolio/parent Issues.
 *
 * Usage:
 *   node scripts/pmo-dashboard/reconcile-task-child-labels.mjs
 *   node scripts/pmo-dashboard/reconcile-task-child-labels.mjs --apply
 *   node scripts/pmo-dashboard/reconcile-task-child-labels.mjs --fixture path/to/issues.json
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template';
const LIFECYCLE_LABELS = new Set(['pmo:pipeline', 'pmo:active', 'pmo:closed']);

function normalizeLabels(input) {
  return [...new Set(
    (input || [])
      .map((label) => (typeof label === 'string' ? label : label?.name))
      .filter(Boolean)
  )].sort();
}

function isProhibitedChildLabel(label) {
  return (
    label.startsWith('team:')
    || label.startsWith('pmo:priority:')
    || label.startsWith('eng:priority:')
    || label.startsWith('ops:')
    || label.startsWith('pmo:stage:')
  );
}

function issueState(issue) {
  return String(issue.state || '').toLowerCase() === 'closed' ? 'closed' : 'open';
}

/**
 * @param {{ number: number, state?: string, labels?: unknown[], title?: string }} issue
 * @returns {{ number: number, title: string, state: string, labelsBefore: string[], add: string[], remove: string[], labelsAfter: string[], changed: boolean }}
 */
export function planTaskChildLabelReconciliation(issue) {
  const number = Number(issue.number);
  const title = issue.title || '';
  const state = issueState(issue);
  const labelsBefore = normalizeLabels(issue.labels);
  const remove = new Set();
  const add = new Set();

  for (const label of labelsBefore) {
    if (isProhibitedChildLabel(label)) remove.add(label);
  }

  const lifecycleBefore = labelsBefore.filter((label) => LIFECYCLE_LABELS.has(label));

  if (state === 'closed') {
    for (const label of lifecycleBefore) {
      if (label !== 'pmo:closed') remove.add(label);
    }
    if (!labelsBefore.includes('pmo:closed') || remove.has('pmo:closed')) {
      add.add('pmo:closed');
      remove.delete('pmo:closed');
    }
  } else {
    if (lifecycleBefore.includes('pmo:closed')) remove.add('pmo:closed');
    const openLifecycle = lifecycleBefore.filter((label) => label !== 'pmo:closed' && !remove.has(label));
    if (openLifecycle.length === 0) {
      add.add('pmo:active');
    } else if (openLifecycle.length > 1) {
      const keep = openLifecycle.includes('pmo:active') ? 'pmo:active' : openLifecycle[0];
      for (const label of openLifecycle) {
        if (label !== keep) remove.add(label);
      }
    }
  }

  const labelsAfter = normalizeLabels([
    ...labelsBefore.filter((label) => !remove.has(label)),
    ...add
  ]);

  return {
    number,
    title,
    state,
    labelsBefore,
    add: [...add].sort(),
    remove: [...remove].sort(),
    labelsAfter,
    changed: add.size > 0 || remove.size > 0
  };
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

function fetchLiveTaskIssues() {
  const issues = [];
  for (const state of ['open', 'closed']) {
    let page = 1;
    for (;;) {
      const batch = ghJson([
        'api',
        '-X',
        'GET',
        `repos/${REPO}/issues?state=${state}&labels=pmo:task&per_page=100&page=${page}`
      ]);
      issues.push(...batch.filter((issue) => !issue.pull_request));
      if (batch.length < 100) break;
      page += 1;
    }
  }
  const byNumber = new Map();
  for (const issue of issues) byNumber.set(issue.number, issue);
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

async function loadIssues(fixturePath) {
  if (fixturePath) {
    const raw = JSON.parse(await readFile(fixturePath, 'utf8'));
    return raw.filter((issue) => !issue.pull_request);
  }
  return fetchLiveTaskIssues();
}

function applyPlan(plan) {
  const args = ['issue', 'edit', String(plan.number), '--repo', REPO];
  for (const label of plan.add) args.push('--add-label', label);
  for (const label of plan.remove) args.push('--remove-label', label);
  execFileSync('gh', args, { stdio: 'inherit' });
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const fixtureIdx = args.indexOf('--fixture');
  const fixturePath = fixtureIdx >= 0 ? args[fixtureIdx + 1] : null;

  const issues = await loadIssues(fixturePath);
  const plans = issues
    .filter((issue) => normalizeLabels(issue.labels).includes('pmo:task'))
    .map((issue) => planTaskChildLabelReconciliation(issue));

  const changed = plans.filter((plan) => plan.changed);
  const summary = {
    sourceIssue: 2788,
    repository: REPO,
    mode: apply ? 'apply' : 'dry-run',
    inspected: plans.length,
    mutable: changed.length,
    unchanged: plans.length - changed.length,
    addCounts: {},
    removeCounts: {}
  };
  for (const plan of changed) {
    for (const label of plan.add) summary.addCounts[label] = (summary.addCounts[label] || 0) + 1;
    for (const label of plan.remove) summary.removeCounts[label] = (summary.removeCounts[label] || 0) + 1;
  }

  console.log(JSON.stringify({ summary, plans: changed }, null, 2));

  if (!apply) {
    console.error(`Dry-run only. Re-run with --apply to mutate ${changed.length} issue(s).`);
    return;
  }

  let applied = 0;
  for (const plan of changed) {
    applyPlan(plan);
    applied += 1;
    console.error(`applied #${plan.number}: +[${plan.add.join(', ')}] -[${plan.remove.join(', ')}]`);
  }
  console.error(`Applied ${applied} reconciliation plan(s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
