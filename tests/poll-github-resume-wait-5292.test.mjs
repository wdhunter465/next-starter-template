import { describe, expect, it } from 'vitest';
import { applyIssueWaitLabelsToResumeQueue } from '../scripts/cursor-wake/poll-github.mjs';

describe('poll-github resumeQueue wait:* (#5292)', () => {
  it('marks an active Cursor Issue with wait:product as waiting', () => {
    const items = [
      {
        kind: 'agent_cursor_active',
        number: 4589,
        title: 'Halt after 3 failures',
        waiting: false,
      },
      {
        kind: 'authored_pr_gates',
        number: 5290,
        title: 'docs PR',
        detail: 'PENDING',
      },
    ];
    const issues = [
      {
        number: 4589,
        labels: [{ name: 'agent:cursor' }, { name: 'status:active' }, { name: 'wait:product' }],
      },
    ];
    applyIssueWaitLabelsToResumeQueue(items, issues);
    expect(items[0].waiting).toBe(true);
    expect(items[0].waitingReason).toBe('wait_labels:wait:product');
    expect(items[1].waiting).toBeUndefined();
  });

  it('leaves Issues without wait:* executable', () => {
    const items = [{ kind: 'agent_cursor_active', number: 1, title: 'open work' }];
    applyIssueWaitLabelsToResumeQueue(items, [
      { number: 1, labels: [{ name: 'agent:cursor' }, { name: 'status:active' }] },
    ]);
    expect(items[0].waiting).toBeUndefined();
  });

  it('preserves an existing waitingReason (e.g. handoff)', () => {
    const items = [
      {
        kind: 'handoff_ready',
        number: 2,
        waiting: true,
        waitingReason: 'handoff_ready_not_go',
      },
    ];
    applyIssueWaitLabelsToResumeQueue(items, [
      { number: 2, labels: [{ name: 'wait:schedule' }, { name: 'handoff:ready' }] },
    ]);
    expect(items[0].waitingReason).toBe('handoff_ready_not_go');
  });
});
