#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeQueueLabels,
  isPeerEngineeringPreparation,
  isStandaloneOperationsIssue
} from './queue-label-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OWNER = process.env.GITHUB_REPOSITORY_OWNER || 'wdhunter465';
const REPO = (process.env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template').split('/')[1];
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const OUT_DIR = process.env.PMO_DASHBOARD_OUT_DIR || 'site/pmo-dashboard';
const API = process.env.GITHUB_API_URL || 'https://api.github.com';

const TITLE_PREFIXES = [
  { pattern: /^PROGRAM CANDIDATE:\s*/i, type: 'program-candidate' },
  { pattern: /^STRATEGY REVIEW:\s*/i, type: 'strategy-review' },
  { pattern: /^STRATEGY:\s*/i, type: 'strategy' },
  { pattern: /^PROGRAM:\s*/i, type: 'program' },
  { pattern: /^PROJECT:\s*/i, type: 'project' }
];
const CHILD_PROJECT_PATTERN = /^PROJECT:\s*(\d+):(\d+)\s*\|\s*(.+)$/i;
const LIFECYCLE_LABELS = new Set(['pmo:pipeline', 'pmo:active', 'pmo:closed']);
const LIFECYCLE_FROM_LABEL = {
  'pmo:pipeline': 'pipeline',
  'pmo:active': 'active',
  'pmo:closed': 'closed'
};
const STAGE_ORDER = [
  'pmo:stage:initial-idea',
  'pmo:stage:drafted-design',
  'pmo:stage:pending-launch-packet',
  'pmo:stage:graduation-candidate'
];
const STAGE_DISPLAY = {
  'pmo:stage:initial-idea': 'Initial Idea',
  'pmo:stage:drafted-design': 'Drafted Design',
  'pmo:stage:pending-launch-packet': 'Pending Launch Packet',
  'pmo:stage:graduation-candidate': 'Graduation Candidate'
};
const PARENT_REF_PATTERN = /^\s*(?:[-*]\s*)?(?:Parent(?:\s+(?:program|project|issue))?)\s*:\s*#?(\d+)\b/im;

/** Canonical agent:* label → display name for dashboard reporting. */
const AGENT_DISPLAY = {
  claude: 'Claude',
  cursor: 'Cursor',
  grok: 'Grok',
  jules: 'Jules',
  chatgpt: 'ChatGPT',
  chat: 'ChatGPT',
  work: 'Work',
  codex: 'Codex',
  copilot: 'Copilot',
  cloudflareai: 'Cloudflare AI'
};

async function github(pathname) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'pmo-dashboard-generator' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${pathname}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${pathname}: ${await res.text()}`);
  return { data: await res.json(), headers: res.headers };
}

function nextLinkPath(linkHeader) {
  const match = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
  if (!match) return null;
  const next = new URL(match[1]);
  return `${next.pathname}${next.search}`;
}

async function fetchIssuesForState(issueState) {
  const all = [];
  let pathname = `/repos/${OWNER}/${REPO}/issues?state=${issueState}&per_page=100`;
  for (;;) {
    const { data: batch, headers } = await github(pathname);
    all.push(...batch.filter((issue) => !issue.pull_request));
    const nextPath = nextLinkPath(headers.get('link'));
    if (!nextPath) break;
    pathname = nextPath;
  }
  return all;
}

async function fetchIssues(state) {
  if (process.env.PMO_DASHBOARD_ISSUES_FIXTURE) {
    const fixture = JSON.parse(await readFile(process.env.PMO_DASHBOARD_ISSUES_FIXTURE, 'utf8'));
    return fixture.filter((issue) => !issue.pull_request && (state === 'all' || issue.state === state));
  }
  if (state === 'all') {
    return [...await fetchIssuesForState('open'), ...await fetchIssuesForState('closed')];
  }
  return fetchIssuesForState(state);
}

function field(body, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = (body || '').match(new RegExp(`^\\s*${escaped}\\s*:\\s*(.+?)\\s*$`, 'im'));
  return match ? match[1].trim() : null;
}

function labels(issue) {
  return (issue.labels || []).map((label) => (typeof label === 'string' ? label : label.name));
}

function isPmoTracked(issue) {
  return labels(issue).some((label) => label.toLowerCase() === 'pmo');
}

function hasTaskLabel(issue) {
  return labels(issue).some((label) => label.toLowerCase() === 'pmo:task');
}

function titleType(title) {
  if (!title) return null;
  for (const { pattern, type } of TITLE_PREFIXES) {
    if (pattern.test(title)) return type;
  }
  return null;
}

function parseChildProject(title) {
  const match = title?.match(CHILD_PROJECT_PATTERN);
  if (!match) return null;
  return {
    parentProgramIssue: Number(match[1]),
    sequence: Number(match[2]),
    displayTitle: decodeBasicHtmlEntities(match[3].trim())
  };
}

function decodeBasicHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanName(title) {
  for (const { pattern } of TITLE_PREFIXES) {
    if (pattern.test(title)) return decodeBasicHtmlEntities(title.replace(pattern, '').trim());
  }
  return decodeBasicHtmlEntities((title || '').trim());
}

function displayName(issue) {
  return parseChildProject(issue.title)?.displayTitle || cleanName(issue.title);
}

function parseParentReference(issue) {
  const match = (issue.body || '').match(PARENT_REF_PATTERN);
  if (match) return Number(match[1]);
  return parseChildProject(issue.title)?.parentProgramIssue || null;
}

/**
 * Canonical current agent ownership from live machine-readable labels.
 * - exactly one agent:* → normalized display name
 * - zero agent:* → Unassigned (body Owner / Agent and legacy owner:* must not invent ownership)
 * - more than one agent:* → data-quality condition string (do not silently choose)
 * Stale Issue-body "Owner / Agent:" never overrides agent:* labels.
 */
function normalizeAgentDisplay(agentKey) {
  const key = String(agentKey || '').trim().toLowerCase();
  if (!key) return null;
  if (AGENT_DISPLAY[key]) return AGENT_DISPLAY[key];
  // Preserve unknown agent ids with light capitalization of first segment.
  return key.replace(/(^|[-_])([a-z])/g, (_, sep, ch) => (sep ? ` ${ch.toUpperCase()}` : ch.toUpperCase()));
}

function owner(issue) {
  const issueLabels = labels(issue);
  const agentLabels = issueLabels.filter((label) => /^agent:/i.test(label));
  if (agentLabels.length === 1) {
    const key = agentLabels[0].replace(/^agent:/i, '');
    return normalizeAgentDisplay(key) || key;
  }
  if (agentLabels.length > 1) {
    return `Conflicting agent ownership: ${agentLabels.join(', ')}`;
  }
  // No agent:* label: report Unassigned. Do not let stale body text or legacy
  // owner:* / assignees invent current ownership over the empty claim state.
  // (Legacy owner:* remains available only as secondary signal when product
  // later re-enables fallback; issue #3615 requires agent:* as sole canonical.)
  void field(issue.body, 'Owner / Agent');
  void issueLabels.find((label) => label.startsWith('owner:'));
  void issue.assignees;
  return 'Unassigned';
}

function isPlaceholderDescription(value) {
  if (!value) return true;
  const trimmed = value.trim();
  return /^<[^>]+>$/.test(trimmed) || /^tbd$/i.test(trimmed);
}

function description(issue) {
  for (const name of ['Program Description', 'Project Description']) {
    const value = field(issue.body, name);
    if (value && !isPlaceholderDescription(value)) return value;
  }
  const purpose = field(issue.body, 'Purpose');
  if (purpose && !isPlaceholderDescription(purpose)) return purpose;
  const line = (issue.body || '').split('\n').find((entry) => entry.trim() && !entry.trim().startsWith('#'));
  return line?.trim() && !isPlaceholderDescription(line.trim()) ? line.trim() : '';
}

async function loadExcludedIssueNumbers() {
  try {
    const inventory = JSON.parse(await readFile(path.join(__dirname, 'pmo-tracked-inventory.json'), 'utf8'));
    return new Set((inventory.excluded || []).map((item) => item.issueNumber));
  } catch {
    return new Set();
  }
}

function analyzeLifecycle(issue) {
  const issueLabels = labels(issue);
  const lifecycleLabels = issueLabels.filter((label) => LIFECYCLE_LABELS.has(label));
  const errors = [];
  const remediation = [];
  if (lifecycleLabels.length === 0) {
    errors.push('missing lifecycle label');
    remediation.push('Add exactly one of pmo:pipeline, pmo:active, or pmo:closed');
  } else if (lifecycleLabels.length > 1) {
    errors.push(`conflicting lifecycle labels: ${lifecycleLabels.join(', ')}`);
    remediation.push('Keep exactly one lifecycle label');
  }
  const lifecycle = lifecycleLabels.length === 1 ? LIFECYCLE_FROM_LABEL[lifecycleLabels[0]] : null;
  if (issue.state === 'closed' && lifecycle !== 'closed') {
    errors.push('closed GitHub issue is not reconciled to pmo:closed');
    remediation.push('Add pmo:closed and remove other lifecycle labels');
  }
  if (issue.state === 'open' && lifecycle === 'closed') {
    errors.push('open GitHub issue carries pmo:closed');
    remediation.push('Close the GitHub issue or replace pmo:closed with pmo:pipeline or pmo:active');
  }
  return { lifecycle, errors, remediation };
}

function analyzeStage(issue, lifecycle, queueRole) {
  const stageLabels = labels(issue).filter((label) => label.startsWith('pmo:stage:'));
  const errors = [];
  const remediation = [];
  if (queueRole === 'task') {
    if (stageLabels.length) {
      errors.push(`project child carries Pipeline stage label(s): ${stageLabels.join(', ')}`);
      remediation.push('Remove Pipeline stage labels from project children');
    }
    return { pipelineStageLabel: null, pipelineStageDisplay: null, stageOrder: null, errors, remediation };
  }
  if (lifecycle !== 'pipeline') {
    if (stageLabels.length) {
      errors.push(`non-Pipeline issue carries stage label(s): ${stageLabels.join(', ')}`);
      remediation.push('Remove Pipeline stage labels outside the Pipeline lifecycle');
    }
    return { pipelineStageLabel: null, pipelineStageDisplay: null, stageOrder: null, errors, remediation };
  }
  const accepted = stageLabels.filter((label) => STAGE_DISPLAY[label]);
  if (stageLabels.length === 0) {
    errors.push('missing pipeline-stage label');
    remediation.push(`Add exactly one stage label: ${STAGE_ORDER.join(', ')}`);
  } else if (accepted.length !== 1 || stageLabels.length !== 1) {
    errors.push(`invalid pipeline-stage label(s): ${stageLabels.join(', ')}`);
    remediation.push('Keep exactly one supported pmo:stage:* label');
  }
  const pipelineStageLabel = accepted.length === 1 && stageLabels.length === 1 ? accepted[0] : null;
  return {
    pipelineStageLabel,
    pipelineStageDisplay: pipelineStageLabel ? STAGE_DISPLAY[pipelineStageLabel] : null,
    stageOrder: pipelineStageLabel ? STAGE_ORDER.indexOf(pipelineStageLabel) : null,
    errors,
    remediation
  };
}

function classifyTrackedIssue(issue, byNumber) {
  const errors = [];
  const remediation = [];
  const issueLabels = labels(issue);
  const type = titleType(issue.title);
  const explicitTask = hasTaskLabel(issue);
  const childMeta = parseChildProject(issue.title);
  const parentIssueNumber = parseParentReference(issue);
  let role = explicitTask ? 'task' : 'portfolio';

  if (!issue.number) {
    errors.push('missing issue identity');
    remediation.push('Ensure the GitHub issue number is present in generated output');
  }
  if (!issue.html_url) {
    errors.push('missing issue URL');
    remediation.push('Ensure the GitHub issue URL is present in generated output');
  }

  if (explicitTask) {
    if (!parentIssueNumber) {
      errors.push('task is missing a valid parent reference');
      remediation.push('Add a Parent / Parent program / Parent project body field referencing #<parentIssue>');
    } else {
      const parent = byNumber.get(parentIssueNumber);
      if (!parent || !isPmoTracked(parent)) {
        errors.push(`task parent #${parentIssueNumber} is missing or not PMO-tracked`);
        remediation.push('Point the task parent reference at a PMO-tracked program/project issue');
      } else if (hasTaskLabel(parent)) {
        errors.push(`task parent #${parentIssueNumber} is itself a pmo:task`);
        remediation.push('Point the task parent reference at a portfolio program/project issue');
      }
    }
  } else if (!type) {
    role = 'unsupported';
    errors.push('unsupported or contradictory PMO classification');
    remediation.push('Use a supported portfolio title prefix, or mark genuine tasks with pmo:task and a valid parent');
  }

  const life = analyzeLifecycle(issue);
  errors.push(...life.errors);
  remediation.push(...life.remediation);

  const queueRole = explicitTask || childMeta ? 'task' : role;
  const queue = analyzeQueueLabels({ labels: issueLabels, lifecycle: life.lifecycle, role: queueRole });
  errors.push(...queue.errors);
  remediation.push(...queue.remediation);

  const stage = analyzeStage(issue, life.lifecycle, queueRole);
  errors.push(...stage.errors);
  remediation.push(...stage.remediation);

  const incomplete = errors.length > 0;
  return {
    role,
    type,
    childMeta,
    parentIssueNumber,
    lifecycle: incomplete ? 'incomplete' : life.lifecycle,
    rawLifecycle: life.lifecycle,
    teamLabel: queue.teamLabel,
    priorityLabel: queue.priorityLabel,
    priorityDisplay: queue.priorityDisplay,
    pipelineStageLabel: stage.pipelineStageLabel,
    pipelineStageDisplay: stage.pipelineStageDisplay,
    stageOrder: stage.stageOrder,
    dataQualityErrors: [...new Set(errors)],
    requiredRemediation: [...new Set(remediation)],
    incomplete,
    labels: issueLabels
  };
}

