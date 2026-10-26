// Reads recorded secret expiry dates from the asset register and opens one
// Operations Issue 30 days before each date (#4691). Names only. Never values.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const WARN_WITHIN_DAYS = 30;
export const EXCEPTION_LABELS = ['team:operations', 'ops-exception'];
const MARKER = '<!-- ops-secret-expiry -->';
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseExpiryRows(markdown) {
  const start = markdown.indexOf('<!-- asset-register:expiry:start -->');
  const end = markdown.indexOf('<!-- asset-register:expiry:end -->');
  if (start < 0 || end < start) return [];
  const rows = [];
  for (const line of markdown.slice(start, end).split('\n')) {
    if (!line.startsWith('|') || line.includes('---') || line.includes('| name |')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2 || !cells[0] || !DATE.test(cells[1])) continue;
    rows.push({ name: cells[0], expires: cells[1] });
  }
  return rows;
}

export function dueNames(rows, now = new Date(), withinDays = WARN_WITHIN_DAYS) {
  const limit = now.getTime() + withinDays * DAY_MS;
  return rows
    .filter((row) => {
      const expires = new Date(`${row.expires}T00:00:00Z`).getTime();
      return expires <= limit;
    })
    .map((row) => row.name);
}

export function renderIssueBody(names) {
  return [
    MARKER,
    '',
    '## Exception: a recorded secret expiry is inside 30 days',
    '',
    ...names.map((name) => `- ${name}`),
    '',
    'Names only. No secret value is included (#4691). A later reminder comments here. Operations closes this Issue once the secret is rotated or the date is accepted.',
  ].join('\n');
}

export async function handleSecretExpiry({ rows, now, api, repo }) {
  const names = dueNames(rows, now);
  if (names.length === 0) return { action: 'quiet' };
  const body = renderIssueBody(names);
  const open = await api(
    'GET',
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent('ops-exception')}&per_page=100`,
  );
  const existing = (open || []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(MARKER),
  );
  if (existing) {
    await api('POST', `/repos/${repo}/issues/${existing.number}/comments`, { body });
    return { action: 'commented', number: existing.number };
  }
  const created = await api('POST', `/repos/${repo}/issues`, {
    title: 'OPS EXCEPTION: recorded secret expiry inside 30 days',
    body,
    labels: EXCEPTION_LABELS,
  });
  return { action: 'created', number: created.number };
}

function makeApi(token) {
  return async function api(method, path, body) {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
}

async function main() {
  const { GH_TOKEN, REPO, REGISTER_PATH } = process.env;
  if (!GH_TOKEN || !REPO) {
    console.error('Missing required environment: GH_TOKEN, REPO');
    process.exit(2);
  }
  const markdown = readFileSync(
    REGISTER_PATH || 'docs/reference/platform/lgfc-asset-register.md',
    'utf8',
  );
  const result = await handleSecretExpiry({
    rows: parseExpiryRows(markdown),
    now: new Date(),
    api: makeApi(GH_TOKEN),
    repo: REPO,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
