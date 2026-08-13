#!/usr/bin/env node

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  classifyProtectedScope,
  isEnforcingReviewerLifecycleEvent,
} from './reviewer-gate-simulation.mjs';
import {
  hasValidDisposition,
  parseReviewerDispositions,
} from './reviewer_comment_disposition.mjs';

export { isEnforcingReviewerLifecycleEvent } from './reviewer-gate-simulation.mjs';

import {
  DEFAULT_TRUSTED_BOT_LOGINS,
  isResolvedReviewText,
  isTrustedReviewer,
  parseTrustedBotLogins,
  trustedBotSet,
} from './reviewer_trusted_bots.mjs';
import { evaluateReviewerCommentDisposition } from './reviewer_comment_disposition.mjs';
import {
  GitHubInfrastructureError,
  formatAttemptEvidence,
  githubApiFetch,
} from './github_api_retry.mjs';

export {
  DEFAULT_TRUSTED_BOT_LOGINS,
  isTrustedReviewer,
  parseTrustedBotLogins,
  trustedBotSet,
} from './reviewer_trusted_bots.mjs';

export { GitHubInfrastructureError } from './github_api_retry.mjs';

export const DEFAULT_EXCEPTION_LABEL = 'reviewer-lifecycle-exception';
export const BREAK_GLASS_MARKER = /<!--\s*reviewer-lifecycle-break-glass\s*-->/i;
const LINKED_REVIEW_STATES = new Set(['APPROVED', 'COMMENTED']);

const DISPOSITION_FAILURE_CODE_MAP = {
  undispositioned_reviewer_comment: 'undispositioned-reviewer-comment',
  outdated_reviewer_thread_without_disposition: 'outdated-reviewer-thread-without-disposition',
  late_undispositioned_reviewer_comment: 'late-undispositioned-reviewer-comment',
};

function mapDispositionFailureCode(code = '') {
  return DISPOSITION_FAILURE_CODE_MAP[code] || String(code || 'reviewer-disposition-failure').replaceAll('_', '-');
}

export function isProtectedPath(filePath = '') {
  return filePath.startsWith('.github/workflows/') || filePath.startsWith('scripts/ci/');
}

function timestamp(value = '') {
  return Date.parse(value || '') || 0;
}

function normalizeActorIdentity(value = '') {
  return String(value || '').trim().toLowerCase();
}

function attestedField(body = '', field = '') {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(body || '').match(new RegExp(`^\\s*-?\\s*${escaped}\\s*:\\s*(.+?)\\s*$`, 'im'))?.[1]?.trim() || '';
}

export function parseImplementationActor(body = '') {
  return attestedField(body, 'Implementation agent');
}

export function reviewerActor(review = {}) {
  return attestedField(review.body || '', 'Reviewer actor')
    || review.author?.login
    || review.user?.login
    || '';
}

export function isActorApprovalReview(review = {}) {
  const decision = attestedField(review.body || '', 'Decision');
  return String(decision || review.state || '').trim().toUpperCase() === 'APPROVED';
}

function latestReviewByActor(reviews = []) {
  const latest = new Map();
  for (const review of reviews) {
    const actor = normalizeActorIdentity(reviewerActor(review));
    if (!actor) continue;
    const submittedAt = review.submittedAt || review.submitted_at || review.created_at || '';
    const current = latest.get(actor);
    if (!current || timestamp(submittedAt) >= timestamp(current.submittedAt || current.submitted_at || current.created_at || '')) {
      latest.set(actor, review);
    }
  }
  return latest;
}

export function assessActorIndependentApproval({
  implementationActor = '',
  implementationLogin = '',
  reviews = [],
  requireActorIndependentApproval = false,
} = {}) {
  if (!requireActorIndependentApproval) return [];

  const implementationIdentity = implementationActor || implementationLogin;
  const implementer = normalizeActorIdentity(implementationIdentity);
  if (!implementer) {
    return [{
      code: 'ambiguous-implementation-identity',
      message: 'Implementation identity is required for actor-independent approval.',
    }];
  }

  const approvedReviews = [...latestReviewByActor(reviews).values()].filter(isActorApprovalReview);
  const hasIndependentApproval = approvedReviews.some(
    (review) => normalizeActorIdentity(reviewerActor(review)) !== implementer,
  );
  if (hasIndependentApproval) return [];

  const hasSelfApproval = approvedReviews.some(
    (review) => normalizeActorIdentity(reviewerActor(review)) === implementer,
  );
  return hasSelfApproval
    ? [{
        code: 'implementer-self-approval',
        message: `${implementationIdentity} cannot satisfy the required approval for its own implementation.`,
      }]
    : [];
}

