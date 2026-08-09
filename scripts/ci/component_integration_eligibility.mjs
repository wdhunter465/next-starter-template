#!/usr/bin/env node

import fs from 'node:fs';
import { classifyDeliveryProfile } from './delivery_profile.mjs';
import {
  assessActorIndependentApproval,
  isActorApprovalReview,
  parseImplementationActor,
  reviewerActor,
} from './reviewer_lifecycle_gate.mjs';

export const HOLD_LABELS = ['component-integration-hold', 'hold:component-integration'];
export const COMPONENT_STATES = ['green', 'red', 'hold'];

/** Check names produced by this workflow — never used as blockers. */
export const SELF_CHECK_NAMES = new Set([
  'Component Integration Eligibility',
  'component-child-integration',
]);

/** Name patterns that are advisory/unrelated to child auto-integration gates. */
export const ADVISORY_CHECK_NAME_PATTERNS = [
  /advisory/i,
  /diataxis/i,
  /cursor-review/i,
  /cubic/i,
  /semgrep/i,
  /cloudflare pages/i,
  /^Agent Governance$/i,
  /^Design Authority/i,
  /^validate-/i,
  /^noop$/i,
  /^gate-ensure-issue$/i,
  /attention pulse/i,
];

/** Required current-head check names for Model B child eligibility. */
export const REQUIRED_CHECK_NAME_PATTERNS = [
  /^GATE — Quality Checks$/i,
  /^GATE — Diff Scope$/i,
  /^GATE — Secret Scan$/i,
  /^quality$/i,
  /^gitleaks$/i,
];

const CHECK_FAILURE = new Set(['failure', 'cancelled', 'timed_out', 'action_required']);
const CHECK_PENDING = new Set(['queued', 'in_progress', 'pending', 'waiting']);

function integrationError(code, message, details = {}) {
  return { code, message, ...details };
}

function normalizeCheckStatus(status = '') {
  return String(status || '').trim().toLowerCase();
}

function isComponentRef(ref = '') {
  return /^component\/[^/].*/.test(String(ref || ''));
}

function labelNames(labels = []) {
  return labels.map((label) => {
    if (typeof label === 'string') return label;
    return label?.name || '';
  }).filter(Boolean);
}

function hasHoldLabel(labels = []) {
  const names = new Set(labelNames(labels).map((name) => name.toLowerCase()));
  return HOLD_LABELS.some((label) => names.has(label.toLowerCase()));
}

function checkTimestamp(check = {}) {
  const raw = check.completed_at || check.completedAt || check.started_at || check.startedAt || '';
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return parsed;
  return Number(check.id) || 0;
}

export function isSelfCheckName(name = '') {
  return SELF_CHECK_NAMES.has(String(name || ''));
}

export function isAdvisoryCheckName(name = '') {
  const value = String(name || '');
  if (isSelfCheckName(value)) return true;
  return ADVISORY_CHECK_NAME_PATTERNS.some((pattern) => pattern.test(value));
}

