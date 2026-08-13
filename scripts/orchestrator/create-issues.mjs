#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = process.env.GITHUB_REPOSITORY;
const dryRun = process.env.DRY_RUN === 'true';
const planDir = 'docs/ops/implementation-plans';
const routingPath = '.github/orchestrator-routing.json';
const labelsPath = '.github/orchestrator-labels.json';

if (!repo) {
  console.error('GITHUB_REPOSITORY is required.');
  process.exit(1);
}

const routing = JSON.parse(fs.readFileSync(routingPath, 'utf8'));

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

export function missingRequiredLabels(existingLabels, requiredLabels) {
  const existing = new Set(existingLabels);
  return requiredLabels.filter((label) => !existing.has(label));
}

function labelDefinition(label) {
  if (label.startsWith('status:')) {
    return {
      color: 'FBCA04',
      description: 'LGFC orchestrator issue state'
    };
  }

  if (label.startsWith('type:')) {
    return {
      color: '0E8A16',
      description: 'LGFC orchestrator task type'
    };
  }

  if (label.startsWith('agent:')) {
    return {
      color: '5319E7',
      description: 'LGFC orchestrator assigned agent'
    };
  }

  return {
    color: '0E8A16',
    description: 'LGFC orchestration label'
  };
}

function ensureLabels() {
  const labelsConfig = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const existingOutput = runGh([
    'label',
    'list',
    '--repo',
    repo,
    '--json',
    'name',
    '--limit',
    '1000'
  ]);
  const existing = JSON.parse(existingOutput).map((label) => label.name);

  for (const label of missingRequiredLabels(existing, labelsConfig.labels || [])) {
    const definition = labelDefinition(label);
    if (dryRun) {
      console.log(`DRY RUN ensure label ${label}`);
      continue;
    }

    runGh([
      'label',
      'create',
      label,
      '--repo',
      repo,
      '--color',
      definition.color,
      '--description',
      definition.description
    ]);
  }
}

function isProductionReady(content) {
  return /Status:\s*production-ready/i.test(content);
}

