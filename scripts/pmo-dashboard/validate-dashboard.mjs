#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAM_QUEUE_ORDER, PMO_QUEUE_ORDER } from './team-queue-counts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || process.env.PMO_DASHBOARD_OUT_DIR || 'site/pmo-dashboard';
const requiredViews = ['activePrograms', 'pmoPipeline', 'completedPrograms', 'incomplete'];
const currentBookViews = ['activePrograms', 'pmoPipeline'];
const validRowLifecycles = new Set(['active', 'pipeline', 'closed']);
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
    'Graduation Candidate',
    'Pipeline'
  ]),
  completedPrograms: new Set(['Completed']),
  incomplete: new Set()
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
  if (row.dataQualityErrors?.length) return;
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
  }
}

function validateRow(row, label, rowByNumber, rowDataByNumber) {
  if (!row.name && !row.title) errors.push(`${label} is missing title/name`);
  if (!Number.isInteger(row.issueNumber) || row.issueNumber <= 0) errors.push(`${label} is missing a valid issueNumber`);
  if (!validUrl(row.issueUrl)) errors.push(`${label} contains an obviously invalid issue link`);
  if (!Array.isArray(row.labels)) errors.push(`${label} labels must be an array`);
  if (!validRowLifecycles.has(row.lifecycle)) errors.push(`${label} lifecycle must be active|pipeline|closed, got ${JSON.stringify(row.lifecycle)}`);
  if (row.lifecycle === 'incomplete') errors.push(`${label} must not manufacture lifecycle incomplete`);
  if (!row.status) errors.push(`${label} is missing Status`);
  validateViewStatus(row, label);
  if (!Array.isArray(row.dataQualityErrors)) errors.push(`${label} dataQualityErrors must be an array`);
  if (!Array.isArray(row.requiredRemediation)) errors.push(`${label} requiredRemediation must be an array`);
  if (row.linkedTaskDataQuality != null && !Array.isArray(row.linkedTaskDataQuality)) {
    errors.push(`${label} linkedTaskDataQuality must be an array when present`);
  }

  const view = topLevelViewFromLabel(label);
  if (view === 'incomplete' || view === 'completedPrograms') {
    errors.push(`${label} must not appear in retired view ${view}`);
  }
  if (row.lifecycle === 'pipeline' && !isChildLabel(label)) {
    if (!row.pipelineStageLabel || !stageLabels.has(row.pipelineStageLabel)) {
      errors.push(`${label} Pipeline rows require a canonical pipeline stage label`);
    }
  }
  if (row.lifecycle === 'active' && row.pipelineStageLabel) {
    errors.push(`${label} Active rows must not carry pipelineStageLabel`);
  }
  validateQueueFields(row, label, view);

  if (Number.isInteger(row.issueNumber) && row.issueNumber > 0) {
    if (rowByNumber.has(row.issueNumber)) {
      errors.push(`issue #${row.issueNumber} appears more than once in current-book views`);
    }
    rowByNumber.set(row.issueNumber, label);
    rowDataByNumber.set(row.issueNumber, row);
  }
}

function validateQueueRow(errors, order, queues, expectedOrder, { orderPath, queuesPath }) {
  if (!Array.isArray(order)) {
    errors.push(`${orderPath} must be an array`);
    return;
  }
  if (!Array.isArray(queues)) {
    errors.push(`${queuesPath} must be an array`);
    return;
  }
  if (order.join(',') !== expectedOrder.map((q) => q.id).join(',')) {
    errors.push(`${orderPath} must match ${expectedOrder.map((q) => q.id).join(',')}`);
  }
  if (queues.length !== expectedOrder.length) {
    errors.push(`${queuesPath} length must equal ${expectedOrder.length}`);
  }
  queues.forEach((queue, index) => {
    const label = `${queuesPath}[${index}]`;
    const expected = expectedOrder[index];
    if (!queue || typeof queue !== 'object') {
      errors.push(`${label} must be an object`);
      return;
    }
    if (expected && queue.id !== expected.id) errors.push(`${label} id must be ${expected.id}`);
    if (expected && queue.title !== expected.title) errors.push(`${label} title must be ${expected.title}`);
    if (!Number.isInteger(queue.count) || queue.count < 0) errors.push(`${label} count must be a non-negative integer`);
    try {
      const url = new URL(queue.issueSearchUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
        errors.push(`${label} issueSearchUrl must be an https GitHub issues search`);
      }
    } catch {
      errors.push(`${label} issueSearchUrl must be a valid URL`);
    }
  });
}

