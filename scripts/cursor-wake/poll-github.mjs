#!/usr/bin/env node
/**
 * Local GitHub work poller (no cloud agents, no usage credits).
 * Uses gh CLI only. Tracks state between runs to avoid repeat alerts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const POLLER_DIR = dirname(fileURLToPath(import.meta.url));
const READY_QUEUE_PATH = join(homedir(), '.cursor', 'lgfc-ready-queue.txt');
const REPO = process.env.GITHUB_POLL_REPO || 'wdhunter465/next-starter-template';
const LOGIN = process.env.GITHUB_POLL_LOGIN || 'wdhunter465';
const STATE_PATH = join(POLLER_DIR, 'state.json');
const ALERTS_LOG = join(POLLER_DIR, 'alerts.log');

function gh(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const trimmed = out.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed);
}

function ghRaw(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
}

/**
 * Markers this workstation's Cursor agent leaves as the latest comment when
 * it writes to GitHub. A fresh event whose newest comment matches one of
 * these is an echo of our own activity, not new work, and must not wake the
 * agent. Anything newer from another actor (Claude dispatch, Bridge packet,
 * review) lands after these and defeats suppression, so real work still wakes.
 */
const SELF_ECHO_PATTERNS = [
  /^CLAIMED — Cursor Local/,
  /^PR opened: #\d+/,
  /^## Reviewer response/,
  /Made with \[Cursor\]\(https:\/\/cursor\.com\)/,
];

function lastCommentBody(number) {
  try {
    const query = `query($owner:String!,$name:String!,$number:Int!){
      repository(owner:$owner,name:$name){
        issueOrPullRequest(number:$number){
          ... on Issue { comments(last:1){ nodes { body } } }
          ... on PullRequest { comments(last:1){ nodes { body } } }
        }
      }
    }`;
    const [owner, name] = REPO.split('/');
    return ghRaw([
      'api',
      'graphql',
      '-F', `owner=${owner}`,
      '-F', `name=${name}`,
      '-F', `number=${number}`,
      '-f', `query=${query}`,
      '-q', '.data.repository.issueOrPullRequest.comments.nodes[0].body // ""',
    ]);
  } catch {
    // Fail open: if the check fails, wake rather than risk missing work.
    return null;
  }
}