function projectSlug(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function parseTasks(content) {
  const matches = [...content.matchAll(/^## Task (\d{3}) — (.+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    const block = content.slice(start, end).trim();
    const type = block.match(/^Type:\s*(.+)$/m)?.[1]?.trim();
    const agent = block.match(/^Agent:\s*(.+)$/m)?.[1]?.trim();
    const status = block.match(/^Status:\s*(.+)$/m)?.[1]?.trim();
    return {
      id: `Task-${match[1]}`,
      number: match[1],
      title: match[2].trim(),
      type,
      agent,
      status,
      block
    };
  });
}

export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isDuplicateOrSupersededIssueBody(body) {
  return (
    /\bDuplicate of (?:Issue )?#\d+\b/i.test(body || '') ||
    /\bclosed as duplicate\b/i.test(body || '') ||
    /\bsuperseded by (?:Issue )?#\d+\b/i.test(body || '')
  );
}

function issueExists(marker) {
  const query = `repo:${repo} is:issue ${marker}`;
  const result = runGh([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--search',
    query,
    '--json',
    'number',
    '--limit',
    '1'
  ]);
  return JSON.parse(result).length > 0;
}

export function findExistingIssueByTitle(repoArg, title) {
  const normalized = normalizeTitle(title);
  const result = runGh([
    'issue',
    'list',
    '--repo',
    repoArg,
    '--state',
    'all',
    '--search',
    title,
    '--json',
    'number,title,state,body,labels',
    '--limit',
    '10'
  ]);
  const issues = JSON.parse(result);
  for (const issue of issues) {
    if (normalizeTitle(issue.title) === normalized) {
      return issue;
    }
  }
  return null;
}

export function issuePreflightResult(existingIssue) {
  if (!existingIssue) return { action: 'create' };
  if (existingIssue.state === 'OPEN') {
    return { action: 'reuse', number: existingIssue.number };
  }
  if (isDuplicateOrSupersededIssueBody(existingIssue.body)) {
    return { action: 'blocked-duplicate', number: existingIssue.number };
  }
  const closedCompletedLabels = ['status:complete', 'status:completed'];
  const labels = (existingIssue.labels || []).map((l) => l.name || l);
  const isComplete = labels.some((l) => closedCompletedLabels.includes(l));
  if (isComplete) {
    return { action: 'blocked-complete', number: existingIssue.number };
  }
  return { action: 'create' };
}

function openOrchestratorIssueExists() {
  const result = runGh([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--search',
    'label:orchestrator',
    '--json',
    'number',
    '--limit',
    '1'
  ]);
  return JSON.parse(result).length > 0;
}

export function statusLabelForCreatedTask(createdIssueCount, queueAlreadyOpen = false) {
  return !queueAlreadyOpen && createdIssueCount === 0 ? 'status:queued' : 'status:blocked';
}

export function agentForTask(task) {
  const route = routing.taskTypes[task.type];
  if (!route) {
    throw new Error(`Unknown task type: ${task.type}`);
  }

  const agent = task.agent || route.defaultAgent;
  if (!route.allowedAgents.includes(agent)) {
    throw new Error(`Agent ${agent} is not allowed for task type ${task.type}`);
  }

  return agent;
}

export function labelsForTask(task, statusLabel = 'status:queued') {
  const agent = agentForTask(task);

  return [
    'orchestrator',
    statusLabel,
    `type:${task.type}`,
    `agent:${agent}`
  ];
}

export function shouldCreateIssueForTask(task) {
  const terminalStatuses = new Set(['complete', 'completed', 'closed', 'issues-created']);
  return !terminalStatuses.has((task.status || '').toLowerCase());
}

export function main() {
  ensureLabels();

  const files = fs.existsSync(planDir)
    ? fs.readdirSync(planDir).filter((name) => name.endsWith('.md') && name !== 'README.md').sort()
    : [];

  const queueAlreadyOpen = openOrchestratorIssueExists();
  let createdIssueCount = 0;

  for (const file of files) {
    const filePath = path.join(planDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (!isProductionReady(content)) {
      continue;
    }

    const slug = projectSlug(filePath);
    const tasks = parseTasks(content);

    for (const task of tasks) {
      if (!shouldCreateIssueForTask(task)) {
        console.log(`SKIP ${task.id} with terminal status: ${task.status}`);
        continue;
      }

      const marker = `lgfc-task-id:${slug}:${task.id}`;
      if (issueExists(marker)) {
        console.log(`REUSED existing issue for ${marker}`);
        continue;
      }

      const fullTitle = `[${task.id}] ${task.title}`;
      const byTitle = findExistingIssueByTitle(repo, fullTitle);
      const preflight = issuePreflightResult(byTitle);

      if (preflight.action === 'reuse') {
        console.log(`REUSED existing open issue #${preflight.number} for ${marker}`);
        continue;
      }

      if (preflight.action === 'blocked-duplicate') {
        console.log(`BLOCKED issue for ${marker}: existing issue #${preflight.number} is duplicate/superseded`);
        continue;
      }

      if (preflight.action === 'blocked-complete') {
        console.log(`BLOCKED issue for ${marker}: existing issue #${preflight.number} is closed-complete`);
        continue;
      }

      const agent = agentForTask(task);
      const statusLabel = statusLabelForCreatedTask(createdIssueCount, queueAlreadyOpen);
      const labels = labelsForTask(task, statusLabel);
      const body = [
        `<!-- ${marker} -->`,
        '',
        `Implementation Plan: \`${filePath}\``,
        `Task: ${task.id}`,
        `Type: ${task.type}`,
        `Agent: ${agent}`,
        '',
        task.block
      ].join('\n');

      if (dryRun) {
        console.log(`DRY RUN create issue for ${marker}`);
        console.log(`DRY RUN title: ${fullTitle}`);
        console.log(`DRY RUN labels: ${labels.join(',')}`);
        createdIssueCount += 1;
        continue;
      }

      runGh([
        'issue',
        'create',
        '--repo',
        repo,
        '--title',
        fullTitle,
        '--body',
        body,
        '--label',
        labels.join(',')
      ]);

      createdIssueCount += 1;
      console.log(`CREATED issue for ${marker}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
