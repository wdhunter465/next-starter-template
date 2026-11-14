#!/usr/bin/env node
// #5241: the dashboard publishes no metadata-defects list, no Incomplete section and no Data quality column.
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

async function main() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'pmo-dashboard-no-defect-report-'));
  try {
    // No repair report path: the published output must not carry the defect list.
    await execFileAsync('node', [path.join(__dirname, 'build-dashboard.mjs')], {
      env: { ...process.env, PMO_DASHBOARD_ISSUES_FIXTURE: fixture, PMO_DASHBOARD_OUT_DIR: outDir, PMO_DASHBOARD_REPAIR_REPORT: '' }
    });
    await execFileAsync('node', [path.join(__dirname, 'validate-dashboard.mjs'), outDir], {
      env: { ...process.env, PMO_DASHBOARD_SKIP_INVENTORY_VALIDATION: '1', PMO_DASHBOARD_REPAIR_REPORT: '' }
    });
    const data = JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'));
    assert(!('dataQualityExceptions' in data), 'dashboard-data.json must not publish dataQualityExceptions');
    assert(!(data.views?.incomplete || []).length, 'the Incomplete view stays empty');

    const page = await readFile(path.join(__dirname, 'static/pmo-dashboard.js'), 'utf8');
    assert(!/Data quality/i.test(page), 'the page must have no Data quality column');
    assert(!/Metadata defects/i.test(page), 'the page must have no Metadata defects section');
    assert(!/dataQualityExceptions/.test(page), 'the page must not read the defect list');
    console.log('PMO dashboard no-defect-report test passed');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
