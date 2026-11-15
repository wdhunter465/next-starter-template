import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ESCALATION_MARKER,
  WAKE_MARKER,
  escalationComment,
  evaluateIssue,
  parseArgs,
  planPosts,
  wakeComment,
} from '../scripts/ops/ops-issue-wake.mjs';

const T0 = Date.parse('2026-11-15T12:00:00Z');
const minutes = (n) => new Date(T0 + n * 60_000).toISOString();

const issue = (over = {}) => ({
  number: 5300,
  state: 'open',
  created_at: minutes(-5),
  labels: [{ name: 'team:operations' }, { name: 'ops-exception' }],
  ...over,
});
const wake = (at) => ({ body: `${WAKE_MARKER}\n## OPERATIONS WAKE`, created_at: minutes(at), user: { login: 'github-actions[bot]' } });
const person = (at, login = 'wdhunter465', body = 'On it.') => ({ body, created_at: minutes(at), user: { login } });
const evaluate = (args) => evaluateIssue({ now: T0, ...args });

describe('ops issue wake (#4681): the wake', () => {
  it('wakes a new, unclaimed Operations Issue that has no wake comment', () => {
    expect(evaluate({ issue: issue() })).toEqual({ action: 'wake', reason: 'no_wake_comment' });
  });

  it('wakes an Issue the failure watcher opened (built-in token, no human comment)', () => {
    const watcher = issue({ labels: [{ name: 'team:operations' }, { name: 'ops-runtime-failure' }] });
    expect(evaluate({ issue: watcher, comments: [] }).action).toBe('wake');
  });

  it('never wakes twice: a wake comment already there means no new wake', () => {
    expect(evaluate({ issue: issue(), comments: [wake(-4)] }).action).toBe('none');
  });

  it('does not wake an Issue someone already claimed with an agent label', () => {
    expect(evaluate({ issue: issue({ labels: [{ name: 'team:operations' }, { name: 'agent:cursor' }] }) })).toEqual({ action: 'none', reason: 'already_claimed' });
  });

  it.each([
    ['a closed Issue', { state: 'closed' }, 'closed'],
    ['an Issue without team:operations', { labels: [{ name: 'team:engineering' }] }, 'not_operations'],
    ['an ops:monitoring Issue', { labels: [{ name: 'team:operations' }, { name: 'ops:monitoring' }] }, 'non_interrupt_label'],
    ['an ops:hold Issue', { labels: [{ name: 'team:operations' }, { name: 'ops:hold' }] }, 'non_interrupt_label'],
    ['a pull request', { pull_request: {} }, 'pull_request'],
    ['an Issue older than the age cap', { created_at: minutes(-60 * 24 * 8) }, 'too_old'],
  ])('takes no action on %s', (_name, over, reason) => {
    expect(evaluate({ issue: issue(over) })).toEqual({ action: 'none', reason });
  });
});

describe('ops issue wake (#4681): acknowledgement and escalation', () => {
  it('stays quiet inside the window', () => {
    expect(evaluate({ issue: issue(), comments: [wake(-29)] })).toEqual({ action: 'none', reason: 'inside_window' });
  });

  it('escalates once the window has passed with no acknowledgement', () => {
    expect(evaluate({ issue: issue(), comments: [wake(-31)] })).toEqual({ action: 'escalate', reason: 'not_acknowledged_in_window' });
    expect(evaluate({ issue: issue(), comments: [wake(-30)] }).action).toBe('escalate');
  });

  it('does not escalate when a person or agent commented after the wake', () => {
    expect(evaluate({ issue: issue(), comments: [wake(-40), person(-20)] })).toEqual({ action: 'none', reason: 'acknowledged_by_comment' });
  });

  it('a comment from before the wake does not count as an acknowledgement', () => {
    expect(evaluate({ issue: issue(), comments: [person(-50), wake(-40)] }).action).toBe('escalate');
  });

  it('does not escalate when an agent label was set', () => {
    const claimed = issue({ labels: [{ name: 'team:operations' }, { name: 'agent:claude' }] });
    expect(evaluate({ issue: claimed, comments: [wake(-40)] })).toEqual({ action: 'none', reason: 'acknowledged_by_label' });
  });

  it('does not escalate a closed Issue', () => {
    expect(evaluate({ issue: issue({ state: 'closed' }), comments: [wake(-40)] }).reason).toBe('closed');
  });

  it('escalates only once', () => {
    const escalation = { body: `${ESCALATION_MARKER}\n## OPERATIONS ESCALATION`, created_at: minutes(-5), user: { login: 'github-actions[bot]' } };
    expect(evaluate({ issue: issue(), comments: [wake(-40), escalation] })).toEqual({ action: 'none', reason: 'already_escalated' });
  });

  it('ignores the bot for acknowledgement, whatever it says', () => {
    const noise = { body: 'Post-merge verification pending', created_at: minutes(-20), user: { login: 'github-actions[bot]' } };
    expect(evaluate({ issue: issue(), comments: [wake(-40), noise] }).action).toBe('escalate');
  });

  it('honors a custom window', () => {
    expect(evaluate({ issue: issue(), comments: [wake(-10)], windowMinutes: 5 }).action).toBe('escalate');
    expect(evaluate({ issue: issue(), comments: [wake(-10)], windowMinutes: 15 }).action).toBe('none');
  });

  it('rejects a bad clock instead of guessing', () => {
    expect(() => evaluateIssue({ issue: issue(), now: 'not a time' })).toThrow(/now must be a time/);
  });
});