function statusForRow(classification) {
  if (classification.incomplete) return 'Incomplete';
  if (classification.lifecycle === 'active') return 'Active';
  if (classification.lifecycle === 'closed') return 'Completed';
  if (classification.lifecycle === 'pipeline') return classification.pipelineStageDisplay || 'Pipeline';
  return 'Incomplete';
}

function buildTaskIndex(classifications) {
  const tasksByParent = new Map();
  for (const entry of classifications.values()) {
    if (entry.role !== 'task' || entry.incomplete) continue;
    const parent = entry.parentIssueNumber;
    if (!tasksByParent.has(parent)) tasksByParent.set(parent, []);
    tasksByParent.get(parent).push(entry);
  }
  for (const tasks of tasksByParent.values()) tasks.sort((a, b) => a.issue.number - b.issue.number);
  return tasksByParent;
}

function taskAccountingFor(parentNumber, tasksByParent) {
  const tasks = tasksByParent.get(parentNumber) || [];
  const declaredTaskIssueNumbers = tasks.map((task) => task.issue.number);
  const completedTaskIssueNumbers = tasks
    .filter((task) => task.rawLifecycle === 'closed')
    .map((task) => task.issue.number);
  return {
    parentIssueNumber: parentNumber,
    declaredTaskIssueNumbers,
    missingTaskIssueNumbers: [],
    completedTaskIssueNumbers,
    taskCount: declaredTaskIssueNumbers.length,
    tasksCompleted: completedTaskIssueNumbers.length
  };
}

