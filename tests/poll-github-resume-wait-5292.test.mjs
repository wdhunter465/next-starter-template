import { describe, expect, it } from 'vitest';
import {
  applyIssueWaitLabelsToResumeQueue,
  mergeIssuesByNumber,
} from '../scripts/cursor-wake/poll-github.mjs';

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

  it('marks ops_interrupt wait:dependency when opsPool is in the issue map (#5430)', () => {
    const items = [
      {
        kind: 'ops_interrupt',
        number: 4421,
        title: 'Launch-readiness run',
        detail: 'ops:priority:2',
        rank: 2,
      },
    ];
    applyIssueWaitLabelsToResumeQueue(
      items,
      mergeIssuesByNumber(
        [
          {
            number: 4421,
            labels: [
              { name: 'team:operations' },
              { name: 'ops:priority:2' },
              { name: 'wait:dependency' },
            ],
          },
        ],
        [],
        [],
      ),
    );
    expect(items[0].waiting).toBe(true);
    expect(items[0].waitingReason).toBe('wait_labels:wait:dependency');
  });

  it('mergeIssuesByNumber prefers later list for the same number (#5430)', () => {
    const merged = mergeIssuesByNumber(
      [{ number: 1, labels: [{ name: 'wait:dependency' }] }],
      [{ number: 1, labels: [{ name: 'wait:product' }, { name: 'agent:cursor' }] }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].labels.map((l) => l.name)).toEqual(['wait:product', 'agent:cursor']);
  });

  it('marks ops_interrupt with status:hold as waiting (#5444)', () => {
    const items = [
      {
        kind: 'ops_interrupt',
        number: 4440,
        title: 'Production bindings evidence',
        detail: 'ops:priority:3',
        rank: 3,
      },
    ];
    applyIssueWaitLabelsToResumeQueue(items, [
      {
        number: 4440,
        labels: [
          { name: 'team:operations' },
          { name: 'ops:priority:3' },
          { name: 'status:hold' },
          { name: 'agent:cursor' },
        ],
      },
    ]);
    expect(items[0].waiting).toBe(true);
    expect(items[0].waitingReason).toBe('status:hold');
  });

  it('combines wait:* and status:hold in waitingReason (#5444)', () => {
    const items = [{ kind: 'ops_interrupt', number: 9, title: 'held+wait' }];
    applyIssueWaitLabelsToResumeQueue(items, [
      {
        number: 9,
        labels: [{ name: 'wait:product' }, { name: 'status:hold' }],
      },
    ]);
    expect(items[0].waiting).toBe(true);
    expect(items[0].waitingReason).toBe('wait_labels:wait:product+status:hold');
  });
});