export function latestReviewByAuthor(reviews = []) {
  const latest = new Map();
  for (const review of reviews) {
    const author = review.author?.login || review.user?.login || '';
    if (!author) continue;
    const submittedAt = review.submittedAt || review.submitted_at || review.created_at || '';
    const current = latest.get(author);
    if (!current || timestamp(submittedAt) >= timestamp(current.submittedAt || current.submitted_at || current.created_at || '')) {
      latest.set(author, review);
    }
  }
  return latest;
}

export function humanChangesRequested(reviews = [], trustedBots = trustedBotSet()) {
  const blockers = [];
  for (const [author, review] of latestReviewByAuthor(reviews)) {
    if (isTrustedReviewer(author, trustedBots)) continue;
    if (String(review.state || '').toUpperCase() !== 'CHANGES_REQUESTED') continue;
    blockers.push({
      author,
      submittedAt: review.submittedAt || review.submitted_at || review.created_at || '',
      state: review.state,
    });
  }
  return blockers;
}

function firstThreadComment(thread = {}) {
  if (thread.firstComment) return thread.firstComment;
  const comments = thread.comments?.nodes || thread.comments || [];
  return Array.isArray(comments) ? comments[0] || {} : {};
}

function threadAuthor(thread = {}) {
  const first = firstThreadComment(thread);
  return first.author?.login || first.user?.login || '';
}