function buildRow(entry, tasksByParent) {
  const { issue, classification } = entry;
  const accounting = taskAccountingFor(issue.number, tasksByParent);
  const percentComplete = accounting.taskCount > 0
    ? Math.round((accounting.tasksCompleted / accounting.taskCount) * 100)
    : null;
  return {
    type: classification.type,
    name: displayName(issue),
    title: displayName(issue),
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    labels: classification.labels,
    lifecycle: classification.incomplete ? 'incomplete' : classification.lifecycle,
    teamLabel: classification.teamLabel,
    priorityLabel: classification.priorityLabel,
    priorityDisplay: classification.incomplete
      ? (classification.priorityDisplay || 'Remediation required')
      : classification.priorityDisplay,
    priority: classification.incomplete
      ? (classification.priorityDisplay || 'Remediation required')
      : classification.priorityDisplay,
    pipelineStageLabel: classification.pipelineStageLabel,
    pipelineStageDisplay: classification.pipelineStageDisplay,
    status: statusForRow(classification),
    percentComplete,
    taskCount: accounting.taskCount,
    tasksCompleted: accounting.tasksCompleted,
    ownerAgent: owner(issue),
    description: description(issue),
    anticipatedCompletionDate: field(issue.body, 'Anticipated Completion Date') || null,
    closedAt: issue.closed_at || null,
    updatedAt: issue.updated_at || null,
    parentProgramIssue: classification.childMeta?.parentProgramIssue ?? classification.parentIssueNumber ?? null,
    childSequence: classification.childMeta?.sequence ?? null,
    dataQualityErrors: classification.incomplete ? classification.dataQualityErrors : [],
    requiredRemediation: classification.incomplete ? classification.requiredRemediation : [],
    role: classification.role
  };
}