function validateExceptionRow(row, label, rowByNumber) {
  if (!row.name && !row.title) errors.push(`${label} is missing title/name`);
  if (!Number.isInteger(row.issueNumber) || row.issueNumber <= 0) errors.push(`${label} is missing a valid issueNumber`);
  if (!validUrl(row.issueUrl)) errors.push(`${label} contains an obviously invalid issue link`);
  if (!Array.isArray(row.labels)) errors.push(`${label} labels must be an array`);
  if (!row.status) errors.push(`${label} is missing Status`);
  if (!Array.isArray(row.dataQualityErrors) || !row.dataQualityErrors.length) {
    errors.push(`${label} must include dataQualityErrors`);
  }
  if (!Array.isArray(row.requiredRemediation) || !row.requiredRemediation.length) {
    errors.push(`${label} must include requiredRemediation`);
  }
  if (row.lifecycle === 'incomplete') errors.push(`${label} must not manufacture lifecycle incomplete`);
  if (row.issueNumber && rowByNumber.has(row.issueNumber)) {
    errors.push(`issue #${row.issueNumber} cannot appear in both the current book and dataQualityExceptions`);
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
  }
  if ((data.views?.completedPrograms || []).length) {
    errors.push('views.completedPrograms must be empty; Completed Programs is not part of current-book presentation');
  }
  if ((data.views?.incomplete || []).length) {
    errors.push('views.incomplete must be empty; Incomplete is not a PMO lifecycle');
  }
  if (!Array.isArray(data.dataQualityExceptions)) {
    errors.push('dataQualityExceptions must be present and must be an array');
  }
  if (!data.teamQueues || typeof data.teamQueues !== 'object') {
    errors.push('teamQueues summary must be present');
  } else {
    validateQueueRow(errors, data.teamQueues.order, data.teamQueues.queues, TEAM_QUEUE_ORDER, {
      orderPath: 'teamQueues.order',
      queuesPath: 'teamQueues.queues'
    });
    validateQueueRow(errors, data.teamQueues.pmoOrder, data.teamQueues.pmoQueues, PMO_QUEUE_ORDER, {
      orderPath: 'teamQueues.pmoOrder',
      queuesPath: 'teamQueues.pmoQueues'
    });
    if (Array.isArray(data.teamQueues.pmoQueues) && data.teamQueues.pmoQueues.length === PMO_QUEUE_ORDER.length) {
      const tracked = data.teamQueues.pmoQueues[0];
      const pipeline = data.teamQueues.pmoQueues[1];
      const active = data.teamQueues.pmoQueues[2];
      if (
        tracked && pipeline && active &&
        Number.isInteger(tracked.count) && Number.isInteger(pipeline.count) && Number.isInteger(active.count) &&
        tracked.count !== pipeline.count + active.count
      ) {
        errors.push('teamQueues.pmoQueues tracked count must equal Pipeline plus Active');
      }
    }
    if (!Number.isInteger(data.teamQueues.totalOpenIssues) || data.teamQueues.totalOpenIssues < 0) {
      errors.push('teamQueues.totalOpenIssues must be a non-negative integer');
    }
    const taskQ = data.teamQueues.pmoTaskQueue;
    if (!taskQ || typeof taskQ !== 'object') {
      errors.push('teamQueues.pmoTaskQueue must be present');
    } else {
      if (taskQ.id !== 'pmoTasks') errors.push('teamQueues.pmoTaskQueue.id must be pmoTasks');
      if (!Number.isInteger(taskQ.count) || taskQ.count < 0) errors.push('teamQueues.pmoTaskQueue.count must be a non-negative integer');
      try {
        const url = new URL(taskQ.issueSearchUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
          errors.push('teamQueues.pmoTaskQueue.issueSearchUrl must be an https GitHub issues search');
        }
      } catch {
        errors.push('teamQueues.pmoTaskQueue.issueSearchUrl must be a valid URL');
      }
    }
    const otherQ = data.teamQueues.otherQueue;
    if (!otherQ || typeof otherQ !== 'object') {
      errors.push('teamQueues.otherQueue must be present');
    } else if (!Number.isInteger(otherQ.count) || otherQ.count < 0) {
      errors.push('teamQueues.otherQueue.count must be a non-negative integer');
    }
    const br = data.teamQueues.breakout;
    if (!br || typeof br !== 'object') {
      errors.push('teamQueues.breakout must be present');
    } else {
      const keys = ['operations', 'engineering', 'governance', 'pmoParents', 'pmoTasks', 'other', 'totalOpenIssues'];
      for (const key of keys) {
        if (!Number.isInteger(br[key]) || br[key] < 0) {
          errors.push(`teamQueues.breakout.${key} must be a non-negative integer`);
        }
      }
      if (
        Number.isInteger(br.operations) && Number.isInteger(br.engineering) && Number.isInteger(br.governance) &&
        Number.isInteger(br.pmoParents) && Number.isInteger(br.pmoTasks) && Number.isInteger(br.other) &&
        Number.isInteger(br.totalOpenIssues)
      ) {
        const sum = br.operations + br.engineering + br.governance + br.pmoParents + br.pmoTasks + br.other;
        if (sum !== br.totalOpenIssues) {
          errors.push(`teamQueues.breakout categories (${sum}) must equal totalOpenIssues (${br.totalOpenIssues})`);
        }
        if (br.totalOpenIssues !== data.teamQueues.totalOpenIssues) {
          errors.push('teamQueues.breakout.totalOpenIssues must equal teamQueues.totalOpenIssues');
        }
      }
      if (taskQ && Number.isInteger(taskQ.count) && Number.isInteger(br.pmoTasks) && taskQ.count !== br.pmoTasks) {
        errors.push('teamQueues.pmoTaskQueue.count must equal breakout.pmoTasks');
      }
    }
  }
  if (!data.currentBook || typeof data.currentBook !== 'object') {
    errors.push('currentBook summary must be present');
  } else {
    const activeCount = (data.views?.activePrograms || []).length;
    const pipelineCount = (data.views?.pmoPipeline || []).length;
    if (data.currentBook.activeCount !== activeCount) {
      errors.push(`currentBook.activeCount (${data.currentBook.activeCount}) must equal activePrograms length (${activeCount})`);
    }
    if (data.currentBook.pipelineCount !== pipelineCount) {
      errors.push(`currentBook.pipelineCount (${data.currentBook.pipelineCount}) must equal pmoPipeline length (${pipelineCount})`);
    }
    if (data.currentBook.parentStandaloneCount !== activeCount + pipelineCount) {
      errors.push('currentBook.parentStandaloneCount must equal activeCount + pipelineCount');
    }
  }
  for (const view of currentBookViews) {
    for (const [index, row] of (data.views?.[view] || []).entries()) validateRow(row, `${view}[${index}]`, rowByNumber, rowDataByNumber);
  }
  for (const [index, row] of (data.dataQualityExceptions || []).entries()) {
    validateExceptionRow(row, `dataQualityExceptions[${index}]`, rowByNumber);
  }
}

if (inventory && Array.isArray(inventory.issues)) {
  for (const [index, item] of inventory.issues.entries()) {
    for (const field of FORBIDDEN_INVENTORY_LIVE_STATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(item, field)) {
        errors.push(`inventory.issues[${index}] must not prescribe live state field ${field}`);
      }
    }
  }
}

if (errors.length) {
  console.error('PMO dashboard validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('PMO dashboard validation passed');