export function isRequiredCheckName(name = '') {
  const value = String(name || '');
  return REQUIRED_CHECK_NAME_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Keep the latest authoritative current-head result per check name after
 * excluding self, advisory, and unrelated runs.
 */
export function selectAuthoritativeChecks(checks = []) {
  const latestByName = new Map();

  for (const check of checks) {
    const name = check.name || check.context || '';
    if (!name || isAdvisoryCheckName(name) || !isRequiredCheckName(name)) {
      continue;
    }
    const existing = latestByName.get(name);
    if (!existing || checkTimestamp(check) >= checkTimestamp(existing)) {
      latestByName.set(name, check);
    }
  }

  return [...latestByName.values()];
}

export function assessChecks(checks = []) {
  const authoritative = selectAuthoritativeChecks(checks);
  const failed = [];
  const pending = [];
  const successConclusions = new Set(['success', 'neutral', 'skipped']);

  for (const check of authoritative) {
    const conclusion = normalizeCheckStatus(check.conclusion);
    const status = normalizeCheckStatus(check.status);
    const name = check.name || check.context || 'unknown-check';
    if (CHECK_FAILURE.has(conclusion)) {
      failed.push(integrationError('failed_check', `Required check failed: ${name}.`, { check: name, status: conclusion }));
      continue;
    }
    if (successConclusions.has(conclusion)) {
      continue;
    }
    if (!conclusion || CHECK_PENDING.has(conclusion) || CHECK_PENDING.has(status)) {
      pending.push(integrationError(
        'pending_check',
        `Required check pending: ${name}.`,
        { check: name, status: conclusion || status || 'pending' },
      ));
    }
  }

  return { failed, pending, authoritative };
}

function reviewTimestamp(review = {}) {
  const raw = review.submitted_at || review.submittedAt || '';
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return parsed;
  return 0;
}

/**
 * Latest-by-author review accounting. Prefer reviews whose commit_id matches
 * headSha when present; otherwise keep the latest review for that author.
 * Only the chosen review's state can block via CHANGES_REQUESTED.
 */
export function selectLatestReviewsByAuthor(reviews = [], { headSha = '' } = {}) {
  const currentHead = [];
  for (const review of reviews) {
    const commitId = review.commit_id || review.commitId || '';
    if (!headSha) {
      currentHead.push(review);
      continue;
    }
    // Missing commit_id is treated as applicable to the evaluation head.
    // Mismatched commit_id is superseded historical evidence and is ignored.
    if (!commitId || commitId === headSha) {
      currentHead.push(review);
    }
  }

  const byAuthor = new Map();
  for (const review of [...currentHead].sort((left, right) => reviewTimestamp(left) - reviewTimestamp(right))) {
    const author = review.author?.login || review.user?.login || 'unknown';
    byAuthor.set(author, review);
  }
  return [...byAuthor.values()];
}

export function assessReviews(reviews = [], { headSha = '' } = {}) {
  const blockers = [];
  for (const review of selectLatestReviewsByAuthor(reviews, { headSha })) {
    const state = String(review.state || '').toUpperCase();
    if (state === 'CHANGES_REQUESTED') {
      blockers.push(integrationError(
        'changes_requested',
        'A reviewer requested changes on the authoritative current-head review.',
        { author: review.author?.login || review.user?.login || 'unknown' },
      ));
    }
  }
  return blockers;
}

function normalizeActorIdentity(value = '') {
  return String(value || '').trim().toLowerCase();
}

/**
 * Determines whether a protected-change PR's required independent review is
 * satisfied for the current head (#3151). Distinguishes:
 *
 * 1. pending — no independent APPROVED review exists yet for the current head;
 * 2. satisfied — an APPROVED review from someone other than the implementer
 *    is linked to the current head (`protected_change` is cleared);
 * 3. stale — an independent APPROVED review exists, but only for a prior
 *    head; a fresh review is required after the head changed;
 * 4. current-head CHANGES_REQUESTED remains blocking via the separate,
 *    unchanged `assessReviews()` check — not handled here;
 * 5. self-approval — an APPROVED review exists only from the implementer
 *    itself, which can never satisfy this requirement.
 *
 * This only ever reads real GitHub review state (author identity, review
 * state, and commit_id) — it verifies that authorized review evidence
 * exists, it never invents or infers the Engineering decision.
 */
export function assessProtectedChangeReview({
  implementationActor = '',
  implementationLogin = '',
  reviews = [],
  headSha = '',
} = {}) {
  const implementer = normalizeActorIdentity(implementationActor || implementationLogin);
  const currentHeadReviews = selectLatestReviewsByAuthor(reviews, { headSha });

  const independentCurrentHeadApproval = currentHeadReviews
    .filter(isActorApprovalReview)
    .find((review) => {
      const author = normalizeActorIdentity(reviewerActor(review));
      return Boolean(author) && author !== implementer;
    });

  if (independentCurrentHeadApproval) {
    return { satisfied: true, blockers: [] };
  }

  // An independent APPROVED review exists somewhere in the PR's history, but
  // not for the current head — the approval was superseded by a new commit
  // and must be refreshed. Distinct from "never reviewed" for operator clarity.
  const hasStaleIndependentApproval = reviews.some((review) => {
    if (!isActorApprovalReview(review)) return false;
    const author = normalizeActorIdentity(reviewerActor(review));
    if (!author || author === implementer) return false;
    const commitId = review.commit_id || review.commitId || '';
    return Boolean(commitId) && commitId !== headSha;
  });

  if (hasStaleIndependentApproval) {
    return {
      satisfied: false,
      blockers: [integrationError(
        'protected_change_stale_approval',
        'Prior protected-change approval no longer covers the current head; a fresh independent review is required.',
      )],
    };
  }

  return {
    satisfied: false,
    blockers: [integrationError(
      'protected_change',
      'Protected paths changed; independent PR Approver / Engineering review is required before component integration.',
    )],
  };
}

/**
 * Map GitHub combined status to green/red only.
 * Hold is never inferred from pending/absent legacy status — only explicit labels.
 */
export function deriveComponentStateFromCombinedStatus(state = '') {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized === 'failure' || normalized === 'error') return 'red';
  return 'green';
}