function prioritySortValue(row) {
  const parsed = Number(row.priorityDisplay);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function updatedSortValue(row) {
  return row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
}

function activeSort(a, b) {
  return prioritySortValue(a) - prioritySortValue(b)
    || updatedSortValue(b) - updatedSortValue(a)
    || a.name.localeCompare(b.name);
}

function pipelineSort(a, b) {
  return prioritySortValue(a) - prioritySortValue(b)
    || (a.pipelineStageLabel ? STAGE_ORDER.indexOf(a.pipelineStageLabel) : 99)
      - (b.pipelineStageLabel ? STAGE_ORDER.indexOf(b.pipelineStageLabel) : 99)
    || updatedSortValue(b) - updatedSortValue(a)
    || a.name.localeCompare(b.name);
}

function completedSort(a, b) {
  const aTime = a.closedAt ? new Date(a.closedAt).getTime() : updatedSortValue(a);
  const bTime = b.closedAt ? new Date(b.closedAt).getTime() : updatedSortValue(b);
  return bTime - aTime || a.name.localeCompare(b.name);
}

function incompleteSort(a, b) {
  return (b.dataQualityErrors?.length || 0) - (a.dataQualityErrors?.length || 0)
    || updatedSortValue(b) - updatedSortValue(a)
    || a.name.localeCompare(b.name);
}

function assembleViews(entries) {
  const activeParentNumbers = new Set(
    entries
      .filter((entry) => !entry.row.dataQualityErrors?.length && entry.row.lifecycle === 'active' && entry.row.type === 'program')
      .map((entry) => entry.row.issueNumber)
  );
  const completedParentNumbers = new Set(
    entries
      .filter((entry) => !entry.row.dataQualityErrors?.length && entry.row.lifecycle === 'closed' && entry.row.type === 'program')
      .map((entry) => entry.row.issueNumber)
  );
  const childrenByParent = new Map();
  for (const entry of entries) {
    if (!entry.classification.childMeta || entry.row.lifecycle === 'incomplete' || entry.classification.role !== 'portfolio') continue;
    const parent = entry.classification.childMeta.parentProgramIssue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(entry);
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.classification.childMeta.sequence - b.classification.childMeta.sequence);
  }
  function attachChildren(parentEntry) {
    const children = childrenByParent.get(parentEntry.row.issueNumber) || [];
    if (children.length) parentEntry.row.children = children.map((child) => child.row);
  }
  const views = { activePrograms: [], pmoPipeline: [], completedPrograms: [], incomplete: [] };
  for (const entry of entries) {
    if (entry.classification.role === 'task' && !entry.classification.incomplete) continue;
    if (entry.row.lifecycle === 'incomplete' || entry.classification.incomplete) {
      views.incomplete.push(entry.row);
      continue;
    }
    const parent = entry.classification.childMeta?.parentProgramIssue;
    if (entry.row.lifecycle === 'active') {
      if (parent && activeParentNumbers.has(parent)) continue;
      if (entry.row.type === 'program') attachChildren(entry);
      views.activePrograms.push(entry.row);
    } else if (entry.row.lifecycle === 'pipeline') {
      if (parent && activeParentNumbers.has(parent)) continue;
      views.pmoPipeline.push(entry.row);
    } else if (entry.row.lifecycle === 'closed') {
      if (parent && (activeParentNumbers.has(parent) || completedParentNumbers.has(parent))) continue;
      if (entry.row.type === 'program') attachChildren(entry);
      views.completedPrograms.push(entry.row);
    }
  }
  views.activePrograms.sort(activeSort);
  views.pmoPipeline.sort(pipelineSort);
  views.completedPrograms.sort(completedSort);
  views.incomplete.sort(incompleteSort);
  return views;
}

