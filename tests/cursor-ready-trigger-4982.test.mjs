import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { shouldDeliverCursorWake, hasReadyCursorHandoff } from '../scripts/cursor-bridge/lib/wake-ingress.mjs';

const REPO = 'wdhunter465/next-starter-template';
const labeled = (labelName, issueLabels) => shouldDeliverCursorWake({
  repository: REPO,
  eventName: 'issues',
  action: 'labeled',
  labelName,
  issueLabels,
});

describe('status:ready wakes Cursor (#4982)', () => {
  it('delivers when status:ready is added to a Cursor Issue', () => {
    expect(labeled('status:ready', ['agent:cursor', 'status:ready'])).toEqual({ deliver: true, reason: 'status_ready_on_cursor_issue' });
  });
  it('delivers when agent:cursor is added to an Issue that is already status:ready', () => {
    expect(labeled('agent:cursor', ['agent:cursor', 'status:ready']).deliver).toBe(true);
  });
  it('keeps the handoff:ready path and its reason', () => {
    expect(labeled('handoff:ready', ['agent:cursor', 'handoff:ready'])).toEqual({ deliver: true, reason: 'handoff_ready_on_cursor_issue' });
  });
  it('does not deliver without agent:cursor', () => {
    expect(labeled('status:ready', ['status:ready', 'team:engineering'])).toEqual({ deliver: false, reason: 'absent_cursor_routing' });
  });
  it('does not deliver when another agent holds the Issue', () => {
    expect(labeled('status:ready', ['agent:claude', 'status:ready']).deliver).toBe(false);
  });
  it('fails closed on conflicting agent labels', () => {
    expect(labeled('status:ready', ['agent:cursor', 'agent:claude', 'status:ready']).deliver).toBe(false);
  });
  it('ignores the other queue-state labels', () => {
    for (const name of ['wait:product', 'wait:review', 'wait:dependency', 'status:active']) {
      expect(labeled(name, ['agent:cursor', 'status:ready', name]).reason).toBe('unrelated_issue_label_event');
    }
  });
  it('needs one ready label, not just the agent label', () => {
    expect(hasReadyCursorHandoff({ labels: ['agent:cursor'] })).toBe(false);
    expect(hasReadyCursorHandoff({ labels: ['agent:cursor', 'status:ready'] })).toBe(true);
  });
});

describe('dispatch workflow conditions (#4982)', () => {
  const wf = fs.readFileSync(path.join(__dirname, '../.github/workflows/lgfc-cursor-dispatch.yml'), 'utf8');
  it('matches status:ready as an exact label in both jobs, never as a substring', () => {
    expect(wf.match(/',status:ready,'/g)).toHaveLength(2);
    expect(wf.match(/format\(',\{0\},'/g)).toHaveLength(2);
    const exact = (labels) => `,${labels.join(',')},`.includes(',status:ready,');
    expect(exact(['agent:cursor', 'status:ready'])).toBe(true);
    expect(exact(['agent:cursor', 'status:ready-for-cursor'])).toBe(false);
  });
  it('still requires agent:cursor and an open Issue in both jobs', () => {
    expect(wf.match(/github\.event\.issue\.state == 'open'/g)).toHaveLength(2);
    expect(wf.match(/contains\(join\(github\.event\.issue\.labels\.\*\.name, ','\), 'agent:cursor'\)/g)).toHaveLength(2);
  });
  it('stays label-driven and never runs on pull_request triggers', () => {
    const onBlock = wf.match(/^on:\n([\s\S]*?)\n\npermissions:/m)?.[1] || '';
    expect(onBlock).not.toMatch(/pull_request/);
    expect(onBlock).toMatch(/types: \[labeled\]/);
  });
});
