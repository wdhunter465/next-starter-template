#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || process.env.PMO_DASHBOARD_OUT_DIR || 'site/pmo-dashboard';
const requiredViews = ['activePrograms', 'pmoPipeline', 'completedPrograms', 'incomplete'];
const validRowLifecycles = new Set(['active', 'pipeline', 'closed', 'incomplete']);
const FORBIDDEN_INVENTORY_LIVE_STATE_FIELDS = ['expectedLifecycle', 'expectedPriority', 'expectedTeam'];
const stageLabels = new Set([
  'pmo:stage:idea',
  'pmo:stage:design-needed',
  'pmo:stage:design-ready',
  'pmo:stage:sandbox-testing',
  'pmo:stage:sandbox-completed',
  'pmo:stage:development-testing',
  'pmo:stage:development-completed',
  'pmo:stage:launch-packet-needed',
  'pmo:stage:launch-packet-ready',
  'pmo:stage:graduation-candidate',
  'pmo:stage:initial-idea',
  'pmo:stage:drafted-design',
  'pmo:stage:pending-launch-packet'
]);
const pmoActivePriorityRe = /^pmo:priority:[1-9]\d*$/;
const pmoPipelinePriorityRe = /^pmo:pipeline-priority:[1-9]\d*$/;
const allowedStatusByView = {
  activePrograms: new Set(['Active']),
  pmoPipeline: new Set([
    'Idea',
    'Design Needed',
    'Design Ready',
    'Sandbox Testing',
    'Sandbox Completed',
    'Development Testing',
    'Development Completed',
    'Launch Packet Needed',
    'Launch Packet Ready',
    'Initial Idea',
    'Drafted Design',
    'Pending Launch Packet',
    'Graduation Candidate'
  ]),
  completedPrograms: new Set(['Completed']),
  incomplete: new Set(['Incomplete'])
};
const errors = [];

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    errors.push(`${label} is missing or JSON does not parse (${file}): ${error.message}`);
    return null;
  }
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com';
  } catch {
    return false;
  }
}

function topLevelViewFromLabel(label) {
  return label.split('[')[0];
}

function isChildLabel(label) {
  return label.includes('.children[');
}

function validateViewStatus(row, label) {
  if (isChildLabel(label)) return;
  const view = topLevelViewFromLabel(label);
  const allowed = allowedStatusByView[view];
  if (row.status && allowed && !allowed.has(row.status)) {
    errors.push(`${label} status ${JSON.stringify(row.status)} is not allowed in ${view}; allowed statuses: ${[...allowed].join(', ')}`);
  }
}

function validateQueueFields(row, label, view) {
  if (isChildLabel(label)) {
    if (row.teamLabel !== null) errors.push(`${label} child rows must use teamLabel null`);
    if (row.priorityLabel !== null) errors.push(`${label} child rows must use priorityLabel null`);
    return;
  }
  if (view === 'activePrograms') {
    if (row.teamLabel !== 'team:pmo') errors.push(`${label} Active rows require team:pmo`);
    if (!pmoActivePriorityRe.test(row.priorityLabel || '')) {
      errors.push(`${label} Active rows require pmo:priority:<n> with n a positive integer and no 1-4 cap`);
    }
  } else if (view === 'pmoPipeline') {
    if (row.teamLabel !== 'team:pmo') errors.push(`${label} Pipeline rows require team:pmo`);
    if (!pmoPipelinePriorityRe.test(row.priorityLabel || '')) {
      errors.push(`${label} Pipeline rows require pmo:pipeline-priority:<n> with n a positive integer and no 1-4 cap`);
    }
  } else if (view === 'completedPrograms') {
    if (row.teamLabel === 'team:operations') errors.push(`${label} completed PMO rows cannot use team:operations`);
    if (
      row.teamLabel === 'team:pmo' &&
      row.priorityLabel &&
      !pmoActivePriorityRe.test(row.priorityLabel) &&
      !pmoPipelinePriorityRe.test(row.priorityLabel)
    ) {
      errors.push(`${label} completed team:pmo rows may only retain a PMO Active or Pipeline priority`);
    }
    if (row.teamLabel === 'team:engineering' && row.priorityLabel) {
      errors.push(`${label} completed team:engineering rows must not retain PMO portfolio priority`);
    }
  }
}

