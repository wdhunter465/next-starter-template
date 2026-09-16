#!/usr/bin/env node
/**
 * #4117 / live #2682: pmo:task children with remediable queue-label defects
 * remain in parent task accounting, and the current book is open Active +
 * Pipeline only.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function issue({
  number,
  title,
  state = 'open',
  labels = [],
  body = '',
  updated_at = '2026-09-16T00:00:00Z',
  closed_at = null
}) {
  return {
    number,
    title,
    state,
    html_url: `https://github.com/wdhunter465/next-starter-template/issues/${number}`,
    body,
    labels: labels.map((name) => ({ name })),
    updated_at,
    closed_at
  };
}

async function main() {
  const issues = [
    issue({
      number: 2682,
      title: 'PROJECT: PMO dashboard (website) — GitHub Issues as source of truth',
      labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'],
      body: 'Owner / Agent: Cursor\nProject Description: Live parent that currently under-counts children.\n'
    }),
    issue({
      number: 3878,
      title: 'TASK: Healthy linked child',
      labels: ['pmo', 'pmo:task', 'pmo:active'],
      body: 'Parent Project: #2682\n'
    }),
    issue({
      number: 3879,
      title: 'TASK: Defective linked child with team label',
      labels: ['pmo', 'pmo:task', 'pmo:active', 'team:pmo'],
      body: 'Parent Project: #2682\n'
    }),
    issue({
      number: 3880,
      title: 'TASK: Second defective linked child',
      labels: ['pmo', 'pmo:task', 'pmo:pipeline', 'team:pmo'],
      body: 'Parent Project: #2682\n'
    }),
    issue({
      number: 3881,
      title: 'TASK: Closed defective linked child',
      state: 'closed',
      closed_at: '2026-09-10T00:00:00Z',
      labels: ['pmo', 'pmo:task', 'pmo:closed', 'team:pmo'],
      body: 'Parent Project: #2682\n'
    }),
    issue({
      number: 4000,
      title: 'PROJECT: Closed archive must not count in current book',
      state: 'closed',
      closed_at: '2026-09-01T00:00:00Z',
      labels: ['pmo', 'pmo:closed']
    })
  ];

  const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-4117-'));
  const fixturePath = path.join(outDir, 'issues.json');
  await writeFile(fixturePath, JSON.stringify(issues, null, 2));
  try {
    await execFileAsync('node', [path.join(__dirname, 'build-dashboard.mjs')], {
      env: {
        ...process.env,
        PMO_DASHBOARD_ISSUES_FIXTURE: fixturePath,
        PMO_DASHBOARD_OUT_DIR: outDir
      }
    });
    await execFileAsync('node', [path.join(__dirname, 'validate-dashboard.mjs'), outDir], {
      env: {
        ...process.env,
        PMO_DASHBOARD_SKIP_INVENTORY_VALIDATION: '1'
      }
    });
    const data = JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'));
    const parent = (data.views.activePrograms || []).find((row) => row.issueNumber === 2682);
    assert(parent, '#2682 stays Active');
    assert(parent.lifecycle === 'active', '#2682 lifecycle remains active');
    assert(parent.taskCount === 4, '#2682 counts all four linked children, including defective ones');
    assert(parent.tasksCompleted === 1, '#2682 counts the closed reconciled child');
    assert(parent.percentComplete === 25, '#2682 percentComplete is 1 of 4');
    assert(
      (parent.linkedTaskDataQuality || []).map((entry) => entry.issueNumber).sort((a, b) => a - b).join(',') === '3879,3880,3881',
      '#2682 surfaces the three remediable child defects without dropping them'
    );
    assert(!(data.views.incomplete || []).length, 'Incomplete view stays empty');
    assert(!(data.views.completedPrograms || []).length, 'Completed Programs stays empty');
    assert(!(data.views.activePrograms || []).some((row) => row.issueNumber === 4000), 'closed archive is not current-book');
    assert(data.currentBook.parentStandaloneCount === 1, 'current book is the one open parent/standalone');
    console.log('PMO current-book child accounting tests passed');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
