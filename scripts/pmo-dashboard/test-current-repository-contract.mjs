#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(__dirname, 'fixtures/issues-current-repository-contract.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function generateDashboard({ repository = '', owner = '' }) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-current-repository-'));
  const env = {
    ...process.env,
    PMO_DASHBOARD_ISSUES_FIXTURE: fixture,
    PMO_DASHBOARD_OUT_DIR: outDir,
    GITHUB_REPOSITORY_OWNER: owner,
    GITHUB_REPOSITORY: repository
  };

  try {
    await execFileAsync(process.execPath, [path.join(__dirname, 'run-dashboard-build.mjs')], { env });
    await execFileAsync(process.execPath, [path.join(__dirname, 'validate-dashboard.mjs'), outDir], {
      env: { ...env, PMO_DASHBOARD_SKIP_INVENTORY_VALIDATION: '1' }
    });
    return JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

async function main() {
  const defaultData = await generateDashboard({});
  assert(
    defaultData.repository === 'wdhunter465/next-starter-template',
    `unexpected default repository ${defaultData.repository}`
  );

  const byNumber = new Map(defaultData.views.activePrograms.map((entry) => [entry.issueNumber, entry]));

  const cursorOwned = byNumber.get(9100);
  assert(cursorOwned, 'expected active project #9100');
  assert(
    cursorOwned.ownerAgent === 'Cursor',
    `agent:cursor must override stale Owner / Agent body and legacy owner:*, got ${cursorOwned.ownerAgent}`
  );
  assert(cursorOwned.taskCount === 1 && cursorOwned.tasksCompleted === 1 && cursorOwned.percentComplete === 100, 'closed direct child accounting');

  const unassigned = byNumber.get(9102);
  assert(unassigned, 'expected active project #9102');
  assert(
    unassigned.ownerAgent === 'Unassigned',
    `zero agent:* labels must render Unassigned (not body/legacy/assignee), got ${unassigned.ownerAgent}`
  );

  const conflict = byNumber.get(9103);
  assert(conflict, 'expected active project #9103');
  assert(
    /Conflicting agent ownership/.test(conflict.ownerAgent)
      && conflict.ownerAgent.includes('agent:claude')
      && conflict.ownerAgent.includes('agent:grok'),
    `multiple agent:* labels must surface conflict, got ${conflict.ownerAgent}`
  );

  const repositoryOnlyData = await generateDashboard({ repository: 'example-owner/example-repository' });
  assert(
    repositoryOnlyData.repository === 'example-owner/example-repository',
    `repository-only environment must remain internally consistent, got ${repositoryOnlyData.repository}`
  );

  console.log('PMO current repository and agent:* owner contract test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