function validateRow(row, label, rowByNumber, rowDataByNumber) {
  if (!row.name && !row.title) errors.push(`${label} is missing title/name`);
  if (!Number.isInteger(row.issueNumber) || row.issueNumber <= 0) errors.push(`${label} is missing a valid issueNumber`);
  if (!validUrl(row.issueUrl)) errors.push(`${label} contains an obviously invalid issue link`);
  if (!Array.isArray(row.labels)) errors.push(`${label} labels must be an array`);
  if (!validRowLifecycles.has(row.lifecycle)) errors.push(`${label} lifecycle must be active|pipeline|closed|incomplete, got ${JSON.stringify(row.lifecycle)}`);
  if (!row.status) errors.push(`${label} is missing Status`);
  validateViewStatus(row, label);
  if (!Array.isArray(row.dataQualityErrors)) errors.push(`${label} dataQualityErrors must be an array`);
  if (!Array.isArray(row.requiredRemediation)) errors.push(`${label} requiredRemediation must be an array`);

  const view = topLevelViewFromLabel(label);
  if (view === 'incomplete') {
    if (!row.dataQualityErrors?.length) errors.push(`${label} Incomplete rows must include dataQualityErrors`);
    if (!row.requiredRemediation?.length) errors.push(`${label} Incomplete rows must include requiredRemediation`);
    if (row.lifecycle !== 'incomplete') errors.push(`${label} Incomplete rows must use lifecycle incomplete`);
  } else {
    if (!isChildLabel(label) && row.dataQualityErrors?.length) {
      errors.push(`${label} valid lifecycle rows must not carry dataQualityErrors; route to Incomplete instead`);
    }
    validateQueueFields(row, label, view);
    if (row.lifecycle === 'pipeline') {
      if (!row.pipelineStageLabel || !stageLabels.has(row.pipelineStageLabel)) {
        errors.push(`${label} Pipeline rows require exactly one supported pipelineStageLabel`);
      }
      if (!row.pipelineStageDisplay) errors.push(`${label} Pipeline rows require pipelineStageDisplay`);
    } else if (row.pipelineStageLabel || row.pipelineStageDisplay) {
      errors.push(`${label} non-Pipeline rows must not carry Pipeline stage fields`);
    }
    if (row.lifecycle === 'active' && view !== 'activePrograms' && !isChildLabel(label)) errors.push(`${label} active lifecycle must appear in activePrograms`);
    if (row.lifecycle === 'pipeline' && view !== 'pmoPipeline' && !isChildLabel(label)) errors.push(`${label} pipeline lifecycle must appear in pmoPipeline`);
    if (row.lifecycle === 'closed' && view !== 'completedPrograms' && !isChildLabel(label)) errors.push(`${label} closed lifecycle must appear in completedPrograms`);
  }

  if (Number.isNaN(row.percentComplete)) errors.push(`${label} percentComplete is NaN`);
  if (row.percentComplete !== null && (typeof row.percentComplete !== 'number' || row.percentComplete < 0 || row.percentComplete > 100)) {
    errors.push(`${label} percentComplete must be null or 0-100`);
  }
  if (!Number.isInteger(row.taskCount) || row.taskCount < 0) errors.push(`${label} taskCount must be a non-negative integer`);
  if (!Number.isInteger(row.tasksCompleted) || row.tasksCompleted < 0) errors.push(`${label} tasksCompleted must be a non-negative integer`);
  if (row.tasksCompleted > row.taskCount) errors.push(`${label} # of Tasks Completed is greater than # of Tasks`);
  if (row.taskCount > 0) {
    const expected = Math.round((row.tasksCompleted / row.taskCount) * 100);
    if (row.percentComplete !== expected) errors.push(`${label} percentComplete must equal round(tasksCompleted / taskCount * 100)`);
  } else if (row.percentComplete !== null) {
    errors.push(`${label} percentComplete must be null when taskCount is 0`);
  }

  if (row.issueNumber) {
    if (rowByNumber.has(row.issueNumber)) errors.push(`issue #${row.issueNumber} appears in multiple dashboard views`);
    rowByNumber.set(row.issueNumber, label);
    rowDataByNumber.set(row.issueNumber, row);
  }

  if (row.children != null) {
    if (!Array.isArray(row.children)) {
      errors.push(`${label} children must be an array`);
      return;
    }
    for (const [index, child] of row.children.entries()) {
      const childLabel = `${label}.children[${index}]`;
      validateRow(child, childLabel, rowByNumber, rowDataByNumber);
      if (!child.parentProgramIssue && row.issueNumber) errors.push(`${childLabel} is missing parentProgramIssue metadata`);
      if (child.parentProgramIssue && child.parentProgramIssue !== row.issueNumber) errors.push(`${childLabel} parentProgramIssue does not match parent row issueNumber`);
      if (!Number.isInteger(child.childSequence) || child.childSequence <= 0) errors.push(`${childLabel} childSequence must be a positive integer`);
    }
  }
}

