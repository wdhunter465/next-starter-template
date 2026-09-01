#!/usr/bin/env node
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
  title = `PROGRAM: Transition fixture #${number}`,
  state = 'open',
  labels = [],
  body = 'Owner / Agent: ChatGPT\nProgram Description: Transition fixture.\n',
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

function findView(data, issueNumber) {
  for (const view of ['activePrograms', 'pmoPipeline', 'completedPrograms', 'incomplete']) {
    const row = (data.views[view] || []).find((entry) => entry.issueNumber === issueNumber);
    if (row) return { view, row };
  }
  for (const parent of data.views.activePrograms || []) {
    const child = (parent.children || []).find((entry) => entry.issueNumber === issueNumber);
    if (child) return { view: 'activePrograms.children', row: child, parent };
  }
  return null;
}

async function buildAndValidate(issues, { inventoryPath, skipInventory = false } = {}) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-transition-'));
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
        ...(skipInventory ? { PMO_DASHBOARD_SKIP_INVENTORY_VALIDATION: '1' } : {}),
        ...(inventoryPath ? { PMO_DASHBOARD_INVENTORY_PATH: inventoryPath } : {})
      }
    });
    return {
      outDir,
      data: JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'))
    };
  } catch (error) {
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}

async function withBuild(issues, fn, options) {
  const result = await buildAndValidate(issues, options);
  try {
    await fn(result.data);
  } finally {
    await rm(result.outDir, { recursive: true, force: true });
  }
}