export function evaluateComponentIntegration({
  profile = {},
  checks = [],
  reviews = [],
  componentState = 'green',
  labels = [],
  changedFiles = [],
  headSha = '',
  implementationActor = '',
  implementationLogin = '',
} = {}) {
  const blockedReasons = [];
  let requiresChatReview = false;

  const normalizedProfile = {
    ...profile,
    changedFiles: Array.isArray(changedFiles) ? changedFiles : profile.changedFiles,
  };

  if (!normalizedProfile.baseRef && normalizedProfile.componentBranch) {
    normalizedProfile.baseRef = normalizedProfile.componentBranch;
  }

  const classified = normalizedProfile.errors
    ? normalizedProfile
    : classifyDeliveryProfile({
      baseRef: normalizedProfile.baseRef || '',
      headRef: normalizedProfile.headRef || '',
      body: normalizedProfile.body || '',
      changedFiles: normalizedProfile.changedFiles ?? changedFiles,
    });

  const deliveryModel = classified.deliveryModel || normalizedProfile.deliveryModel || '';
  const gateProfile = classified.gateProfile || normalizedProfile.gateProfile || '';
  const approvalProfile = classified.approvalProfile || normalizedProfile.approvalProfile || '';
  const componentBranch = classified.componentBranch || normalizedProfile.componentBranch || '';
  const componentMaster = classified.componentMaster || normalizedProfile.componentMaster || '';
  const protectedChange = classified.protectedChange ?? normalizedProfile.protectedChange ?? false;
  const baseRef = normalizedProfile.baseRef || '';
  const baseBehindComponentHead = Number(normalizedProfile.baseBehindComponentHead || 0);
  const profileErrors = classified.errors || normalizedProfile.errors || [];
  const resolvedHeadSha = headSha || normalizedProfile.headSha || '';

  if (deliveryModel !== 'B-child') {
    blockedReasons.push(integrationError(
      'invalid_delivery_model',
      'Component auto-integration applies only to Model B child PRs.',
      { deliveryModel },
    ));
  }

  if (gateProfile !== 'component-child') {
    blockedReasons.push(integrationError(
      'invalid_gate_profile',
      'Component auto-integration requires gate profile component-child.',
      { gateProfile },
    ));
  }

  if (!isComponentRef(baseRef)) {
    blockedReasons.push(integrationError(
      'non_component_base',
      'Model B child PRs must target a component/** base branch.',
      { baseRef },
    ));
  }

  if (!componentBranch) {
    blockedReasons.push(integrationError(
      'missing_component_branch',
      'Component branch metadata is required for Model B child integration.',
    ));
  } else if (componentBranch !== baseRef) {
    blockedReasons.push(integrationError(
      'branch_mismatch',
      'Component branch metadata must match the PR base ref.',
      { expected: baseRef, value: componentBranch },
    ));
  }

  if (!componentMaster) {
    blockedReasons.push(integrationError(
      'missing_component_master',
      'Component master issue reference is required for Model B child integration.',
    ));
  }

  for (const error of profileErrors) {
    blockedReasons.push(integrationError(
      error.code || 'profile_error',
      error.message || 'Delivery profile classification failed.',
      error,
    ));
  }

  if (protectedChange || approvalProfile === 'protected-change-review') {
    const protectedChangeReview = assessProtectedChangeReview({
      implementationActor: implementationActor || implementationLogin,
      reviews,
      headSha: resolvedHeadSha,
    });
    requiresChatReview = !protectedChangeReview.satisfied;
    blockedReasons.push(...protectedChangeReview.blockers);
  }

  if (componentState === 'red') {
    blockedReasons.push(integrationError(
      'component_red_state',
      'Component branch integration state is red; auto-integration is blocked.',
    ));
  }

  // Hold only from explicit labels (or an explicitly supplied hold state from labels).
  if (componentState === 'hold' || hasHoldLabel(labels)) {
    blockedReasons.push(integrationError(
      'component_hold',
      'Component integration is on hold; auto-integration is blocked.',
    ));
  }

  if (baseBehindComponentHead > 0) {
    blockedReasons.push(integrationError(
      'stale_base',
      'PR base is behind the component branch head; sync the latest component branch before integration.',
      { commitsBehind: baseBehindComponentHead },
    ));
  }

  const { failed, pending } = assessChecks(checks);
  blockedReasons.push(...failed, ...pending);
  blockedReasons.push(...assessReviews(reviews, { headSha: resolvedHeadSha }));
  const currentHeadReviews = selectLatestReviewsByAuthor(reviews, { headSha: resolvedHeadSha });
  blockedReasons.push(...assessActorIndependentApproval({
    implementationActor: implementationActor || implementationLogin,
    reviews: currentHeadReviews,
    requireActorIndependentApproval: currentHeadReviews.some(isActorApprovalReview),
  }));

  const eligible = blockedReasons.length === 0;

  return {
    eligible,
    blockedReasons,
    requiresChatReview,
    componentState: componentState || 'green',
    deliveryModel,
    gateProfile,
    approvalProfile,
    componentBranch,
    componentMaster,
    protectedChange,
  };
}