function isSelfEcho(event) {
  // Merges and issue closures are GitHub state changes, not comment echoes.
  if (
    event.kind === 'pr_merged' ||
    event.kind === 'authored_pr_merged' ||
    event.kind === 'issue_closed'
  ) {
    return false;
  }
  const number = event.issueNumber || event.prNumber;
  if (!number) return false;
  const body = lastCommentBody(number);
  if (!body) return false;
  return SELF_ECHO_PATTERNS.some((re) => re.test(body));
}

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return {
      since: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      seen: {},
    };
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  mkdirSync(POLLER_DIR, { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function eventKey(event) {
  return `${event.kind}:${event.id}`;
}

function addEvent(bucket, event) {
  bucket.push(event);
}

function latestHandoffComment(issueNumber) {
  try {
    const comments = gh([
      'api',
      `repos/${REPO}/issues/${issueNumber}/comments`,
      '--paginate',
      '-q',
      '.[] | {id, created_at, user: .user.login, body}',
    ]);
    const handoffs = comments.filter((c) => (c.body || '').includes('### AGENT HANDOFF'));
    if (handoffs.length === 0) return null;
    const latest = handoffs[handoffs.length - 1];
    return {
      id: latest.id,
      at: latest.created_at,
      author: latest.user,
      preview: latest.body.split('\n').slice(0, 8).join('\n'),
    };
  } catch {
    return null;
  }
}

function collectEvents(since) {
  const events = [];
  const sinceMs = new Date(since).getTime();

  const handoffs = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--label',
    'agent:cursor,handoff:ready',
    '--state',
    'open',
    '--json',
    'number,title,updatedAt,url',
    '--limit',
    '30',
  ]);
  for (const issue of handoffs) {
    if (new Date(issue.updatedAt).getTime() <= sinceMs) continue;
    const handoff = latestHandoffComment(issue.number);
    addEvent(events, {
      kind: 'cursor_handoff',
      id: `${issue.number}@${issue.updatedAt}`,
      at: issue.updatedAt,
      issueNumber: issue.number,
      title: issue.title,
      url: issue.url,
      handoff,
    });
  }

  const assignedIssues = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--assignee',
    LOGIN,
    '--state',
    'open',
    '--json',
    'number,title,updatedAt,url',
    '--limit',
    '50',
  ]);
  for (const issue of assignedIssues) {
    if (new Date(issue.updatedAt).getTime() <= sinceMs) continue;
    addEvent(events, {
      kind: 'assigned_issue_activity',
      id: `${issue.number}@${issue.updatedAt}`,
      at: issue.updatedAt,
      issueNumber: issue.number,
      title: issue.title,
      url: issue.url,
    });
  }

  const assignedPrs = gh([
    'pr',
    'list',
    '--repo',
    REPO,
    '--assignee',
    LOGIN,
    '--state',
    'open',
    '--json',
    'number,title,updatedAt,url',
    '--limit',
    '50',
  ]);
  for (const pr of assignedPrs) {
    if (new Date(pr.updatedAt).getTime() <= sinceMs) continue;
    addEvent(events, {
      kind: 'assigned_pr_activity',
      id: `${pr.number}@${pr.updatedAt}`,
      at: pr.updatedAt,
      prNumber: pr.number,
      title: pr.title,
      url: pr.url,
    });
  }

  // Authored open PRs (Cursor work is often unassigned).
  const authoredPrs = gh([
    'pr',
    'list',
    '--repo',
    REPO,
    '--author',
    LOGIN,
    '--state',
    'open',
    '--json',
    'number,title,updatedAt,url',
    '--limit',
    '50',
  ]);
  for (const pr of authoredPrs) {
    if (new Date(pr.updatedAt).getTime() <= sinceMs) continue;
    addEvent(events, {
      kind: 'authored_pr_activity',
      id: `authored:${pr.number}@${pr.updatedAt}`,
      at: pr.updatedAt,
      prNumber: pr.number,
      title: pr.title,
      url: pr.url,
    });
  }

  // Recently merged PRs (any author) — post-merge continuity.
  const mergedPrs = gh([
    'pr',
    'list',
    '--repo',
    REPO,
    '--state',
    'merged',
    '--json',
    'number,title,mergedAt,url,updatedAt',
    '--limit',
    '30',
  ]);
  for (const pr of mergedPrs) {
    const at = pr.mergedAt || pr.updatedAt;
    if (!at || new Date(at).getTime() <= sinceMs) continue;
    addEvent(events, {
      kind: 'pr_merged',
      id: `merged:${pr.number}@${at}`,
      at,
      prNumber: pr.number,
      title: pr.title,
      url: pr.url,
    });
  }

  // Recently closed issues — source-issue closeout after merge.
  const closedIssues = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--state',
    'closed',
    '--json',
    'number,title,closedAt,url,updatedAt',
    '--limit',
    '30',
  ]);
  for (const issue of closedIssues) {
    const at = issue.closedAt || issue.updatedAt;
    if (!at || new Date(at).getTime() <= sinceMs) continue;
    addEvent(events, {
      kind: 'issue_closed',
      id: `closed:${issue.number}@${at}`,
      at,
      issueNumber: issue.number,
      title: issue.title,
      url: issue.url,
    });
  }

  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

function labelNames(item) {
  return (item.labels || []).map((label) =>
    typeof label === 'string' ? label : label.name,
  );
}

function isNumberedOps(item) {
  return labelNames(item).some((name) => /^ops:priority:[1-4]$/.test(name));
}

function opsPriority(item) {
  const match = labelNames(item)
    .map((name) => name.match(/^ops:priority:([1-4])$/))
    .find(Boolean);
  return match ? Number(match[1]) : 99;
}

