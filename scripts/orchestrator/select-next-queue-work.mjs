#!/usr/bin/env node
/**
 * Queue-aware next-work selector (#2726).
 * Read-only against GitHub by default.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { selectNextDispatch } from './queue-routing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
}

function ghJson(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8' });
  return JSON.parse(out || '[]');
}

function fetchOpenIssues(repo) {
  return ghJson([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,state,labels,body'
  ]);
}

export function buildCandidates(issues, parentsByNumber = new Map()) {
  return issues.map((issue) => {
    const labels = (issue.labels || []).map((label) => label.name || label);
    const parentMatch = String(issue.body || '').match(
      /^\s*Parent(?:\s+(?:program|project|issue))?\s*:\s*#?(\d+)\b/im
    );
    const parentNumber = parentMatch ? Number(parentMatch[1]) : null;
    const parent = parentNumber ? parentsByNumber.get(parentNumber) || null : null;
    return {
      issue: {
        number: issue.number,
        state: String(issue.state || '').toLowerCase() === 'open' ? 'open' : issue.state,
        title: issue.title,
        labels,
        body: issue.body || ''
      },
      context: {
        parent,
        implementationAuthorized: Boolean(parent),
        childSequenceReady: Boolean(parent),
        productionGo: false
      }
    };
  });
}

export function selectFromIssues(issues) {
  const byNumber = new Map(
    issues.map((issue) => [
      issue.number,
      {
        number: issue.number,
        state: String(issue.state || '').toLowerCase() === 'open' ? 'open' : issue.state,
        labels: (issue.labels || []).map((label) => label.name || label),
        body: issue.body || ''
      }
    ])
  );
  const candidates = buildCandidates(issues, byNumber);
  return selectNextDispatch(candidates);
}

export function main(argv = process.argv.slice(2), deps = {}) {
  const repo = deps.repo || process.env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template';
  const fixturePath = argv.find((arg) => arg.startsWith('--fixture='))?.slice('--fixture='.length);
  const routing = deps.routing || loadJson('.github/orchestrator-routing.json');

  if (!routing.queueAwareDispatch?.enabled) {
    console.log(JSON.stringify({ ok: false, reason: 'queue_aware_dispatch_disabled' }, null, 2));
    process.exitCode = 1;
    return;
  }

  let issues;
  if (fixturePath) {
    issues = JSON.parse(fs.readFileSync(path.resolve(fixturePath), 'utf8'));
  } else if (deps.issues) {
    issues = deps.issues;
  } else {
    issues = fetchOpenIssues(repo);
  }

  const result = selectFromIssues(issues);
  const payload = {
    ok: true,
    registry: routing.queueAwareDispatch.registry,
    selectedIssueNumber: result.selectedIssueNumber,
    selectedLane: result.selected?.classification?.lane || null,
    selectedAction: result.selected?.classification?.action || null,
    intervalOnly: result.intervalOnly,
    classifiedCount: result.classified.length,
    apply: false,
    note: 'Read-only selector. Live mutation remains owned by authorized migration (#2727) or explicit apply workflows.'
  };
  console.log(JSON.stringify(payload, null, 2));
  return payload;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main();
}