function threadExcerpt(thread = {}) {
  const first = firstThreadComment(thread);
  return String(first.body || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function hasExceptionLabel(labels = [], exceptionLabel = DEFAULT_EXCEPTION_LABEL) {
  const target = String(exceptionLabel || '').toLowerCase();
  return labels
    .map((label) => (typeof label === 'string' ? label : label?.name || ''))
    .map((label) => label.toLowerCase())
    .includes(target);
}

export function hasProtectedScopeBreakGlass({ labels = [], body = '' } = {}) {
  const names = labels.map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean);
  return names.includes('recovery') && BREAK_GLASS_MARKER.test(body || '');
}

function isTrustedReviewLinkedToHead(review, headSha, trustedBots = trustedBotSet()) {
  const login = review.user?.login || review.author?.login || '';
  return isTrustedReviewer(login, trustedBots)
    && Boolean(review.commit_id)
    && review.commit_id === headSha
    && review.state !== 'PENDING'
    && review.state !== 'DISMISSED'
    && LINKED_REVIEW_STATES.has(review.state);
}

function isTrustedCommentLinkedToHead(comment, headSha, trustedBots = trustedBotSet()) {
  return isTrustedReviewer(comment.user?.login || comment.author?.login || '', trustedBots)
    && Boolean(comment.commit_id)
    && comment.commit_id === headSha;
}

export function computeCurrentHeadLinkedReview({ reviews = [], reviewComments = [], headSha = '' } = {}) {
  if (!headSha) return false;
  const trustedBots = trustedBotSet();
  return reviews.some((review) => isTrustedReviewLinkedToHead(review, headSha, trustedBots))
    || reviewComments.some((comment) => isTrustedCommentLinkedToHead(comment, headSha, trustedBots));
}

export function hasStaleTrustedReviewOnly({ reviews = [], reviewComments = [], headSha = '' } = {}) {
  if (!headSha) return false;
  if (computeCurrentHeadLinkedReview({ reviews, reviewComments, headSha })) return false;
  const trustedBots = trustedBotSet();
  return reviews.some((review) => isTrustedReviewer(review.user?.login || review.author?.login || '', trustedBots) && review.commit_id && review.commit_id !== headSha)
    || reviewComments.some((comment) => isTrustedReviewer(comment.user?.login || comment.author?.login || '', trustedBots) && comment.commit_id && comment.commit_id !== headSha);
}

function resolveThreadRootId(comment, commentsById) {
  let current = comment;
  const visited = new Set();
  while (current?.in_reply_to_id) {
    if (visited.has(current.in_reply_to_id)) return current.in_reply_to_id;
    visited.add(current.in_reply_to_id);
    const parent = commentsById.get(current.in_reply_to_id);
    if (!parent) return current.in_reply_to_id;
    current = parent;
  }
  return current.id;
}

function sortCommentsChronologically(comments) {
  return [...comments].sort((left, right) => {
    const leftTime = timestamp(left.created_at || '');
    const rightTime = timestamp(right.created_at || '');
    if (leftTime !== rightTime) return leftTime - rightTime;
    return (left.id || 0) - (right.id || 0);
  });
}

export function countUnresolvedProtectedThreads({ reviewComments = [], reviews = [], body = '' } = {}) {
  let unresolved = 0;
  const trustedBots = trustedBotSet();
  const dispositions = parseReviewerDispositions(body);
  const validComments = reviewComments.filter((comment) => comment?.id != null);
  const commentsById = new Map(validComments.map((comment) => [comment.id, comment]));
  const threads = new Map();

  for (const comment of validComments) {
    const threadId = resolveThreadRootId(comment, commentsById);
    if (!threads.has(threadId)) threads.set(threadId, []);
    threads.get(threadId).push(comment);
  }

  for (const comments of threads.values()) {
    const orderedComments = sortCommentsChronologically(comments);
    const firstComment = orderedComments[0];
    const latestComment = orderedComments[orderedComments.length - 1];
    const user = firstComment.user?.login || '';
    const path = firstComment.path || '';
    const threadId = String(resolveThreadRootId(firstComment, commentsById));
    if (!isTrustedReviewer(user, trustedBots)) continue;
    if (!isProtectedPath(path)) continue;
    if (firstComment.line == null && firstComment.position == null) continue;
    if (hasValidDisposition(dispositions.get(threadId))) continue;
    if (isResolvedReviewText(latestComment.body || '')) continue;
    unresolved += 1;
  }

  for (const review of latestReviewByAuthor(reviews).values()) {
    if (!isTrustedReviewer(review.user?.login || review.author?.login || '', trustedBots)) continue;
    if (review.state !== 'CHANGES_REQUESTED') continue;
    if (isResolvedReviewText(review.body || '')) continue;
    unresolved += 1;
  }

  return unresolved;
}

export function countAdvisoryFindings({ issueComments = [], reviewComments = [], reviews = [] } = {}) {
  const trustedBots = trustedBotSet();
  return [...issueComments, ...reviewComments, ...reviews]
    .filter((item) => isTrustedReviewer(item.user?.login || item.author?.login || '', trustedBots))
    .filter((item) => !isResolvedReviewText(item.body || ''))
    .length;
}

export function unresolvedReviewThreads(reviewThreads = [], { trustedBots = trustedBotSet(), labels = [], exceptionLabel = DEFAULT_EXCEPTION_LABEL } = {}) {
  const exceptionActive = hasExceptionLabel(labels, exceptionLabel);
  const blocking = [];
  const advisory = [];
  const outdated = [];
  const resolved = [];

  for (const thread of reviewThreads) {
    const author = threadAuthor(thread);
    const trusted = isTrustedReviewer(author, trustedBots);
    const detail = {
      id: thread.id || '',
      author,
      trusted,
      isResolved: Boolean(thread.isResolved),
      isOutdated: Boolean(thread.isOutdated),
      path: thread.path || firstThreadComment(thread).path || '',
      excerpt: threadExcerpt(thread),
    };

    if (detail.isResolved) {
      resolved.push(detail);
      continue;
    }

    if (detail.isOutdated) {
      outdated.push(detail);
      continue;
    }

    if (trusted && exceptionActive) {
      advisory.push({ ...detail, exceptionActive: true });
      continue;
    }

    if (trusted) {
      advisory.push(detail);
      continue;
    }

    blocking.push(detail);
  }

  return { blocking, advisory, outdated, resolved };
}

export function pageInfoFailure(pageInfo = {}, label = 'result') {
  return pageInfo?.hasNextPage ? `${label} pagination not supported; refusing to make an incomplete reviewer lifecycle decision.` : '';
}

export function assessReviewerLifecycle({
  eventName = 'pull_request_target',
  labels = [],
  files = [],
  reviews = [],
  reviewThreads = [],
  trustedBotLogins = DEFAULT_TRUSTED_BOT_LOGINS,
  exceptionLabel = DEFAULT_EXCEPTION_LABEL,
  implementationActor = '',
  implementationLogin = '',
  requireActorIndependentApproval = false,
  enforceFailure = isEnforcingReviewerLifecycleEvent(eventName),
  paginationFailures = [],
  body = '',
  reviewComments = [],
  issueComments = [],
  headSha = '',
  readyForReviewAt = '',
} = {}) {
  const trustedBots = trustedBotSet(trustedBotLogins);
  const scope = classifyProtectedScope(files);
  const humanReviewBlockers = humanChangesRequested(reviews, trustedBots);
  const threadState = unresolvedReviewThreads(reviewThreads, {
    trustedBots,
    labels,
    exceptionLabel,
  });
  const disposition = evaluateReviewerCommentDisposition({
    body,
    issueComments: Array.isArray(issueComments) ? issueComments : [],
    reviewComments: Array.isArray(reviewComments) ? reviewComments : [],
    reviews: Array.isArray(reviews) ? reviews : [],
    headSha,
    readyForReviewAt,
    auditPhase: 'pre_merge',
  });
  const dispositionBlockers = (disposition.failures || []).map((failure) => ({
    code: mapDispositionFailureCode(failure.code),
    message: failure.message,
    commentId: failure.commentId,
  }));
  const blockingReasons = [
    ...paginationFailures.filter(Boolean).map((message) => ({ code: 'pagination-incomplete', message })),
    ...assessActorIndependentApproval({
      implementationActor: implementationActor || implementationLogin,
      reviews,
      requireActorIndependentApproval,
    }),
    ...humanReviewBlockers.map((review) => ({ code: 'human-changes-requested', message: `${review.author} latest review is CHANGES_REQUESTED.` })),
    ...threadState.blocking.map((thread) => ({ code: 'unresolved-human-review-thread', message: `${thread.author || 'unknown'} unresolved thread${thread.path ? ` on ${thread.path}` : ''}: ${thread.excerpt}` })),
    ...dispositionBlockers,
  ];

  const ok = blockingReasons.length === 0;

  return {
    scope,
    labels,
    trustedBotLogins: [...trustedBots],
    exceptionLabel,
    exceptionActive: hasExceptionLabel(labels, exceptionLabel),
    humanChangesRequested: humanReviewBlockers,
    reviewThreads: threadState,
    disposition,
    blockingReasons,
    advisoryFindings: threadState.advisory.length,
    enforceFailure,
    headSha,
    assessment: {
      ok,
      severity: ok ? (threadState.advisory.length > 0 ? 'advisory' : 'none') : 'blocking',
      reason: ok ? 'github-native-review-state-ok' : blockingReasons[0].code,
    },
    shouldFail: enforceFailure && !ok,
  };
}

export function buildReviewerLifecycleArtifact(result) {
  return {
    gate: 'reviewer-lifecycle',
    schemaVersion: 2,
    advisory: !result.enforceFailure,
    ok: result.assessment.ok,
    severity: result.assessment.severity,
    reason: result.assessment.reason,
    enforceFailure: result.enforceFailure,
    humanChangesRequested: result.humanChangesRequested.length,
    unresolvedHumanThreads: result.reviewThreads.blocking.length,
    advisoryThreads: result.reviewThreads.advisory.length,
    outdatedThreads: result.reviewThreads.outdated.length,
    resolvedThreads: result.reviewThreads.resolved.length,
    dispositionFailures: result.disposition?.failures?.length || 0,
    outdatedWithoutDisposition: result.disposition?.outdatedWithoutDispositionCount || 0,
    blockingReasons: result.blockingReasons,
    headSha: result.headSha || '',
  };
}

export function writeReviewerLifecycleArtifacts(result, env = process.env) {
  const artifact = buildReviewerLifecycleArtifact(result);
  const jsonPath = env.REVIEWER_LIFECYCLE_RESULT_JSON || env.PR_VALIDATION_RESULT_JSON;
  const markdownPath = env.REVIEWER_LIFECYCLE_RESULT_MD;

  if (jsonPath) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }
  if (markdownPath) {
    fs.writeFileSync(markdownPath, `${result.report}\n`);
  }

  return artifact;
}

