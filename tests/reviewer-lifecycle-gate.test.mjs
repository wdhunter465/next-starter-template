import { describe, expect, it } from 'vitest';
import {
  evaluateReviewerCommentDisposition,
  resolvedCommentIdsFromReviewThreads,
} from '../scripts/ci/reviewer_comment_disposition.mjs';
import {
  assessReviewerLifecycle,
  buildReviewerLifecycleReport,
  hasExceptionLabel,
  isProtectedPath,
  isTrustedReviewer,
  latestReviewByAuthor,
  unresolvedReviewThreads,
} from '../scripts/ci/reviewer_lifecycle_gate.mjs';

describe('native lifecycle assessment', () => {
  it('uses the latest review state per author', () => {
    const latest = latestReviewByAuthor([
      { author: { login: 'reviewer-a' }, state: 'COMMENTED', submittedAt: '2026-07-01T00:00:00Z' },
      { author: { login: 'reviewer-a' }, state: 'APPROVED', submittedAt: '2026-07-02T00:00:00Z' },
    ]);

    expect(latest.get('reviewer-a').state).toBe('APPROVED');
  });

  it('passes without review findings', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      files: ['src/app/page.tsx'],
      reviews: [],
      reviewThreads: [],
    });

    expect(result.shouldFail).toBe(false);
    expect(result.assessment.ok).toBe(true);
  });

  it('requires action for unresolved human threads', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      files: ['src/app/page.tsx'],
      reviewThreads: [{
        id: 'thread-1',
        isResolved: false,
        isOutdated: false,
        path: 'src/app/page.tsx',
        comments: { nodes: [{ author: { login: 'reviewer-a' }, body: 'Please update this.' }] },
      }],
    });

    expect(result.shouldFail).toBe(true);
    expect(result.assessment.reason).toBe('unresolved-human-review-thread');
  });

  it('ignores resolved GraphQL threads while disposition audit still covers outdated comments', () => {
    const state = unresolvedReviewThreads([
      {
        id: 'resolved-thread',
        isResolved: true,
        isOutdated: false,
        comments: { nodes: [{ author: { login: 'reviewer-a' }, body: 'Resolved.' }] },
      },
      {
        id: 'outdated-thread',
        isResolved: false,
        isOutdated: true,
        comments: { nodes: [{ author: { login: 'reviewer-a' }, body: 'Old note.' }] },
      },
    ]);

    expect(state.blocking).toEqual([]);
    expect(state.resolved).toHaveLength(1);
    expect(state.outdated).toHaveLength(1);
  });

  it('does not fail disposition when GraphQL resolved a thread REST comments cannot mark (#4066)', () => {
    const result = assessReviewerLifecycle({
      eventName: 'pull_request',
      labels: ['change-ops'],
      files: ['scripts/ci/reviewer_lifecycle_gate.mjs'],
      enforceFailure: true,
      headSha: 'abc123',
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments: [{
        id: 3914286450,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'abc123',
        path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
        line: 12,
        body: 'Please fix this issue.',
        created_at: '2026-09-01T13:00:00Z',
      }],
      reviewThreads: [{
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
      }],
    });

    expect(result.shouldFail).toBe(false);
    expect(result.disposition.undispositionedCount).toBe(0);
    expect(result.reviewThreads.resolved).toHaveLength(1);
  });

  it('fails the same REST thread when GraphQL isResolved is omitted (#4066)', () => {
    const reviewComments = [{
      id: 3914286450,
      user: { login: 'copilot-pull-request-reviewer[bot]' },
      commit_id: 'abc123',
      path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
      line: 12,
      body: 'Please fix this issue.',
      created_at: '2026-09-01T13:00:00Z',
    }, {
      id: 3914289999,
      in_reply_to_id: 3914286450,
      user: { login: 'implementer' },
      commit_id: 'abc123',
      path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
      line: 12,
      body: 'Accepted. Head abc123 adds the missing sections.',
      created_at: '2026-09-01T13:05:00Z',
    }];

    const withoutGraphql = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments,
      headSha: 'abc123',
    });
    expect(withoutGraphql.ok).toBe(false);
    expect(withoutGraphql.failures[0].code).toBe('undispositioned_reviewer_comment');

    const unresolvedGraphql = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments,
      reviewThreads: [{
        isResolved: false,
        comments: { nodes: [{ databaseId: 3914286450 }] },
      }],
      headSha: 'abc123',
    });
    expect(unresolvedGraphql.ok).toBe(false);

    const resolvedIds = resolvedCommentIdsFromReviewThreads([{
      isResolved: true,
      comments: { nodes: [{ databaseId: 3914286450 }] },
    }]);
    expect(resolvedIds.has('3914286450')).toBe(true);
  });

  it('does not fail closed on outdated trusted review comments without disposition pre-merge (#3281 E)', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      files: ['scripts/ci/reviewer_lifecycle_gate.mjs'],
      headSha: 'new-sha',
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed only',
      reviewComments: [{
        id: 2002,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
        line: 12,
        body: 'Outdated finding on prior commit.',
        created_at: '2026-06-01T00:00:00Z',
      }],
    });

    expect(result.shouldFail).toBe(false);
    expect(result.disposition.outdatedWithoutDispositionCount).toBe(0);
  });

  it('passes when outdated trusted review comments have explicit dispositions', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      files: ['scripts/ci/reviewer_lifecycle_gate.mjs'],
      headSha: 'new-sha',
      body: [
        '## REVIEWER RESPONSE ACCOUNTING',
        '- review-comment:2003 — acknowledged — Superseded by refactor — thread state: outdated',
      ].join('\n'),
      reviewComments: [{
        id: 2003,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
        line: 14,
        body: 'Please update this helper.',
        created_at: '2026-06-01T00:00:00Z',
      }],
    });

    expect(result.shouldFail).toBe(false);
    expect(result.assessment.ok).toBe(true);
  });

  it('keeps trusted bot threads advisory by default', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      files: ['scripts/ci/reviewer_lifecycle_gate.mjs'],
      reviewThreads: [{
        id: 'bot-thread',
        isResolved: false,
        isOutdated: false,
        path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
        comments: { nodes: [{ author: { login: 'cubic-dev-ai[bot]' }, body: 'Advisory note.' }] },
      }],
    });

    expect(result.shouldFail).toBe(false);
    expect(result.assessment.severity).toBe('advisory');
  });

  it('supports exception labels', () => {
    expect(hasExceptionLabel(['Reviewer-Lifecycle-Exception'], 'reviewer-lifecycle-exception')).toBe(true);
  });

  it('fails closed on incomplete pagination', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      paginationFailures: ['pagination incomplete'],
    });

    expect(result.shouldFail).toBe(true);
    expect(result.assessment.reason).toBe('pagination-incomplete');
  });

  it('renders report without legacy ledger syntax', () => {
    const result = assessReviewerLifecycle({
      enforceFailure: true,
      files: ['src/app/page.tsx'],
      reviewThreads: [{
        id: 'thread-1',
        isResolved: false,
        isOutdated: false,
        comments: { nodes: [{ author: { login: 'reviewer-a' }, body: 'Please update this.' }] },
      }],
    });
    const report = buildReviewerLifecycleReport(result);

    expect(report).toContain('GitHub-native review state');
    expect(report).toContain('PR body is not used as a reviewer comment ledger');
    expect(report).not.toContain('review-comment:');
  });

  it('detects protected paths', () => {
    expect(isProtectedPath('scripts/ci/reviewer_lifecycle_gate.mjs')).toBe(true);
    expect(isProtectedPath('.github/workflows/reviewer-response-completion.yml')).toBe(true);
    expect(isProtectedPath('src/app/page.tsx')).toBe(false);
  });

  it('accepts configured trusted bot logins', () => {
    const trusted = new Set(['custom-bot']);
    expect(isTrustedReviewer('custom-bot', trusted)).toBe(true);
    expect(isTrustedReviewer('reviewer-a', trusted)).toBe(false);
  });
});