function checkRollup(pr) {
  const rollup = pr.statusCheckRollup;
  if (!rollup) return 'UNKNOWN';
  if (typeof rollup === 'string') return rollup;
  if (Array.isArray(rollup)) {
    const latestByName = new Map();
    for (const entry of rollup) {
      const name = entry.name || entry.workflowName || 'unknown';
      const started = Date.parse(entry.startedAt || entry.completedAt || 0) || 0;
      const prev = latestByName.get(name);
      if (!prev || started >= prev.started) {
        latestByName.set(name, { started, entry });
      }
    }
    const states = [...latestByName.values()].map(({ entry }) => {
      const status = String(entry.status || '');
      if (/in_progress|queued|pending|waiting/i.test(status)) return 'PENDING';
      return String(entry.conclusion || entry.state || '');
    });
    if (states.some((state) => /fail|error/i.test(state))) return 'FAILURE';
    if (states.some((state) => /pending|queued|in_progress/i.test(state))) return 'PENDING';
    if (states.length && states.every((state) => /success|neutral|skip|skipped/i.test(state))) {
      return 'SUCCESS';
    }
  }
  return String(rollup.state || rollup || 'UNKNOWN');
}

/**
 * Standing discovered work. Independent of the `since` watermark so
 * completing one assignment still leaves remaining queue visible.
 */
function linkedIssueFromPr(pr) {
  const body = String(pr.body || '');
  const fromBody = body.match(/\*\*Issue:\*\*\s*#(\d+)/i);
  if (fromBody) return Number(fromBody[1]);
  const fromTitle = String(pr.title || '').match(/\(#(\d+)\)/);
  if (fromTitle) return Number(fromTitle[1]);
  return null;
}

async function loadNextWorkResolver() {
  if (process.env.CURSOR_NEXT_WORK_RESOLVER === '0') return null;
  const candidates = [
    process.env.LGFC_NEXT_WORK_RESOLVER,
  ].filter(Boolean);
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      return await import(pathToFileURL(path).href);
    } catch {
      continue;
    }
  }
  return null;
}

async function collectResumeQueue() {
  const items = [];
  const seen = new Set();

  const authoredPrs = gh([
    'pr',
    'list',
    '--repo',
    REPO,
    '--author',
    LOGIN,
    '--state',
    'open',
    '--json',
    'number,title,url,body,statusCheckRollup',
    '--limit',
    '20',
  ]);
  const waitingIssues = new Set();
  for (const pr of authoredPrs) {
    if (checkRollup(pr) !== 'SUCCESS') continue;
    const issueNumber = linkedIssueFromPr(pr);
    if (issueNumber) waitingIssues.add(issueNumber);
  }

  function push(item) {
    const key = `${item.kind}:${item.number}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (item.kind === 'handoff_ready') {
      item.waiting = true;
      item.waitingReason = 'handoff_ready_not_go';
    } else if (
      item.kind !== 'authored_pr_gates' &&
      item.kind !== 'post_merge_failure' &&
      waitingIssues.has(item.number)
    ) {
      item.waiting = true;
      item.waitingReason = 'open_pr_awaiting_review';
    }
    items.push(item);
  }

  const opsPool = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--label',
    'team:operations',
    '--state',
    'open',
    '--json',
    'number,title,url,labels',
    '--limit',
    '30',
  ]);
  for (const issue of opsPool) {
    if (!isNumberedOps(issue)) continue;
    push({
      kind: 'ops_interrupt',
      number: issue.number,
      title: issue.title,
      url: issue.url,
      detail: `ops:priority:${opsPriority(issue)}`,
      rank: opsPriority(issue),
    });
  }

  const resolver = await loadNextWorkResolver();
  const assigned = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--assignee',
    LOGIN,
    '--state',
    'open',
    '--json',
    'number,title,url,labels,body,state',
    '--limit',
    '20',
  ]);
  const cursorClaims = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--label',
    'agent:cursor',
    '--state',
    'open',
    '--json',
    'number,title,url,labels,body,state',
    '--limit',
    '30',
  ]);
  if (!resolver) {
    for (const issue of assigned) {
      push({
        kind: 'assigned_issue',
        number: issue.number,
        title: issue.title,
        url: issue.url,
        detail: 'assignee',
        rank: 20,
      });
    }
  } else {
    const byNumber = new Map();
    for (const issue of [...assigned, ...cursorClaims]) byNumber.set(issue.number, issue);
    const decision = resolver.resolveCursorNextWork([...byNumber.values()]);
    if (decision.status === 'SELECTED') {
      const issue = byNumber.get(decision.issue);
      push({
        kind: 'agent_cursor_next',
        number: decision.issue,
        title: issue?.title || '',
        url: issue?.url || `https://github.com/${REPO}/issues/${decision.issue}`,
        detail: decision.eligibilityReason,
        rank: 25,
      });
    }
  }

  for (const pr of authoredPrs) {
    const rollup = checkRollup(pr);
    if (rollup === 'SUCCESS') continue;
    push({
      kind: 'authored_pr_gates',
      number: pr.number,
      title: pr.title,
      url: pr.url,
      detail: rollup,
      rank: rollup === 'FAILURE' ? 10 : 11,
    });
  }

  const pmf = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--label',
    'post-merge-failure,agent:cursor',
    '--state',
    'open',
    '--json',
    'number,title,url',
    '--limit',
    '10',
  ]);
  for (const issue of pmf) {
    push({
      kind: 'post_merge_failure',
      number: issue.number,
      title: issue.title,
      url: issue.url,
      detail: 'cursor-owned exception',
      rank: 15,
    });
  }

  if (!resolver) {
    const cursorActive = cursorClaims.filter((issue) =>
      (issue.labels || []).some((label) => (label.name || label) === 'status:active'),
    );
    for (const issue of cursorActive) {
      push({
        kind: 'agent_cursor_active',
        number: issue.number,
        title: issue.title,
        url: issue.url,
        detail: 'agent:cursor+status:active',
        rank: 25,
      });
    }
  }

  const handoffs = gh([
    'issue',
    'list',
    '--repo',
    REPO,
    '--label',
    'agent:cursor,handoff:ready',
    '--state',
    'open',
    '--json',
    'number,title,url',
    '--limit',
    '8',
  ]);
  for (const issue of handoffs) {
    push({
      kind: 'handoff_ready',
      number: issue.number,
      title: issue.title,
      url: issue.url,
      detail: 'labels/status only — not website Go',
      rank: 30,
    });
  }

  const handoffNumbers = new Set(
    items.filter((item) => item.kind === 'handoff_ready').map((item) => item.number),
  );
  for (const item of items) {
    if (!handoffNumbers.has(item.number)) continue;
    item.waiting = true;
    item.waitingReason = item.waitingReason || 'handoff_ready_not_go';
  }

  return items.sort((a, b) => a.rank - b.rank || a.number - b.number);
}