async function main() {
  const excluded = await loadExcludedIssueNumbers();
  const issues = await fetchIssues('all');
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const classificationEntries = [];
  for (const issue of issues) {
    if (!isPmoTracked(issue) || excluded.has(issue.number)) continue;
    if (isStandaloneOperationsIssue(issue) || isPeerEngineeringPreparation(issue)) continue;
    classificationEntries.push({ issue, classification: classifyTrackedIssue(issue, byNumber) });
  }
  const classificationByNumber = new Map(
    classificationEntries.map((entry) => [entry.issue.number, { ...entry.classification, issue: entry.issue }])
  );
  const tasksByParent = buildTaskIndex(classificationByNumber);
  const built = [];
  const taskAccounting = [];
  for (const entry of classificationEntries) {
    const row = buildRow(entry, tasksByParent);
    built.push({ issue: entry.issue, classification: entry.classification, row });
    if (entry.classification.role === 'portfolio' || entry.classification.incomplete) {
      taskAccounting.push(taskAccountingFor(entry.issue.number, tasksByParent));
    }
  }
  for (const parentNumber of tasksByParent.keys()) {
    if (!taskAccounting.some((entry) => entry.parentIssueNumber === parentNumber)) {
      taskAccounting.push(taskAccountingFor(parentNumber, tasksByParent));
    }
  }
  const views = assembleViews(built);
  taskAccounting.sort((a, b) => a.parentIssueNumber - b.parentIssueNumber);
  const topLevelCount = Object.values(views).reduce((sum, view) => sum + view.length, 0);
  const nestedCount = Object.values(views).reduce(
    (sum, view) => sum + view.reduce((count, row) => count + (row.children?.length || 0), 0),
    0
  );
  const data = {
    generatedAt: new Date().toISOString(),
    source: 'github-issues',
    repository: `${OWNER}/${REPO}`,
    trackingModel: 'pmo-label',
    contractVersion: 'queue-label-registry-v1',
    views,
    taskAccounting
  };
  await mkdir(path.join(OUT_DIR, 'assets'), { recursive: true });
  await writeFile(path.join(OUT_DIR, 'dashboard-data.json'), `${JSON.stringify(data, null, 2)}\n`);
  await cp(path.join(__dirname, 'static/index.html'), path.join(OUT_DIR, 'index.html'));
  await cp(path.join(__dirname, 'static/pmo-dashboard.css'), path.join(OUT_DIR, 'assets/pmo-dashboard.css'));
  await cp(path.join(__dirname, 'static/pmo-dashboard.js'), path.join(OUT_DIR, 'assets/pmo-dashboard.js'));
  console.log(`Generated PMO dashboard with ${topLevelCount} top-level rows and ${nestedCount} nested child rows at ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