const data = await readJson(path.join(outDir, 'dashboard-data.json'), 'dashboard data');
const inventoryPath = process.env.PMO_DASHBOARD_INVENTORY_PATH || path.join(__dirname, 'pmo-tracked-inventory.json');
const inventory = process.env.PMO_DASHBOARD_SKIP_INVENTORY_VALIDATION
  ? null
  : await readJson(inventoryPath, 'tracked inventory');

if (data) {
  if (data.source !== 'github-issues') errors.push('dashboard source must be github-issues');
  const rowByNumber = new Map();
  const rowDataByNumber = new Map();
  for (const view of requiredViews) {
    if (!Array.isArray(data.views?.[view])) errors.push(`required top-level view missing: ${view}`);
    for (const [index, row] of (data.views?.[view] || []).entries()) validateRow(row, `${view}[${index}]`, rowByNumber, rowDataByNumber);
  }

  const taskAccountingByNumber = new Map();
  if (!Array.isArray(data.taskAccounting)) {
    errors.push('taskAccounting must be present and must be an array');
  } else {
    for (const [index, entry] of data.taskAccounting.entries()) {
      const label = `taskAccounting[${index}]`;
      if (!Number.isInteger(entry.parentIssueNumber) || entry.parentIssueNumber <= 0) errors.push(`${label} parentIssueNumber must be a positive integer`);
      if (!Array.isArray(entry.declaredTaskIssueNumbers)) errors.push(`${label} declaredTaskIssueNumbers must be an array`);
      if (!Array.isArray(entry.missingTaskIssueNumbers)) errors.push(`${label} missingTaskIssueNumbers must be an array`);
      if (!Array.isArray(entry.completedTaskIssueNumbers)) errors.push(`${label} completedTaskIssueNumbers must be an array`);
      if (!Number.isInteger(entry.taskCount) || entry.taskCount < 0) errors.push(`${label} taskCount must be a non-negative integer`);
      if (!Number.isInteger(entry.tasksCompleted) || entry.tasksCompleted < 0) errors.push(`${label} tasksCompleted must be a non-negative integer`);
      if (entry.tasksCompleted > entry.taskCount) errors.push(`${label} tasksCompleted is greater than taskCount`);
      const declaredUnique = new Set(entry.declaredTaskIssueNumbers || []);
      if (declaredUnique.size !== (entry.declaredTaskIssueNumbers || []).length) errors.push(`${label} declaredTaskIssueNumbers must not contain duplicates`);
      if (entry.taskCount !== declaredUnique.size) errors.push(`${label} taskCount must equal declaredTaskIssueNumbers length`);
      if (entry.tasksCompleted !== (entry.completedTaskIssueNumbers || []).length) errors.push(`${label} tasksCompleted must equal completedTaskIssueNumbers length`);
      const row = rowDataByNumber.get(entry.parentIssueNumber);
      if (row && row.taskCount !== entry.taskCount) errors.push(`${label} taskCount does not match dashboard row value for #${entry.parentIssueNumber}`);
      if (row && row.tasksCompleted !== entry.tasksCompleted) errors.push(`${label} tasksCompleted does not match dashboard row value for #${entry.parentIssueNumber}`);
      if (taskAccountingByNumber.has(entry.parentIssueNumber)) errors.push(`${label} duplicates task accounting for issue #${entry.parentIssueNumber}`);
      taskAccountingByNumber.set(entry.parentIssueNumber, entry);
    }
  }

  for (const [collection, items] of [['included', inventory?.included], ['excluded', inventory?.excluded]]) {
    for (const item of items || []) {
      for (const field of FORBIDDEN_INVENTORY_LIVE_STATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(item, field)) {
          errors.push(`tracked inventory ${collection} #${item.issueNumber} must not declare ${field}; live GitHub Issue metadata is sole lifecycle/team/priority authority`);
        }
      }
    }
  }
  for (const item of inventory?.excluded || []) {
    const view = rowByNumber.get(item.issueNumber);
    if (view) errors.push(`excluded issue #${item.issueNumber} must not appear in dashboard output (found in ${view})`);
  }
}

for (const file of ['index.html', 'assets/pmo-dashboard.css', 'assets/pmo-dashboard.js']) {
  try {
    await readFile(path.join(outDir, file), 'utf8');
  } catch {
    errors.push(`generated ${file} is missing`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`PMO dashboard validation passed for ${outDir}`);