export function buildReviewerLifecycleReport(result) {
  const lines = [
    result.assessment.ok
      ? 'Reviewer lifecycle gate passed.'
      : result.enforceFailure
        ? 'Reviewer lifecycle gate failed.'
        : 'Reviewer lifecycle gate advisory refreshed.',
    '',
    'Reviewer lifecycle is evaluated from GitHub-native review state and review-thread state.',
    'The PR body is not used as a reviewer comment ledger.',
    '',
    `Protected scope: ${result.scope.hasProtectedScope ? 'yes' : 'no'}`,
    `Human latest CHANGES_REQUESTED reviews: ${result.humanChangesRequested.length}`,
    `Unresolved human review threads: ${result.reviewThreads.blocking.length}`,
    `Trusted/advisory review threads: ${result.reviewThreads.advisory.length}`,
    `Outdated review threads: ${result.reviewThreads.outdated.length}`,
    `Resolved review threads: ${result.reviewThreads.resolved.length}`,
    `Disposition failures: ${result.disposition?.failures?.length || 0}`,
    `Outdated without disposition: ${result.disposition?.outdatedWithoutDispositionCount || 0}`,
    `Trusted-bot exception label: ${result.exceptionLabel}`,
    `Trusted-bot exception active: ${result.exceptionActive ? 'yes' : 'no'}`,
    `Assessment severity: ${result.assessment.severity}`,
    `Assessment reason: ${result.assessment.reason}`,
    `Enforcing event: ${result.enforceFailure ? 'yes' : 'no'}`,
  ];

  if (result.blockingReasons.length) {
    lines.push('', '## Blocking reviewer lifecycle findings');
    for (const finding of result.blockingReasons) {
      lines.push(`- ${finding.code}: ${finding.message}`);
    }
  }

  if (result.reviewThreads.advisory.length) {
    lines.push('', '## Advisory trusted-bot review threads');
    for (const thread of result.reviewThreads.advisory.slice(0, 20)) {
      lines.push(`- ${thread.author || 'unknown'}${thread.path ? ` on ${thread.path}` : ''}: ${thread.excerpt || 'no excerpt'}`);
    }
  }

  return lines.join('\n');
}

