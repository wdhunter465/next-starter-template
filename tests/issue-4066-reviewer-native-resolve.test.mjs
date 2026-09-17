import { describe, expect, it } from 'vitest';
import {
  evaluateReviewerCommentDisposition,
  resolvedCommentIdsFromReviewThreads,
} from '../scripts/ci/reviewer_comment_disposition.mjs';
import { reviewerDispositionFailures } from '../scripts/ci/post_merge_validator.mjs';
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

describe('issue #4095 post-merge native review-thread regression', () => {
  it('accepts PR #4094 resolved outdated trusted thread without a PR-body ledger', () => {
    const failures = reviewerDispositionFailures({
      body: [
        '## Purpose',
        'Record the governance correction.',
        '## Scope',
        'Bounded report correction.',
        '## Current known truth',
        'The requested correction is present.',
        '## Intended final state',
        'The report remains authoritative.',
      ].join('\n'),
      reviewComments: [{
        id: 3934045985,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'pre-fix-sha',
        path: 'docs/ops/reports/repository-operating-model-analysis-4091.md',
        line: null,
        position: 12,
        body: 'Add Purpose, Scope, Current known truth, and Intended final state.',
        created_at: '2026-09-04T00:00:00Z',
      }],
      reviewThreads: [{
        id: 'PRRT_kwDOQCj8X86fSl2f',
        isResolved: true,
        isOutdated: true,
        comments: { nodes: [{ databaseId: 3934045985 }] },
      }],
      headSha: '233b35e68159bc1eb31a123accc3ffc1bb8c5847',
      mergedAt: '2026-09-05T00:00:00Z',
    });

    expect(failures).toEqual([]);
  });
});

describe('issue #4093 PR #4092 native review-thread regression', () => {
  const stablePrBody = [
    '# PR Summary',
    '- **Issue:** #4091',
    '## Scope',
    'Bounded governance and workflow correction.',
    '## Change Summary',
    'Applied the accepted reviewer fixes.',
    '## Verification',
    'Required checks passed.',
    '## Acceptance Criteria',
    '- [x] Reviewer findings addressed',
  ].join('\n');

  const trustedComments = [3933744715, 3933744763, 3933744804].map((id, index) => ({
    id,
    user: { login: 'copilot-pull-request-reviewer[bot]' },
    commit_id: `pre-fix-sha-${index + 1}`,
    path: index === 0 ? 'AGENTS.md' : `.github/workflows/gate-${index === 1 ? 'quality' : 'model-c'}.yml`,
    line: null,
    position: index + 1,
    body: `Trusted reviewer finding ${index + 1}.`,
    created_at: `2026-09-04T00:0${index}:00Z`,
  }));

  const nativeThreads = trustedComments.map((comment, index) => ({
    id: [
      'PRRT_kwDOQCj8X86fR0uF',
      'PRRT_kwDOQCj8X86fR0un',
      'PRRT_kwDOQCj8X86fR0u_',
    ][index],
    isResolved: true,
    isOutdated: true,
    comments: { nodes: [{ databaseId: comment.id }] },
  }));

  it('accepts all three resolved outdated trusted threads without a PR-body ledger', () => {
    const failures = reviewerDispositionFailures({
      body: stablePrBody,
      reviewComments: trustedComments,
      reviewThreads: nativeThreads,
      headSha: '05437ef35332dd5060e3e797beea9a16deec7bd5',
      mergedAt: '2026-09-04T12:33:25Z',
    });

    expect(failures).toEqual([]);
  });

  it('still fails closed when one of the three trusted threads is unresolved', () => {
    const reviewThreads = nativeThreads.map((thread, index) => (
      index === 1 ? { ...thread, isResolved: false } : thread
    ));

    const failures = reviewerDispositionFailures({
      body: stablePrBody,
      reviewComments: trustedComments,
      reviewThreads,
      headSha: '05437ef35332dd5060e3e797beea9a16deec7bd5',
      mergedAt: '2026-09-04T12:33:25Z',
    });

    expect(failures).toContainEqual(expect.objectContaining({
      code: 'outdated_reviewer_thread_without_disposition',
      commentId: '3933744763',
    }));
  });
});
