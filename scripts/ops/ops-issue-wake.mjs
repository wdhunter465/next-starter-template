/**
 * ops-issue-wake.mjs (#4681, gap 1 of the launch monitoring review #4657)
 *
 * Nothing used to wake an agent when a `team:operations` Issue opened. This sweep does two things and nothing else:
 *   1. WAKE: for an open `team:operations` Issue with no wake comment, post one comment that names the Operations
 *      holder and mentions the secondary holder. The comment is notification only.
 *   2. ESCALATE: if the wake is not acknowledged within the window, post one OPERATIONS ESCALATION comment that
 *      mentions the secondary holder.
 * It never assigns, relabels, closes, approves or decides anything. A comment is posted at most once per Issue per
 * kind (the marker in the comment is the record), so a re-run changes nothing.
 *
 * Acknowledged means any of: the Issue is closed; it carries any `agent:*` label; a comment from anyone other than
 * the bot, after the wake comment, that is not itself a wake or escalation.
 *
 * Why a sweep and not only an `issues` trigger: Issues opened with the built-in token (the failure watcher's
 * exception Issues) do not trigger workflows, so only a scheduled sweep sees them.
 *
 * Modes:  scan  read only, print what it would post
 *         apply scan, then post (default in the workflow)
 * Usage:  node scripts/ops/ops-issue-wake.mjs --mode=scan|apply --repo=wdhunter465/next-starter-template \
 *           [--window-minutes=30] [--max-age-days=7] [--max-posts=5]
 * Requires the gh CLI with GH_TOKEN for scan and apply.
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_REPO = 'wdhunter465/next-starter-template';
export const WAKE_MARKER = '<!-- ops-issue-wake:v1 -->';
export const ESCALATION_MARKER = '<!-- ops-issue-escalation:v1 -->';
export const DEFAULT_WINDOW_MINUTES = 30;
export const DEFAULT_MAX_AGE_DAYS = 7;
export const DEFAULT_MAX_POSTS = 5;
export const BOT_LOGIN = 'github-actions[bot]';
// ops:monitoring and ops:hold do not interrupt (docs/governance/OPERATIONS-AND-RECOVERY.md).
export const NON_INTERRUPT_LABELS = ['ops:monitoring', 'ops:hold'];

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function labelNames(issue = {}) {
  return (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
}

export function isBotComment(comment = {}) {
  return comment.user?.login === BOT_LOGIN || String(comment.body ?? '').includes(WAKE_MARKER) || String(comment.body ?? '').includes(ESCALATION_MARKER);
}

/**
 * Decides the one action for one Issue. Pure: issue and comments in, an action out.
 * comments: [{ body, created_at, user: { login } }], oldest first.
 */
export function evaluateIssue({ issue, comments = [], now, windowMinutes = DEFAULT_WINDOW_MINUTES, maxAgeDays = DEFAULT_MAX_AGE_DAYS }) {
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('now must be a time');
  const labels = labelNames(issue);

  if (issue.pull_request) return { action: 'none', reason: 'pull_request' };
  if (String(issue.state ?? '').toLowerCase() !== 'open') return { action: 'none', reason: 'closed' };
  if (!labels.includes('team:operations')) return { action: 'none', reason: 'not_operations' };
  if (labels.some((l) => NON_INTERRUPT_LABELS.includes(l))) return { action: 'none', reason: 'non_interrupt_label' };
  if (nowMs - Date.parse(issue.created_at) > maxAgeDays * DAY) return { action: 'none', reason: 'too_old' };

  const claimed = labels.some((l) => l.startsWith('agent:'));
  const wake = comments.find((c) => String(c.body ?? '').includes(WAKE_MARKER));

  if (!wake) {
    // An Issue that already has an agent claim needs no wake: someone has it.
    if (claimed) return { action: 'none', reason: 'already_claimed' };
    return { action: 'wake', reason: 'no_wake_comment' };
  }

  if (claimed) return { action: 'none', reason: 'acknowledged_by_label' };
  const wakeAt = Date.parse(wake.created_at);
  const answered = comments.some((c) => Date.parse(c.created_at) > wakeAt && !isBotComment(c));
  if (answered) return { action: 'none', reason: 'acknowledged_by_comment' };
  if (comments.some((c) => String(c.body ?? '').includes(ESCALATION_MARKER))) return { action: 'none', reason: 'already_escalated' };
  if (nowMs - wakeAt < windowMinutes * MINUTE) return { action: 'none', reason: 'inside_window' };
  return { action: 'escalate', reason: 'not_acknowledged_in_window' };
}

