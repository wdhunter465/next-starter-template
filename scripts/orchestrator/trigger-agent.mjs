#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const repo = process.env.GITHUB_REPOSITORY;
const issueNumber = process.env.ISSUE_NUMBER;

if (!repo || !issueNumber) {
  console.error('GITHUB_REPOSITORY and ISSUE_NUMBER environment variables are required.');
  process.exit(1);
}

const AGENT_PROMPTS = {
  'agent:cursor': '@cursor execute implementation per issue and update the existing draft PR only. Do not open a new PR.',
  'agent:copilot': '@copilot implement per issue and update the existing draft PR only. Do not open a new PR.',
  'agent:ChatGPT': 'ChatGPT-routed task detected. Human/ChatGPT execution required. Update the existing draft PR only. Do not open a new PR.'
};

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

const issueJson = runGh([
  'issue', 'view', issueNumber, '--repo', repo, '--json', 'labels,title'
]);

const issue = JSON.parse(issueJson);
const labels = issue.labels.map((label) => label.name);

if (!labels.includes('orchestrator') || !labels.includes('status:pr-draft')) process.exit(0);

const agent = labels.find((label) => label.startsWith('agent:'));
if (!agent) process.exit(0);

const triggerComment = AGENT_PROMPTS[agent] || '';
if (!triggerComment) {
  console.error(`No trigger prompt configured for ${agent}`);
  process.exit(1);
}

runGh(['issue', 'comment', issueNumber, '--repo', repo, '--body', triggerComment]);
runGh(['issue', 'edit', issueNumber, '--repo', repo, '--remove-label', 'status:pr-draft', '--add-label', 'status:implementation']);

console.log(`Agent triggered for issue #${issueNumber}`);
