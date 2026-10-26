// After the 10:00 America/New_York publish sweep, confirm a post that the
// sweep says it published is on the public fundraiser-details list (#4684).
// A day with no successful publish comment is a day with no scheduled post:
// the check stays quiet and opens nothing.
//
// The bridge token stays on the publish workflow (#4407, closed). This check
// reads the public list and the publish workflow's comment on #4253.

import { pathToFileURL } from 'node:url';

export const EXCEPTION_LABELS = ['team:operations', 'ops-exception'];
const MARKER = '<!-- ops-scheduled-post-missing -->';
const PUBLISH_ISSUE = 4253;

export function newYorkDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function publishedKeysFromComment(body) {
  if (!body || !/sweep — published/.test(body) || /FAILED/.test(body)) return [];
  const match = body.match(/```\n([\s\S]*?)\n```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return (parsed.published || []).map((item) => item && item.key).filter(Boolean);
  } catch {
    return [];
  }
}

export function expectedKeysFromComments(comments, nyDate) {
  const todays = (comments || [])
    .filter((comment) => comment && comment.created_at && newYorkDate(new Date(comment.created_at)) === nyDate)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const comment of todays) {
    const keys = publishedKeysFromComment(comment.body || '');
    if (keys.length > 0) return keys;
  }
  return [];
}

export function evaluatePresence({ expectedKeys, items }) {
  if (!expectedKeys || expectedKeys.length === 0) return { action: 'quiet' };
  const present = new Set((items || []).map((item) => item && item.key).filter(Boolean));
  const missing = expectedKeys.filter((key) => !present.has(key));
  if (missing.length === 0) return { action: 'present' };
  return { action: 'missing', missing };
}

export function renderIssueBody({ nyDate, missing, listUrl }) {
  return [
    MARKER,
    '',
    '## Exception: a scheduled post is missing from the public site',
    '',
    `- New York date: ${nyDate}`,
    `- Missing key(s): ${missing.join(', ')}`,
    `- Public list: ${listUrl}`,
    '',
    'The 10:00 America/New_York publish sweep reported these keys as published, and the public fundraiser-details list does not include them (#4684).',
    '',
    'A day with no successful publish comment opens nothing. A failed publish run is already an Operations exception from the workflow failure watcher (#4444). The bridge token is #4407, which is closed; this check does not read or change it.',
    '',
    'A later missing post comments here instead of opening another Issue. Operations closes this Issue once the post is on the site or the miss is accepted.',
  ].join('\n');
}

export function renderComment({ nyDate, missing, listUrl }) {
  return [
    `Still missing on ${nyDate}: ${missing.join(', ')}`,
    '',
    `- Public list: ${listUrl}`,
  ].join('\n');
}

export async function handleScheduledPostPresence({
  comments,
  items,
  nyDate,
  listUrl,
  api,
  repo,
}) {
  const expectedKeys = expectedKeysFromComments(comments, nyDate);
  const result = evaluatePresence({ expectedKeys, items });
  if (result.action !== 'missing') return { action: result.action, expectedKeys };

  const open = await api(
    'GET',
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent('ops-exception')}&per_page=100`,
  );
  const existing = (open || []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(MARKER),
  );
  if (existing) {
    await api('POST', `/repos/${repo}/issues/${existing.number}/comments`, {
      body: renderComment({ nyDate, missing: result.missing, listUrl }),
    });
    return { action: 'commented', number: existing.number, missing: result.missing };
  }

  const created = await api('POST', `/repos/${repo}/issues`, {
    title: 'OPS EXCEPTION: scheduled post missing after 10:00',
    body: renderIssueBody({ nyDate, missing: result.missing, listUrl }),
    labels: EXCEPTION_LABELS,
  });
  return { action: 'created', number: created.number, missing: result.missing };
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
    if (!response.ok) {
      throw new Error(`GitHub API ${method} ${path} failed: ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
  };
}

async function main() {
  const { GH_TOKEN, REPO, BASE_URL } = process.env;
  const baseUrl = (BASE_URL || 'https://www.lougehrigfanclub.com').replace(/\/$/, '');
  if (!GH_TOKEN || !REPO) {
    console.error('Missing required environment: GH_TOKEN, REPO');
    process.exit(2);
  }
  const listUrl = `${baseUrl}/api/fundraiser-details/list?limit=30`;
  const api = makeApi(GH_TOKEN);
  const [comments, listResponse] = await Promise.all([
    api('GET', `/repos/${REPO}/issues/${PUBLISH_ISSUE}/comments?per_page=100`),
    fetch(listUrl),
  ]);
  if (!listResponse.ok) {
    throw new Error(`Public list ${listUrl} failed: ${listResponse.status}`);
  }
  const list = await listResponse.json();
  const result = await handleScheduledPostPresence({
    comments,
    items: list.items || [],
    nyDate: newYorkDate(new Date()),
    listUrl,
    api,
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