export function wakeComment(issue) {
  return [
    WAKE_MARKER,
    '## OPERATIONS WAKE',
    '',
    `A new Operations Issue is open: #${issue.number}.`,
    '',
    '- Operations holder (primary): Cursor. Secondary: Claude Code (`@claude`), per `docs/governance/AGENT-TEAM.md`.',
    '- Acknowledge by commenting here or by setting your `agent:*` label. Until then this Issue is unacknowledged.',
    `- If it is not acknowledged within the window, one escalation comment mentions the secondary holder.`,
    '',
    'Notification only. This comment does not assign, approve, decide or grant authority.',
  ].join('\n');
}

export function escalationComment(issue, minutes) {
  return [
    ESCALATION_MARKER,
    '## OPERATIONS ESCALATION',
    '',
    `Operations Issue #${issue.number} was not acknowledged within ${minutes} minutes of the wake comment.`,
    '',
    '`@claude`: you are the secondary Operations holder. Read the Issue, acknowledge it here, and take it if the primary holder has not.',
    '',
    'Notification only. Nothing was assigned, relabeled or changed.',
  ].join('\n');
}

/** Plans the posts for a set of Issues, newest-risk first (oldest unacknowledged first), capped at maxPosts. */
export function planPosts({ items, now, windowMinutes, maxAgeDays, maxPosts = DEFAULT_MAX_POSTS }) {
  const planned = [];
  for (const { issue, comments } of items) {
    const result = evaluateIssue({ issue, comments, now, windowMinutes, maxAgeDays });
    if (result.action === 'none') continue;
    planned.push({
      number: issue.number,
      action: result.action,
      reason: result.reason,
      body: result.action === 'wake' ? wakeComment(issue) : escalationComment(issue, windowMinutes ?? DEFAULT_WINDOW_MINUTES),
      created_at: issue.created_at,
    });
  }
  planned.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return { planned: planned.slice(0, maxPosts), deferred: planned.slice(maxPosts).map((p) => p.number) };
}

export function parseArgs(argv) {
  const options = {
    mode: 'scan',
    repo: DEFAULT_REPO,
    windowMinutes: DEFAULT_WINDOW_MINUTES,
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    maxPosts: DEFAULT_MAX_POSTS,
  };
  for (const arg of argv) {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    if (key === 'mode') options.mode = value;
    else if (key === 'repo') options.repo = value;
    else if (key === 'window-minutes') options.windowMinutes = Number(value);
    else if (key === 'max-age-days') options.maxAgeDays = Number(value);
    else if (key === 'max-posts') options.maxPosts = Number(value);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['scan', 'apply'].includes(options.mode)) throw new Error('mode must be scan or apply');
  if (options.repo !== DEFAULT_REPO) throw new Error(`repo is locked to ${DEFAULT_REPO}`);
  for (const [name, v] of [['window-minutes', options.windowMinutes], ['max-age-days', options.maxAgeDays], ['max-posts', options.maxPosts]]) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number`);
  }
  return options;
}

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024 });
}

function ghJson(path) {
  return JSON.parse(gh(['api', '--paginate', '--slurp', path])).flat();
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const now = Date.now();
  // A failed API call throws and fails the run. The sweep never reports "nothing to do" when it could not look.
  const issues = ghJson(`repos/${options.repo}/issues?state=open&labels=team:operations&per_page=100`).filter((i) => !i.pull_request);
  const items = issues.map((issue) => ({ issue, comments: ghJson(`repos/${options.repo}/issues/${issue.number}/comments?per_page=100`) }));
  const { planned, deferred } = planPosts({ items, now, windowMinutes: options.windowMinutes, maxAgeDays: options.maxAgeDays, maxPosts: options.maxPosts });

  console.log(`open team:operations Issues: ${issues.length}; to post: ${planned.length}; deferred to the next run: ${deferred.length}`);
  for (const p of planned) console.log(`- #${p.number}: ${p.action} (${p.reason})`);

  if (options.mode !== 'apply') return;
  for (const p of planned) {
    gh(['api', `repos/${options.repo}/issues/${p.number}/comments`, '-X', 'POST', '-F', 'body=@-'], p.body);
    console.log(`posted ${p.action} on #${p.number}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