async function main() {
  await withBuild([
    issue({ number: 9101, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'] })
  ], (data) => {
    const hit = findView(data, 9101);
    assert(hit?.view === 'activePrograms', 'T1: Active placement');
    assert(hit.row.teamLabel === 'team:pmo', 'T1: Active team');
    assert(hit.row.priorityDisplay === '1', 'T1: numeric priority display');
  });

  await withBuild([
    issue({
      number: 9102,
      title: 'PROJECT: Pipeline stage fixture',
      labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'pmo:pipeline-priority:2', 'pmo:stage:pending-launch-packet']
    })
  ], (data) => {
    const hit = findView(data, 9102);
    assert(hit?.view === 'pmoPipeline', 'T2: Pipeline placement');
    assert(hit.row.teamLabel === 'team:pmo', 'T2: Pipeline team');
    assert(hit.row.priorityLabel === 'pmo:pipeline-priority:2', 'T2: Pipeline priority');
    assert(hit.row.pipelineStageLabel === 'pmo:stage:pending-launch-packet', 'T2: stage label');
  });

  await withBuild([
    issue({
      number: 9103,
      title: 'STRATEGY: Idea fixture',
      labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'pmo:pipeline-priority:12', 'pmo:stage:initial-idea']
    })
  ], (data) => {
    const hit = findView(data, 9103);
    assert(hit?.view === 'pmoPipeline', 'T3: Pipeline placement');
    assert(hit.row.priorityDisplay === '12', 'T3: unbounded Pipeline priority display');
  });

  for (const [index, stage] of [
    'idea',
    'design-needed',
    'design-ready',
    'sandbox-testing',
    'sandbox-completed',
    'development-testing',
    'development-completed',
    'launch-packet-needed',
    'launch-packet-ready',
    'graduation-candidate'
  ].entries()) {
    const number = 9200 + index;
    await withBuild([
      issue({
        number,
        title: `PROJECT: Approved ${stage} stage fixture`,
        labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'pmo:pipeline-priority:1', `pmo:stage:${stage}`]
      })
    ], (data) => {
      const hit = findView(data, number);
      assert(hit?.view === 'pmoPipeline', `Approved stage ${stage}: Pipeline placement`);
      assert(hit.row.pipelineStageLabel === `pmo:stage:${stage}`, `Approved stage ${stage}: stage label`);
    });
  }

  await withBuild([
    issue({
      number: 9104,
      state: 'closed',
      closed_at: '2026-07-21T10:00:00Z',
      labels: ['pmo', 'pmo:closed']
    })
  ], (data) => {
    const hit = findView(data, 9104);
    assert(hit?.view === 'completedPrograms', 'T4: Completed placement');
    assert(hit.row.teamLabel === null && hit.row.priorityLabel === null, 'T4: terminal queue fields optional');
  });

  for (const [number, labels, expected] of [
    [9105, ['pmo', 'team:pmo', 'pmo:priority:1'], /lifecycle/i],
    [9106, ['pmo', 'pmo:active', 'pmo:pipeline', 'team:pmo', 'pmo:priority:1'], /conflicting lifecycle/i],
    [9107, ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:none'], /priority/i],
    [9108, ['pmo', 'pmo:pipeline', 'team:pmo', 'pmo:pipeline-priority:2'], /stage/i],
    [9109, ['pmo', 'pmo:closed'], /open GitHub issue carries pmo:closed/i]
  ]) {
    await withBuild([issue({ number, title: `PROJECT: Invalid ${number}`, labels })], (data) => {
      const hit = findView(data, number);
      assert(hit?.view === 'incomplete', `T invalid ${number}: Incomplete`);
      assert(hit.row.dataQualityErrors.some((error) => expected.test(error)), `T invalid ${number}: expected error`);
    });
  }

  await withBuild([
    issue({
      number: 9110,
      state: 'closed',
      closed_at: '2026-07-21T09:00:00Z',
      labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1']
    })
  ], (data) => {
    assert(findView(data, 9110)?.view === 'incomplete', 'T10: closed without pmo:closed');
  });

  await withBuild([
    issue({ number: 2101, title: 'DESIGN: Excluded fixture', labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'] }),
    issue({ number: 9111, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:2'] })
  ], (data) => {
    assert(!findView(data, 2101), 'T11: excluded issue absent');
    assert(findView(data, 9111)?.view === 'activePrograms', 'T11: non-excluded issue emits');
  });

  await withBuild([
    issue({ number: 9112, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'] })
  ], (data) => {
    assert(findView(data, 9112).row.priorityDisplay === '1', 'T12a: priority 1');
  });
  await withBuild([
    issue({ number: 9112, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:4'] })
  ], (data) => {
    assert(findView(data, 9112).row.priorityDisplay === '4', 'T12b: priority 4');
  });
  await withBuild([
    issue({ number: 9112, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:5'] })
  ], (data) => {
    assert(findView(data, 9112)?.view === 'activePrograms', 'T12c: priority 5 is a valid ordered Active position');
    assert(findView(data, 9112).row.priorityDisplay === '5', 'T12c: priority 5 display');
  });
  await withBuild([
    issue({ number: 9112, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:12'] })
  ], (data) => {
    assert(findView(data, 9112)?.view === 'activePrograms', 'T12d: priority 12 is a valid ordered Active position');
    assert(findView(data, 9112).row.priorityDisplay === '12', 'T12d: priority 12 display');
  });

  await withBuild([
    issue({
      number: 9113,
      title: 'PROJECT: Transition target',
      labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'pmo:pipeline-priority:2', 'pmo:stage:pending-launch-packet']
    })
  ], (data) => {
    assert(findView(data, 9113)?.view === 'pmoPipeline', 'T13a: starts Pipeline');
  });
  await withBuild([
    issue({
      number: 9113,
      title: 'PROJECT: Transition target',
      labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:3']
    })
  ], (data) => {
    assert(findView(data, 9113)?.view === 'activePrograms', 'T13b: Active after explicit Graduation labels');
  });

  await withBuild([
    issue({
      number: 9120,
      title: 'PROGRAM: Parent with tasks',
      labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'],
      body: 'Owner / Agent: ChatGPT\nProgram Description: Parent.\n'
    }),
    issue({ number: 9121, title: 'TASK: Open child task', labels: ['pmo', 'pmo:task', 'pmo:active'], body: 'Parent: #9120\n' }),
    issue({ number: 9122, title: 'TASK: Closed child task', state: 'closed', closed_at: '2026-07-21T08:00:00Z', labels: ['pmo', 'pmo:task', 'pmo:closed'], body: 'Parent: #9120\n' }),
    issue({ number: 9123, title: 'TASK: Orphan task', labels: ['pmo', 'pmo:task', 'pmo:active'], body: 'No parent reference here.\n' }),
    issue({ number: 9124, title: 'TASK: Prioritized child', labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:priority:1'], body: 'Parent: #9120\n' }),
    issue({ number: 9125, title: 'PROJECT: 9120:1 | Nested project child', labels: ['pmo', 'pmo:active'] })
  ], (data) => {
    const parent = findView(data, 9120);
    assert(parent?.view === 'activePrograms', 'T14: parent active');
    assert(parent.row.taskCount === 2, 'T14: only valid linked tasks counted');
    assert(parent.row.tasksCompleted === 1, 'T14: completed valid task counted');
    assert(parent.row.percentComplete === 50, 'T14: completion math');
    assert(parent.row.children?.[0]?.issueNumber === 9125, 'T14: child project nested');
    assert(parent.row.children[0].teamLabel === null && parent.row.children[0].priorityLabel === null, 'T14: nested child queue fields null');
    assert(findView(data, 9123)?.view === 'incomplete', 'T15: orphan task Incomplete');
    assert(findView(data, 9124)?.view === 'incomplete', 'T16: prioritized task Incomplete');
  });

  await withBuild([
    issue({ number: 9130, labels: ['pmo', 'pmo:active', 'pmo:priority:1'] })
  ], (data) => {
    assert(findView(data, 9130)?.view === 'incomplete', 'Correction a: missing team');
  });
  await withBuild([
    issue({ number: 9130, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'] })
  ], (data) => {
    assert(findView(data, 9130)?.view === 'activePrograms', 'Correction b: valid after fix');
  });

  await withBuild([
    issue({ number: 9150, title: 'PROJECT: Operations peer', labels: ['pmo', 'team:operations', 'ops:priority:1'] }),
    issue({ number: 9151, title: 'PROJECT: Engineering prep peer', labels: ['pmo', 'team:engineering'], body: 'Related Pipeline Project: #9102\n' }),
    issue({ number: 9152, title: 'PROJECT: Retained', labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'] })
  ], (data) => {
    assert(!findView(data, 9150), 'T17: Operations peer excluded');
    assert(!findView(data, 9151), 'T17: Engineering prep peer excluded');
    assert(findView(data, 9152)?.view === 'activePrograms', 'T17: PMO parent retained');
  });

  {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-forbidden-inventory-'));
    const fixturePath = path.join(outDir, 'issues.json');
    const inventoryPath = path.join(outDir, 'pmo-tracked-inventory.json');
    await writeFile(fixturePath, JSON.stringify([
      issue({ number: 9140, labels: ['pmo', 'pmo:active', 'team:pmo', 'pmo:priority:1'] })
    ], null, 2));
    await writeFile(inventoryPath, JSON.stringify({
      version: 99,
      included: [{ issueNumber: 9140, expectedLifecycle: 'active', expectedPriority: 1, expectedTeam: 'team:pmo' }],
      excluded: []
    }, null, 2));
    try {
      await execFileAsync('node', [path.join(__dirname, 'build-dashboard.mjs')], {
        env: { ...process.env, PMO_DASHBOARD_ISSUES_FIXTURE: fixturePath, PMO_DASHBOARD_OUT_DIR: outDir }
      });
      let failed = false;
      try {
        await execFileAsync('node', [path.join(__dirname, 'validate-dashboard.mjs'), outDir], {
          env: { ...process.env, PMO_DASHBOARD_INVENTORY_PATH: inventoryPath }
        });
      } catch (error) {
        failed = true;
        const stderr = String(error.stderr || error.message || '');
        assert(/expectedLifecycle/.test(stderr), 'expectedLifecycle rejected');
        assert(/expectedPriority/.test(stderr), 'expectedPriority rejected');
        assert(/expectedTeam/.test(stderr), 'expectedTeam rejected');
      }
      assert(failed, 'frozen live-state fields must fail closed');
      const productionInventory = JSON.parse(await readFile(path.join(__dirname, 'pmo-tracked-inventory.json'), 'utf8'));
      for (const collection of ['included', 'excluded']) {
        for (const item of productionInventory[collection] || []) {
          for (const field of ['expectedLifecycle', 'expectedPriority', 'expectedTeam']) {
            assert(!(field in item), `production inventory ${collection} must not carry ${field}`);
          }
        }
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }

  console.log('PMO lifecycle transition tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
