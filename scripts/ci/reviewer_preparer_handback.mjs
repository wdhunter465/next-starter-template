#!/usr/bin/env node

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const HANDOFF_MARKER = '<!-- reviewer-preparer-handback -->';
const PENDING_PLACEHOLDER_PATTERN = /review-comment:(\d+)[^\n]*pending agent completion/gi;

function normalize(value = '') {
  return String(value || '').trim();
}

function implementationAgentFromBody(body = '') {
  return normalize(String(body || '').match(/^\s*-?\s*Implementation agent\s*:\s*(.+?)\s*$/im)?.[1] || '');
}

export function extractPendingPlaceholderIds(body = '') {
  const ids = [];
  const seen = new Set();
  const pattern = new RegExp(PENDING_PLACEHOLDER_PATTERN.source, PENDING_PLACEHOLDER_PATTERN.flags);
  for (const match of String(body || '').matchAll(pattern)) {
    const id = String(match[1]);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function resolvePreparerIdentity({ body = '', labels = [], authorLogin = '' } = {}) {
  const implementationAgent = implementationAgentFromBody(body);
  if (implementationAgent && !/^(?:not-applicable|n\/a|none)$/i.test(implementationAgent)) {
    return { value: implementationAgent, source: 'implementation-agent' };
  }

  const agentLabel = labels
    .map((label) => (typeof label === 'string' ? label : label?.name || ''))
    .find((name) => /^agent:/i.test(name));
  if (agentLabel) {
    return { value: agentLabel, source: 'agent-label' };
  }

  return { value: normalize(authorLogin) || 'unknown-preparer', source: 'pr-author' };
}

function uniqueFindingRows({ blockingReasons = [], pendingPlaceholderIds = [] } = {}) {
  const rows = [];
  const seen = new Set();

  for (const finding of blockingReasons || []) {
    const id = String(finding.commentId || '').trim();
    const key = `${finding.code || 'reviewer-lifecycle-blocker'}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: id || 'n/a',
      state: finding.code || 'reviewer-lifecycle-blocker',
      detail: finding.message || 'Reviewer lifecycle finding requires correction.',
    });
  }

  for (const id of pendingPlaceholderIds || []) {
    const key = `pending-agent-disposition:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: String(id),
      state: 'pending-agent-disposition',
      detail: 'CI scaffold exists but the preparer has not replaced it with a substantive final disposition.',
    });
  }

  return rows;
}

export function buildPreparerHandbackBlock({ preparer, blockingReasons = [], pendingPlaceholderIds = [] } = {}) {
  const rows = uniqueFindingRows({ blockingReasons, pendingPlaceholderIds });
  const lines = [
    HANDOFF_MARKER,
    '',
    '### 🤖 PREPARER HANDBACK ACTION REQUIRED',
    '',
    `- Target preparer: ${preparer?.value || 'unknown-preparer'}`,
    `- Identity source: ${preparer?.source || 'unknown'}`,
    '- Required action: correct this same PR; do not open a remediation PR for a defect known before merge.',
    '- Merge state: blocked until every finding is substantively resolved/dispositioned and the enforcing gate reruns green.',
    '',
    '| Reviewer item | State | Required correction |',
    '| --- | --- | --- |',
  ];

  if (!rows.length) {
    lines.push('| n/a | no blocking reviewer item | none |');
  } else {
    for (const row of rows) {
      const detail = String(row.detail || '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
      lines.push(`| ${row.id} | ${row.state} | ${detail} |`);
    }
  }

  lines.push(
    '',
    'Required final disposition format:',
    '`- review-comment:<id> — <accepted|rejected|not-applicable|acknowledged> — <substantive rationale> — thread state: <resolved|outdated|unresolved-with-rationale|follow-up>`',
    '',
    'CI-generated text containing `pending agent completion` is scaffolding only and cannot satisfy merge readiness.',
  );

  return lines.join('\n');
}

async function request(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-reviewer-preparer-handback',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function paginate(path, token) {
  const results = [];
  let page = 1;
  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const data = await request(`${path}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(data) || !data.length) break;
    results.push(...data);
    if (data.length < 100) break;
    page += 1;
  }
  return results;
}

async function upsertHandbackComment({ token, owner, repo, prNumber, body }) {
  const comments = await paginate(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token);
  const existing = comments.find((comment) => String(comment.body || '').includes(HANDOFF_MARKER));
  if (existing) {
    await request(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
    return;
  }
  await request(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function runPreparerHandback({ token, owner, repo, prNumber, resultPath = '', enforceFailure = false } = {}) {
  if (!token || !owner || !repo || !prNumber) {
    throw new Error('token, owner, repo, and prNumber are required.');
  }

  const [pull, issue] = await Promise.all([
    request(`/repos/${owner}/${repo}/pulls/${prNumber}`, token),
    request(`/repos/${owner}/${repo}/issues/${prNumber}`, token),
  ]);

  let lifecycle = {};
  if (resultPath && fs.existsSync(resultPath)) {
    lifecycle = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  }

  const pendingPlaceholderIds = extractPendingPlaceholderIds(pull.body || '');
  const blockingReasons = Array.isArray(lifecycle.blockingReasons) ? lifecycle.blockingReasons : [];
  const mustHandBack = enforceFailure && (blockingReasons.length > 0 || pendingPlaceholderIds.length > 0);

  if (!mustHandBack) {
    return {
      blocked: false,
      preparer: resolvePreparerIdentity({ body: pull.body || '', labels: issue.labels || [], authorLogin: pull.user?.login || '' }),
      pendingPlaceholderIds,
      blockingReasons,
    };
  }

  const preparer = resolvePreparerIdentity({
    body: pull.body || '',
    labels: issue.labels || [],
    authorLogin: pull.user?.login || '',
  });
  const body = buildPreparerHandbackBlock({ preparer, blockingReasons, pendingPlaceholderIds });
  await upsertHandbackComment({ token, owner, repo, prNumber, body });

  return { blocked: true, preparer, pendingPlaceholderIds, blockingReasons, body };
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || '';
  const prNumber = process.env.PR_NUMBER;
  const resultPath = process.env.REVIEWER_LIFECYCLE_RESULT_JSON || '';
  const enforceFailure = process.env.ENFORCE_FAILURE === 'true';
  const [owner, repo] = repository.split('/');

  const result = await runPreparerHandback({ token, owner, repo, prNumber, resultPath, enforceFailure });
  if (result.blocked) {
    console.error(`Reviewer-response merge block handed back to ${result.preparer.value}.`);
    process.exitCode = 1;
  } else {
    console.log('No enforcing preparer handback required.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
