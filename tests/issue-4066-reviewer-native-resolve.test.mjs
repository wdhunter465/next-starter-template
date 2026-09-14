import { describe, expect, it } from 'vitest';
import {
  evaluateReviewerCommentDisposition,
  resolvedCommentIdsFromReviewThreads,
} from '../scripts/ci/reviewer_comment_disposition.mjs';
import { assessReviewerLifecycle } from '../scripts/ci/reviewer_lifecycle_gate.mjs';

const reviewComments = [
  {
    id: 3914286450,
    user: { login: 'copilot-pull-request-reviewer[bot]' },
    commit_id: 'abc123',
    path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
    line: 10,
    body: 'Please fix this issue.',
    created_at: '2026-09-01T13:00:00Z',
  },
  {
    id: 3914289999,
    in_reply_to_id: 3914286450,
    user: { login: 'implementer' },
    commit_id: 'abc123',
    path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
    line: 10,
    body: 'Accepted. Head abc123 adds the missing sections.',
    created_at: '2026-09-01T13:05:00Z',
  },
];

const resolvedGraphqlThread = {
  id: 'PRRT_kwDOQCj8X86hdaGC',
  isResolved: true,
  isOutdated: false,
  path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
  comments: {
    nodes: [{
      databaseId: 3914286450,
      author: { login: 'copilot-pull-request-reviewer' },
      body: 'Please fix this issue.',
      path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
    }],
  },
};

describe('issue #4066 GraphQL native resolve closeout', () => {
  it('maps resolved GraphQL threads onto REST comment ids', () => {
    const ids = resolvedCommentIdsFromReviewThreads([resolvedGraphqlThread]);
    expect([...ids]).toEqual(['3914286450']);
  });

  it('fails REST-only native resolve because GitHub REST omits is_resolved', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments,
      headSha: 'abc123',
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0].code).toBe('undispositioned_reviewer_comment');
    expect(result.failures[0].commentId).toBe('3914286450');
  });

  it('passes when GraphQL isResolved is wired into disposition', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments,
      reviewThreads: [resolvedGraphqlThread],
      headSha: 'abc123',
    });
    expect(result.ok).toBe(true);
    expect(result.undispositionedCount).toBe(0);
  });

  it('still fails when GraphQL leaves the same REST thread unresolved', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments: [reviewComments[0]],
      reviewThreads: [{
        ...resolvedGraphqlThread,
        isResolved: false,
      }],
      headSha: 'abc123',
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0].code).toBe('undispositioned_reviewer_comment');
  });

  it('passes assessReviewerLifecycle when GraphQL resolved count and disposition agree', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      eventName: 'pull_request_review',
      files: ['scripts/ci/reviewer_lifecycle_gate.mjs'],
      headSha: 'abc123',
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments: [reviewComments[0]],
      reviewThreads: [resolvedGraphqlThread],
    });
    expect(result.shouldFail).toBe(false);
    expect(result.reviewThreads.resolved).toHaveLength(1);
    expect(result.disposition.undispositionedCount).toBe(0);
  });
});
