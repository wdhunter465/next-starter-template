import { describe, expect, it } from 'vitest';
import {
  collectCursorInboundCommunication,
  findUnansweredCursorInbound,
  formatInboundPromptLine,
  isCursorSoftCollaborationReply,
  targetsCursorRole,
} from '../scripts/cursor-wake/cursor-inbound-communication.mjs';

describe('cursor inbound communication (#5379)', () => {
  const now = new Date('2026-11-19T22:00:00.000Z');

  it('detects Cursor as the named target without matching unrelated Cursor Local Bridge text alone when no to-Cursor phrase exists', () => {
    expect(
      targetsCursorRole(
        '## COLLABORATION REQUEST — Claude Code to Cursor (Governance)\nPlease review.',
      ),
    ).toBe(true);
    expect(targetsCursorRole('## COLLABORATION REQUEST\nTarget: Cursor')).toBe(true);
    expect(
      targetsCursorRole(
        'COLLABORATION REQUEST\nTarget agent / role: Cursor, CMO alternate (secondary)',
      ),
    ).toBe(true);
    expect(
      targetsCursorRole('COLLABORATION REQUEST\nTarget agent / role: Cursor\nPlease merge.'),
    ).toBe(true);
    expect(
      targetsCursorRole(
        '## COLLABORATION REQUEST\nCursor Local Bridge eligibility remains label/status-only.',
      ),
    ).toBe(false);
  });

  it('does not treat Cursor-as-requester COLLABORATION REQUEST as Cursor-targeted (#5453)', () => {
    const requesterOnly = `## COLLABORATION REQUEST

Source Issue: #5253
Requesting agent / role: Cursor (Implementation / Operations)
Target agent / role: Claude Code (current \`agent:claude\` claim)

This Issue has a clear Write path.`;
    expect(targetsCursorRole(requesterOnly)).toBe(false);

    expect(
      targetsCursorRole(
        '## RESPONSE\n\nTarget agent: Cursor — none required.\n\nThe COLLABORATION REQUEST targets Claude Code.',
      ),
    ).toBe(false);
  });

  it('treats AGREE / DISSENT / RESPONSE as Cursor soft replies without changing shared detector vocabulary', () => {
    expect(isCursorSoftCollaborationReply('## AGREE — Cursor (Governance)\nChecked.')).toBe(
      true,
    );
    expect(isCursorSoftCollaborationReply('## DISSENT\nReason: path mismatch.')).toBe(true);
    expect(
      isCursorSoftCollaborationReply('## COLLABORATION RESPONSE\nAcknowledged scope.'),
    ).toBe(true);
    expect(
      isCursorSoftCollaborationReply(
        '## RESPONSE\n\nTarget agent: Cursor — none required.\nClearing inbound.',
      ),
    ).toBe(true);
    expect(isCursorSoftCollaborationReply('## COLLABORATION REQUEST\nTarget: Cursor')).toBe(
      false,
    );
  });

  it('does not surface a requester-only COLLABORATION REQUEST after the #5453 target rule', () => {
    const open = findUnansweredCursorInbound(
      [
        {
          id: 300,
          createdAt: '2026-11-19T21:58:00.000Z',
          body: `## COLLABORATION REQUEST

Requesting agent / role: Cursor (Implementation / Operations)
Target agent / role: Claude Code (current claim)

Please KEEP or AGREE handoff.`,
        },
      ],
      { now, issueNumber: 5253 },
    );
    expect(open).toHaveLength(0);
  });

  it('surfaces an unanswered Cursor-targeted request on an Issue claimed by another agent', () => {
    const open = findUnansweredCursorInbound(
      [
        {
          id: 100,
          createdAt: '2026-11-19T21:58:00.000Z',
          body: '## COLLABORATION REQUEST — Claude Code to Cursor (Engineering and Governance roles).\n\nPlease review PR #5376.',
        },
      ],
      { now, issueNumber: 5370 },
    );
    expect(open).toHaveLength(1);
    expect(open[0].event).toBe('COLLABORATION REQUEST');
    expect(open[0].status).toBe('pending_not_stale');
  });

  it('also surfaces stale Cursor-targeted requests past the detector SLO', () => {
    const open = findUnansweredCursorInbound(
      [
        {
          id: 110,
          createdAt: '2026-11-19T21:00:00.000Z',
          body: '## COLLABORATION REQUEST\nTarget: Cursor\nPlease ack.',
        },
      ],
      { now, issueNumber: 4242 },
    );
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe('stale');
  });

  it('does not surface after a Cursor AGREE soft reply', () => {
    const open = findUnansweredCursorInbound(
      [
        {
          id: 100,
          createdAt: '2026-11-19T21:39:00.000Z',
          body: '## COLLABORATION REQUEST — Claude Code to Cursor (Governance).\nPlease review.',
        },
        {
          id: 101,
          createdAt: '2026-11-19T21:45:00.000Z',
          body: '## AGREE — Cursor (Governance / Engineering), independent review of PR #5376\nChecked.',
        },
      ],
      { now, issueNumber: 5370 },
    );
    expect(open).toHaveLength(0);
  });

  it('still surfaces after COMMUNICATION EXCEPTION (exception is not an ack)', () => {
    const open = findUnansweredCursorInbound(
      [
        {
          id: 1,
          createdAt: '2026-11-19T21:00:00.000Z',
          body: '## COLLABORATION REQUEST\nTarget: Cursor',
        },
        {
          id: 2,
          createdAt: '2026-11-19T21:10:00.000Z',
          body: '## COMMUNICATION EXCEPTION\n<!-- lgfc-stale-communication:4242:1 -->',
        },
      ],
      { now, issueNumber: 4242 },
    );
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe('already_surfaced');
    expect(isCursorSoftCollaborationReply('## COMMUNICATION EXCEPTION\nx')).toBe(false);
  });

  it('ignores requests that do not name Cursor', () => {
    const open = findUnansweredCursorInbound(
      [
        {
          id: 200,
          createdAt: '2026-11-19T20:00:00.000Z',
          body: '## COLLABORATION REQUEST — Claude Code to Product Authority.\nNeed a Go.',
        },
      ],
      { now, issueNumber: 999 },
    );
    expect(open).toHaveLength(0);
  });

  it('collectCursorInboundCommunication returns a readyQueue-shaped block', () => {
    const searchIssues = (_repo, phrase) => {
      if (phrase.includes('COLLABORATION REQUEST')) {
        return [{ number: 5370, title: 'Grok role', updatedAt: now.toISOString() }];
      }
      return [];
    };
    const loadComments = () => [
      {
        id: 1,
        createdAt: '2026-11-19T21:00:00.000Z',
        body: '## COLLABORATION REQUEST — to Cursor (Governance)\nReview please.',
        source: 'issue',
      },
    ];
    const block = collectCursorInboundCommunication({
      now,
      searchIssues,
      loadComments,
    });
    expect(block.kind).toBe('cursor-inbound-communication');
    expect(block.actionableCount).toBe(1);
    expect(block.first).toEqual([5370]);
    expect(formatInboundPromptLine(block)).toMatch(/Inbound communication checkpoint/);
    expect(formatInboundPromptLine(block)).toMatch(/#5370:COLLABORATION REQUEST/);
  });

  it('formatInboundPromptLine is empty when nothing is actionable', () => {
    expect(
      formatInboundPromptLine({
        actionableCount: 0,
        actionable: [],
      }),
    ).toBe('');
  });
});