async function request(path, token, options = {}) {
  const method = options.method || 'GET';
  const { response, bodyText, attemptLog } = await githubApiFetch({
    url: `https://api.github.com${path}`,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-reviewer-lifecycle-gate',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
    maxRetries: options.maxRetries,
    initialBackoffMs: options.initialBackoffMs,
    maxBackoffMs: options.maxBackoffMs,
    sleepFn: options.sleepFn,
    fetchFn: options.fetchFn,
    pathLabel: path,
  });

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${bodyText || ''}`);
  }

  if (attemptLog.length) {
    console.warn(`GitHub API retry evidence for ${method} ${path}:\n${formatAttemptEvidence(attemptLog)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function paginate(path, token) {
  const results = [];
  let page = 1;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const data = await request(`${path}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page += 1;
  }

  return results;
}

async function graphql(query, variables, token, options = {}) {
  const { response, bodyText, attemptLog } = await githubApiFetch({
    url: 'https://api.github.com/graphql',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'lgfc-reviewer-lifecycle-gate',
    },
    body: JSON.stringify({ query, variables }),
    maxRetries: options.maxRetries,
    initialBackoffMs: options.initialBackoffMs,
    maxBackoffMs: options.maxBackoffMs,
    sleepFn: options.sleepFn,
    fetchFn: options.fetchFn,
    pathLabel: '/graphql',
  });

  if (attemptLog.length) {
    console.warn(`GitHub API retry evidence for POST /graphql:\n${formatAttemptEvidence(attemptLog)}`);
  }

  let data;
  try {
    data = bodyText ? JSON.parse(bodyText) : await response.json();
  } catch {
    data = bodyText || null;
  }

  if (!response.ok || data?.errors?.length) {
    throw new Error(`GraphQL request failed: ${response.status} ${JSON.stringify(data?.errors || data || bodyText)}`);
  }
  return data.data;
}

export async function fetchNativeReviewState({ owner, repo, prNumber, token }) {
  const query = `
    query ReviewerLifecycle($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          labels(first: 100) { nodes { name } pageInfo { hasNextPage } }
          reviews(first: 100) { nodes { author { login } body state submittedAt } pageInfo { hasNextPage } }
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              isOutdated
              path
              comments(first: 1) { nodes { author { login } body path } }
            }
            pageInfo { hasNextPage }
          }
        }
      }
    }
  `;
  const data = await graphql(query, { owner, repo, number: Number(prNumber) }, token);
  const pr = data.repository?.pullRequest;
  if (!pr) throw new Error(`PR #${prNumber} not found.`);

  const paginationFailures = [
    pageInfoFailure(pr.labels?.pageInfo, 'label'),
    pageInfoFailure(pr.reviews?.pageInfo, 'review'),
    pageInfoFailure(pr.reviewThreads?.pageInfo, 'review thread'),
  ].filter(Boolean);

  return {
    labels: (pr.labels?.nodes || []).map((label) => label.name),
    reviews: pr.reviews?.nodes || [],
    reviewThreads: pr.reviewThreads?.nodes || [],
    paginationFailures,
  };
}