export function renderIntegrationReport(result) {
  const lines = [
    `Component integration eligibility: ${result.eligible ? 'eligible' : 'blocked'}`,
    `- Delivery model: ${result.deliveryModel || 'unknown'}`,
    `- Gate profile: ${result.gateProfile || 'unknown'}`,
    `- Component branch: ${result.componentBranch || 'unknown'}`,
    `- Component master: ${result.componentMaster || 'unknown'}`,
    `- Protected change: ${result.protectedChange ? 'yes' : 'no'}`,
    `- Component state: ${result.componentState}`,
    `- Requires Chat review: ${result.requiresChatReview ? 'yes' : 'no'}`,
  ];

  if (result.blockedReasons.length) {
    lines.push('', '## Blocked reasons');
    for (const reason of result.blockedReasons) {
      lines.push(`- ${reason.code}: ${reason.message}`);
    }
  }

  return lines.join('\n');
}

function readJsonFile(path, fallback) {
  if (!path || !fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readListFile(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function runCli(env = process.env) {
  const profile = readJsonFile(env.COMPONENT_INTEGRATION_PROFILE_JSON, {});
  const checks = readJsonFile(env.COMPONENT_INTEGRATION_CHECKS_JSON, []);
  const reviews = readJsonFile(env.COMPONENT_INTEGRATION_REVIEWS_JSON, []);
  const labels = readJsonFile(env.COMPONENT_INTEGRATION_LABELS_JSON, []);
  const changedFiles = readListFile(env.COMPONENT_INTEGRATION_CHANGED_FILES_FILE || env.CHANGED_FILES_FILE);

  if (env.PR_BODY_FILE && fs.existsSync(env.PR_BODY_FILE)) {
    profile.body = fs.readFileSync(env.PR_BODY_FILE, 'utf8');
  }
  if (env.PR_BASE_REF) profile.baseRef = env.PR_BASE_REF;
  if (env.PR_HEAD_REF) profile.headRef = env.PR_HEAD_REF;
  if (env.COMPONENT_INTEGRATION_STATE) {
    profile.componentState = env.COMPONENT_INTEGRATION_STATE;
  }
  if (env.COMPONENT_INTEGRATION_BASE_BEHIND) {
    profile.baseBehindComponentHead = Number(env.COMPONENT_INTEGRATION_BASE_BEHIND || 0);
  }

  const result = evaluateComponentIntegration({
    profile,
    checks,
    reviews,
    componentState: env.COMPONENT_INTEGRATION_STATE || profile.componentState || 'green',
    labels,
    changedFiles,
    headSha: env.COMPONENT_INTEGRATION_HEAD_SHA || profile.headSha || '',
    implementationActor: env.COMPONENT_INTEGRATION_IMPLEMENTATION_ACTOR
      || profile.implementationActor
      || parseImplementationActor(profile.body || ''),
  });

  const report = renderIntegrationReport(result);
  console.log(report);

  const jsonPath = env.COMPONENT_INTEGRATION_RESULT_JSON;
  if (jsonPath) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  }

  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `eligible=${result.eligible}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `requires_chat_review=${result.requiresChatReview}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `blocked_reason_count=${result.blockedReasons.length}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `component_state=${result.componentState}\n`);
  }

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
