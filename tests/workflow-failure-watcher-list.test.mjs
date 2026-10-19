import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Monitoring gap 6 (#4686). The failure watcher (#4444) opens one Operations Issue when a
// watched workflow fails on main. These tests fail if a workflow that must be watched is
// dropped or renamed, and if a self-reporting workflow is added and would open a duplicate.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDir = path.join(root, '.github', 'workflows');
const watcherFile = path.join(workflowsDir, 'ops-workflow-failure-exception-issues.yml');

// Workflows that must open the shared exception Issue when they fail.
const MUST_BE_WATCHED = [
  'OPS — D1 Backup Scheduled Daily Export (#3268 Phase 3)',
  'OPS — D1 Backup Scheduled Quarterly Restore Drill (#3268 Phase 4)',
  'OPS — Snapshot Backup',
  'D1 Migrations',
  'OPS — B2 D1 Daily Sync',
  'OPS — B2 S3 Smoke Test',
  'OPS — Matchup Pair Monitor',
  'OPS — Production Edge Health',
  'OPS — Scheduled Job Health',
  'GATE — Quality Checks',
  'GATE — Secret Scan',
];

// These report a failure themselves (their own Issue, then the three-failure halt alert), so
// watching them would open two Issues for one failure. Production Audit and the uptime probe
// are the monitoring gap 6 decision: not on the watcher by design.
const SELF_REPORTING = ['OPS — Production Audit', 'OPS — Site Uptime Probe'];

function unquote(value) {
  return value.trim().replace(/^(["'])(.*)\1$/, '$2');
}

function watchedNames() {
  const text = fs.readFileSync(watcherFile, 'utf8');
  const block = text.match(/workflow_run:\s*\n\s*workflows:\s*\n([\s\S]*?)\n\s*types:/);
  if (!block) throw new Error('could not find the workflow_run.workflows list in the watcher');
  return [...block[1].matchAll(/^\s*-\s*(.+)$/gm)].map((match) => unquote(match[1]));
}

function workflowNames() {
  const names = new Map();
  for (const file of fs.readdirSync(workflowsDir).filter((entry) => /\.ya?ml$/.test(entry))) {
    const line = fs.readFileSync(path.join(workflowsDir, file), 'utf8').match(/^name:\s*(.+)$/m);
    if (line) names.set(unquote(line[1]), file);
  }
  return names;
}

describe('failure watcher list (#4686)', () => {
  const watched = watchedNames();

  it('reads a non-empty list', () => {
    expect(watched.length).toBeGreaterThan(0);
  });

  it.each(MUST_BE_WATCHED)('watches %s', (name) => {
    expect(watched).toContain(name);
  });

  it('lists every workflow once', () => {
    expect(watched.filter((name, index) => watched.indexOf(name) !== index)).toEqual([]);
  });

  it('names only workflows that exist, so a rename cannot silently stop the watch', () => {
    const real = workflowNames();
    expect(watched.filter((name) => !real.has(name))).toEqual([]);
  });

  it.each(SELF_REPORTING)('does not also watch %s, which reports its own failure', (name) => {
    expect(workflowNames().has(name)).toBe(true);
    expect(watched).not.toContain(name);
  });
});
