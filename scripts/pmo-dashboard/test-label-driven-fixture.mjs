#!/usr/bin/env node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, 'fixtures/issues-label-driven.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function byNumber(rows) {
  return new Map(rows.map((row) => [row.issueNumber, row]));
}

async function main() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-fixture-'));
  try {
    await execFileAsync('node', [path.join(__dirname, 'build-dashboard.mjs')], {
      env: { ...process.env, PMO_DASHBOARD_ISSUES_FIXTURE: fixture, PMO_DASHBOARD_OUT_DIR: outDir }
    });
    await execFileAsync('node', [path.join(__dirname, 'validate-dashboard.mjs'), outDir], {
      env: { ...process.env, PMO_DASHBOARD_SKIP_INVENTORY_VALIDATION: '1' }
    });

    const data = JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'));
    assert(data.trackingModel === 'pmo-label', 'trackingModel must be pmo-label');
    assert(data.contractVersion === 'queue-label-registry-v1', 'queue contract version');

    const active = data.views.activePrograms;
    const pipeline = data.views.pmoPipeline;
    const completed = data.views.completedPrograms;
    const incomplete = data.views.incomplete;
    assert(active.length === 2, `expected two active portfolio rows, got ${active.length}`);
    const activeMap = byNumber(active);
    assert(activeMap.has(9001) && activeMap.has(9028), 'active rows');
    assert(activeMap.get(9028).teamLabel === 'team:pmo', '#9028 Active team');
    assert(activeMap.get(9028).priorityDisplay === '4', '#9028 priority from label');

    const program = activeMap.get(9001);
    assert(program.children?.length === 3, 'active program should have three nested children');
    assert(program.children.map((row) => row.issueNumber).join(',') === '9003,9002,9008', 'child sequence');
    for (const child of program.children) {
      assert(child.teamLabel === null && child.priorityLabel === null, `child #${child.issueNumber} queue fields`);
    }
    assert(program.taskCount === 3 && program.tasksCompleted === 1 && program.percentComplete === 33, 'task accounting');

    const pipelineMap = byNumber(pipeline);
    assert(pipelineMap.has(9004) && pipelineMap.has(9005), 'pipeline rows');
    assert(pipelineMap.get(9004).teamLabel === 'team:pmo', '#9004 Pipeline team');
    assert(pipelineMap.get(9004).priorityLabel === 'pmo:pipeline-priority:3', '#9004 Pipeline priority');
    assert(pipelineMap.get(9005).priorityLabel === 'pmo:pipeline-priority:12', '#9005 unbounded Pipeline priority');
    assert(pipelineMap.get(9005).priorityDisplay === '12', '#9005 unbounded display');
    assert(pipelineMap.get(9004).pipelineStageDisplay === 'Graduation Candidate', '#9004 stage display');
    assert(pipeline[0].issueNumber === 9004, 'Pipeline sorts by independent numeric priority');

    const completedMap = byNumber(completed);
    assert(completed[0].issueNumber === 9006, 'completed newest first');
    assert(completedMap.has(9011) && completedMap.has(9007), 'completed rows retained');
    assert(!completedMap.has(9008), 'completed child must not duplicate');

    const incompleteMap = byNumber(incomplete);
    for (const number of [9023, 9024, 9025, 9026, 9027, 9029, 9030]) {
      const row = incompleteMap.get(number);
      assert(row, `#${number} must quarantine`);
      assert(row.lifecycle === 'incomplete', `#${number} lifecycle`);
      assert(row.dataQualityErrors.length > 0 && row.requiredRemediation.length > 0, `#${number} evidence`);
    }
    assert(incompleteMap.get(9027).dataQualityErrors.some((error) => /priority/.test(error)), 'none priority reported');
    assert(incompleteMap.get(9029).dataQualityErrors.some((error) => /not reconciled to pmo:closed/.test(error)), 'closed conflict reported');
    assert(incompleteMap.get(9030).dataQualityErrors.some((error) => /cross-namespace/.test(error)), 'cross namespace reported');

    const serialized = JSON.stringify(data);
    for (const excluded of [9010, 9031, 9032]) assert(!serialized.includes(`"issueNumber":${excluded}`), `#${excluded} excluded`);

    const accounting = new Map(data.taskAccounting.map((entry) => [entry.parentIssueNumber, entry]));
    const parentAccounting = accounting.get(9001);
    assert(parentAccounting.declaredTaskIssueNumbers.sort().join(',') === '9020,9021,9022', 'linked tasks');
    assert(parentAccounting.completedTaskIssueNumbers.includes(9022), 'completed task');

    for (const row of [...active, ...pipeline, ...completed, ...incomplete]) {
      assert(Number.isInteger(row.issueNumber) && row.issueNumber > 0, `row identity ${row.name}`);
      assert(typeof row.issueUrl === 'string' && row.issueUrl.includes('github.com'), `row URL #${row.issueNumber}`);
      assert(Array.isArray(row.dataQualityErrors), `row errors #${row.issueNumber}`);
    }

    const contract = await execFileAsync('node', [path.join(__dirname, 'test-queue-label-contract.mjs')]);
    if (contract.stdout) process.stdout.write(contract.stdout);
    const transition = await execFileAsync('node', [path.join(__dirname, 'test-lifecycle-transitions.mjs')]);
    if (transition.stdout) process.stdout.write(transition.stdout);
    const reconcile = await execFileAsync('node', [path.join(__dirname, 'test-reconcile-task-child-labels.mjs')]);
    if (reconcile.stdout) process.stdout.write(reconcile.stdout);
    const skew = await execFileAsync('node', [path.join(__dirname, 'test-task-count-incomplete-skew.mjs')]);
    if (skew.stdout) process.stdout.write(skew.stdout);
    console.log('PMO label-driven fixture test passed');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