function readReadyQueries() {
  if (!existsSync(READY_QUEUE_PATH)) return [];
  return readFileSync(READY_QUEUE_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function collectReadyQueue() {
  const queries = readReadyQueries();
  const readyQueue = [];
  queries.forEach((query, index) => {
    const search = `repo:${REPO} ${query}`;
    let issues = [];
    try {
      issues = gh([
        'issue',
        'list',
        '--repo',
        REPO,
        '--state',
        'open',
        '--search',
        search,
        '--limit',
        '20',
        '--json',
        'number,title,labels',
      ]);
    } catch (err) {
      readyQueue.push({
        index: index + 1,
        query,
        count: 0,
        error: err.message,
        actionable: [],
        skipped: [],
      });
      return;
    }
    const actionable = [];
    const skipped = [];
    for (const issue of issues) {
      const waits = labelNames(issue).filter((name) => name && name.startsWith('wait:'));
      if (waits.length) {
        skipped.push({ number: issue.number, title: issue.title, wait: waits });
      } else {
        actionable.push({ number: issue.number, title: issue.title });
      }
    }
    readyQueue.push({
      index: index + 1,
      query,
      count: issues.length,
      actionableCount: actionable.length,
      skippedCount: skipped.length,
      first: actionable.slice(0, 5).map((issue) => issue.number),
      actionable: actionable.slice(0, 8),
      skipped: skipped.slice(0, 8),
    });
  });
  return readyQueue;
}

function persistResumeQueue(queue, polledAt) {
  const waiting = queue.filter((item) => item.waiting);
  const executable = queue.filter((item) => !item.waiting);
  const payload = {
    polledAt,
    repo: REPO,
    idle: queue.length === 0,
    nextExecutable: executable[0] || null,
    waiting,
    items: queue,
  };
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(join(POLLER_DIR, 'resume-queue.json'), text);
  try {
    writeFileSync('/tmp/lgfc-cursor-resume-queue.json', text);
  } catch {
    // best-effort host copy for the always-on tick prompt
  }
}

function formatEvent(event) {
  const ref = event.issueNumber ? `issue #${event.issueNumber}` : `PR #${event.prNumber}`;
  const lines = [
    `[${event.kind}] ${ref}: ${event.title}`,
    `  url: ${event.url}`,
    `  updated: ${event.at}`,
  ];
  if (event.handoff?.preview) {
    lines.push('  handoff:');
    for (const line of event.handoff.preview.split('\n')) {
      lines.push(`    ${line}`);
    }
  }
  return lines.join('\n');
}

function appendAlerts(text) {
  mkdirSync(POLLER_DIR, { recursive: true });
  writeFileSync(ALERTS_LOG, `${text}\n`, { flag: 'a' });
}

async function main() {
  const state = loadState();
  const since = state.since;
  const now = new Date().toISOString();

  let events;
  let resumeQueue = [];
  let readyQueue = [];
  try {
    events = collectEvents(since);
    resumeQueue = await collectResumeQueue();
    readyQueue = collectReadyQueue();
  } catch (err) {
    const message = `[${now}] poll failed: ${err.message}`;
    console.error(message);
    process.exit(1);
  }
  persistResumeQueue(resumeQueue, now);

  const unseen = events.filter((event) => !state.seen[eventKey(event)]);
  for (const event of unseen) {
    state.seen[eventKey(event)] = event.at;
  }

  // Echo suppression: skip events whose newest comment is this agent's own
  // write-back (claim, PR-opened, reviewer-response). Suppressed events are
  // still marked seen above so they never re-alert later.
  const suppressed = [];
  const fresh = [];
  for (const event of unseen) {
    if (isSelfEcho(event)) suppressed.push(event);
    else fresh.push(event);
  }

  state.since = now;
  const keys = Object.keys(state.seen);
  if (keys.length > 400) {
    const keep = keys.slice(-250);
    state.seen = Object.fromEntries(keep.map((k) => [k, state.seen[k]]));
  }
  saveState(state);

  const refs = fresh.map((event) => {
    if (event.issueNumber) return `issue #${event.issueNumber}`;
    if (event.prNumber) return `PR #${event.prNumber}`;
    return event.kind;
  });

  const waiting = resumeQueue.filter((item) => item.waiting);
  const executable = resumeQueue.filter((item) => !item.waiting);
  const nextExecutable = executable[0] || null;
  const idle = fresh.length === 0 && resumeQueue.length === 0;
  const prompt = [
    `Run the queries in ~/.cursor/lgfc-ready-queue.txt for ${REPO}.`,
    'Skip any Issue labeled wait:* after recording the blocker.',
    'Act on the first Issue that can move. Never send a third identical report.',
    fresh.length
      ? `Poll saw ${fresh.length} new event(s): ${refs.join(', ')}.`
      : 'Poll saw no new events.',
  ].join(' ');

  const payload = {
    ok: true,
    repo: REPO,
    login: LOGIN,
    since,
    polledAt: now,
    fresh: fresh.length,
    idle,
    suppressedEchoes: suppressed.length,
    nextExecutable,
    waiting,
    resumeQueue,
    readyQueue,
    events: fresh,
    prompt,
  };

  // Machine-readable line for wake-loop.sh (stdout only).
  process.stdout.write(`${JSON.stringify(payload)}\n`);

  if (suppressed.length > 0) {
    const refs = suppressed
      .map((e) => (e.issueNumber ? `issue #${e.issueNumber}` : `PR #${e.prNumber}`))
      .join(', ');
    console.error(`[${now}] suppressed ${suppressed.length} self-echo event(s): ${refs}`);
  }

  if (fresh.length === 0) {
    console.error(
      `[${now}] no new repo activity (checked since ${since}); resumeQueue=${resumeQueue.length} idle=${idle}`,
    );
    return;
  }

  const banner = [
    '',
    '='.repeat(72),
    `[${now}] ${fresh.length} new repo event(s) in ${REPO}`,
    '='.repeat(72),
    ...fresh.map(formatEvent),
    '',
    'Waking Cursor agent with resume prompt.',
    '',
  ].join('\n');

  console.error(banner);
  appendAlerts(banner);
}

main();
