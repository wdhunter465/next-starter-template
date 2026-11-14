// Test helper (#5241). The metadata-defects list is no longer in the published dashboard-data.json. The builder
// writes it to a separate repair report when PMO_DASHBOARD_REPAIR_REPORT is set. Tests set that path, then merge
// the list back into the data they inspect, so their assertions about defect classification stay as they were.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function repairReportPath(outDir) {
  return path.join(outDir, 'repair-report.json');
}

export async function loadDashboardData(outDir) {
  const data = JSON.parse(await readFile(path.join(outDir, 'dashboard-data.json'), 'utf8'));
  try {
    const report = JSON.parse(await readFile(repairReportPath(outDir), 'utf8'));
    data.dataQualityExceptions = report.dataQualityExceptions || [];
  } catch {
    // no report written: leave the data as published
  }
  return data;
}