describe('ops issue wake (#4681): comments and planning', () => {
  it('the wake comment names both holders and grants nothing', () => {
    const body = wakeComment(issue());
    expect(body.startsWith(WAKE_MARKER)).toBe(true);
    expect(body).toMatch(/#5300/);
    expect(body).toMatch(/Cursor/);
    expect(body).toMatch(/@claude/);
    expect(body).toMatch(/does not assign, approve, decide or grant authority/);
  });

  it('the escalation comment mentions the secondary holder and changes nothing', () => {
    const body = escalationComment(issue(), 30);
    expect(body.startsWith(ESCALATION_MARKER)).toBe(true);
    expect(body).toMatch(/OPERATIONS ESCALATION/);
    expect(body).toMatch(/30 minutes/);
    expect(body).toMatch(/Nothing was assigned, relabeled or changed/);
  });

  it('plans the oldest unacknowledged Issue first and caps the posts per run', () => {
    const items = [5, 4, 3, 2, 1].map((n) => ({ issue: issue({ number: 6000 + n, created_at: minutes(-n * 3) }), comments: [] }));
    const { planned, deferred } = planPosts({ items, now: T0, maxPosts: 3 });
    expect(planned.map((p) => p.number)).toEqual([6005, 6004, 6003]);
    expect(deferred).toEqual([6002, 6001]);
  });

  it('plans nothing when everything is acknowledged or closed', () => {
    const items = [
      { issue: issue({ number: 1, state: 'closed' }), comments: [] },
      { issue: issue({ number: 2 }), comments: [wake(-40), person(-10)] },
    ];
    expect(planPosts({ items, now: T0 })).toEqual({ planned: [], deferred: [] });
  });
});

describe('ops issue wake (#4681): command line', () => {
  it('defaults to a read-only scan with the documented 30 minute window', () => {
    expect(parseArgs([])).toMatchObject({ mode: 'scan', windowMinutes: 30, maxAgeDays: 7, maxPosts: 5 });
  });

  it('rejects unknown arguments, another repository, bad modes and non-positive numbers', () => {
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
    expect(() => parseArgs(['--repo=someone/else'])).toThrow(/locked/);
    expect(() => parseArgs(['--mode=delete'])).toThrow(/scan or apply/);
    expect(() => parseArgs(['--window-minutes=0'])).toThrow(/positive/);
    expect(() => parseArgs(['--max-posts=abc'])).toThrow(/positive/);
  });
});

describe('ops issue wake (#4681): the workflow', () => {
  const workflow = fs.readFileSync('.github/workflows/ops-issue-wake.yml', 'utf8');

  it('runs on a schedule, on issue open and label, and by hand', () => {
    expect(workflow).toMatch(/cron: '\*\/15 \* \* \* \*'/);
    expect(workflow).toMatch(/types: \[opened, labeled\]/);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it('can only comment: the token has issues write and contents read, and nothing else', () => {
    const permissions = workflow.match(/^permissions:\n((?:  .+\n)+)/m)[1];
    expect(permissions.trim().split('\n').map((l) => l.trim()).sort()).toEqual(['contents: read', 'issues: write']);
  });

  it('applies on the schedule and the issue trigger, and scans by default when run by hand', () => {
    expect(workflow).toMatch(/github\.event_name == 'workflow_dispatch' && github\.event\.inputs\.mode \|\| 'apply'/);
    expect(workflow).toMatch(/default: 'scan'/);
  });

  it('serializes runs so two sweeps cannot post the same wake', () => {
    expect(workflow).toMatch(/group: ops-issue-wake\n\s+cancel-in-progress: false/);
  });

  it('runs only in this repository and only for Operations Issues on the issue trigger', () => {
    expect(workflow).toMatch(/github\.repository == 'wdhunter465\/next-starter-template'/);
    expect(workflow).toMatch(/contains\(github\.event\.issue\.labels\.\*\.name, 'team:operations'\)/);
  });

  it('never uses a pull_request trigger or a secret', () => {
    expect(workflow).not.toMatch(/pull_request/);
    expect(workflow).not.toMatch(/secrets\./);
  });
});