export async function runReviewerLifecycleGate({
  token,
  owner,
  repo,
  prNumber,
  eventName = 'pull_request_target',
  enforceFailure = isEnforcingReviewerLifecycleEvent(eventName),
  trustedBotLogins = DEFAULT_TRUSTED_BOT_LOGINS,
  exceptionLabel = DEFAULT_EXCEPTION_LABEL,
}) {
  const pull = await request(`/repos/${owner}/${repo}/pulls/${prNumber}`, token);
  const [files, nativeState, reviewComments, issueComments] = await Promise.all([
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/files`, token),
    fetchNativeReviewState({ owner, repo, prNumber, token }),
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, token),
    paginate(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token),
  ]);

  const result = assessReviewerLifecycle({
    eventName,
    labels: nativeState.labels,
    files: files.map((file) => file.filename),
    reviews: nativeState.reviews,
    reviewThreads: nativeState.reviewThreads,
    trustedBotLogins,
    exceptionLabel,
    implementationActor: parseImplementationActor(pull.body || ''),
    requireActorIndependentApproval: nativeState.reviews.some(isActorApprovalReview),
    enforceFailure,
    paginationFailures: nativeState.paginationFailures,
    body: pull.body || '',
    reviewComments,
    issueComments,
    headSha: pull.head?.sha || '',
    readyForReviewAt: pull.updated_at || pull.created_at || '',
  });

  return {
    ...result,
    prNumber,
    headSha: pull.head?.sha || '',
    marker: '<!-- reviewer-lifecycle-gate -->',
    report: buildReviewerLifecycleReport(result),
  };
}

export async function upsertGateComment({ token, owner, repo, prNumber, marker, body }) {
  const comments = await paginate(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token);
  const existing = comments.find((comment) => (comment.body || '').includes(marker));
  const commentBody = `${marker}\n\n${body}`;

  if (existing) {
    await request(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body: commentBody }),
    });
    return;
  }

  await request(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ body: commentBody }),
  });
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const eventName = process.env.GITHUB_EVENT_NAME || 'pull_request_target';
  const enforceFailure = (process.env.ENFORCE_FAILURE || (isEnforcingReviewerLifecycleEvent(eventName) ? 'true' : 'false')) === 'true';
  const trustedBotLogins = parseTrustedBotLogins(process.env.TRUSTED_BOT_LOGINS || '');
  const exceptionLabel = process.env.EXCEPTION_LABEL || DEFAULT_EXCEPTION_LABEL;

  if (!token || !repository || !prNumber) {
    throw new Error('GITHUB_TOKEN/GH_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required.');
  }

  const [owner, repo] = repository.split('/');
  const result = await runReviewerLifecycleGate({
    token,
    owner,
    repo,
    prNumber,
    eventName,
    enforceFailure,
    trustedBotLogins,
    exceptionLabel,
  });

  writeReviewerLifecycleArtifacts(result, process.env);

  try {
    await upsertGateComment({
      token,
      owner,
      repo,
      prNumber: result.prNumber,
      marker: result.marker,
      body: result.report,
    });
  } catch (error) {
    console.warn(`Failed to upsert reviewer lifecycle gate comment: ${error.message}`);
    console.warn('Continuing with gate result; merge blocking depends on assessment only.');
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, `\n### Reviewer lifecycle gate\n\n${result.report}\n`);
  }

  console.log(result.report);
  if (result.shouldFail) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof GitHubInfrastructureError) {
      console.error(`INFRASTRUCTURE_FAILURE classification=${error.classification}`);
      console.error(error.message);
      if (error.attemptLog?.length) {
        console.error(formatAttemptEvidence(error.attemptLog));
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  });
}
