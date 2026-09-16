#!/usr/bin/env node
/**
 * Regression coverage for #4117: linked pmo:task Issues stay in parent task
 * accounting even when they have remediable metadata defects. Incomplete is not
 * a lifecycle, so defective children must not be quarantined out of the count.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planTaskChildLabelReconciliation } from './reconcile-task-child-labels.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function issue({
  number,
  title = `PROGRAM: Fixture #${number}`,
  state = 'open',
  labels = [],
  body = 'Owner / Agent: ChatGPT\nProgram Description: Fixture.\n',
  updated_at = '2026-07-22T00:00:00Z',
  closed_at = null
}) {
  return {
    number,
    title,
    state,
    html_url: `https://github.com/wdhunter645/next-starter-template/issues/${number}`,
    body,
    labels: labels.map((name) => ({ name })),
    updated_at,
    closed_at
  };
}

async function build(issues) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-task-skew-'));
  const fixturePath = path.join(outDir, 'issues.json');
  await writeFile(fixturePath, JSON.stringify(issues, null, 2));
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
  return {
    outDir,
    data: JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'))
  };
}

function findActive(data, issueNumber) {
  return (data.views.activePrograms || []).find((row) => row.issueNumber === issueNumber) || null;
}

function metadataDefectTasks(data) {
  return (data.dataQualityExceptions || []).filter((row) => row.role === 'task');
}

function applyPlansToIssues(issues) {
  return issues.map((entry) => {
    if (!(entry.labels || []).some((label) => label.name === 'pmo:task')) return entry;
    const plan = planTaskChildLabelReconciliation({
      number: entry.number,
      state: entry.state,
      title: entry.title,
      labels: entry.labels
    });
    if (!plan.changed) return entry;
    const next = new Set(plan.labelsAfter);
    return {
      ...entry,
      labels: [...next].sort().map((name) => ({ name }))
    };
  });
}

async function main() {
  const parent = issue({
    number: 9200,
    title: 'PROGRAM: Task-count skew parent',
    labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'],
    body: 'Owner / Agent: ChatGPT\nProgram Description: Parent for skew regression.\n'
  });
  const emptyParent = issue({
    number: 9201,
    title: 'PROGRAM: No tasks parent',
    labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:2'],
    body: 'Owner / Agent: ChatGPT\nProgram Description: Empty parent.\n'
  });

  const defectiveChildren = [
    issue({
      number: 9210,
      title: 'TASK: Missing lifecycle linked child',
      labels: ['pmo', 'pmo:task'],
      body: 'Parent: #9200\n'
    }),
    issue({
      number: 9211,
      title: 'TASK: Prioritized linked child',
      labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:priority:1'],
      body: 'Parent program: #9200\n'
    }),
    issue({
      number: 9212,
      title: 'TASK: Closed unreconciled linked child',
      state: 'closed',
      closed_at: '2026-07-21T12:00:00Z',
      labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:priority:1', 'pmo:stage:execution'],
      body: 'Parent project: #9200\n'
    }),
    issue({
      number: 9213,
      title: 'TASK: Orphan unresolved relationship',
      labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:priority:1'],
      body: 'No parent field.\n'
    })
  ];

  {
    const { outDir, data } = await build([parent, emptyParent, ...defectiveChildren]);
    try {
      const skewed = findActive(data, 9200);
      assert(skewed, 'parent remains Active while children have remediable defects');
      assert(skewed.taskCount === 3, 'linked children with remediable defects still count');
      assert(skewed.tasksCompleted === 1, 'GitHub-closed linked child counts completed even with remediable label defects');
      assert(skewed.percentComplete === 33, 'completion percentage includes closed unreconciled children');
      assert(
        (skewed.linkedTaskDataQuality || []).map((entry) => entry.issueNumber).sort((a, b) => a - b).join(',') === '9210,9211,9212',
        'parent surfaces linked-task metadata defects without dropping them from accounting'
      );

      const empty = findActive(data, 9201);
      assert(empty, 'empty parent Active');
      assert(empty.taskCount === 0, 'parent with no tasks stays at 0');

      assert(!(data.views.incomplete || []).length, 'Incomplete view stays empty');
      const defects = metadataDefectTasks(data);
      assert(defects.length === 1, 'only the orphan task is unplaceable');
      assert(defects[0].issueNumber === 9213, 'orphan remains a metadata defect');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  {
    const reconciled = applyPlansToIssues([parent, emptyParent, ...defectiveChildren]);
    const { outDir, data } = await build(reconciled);
    try {
      const fixed = findActive(data, 9200);
      assert(fixed, 'parent still Active after reconcile');
      assert(fixed.taskCount === 3, 'three valid linked tasks counted after reconcile');
      assert(fixed.tasksCompleted === 1, 'closed reconciled task counts completed');
      assert(fixed.percentComplete === 33, 'completion percentage after reconcile');

      const accounting = (data.taskAccounting || []).find((entry) => entry.parentIssueNumber === 9200);
      assert(accounting, 'taskAccounting row exists');
      assert(
        accounting.declaredTaskIssueNumbers.slice().sort((a, b) => a - b).join(',') === '9210,9211,9212',
        'declared tasks are the three linked valid children'
      );

      const empty = findActive(data, 9201);
      assert(empty.taskCount === 0, 'empty parent remains 0 after reconcile');

      const incomplete = metadataDefectTasks(data);
      assert(incomplete.length === 1, 'only orphan remains a metadata defect');
      assert(incomplete[0].issueNumber === 9213, 'orphan is the remaining metadata defect');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  {
    const single = [
      parent,
      issue({
        number: 9220,
        title: 'TASK: Single valid child',
        labels: ['pmo', 'pmo:task', 'pmo:active'],
        body: 'Parent: #9200\n'
      })
    ];
    const { outDir, data } = await build(single);
    try {
      const row = findActive(data, 9200);
      assert(row.taskCount === 1, 'single valid linked task counts as 1');
      assert(row.tasksCompleted === 0, 'open single task not completed');
      assert(row.percentComplete === 0, '0% when one open task');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  {
    const fanClub = issue({
      number: 2682,
      title: 'PROJECT: Fan Club Product',
      labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'],
      body: 'Owner / Agent: ChatGPT\nProject Description: Live #2682 accounting regression.\n'
    });
    const liveChildren = [
      issue({
        number: 2683,
        title: 'TASK: Closed valid child',
        state: 'closed',
        closed_at: '2026-07-21T12:00:00Z',
        labels: ['pmo', 'pmo:task', 'pmo:closed'],
        body: 'Parent: #2682\n'
      }),
      issue({
        number: 3879,
        title: 'TASK: Child with team pmo',
        labels: ['pmo', 'pmo:task', 'pmo:active', 'team:pmo'],
        body: 'Parent Project: #2682\n'
      }),
      issue({
        number: 3880,
        title: 'TASK: Child with team pmo 2',
        labels: ['pmo', 'pmo:task', 'pmo:active', 'team:pmo'],
        body: 'Parent Project: #2682\n'
      }),
      issue({
        number: 3881,
        title: 'TASK: Child with team pmo 3',
        labels: ['pmo', 'pmo:task', 'pmo:active', 'team:pmo'],
        body: 'Parent Project: #2682\n'
      })
    ];
    const { outDir, data } = await build([fanClub, ...liveChildren]);
    try {
      const row = findActive(data, 2682);
      assert(row, '#2682 remains Active');
      assert(row.taskCount === 4, '#2682 linked children remain in accounting despite team:pmo on tasks');
      assert(row.tasksCompleted === 1, '#2682 closed child still counts completed');
      assert(row.percentComplete === 25, '#2682 completion is 1 of 4');
      assert(!(data.views.incomplete || []).length, '#2682 children are not quarantined into Incomplete');
      assert(!metadataDefectTasks(data).some((entry) => [3879, 3880, 3881].includes(entry.issueNumber)), 'linked defective children are not unplaceable exceptions');
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  console.log('task-count linked-child accounting regression tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
