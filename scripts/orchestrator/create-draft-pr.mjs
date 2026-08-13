#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

export function isDuplicateIssueBody(body) {
  return /\bDuplicate of (?:Issue )?#\d+\b/i.test(body || '') || /\bclosed as duplicate\b/i.test(body || '');
}

function firstPrUrlFromSearch(repo, search, state = 'open') {
  const result = runGh([
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    state,
    '--search',
    search,
    '--json',
    'url,mergedAt',
    '--limit',
    '1'
  ]);
  const prs = JSON.parse(result);
  return prs.length > 0 ? prs[0] : null;
}

export function issuePrSearchQuery(number) {
  return `"orchestrator-source-issue: ${number}" OR "- **Issue:** #${number}"`;
}

function existingOpenPrForIssue(repo, number) {
  const pr = firstPrUrlFromSearch(repo, issuePrSearchQuery(number), 'open');
  return pr ? pr.url : '';
}

export function existingMergedPrForIssue(repo, number) {
  const pr = firstPrUrlFromSearch(repo, issuePrSearchQuery(number), 'merged');
  return pr ? pr.url : '';
}

export function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const issueNumber = process.env.ISSUE_NUMBER;

  if (!repo) {
    console.error('GITHUB_REPOSITORY is required.');
    process.exit(1);
  }

  if (!issueNumber) {
    console.error('ISSUE_NUMBER is required.');
    process.exit(1);
  }

  const issueJson = runGh([
    'issue',
    'view',
    issueNumber,
    '--repo',
    repo,
    '--json',
    'number,title,body,labels,state'
  ]);

  const issue = JSON.parse(issueJson);
  const labels = issue.labels.map((label) => label.name);
  const issueBody = issue.body || '';

  if (issue.state !== 'OPEN') {
    console.log(`Issue #${issueNumber} is not open. Skipping PR creation.`);
    process.exit(0);
  }

  if (isDuplicateIssueBody(issueBody)) {
    runGh(['issue', 'edit', issueNumber, '--repo', repo, '--remove-label', 'status:queued', '--add-label', 'status:failed']);
    runGh(['issue', 'comment', issueNumber, '--repo', repo, '--body', 'Orchestrator PR creation skipped: issue is marked duplicate. Removed status:queued and added status:failed so queue advancement/recovery handling can proceed.']);
    console.log(`Issue #${issueNumber} is marked duplicate. Skipping PR creation and marking failed for queue handling.`);
    process.exit(0);
  }

  if (!labels.includes('orchestrator') || !labels.includes('status:queued')) {
    console.log(`Issue #${issueNumber} is not an orchestrator queued issue. Skipping.`);
    process.exit(0);
  }

  const alreadyOpenPr = existingOpenPrForIssue(repo, issue.number);

  if (alreadyOpenPr) {
    runGh(['issue', 'edit', issueNumber, '--repo', repo, '--remove-label', 'status:queued', '--add-label', 'status:pr-draft']);
    runGh(['issue', 'comment', issueNumber, '--repo', repo, '--body', `Existing active implementation PR found: ${alreadyOpenPr}. No new PR created.`]);
    console.log(`REUSED existing open PR for issue #${issueNumber}: ${alreadyOpenPr}`);
    process.exit(0);
  }

  const alreadyMergedPr = existingMergedPrForIssue(repo, issue.number);

  if (alreadyMergedPr) {
    runGh(['issue', 'comment', issueNumber, '--repo', repo, '--body', `Orchestrator PR creation skipped: a merged PR already satisfies this issue (${alreadyMergedPr}). No new PR will be created unless this issue is explicitly marked follow-up/reopen-required.`]);
    console.log(`SKIPPED PR creation for issue #${issueNumber}: merged PR already satisfies the issue (${alreadyMergedPr})`);
    process.exit(0);
  }

  runGh(['issue', 'edit', issueNumber, '--repo', repo, '--remove-label', 'status:queued', '--add-label', 'status:pr-draft']);
  runGh(['issue', 'comment', issueNumber, '--repo', repo, '--body', 'Orchestrator queue handoff: no placeholder PR was created. Status moved to status:pr-draft to trigger assigned-agent handoff. The assigned agent must create an implementation PR only after producing real file changes.']);
  console.log(`No placeholder PR created for issue #${issueNumber}. Issue moved to status:pr-draft for assigned-agent implementation handoff.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
