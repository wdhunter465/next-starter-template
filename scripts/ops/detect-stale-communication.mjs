#!/usr/bin/env node
/**
 * detect-stale-communication.mjs
 *
 * Source-Issue-first stale / unanswered communication detector (#3188).
 *
 * The detector surfaces at most one deduplicated communication exception per
 * event identity. It does not acknowledge, reassign, approve, or invent a
 * role decision. Cursor Local Bridge eligibility remains label/status-only.
 *
 * Modes:
 *   self-test — offline fixtures (no network)
 *   scan      — fetch open Issues and evaluate comments
 *   apply     — scan, then post missing exception comments (idempotent)
 *
 * Live repo slug is locked to wdhunter465/next-starter-template.
 *
 * Requirements: Node 18+; gh CLI for scan/apply.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_LGFC_REPO = 'wdhunter465/next-starter-template';
const ALLOWED_REPOS = new Set([DEFAULT_LGFC_REPO]);
const SLO_MS = 5 * 60 * 1000;
const HISTORICAL_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_POSTS = 3;
const EXCEPTION_HEADING = 'COMMUNICATION EXCEPTION';
const MARKER_PREFIX = 'lgfc-stale-communication';

export const REQUEST_EVENTS = Object.freeze({
  'COLLABORATION REQUEST': [
    'COLLABORATION ACKNOWLEDGED',
    'COLLABORATION RESPONSE',
    'COLLABORATION COMPLETE',
  ],
  'PR REVIEW REQUEST': [
    'COLLABORATION ACKNOWLEDGED',
    'APPROVED FOR INTEGRATION',
  ],
  'PROBLEM FOUND': ['GUIDANCE', 'ADJUSTMENT', 'PLAN CHANGE REQUIRED', 'HOLD', 'RESUME'],
  'IMPLEMENTATION HANDOFF': [
    'COLLABORATION ACKNOWLEDGED',
    'CLOSEOUT',
    'APPROVED FOR INTEGRATION',
    'ADJUSTMENT',
    'RESUME',
  ],
});

export const EVENT_NAMES = Object.freeze([
  ...Object.keys(REQUEST_EVENTS),
  ...new Set(Object.values(REQUEST_EVENTS).flat()),
  EXCEPTION_HEADING,
]);

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  return args.includes(`--${name}`) ? true : fallback;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

export function resolveRepo(requested = DEFAULT_LGFC_REPO) {
  if (!ALLOWED_REPOS.has(requested)) {
    throw new Error(
      `Refusing repo '${requested}'. Only ${DEFAULT_LGFC_REPO} is allowed.`,
    );
  }
  return requested;
}

export function exceptionId(issueNumber, sourceCommentId) {
  return `${MARKER_PREFIX}:${issueNumber}:${sourceCommentId}`;
}

export function primaryEvent(body) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('<!--'));
  for (const line of lines.slice(0, 12)) {
    const heading = line.replace(/^#+\s*/, '');
    for (const name of EVENT_NAMES) {
      if (heading === name || heading.startsWith(`${name} `) || heading.startsWith(`${name}:`)) {
        return name;
      }
    }
  }
  return null;
}

export function isProtectedEscalation(body) {
  const text = String(body || '');
  const targetsPa =
    /product authority|\b@wdhunter465\b|\bbill\b/i.test(text);
  const protectedTopic =
    /\b(cost|legal|privacy|credential|destructive|production go|production decision)\b/i.test(
      text,
    );
  return targetsPa && protectedTopic;
}

export function hasExceptionMarker(comments, id) {
  return comments.some((comment) => String(comment.body || '').includes(`<!-- ${id} -->`));
}

/**
 * @param {Array<{id:string|number, body:string, createdAt:string, source?:string}>} comments
 * @param {{ now?: Date, sloMs?: number, historicalMs?: number, issueNumber?: number }} [options]
 */
export function evaluateStaleCommunication(comments, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const sloMs = options.sloMs ?? SLO_MS;
  const historicalMs = options.historicalMs ?? HISTORICAL_MS;
  const issueNumber = options.issueNumber ?? 0;
  const ordered = [...comments]
    .filter((comment) => (comment.source || 'issue') === 'issue')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const findings = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const comment = ordered[index];
    const event = primaryEvent(comment.body);
    const responses = REQUEST_EVENTS[event];
    if (!responses) continue;
    if (isProtectedEscalation(comment.body)) {
      findings.push({
        status: 'protected_escalation',
        event,
        issueNumber,
        sourceCommentId: String(comment.id),
      });
      continue;
    }

    const later = ordered.slice(index + 1);
    const answered = later.some((candidate) => {
      const laterEvent = primaryEvent(candidate.body);
      return laterEvent && responses.includes(laterEvent);
    });
    if (answered) {
      findings.push({
        status: 'resolved',
        event,
        issueNumber,
        sourceCommentId: String(comment.id),
      });
      continue;
    }

    const id = exceptionId(issueNumber, comment.id);
    if (hasExceptionMarker(ordered, id)) {
      findings.push({
        status: 'already_surfaced',
        event,
        issueNumber,
        sourceCommentId: String(comment.id),
        exceptionId: id,
      });
      continue;
    }

    const ageMs = now.getTime() - Date.parse(comment.createdAt);
    if (!Number.isFinite(ageMs) || ageMs < sloMs) {
      findings.push({
        status: 'pending_not_stale',
        event,
        issueNumber,
        sourceCommentId: String(comment.id),
      });
      continue;
    }
    if (ageMs >= historicalMs) {
      findings.push({
        status: 'historical',
        event,
        issueNumber,
        sourceCommentId: String(comment.id),
      });
      continue;
    }

    findings.push({
      status: 'stale',
      event,
      issueNumber,
      sourceCommentId: String(comment.id),
      exceptionId: id,
      ageMs,
    });
  }

  const prOnlyComments = comments.filter((comment) => comment.source === 'pr');
  for (const comment of prOnlyComments) {
    const event = primaryEvent(comment.body);
    if (!event || !REQUEST_EVENTS[event]) continue;
    findings.push({
      status: 'pr_not_routing_authority',
      event,
      issueNumber,
      sourceCommentId: String(comment.id),
    });
  }

  return findings;
}

/**
 * Acknowledgment-before-unrelated-claim rule.
 * Numbered Operations interrupts may proceed; same-Issue work may proceed to ack.
 */
export function mayClaimUnrelatedWork({
  pendingRequired = false,
  nextIsOpsInterrupt = false,
  pendingOnSameIssue = false,
} = {}) {
  if (!pendingRequired) return { allowed: true, reason: 'no_pending_required_communication' };
  if (nextIsOpsInterrupt) return { allowed: true, reason: 'operations_interrupt_precedence' };
  if (pendingOnSameIssue) return { allowed: true, reason: 'same_issue_acknowledgment' };
  return { allowed: false, reason: 'ack_required_before_unrelated_claim' };
}

export function renderExceptionComment({ issueNumber, event, sourceCommentId, exceptionId: id }) {
  return `## ${EXCEPTION_HEADING}

<!-- ${id} -->

**Source Issue:** #${issueNumber}
**Stale event:** \`${event}\`
**Source comment:** ${sourceCommentId}

This is a bounded, deduplicated communication exception (#3188). It does not acknowledge the event, reassign the Issue, or create a role decision.

Required next action: the target role holder must post the matching source-Issue acknowledgment or owning-role response using the existing event vocabulary.

PR comments, chat, and external notifications do not satisfy this requirement.
`;
}

function runGh(ghArgs) {
  try {
    return execFileSync('gh', ghArgs, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
    });
  } catch (error) {
    const err = new Error(`gh command failed: gh ${ghArgs.join(' ')}\n${error.message}`);
    err.cause = error;
    throw err;
  }
}

function searchOpenIssues(repo, phrase) {
  const output = runGh([
    'search',
    'issues',
    '--repo',
    repo,
    '--state',
    'open',
    '--limit',
    '50',
    '--json',
    'number,title,updatedAt',
    phrase,
  ]);
  return JSON.parse(output || '[]');
}

function fetchComments(repo, issueNumber) {
  const output = runGh([
    'api',
    `repos/${repo}/issues/${issueNumber}/comments`,
    '--paginate',
  ]);
  const comments = JSON.parse(output || '[]');
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body || '',
    createdAt: comment.created_at,
    source: 'issue',
  }));
}

function postComment(repo, issueNumber, body) {
  runGh(['issue', 'comment', String(issueNumber), '--repo', repo, '--body', body]);
}

function collectCandidateIssues(repo) {
  const seen = new Map();
  for (const phrase of Object.keys(REQUEST_EVENTS)) {
    for (const issue of searchOpenIssues(repo, `"${phrase}"`)) {
      seen.set(issue.number, issue);
    }
  }
  return [...seen.values()];
}

function runScan(repo, { apply = false, maxPosts = DEFAULT_MAX_POSTS, now = new Date() } = {}) {
  const issues = collectCandidateIssues(repo);
  const allFindings = [];
  let posted = 0;
  for (const issue of issues) {
    const comments = fetchComments(repo, issue.number);
    const findings = evaluateStaleCommunication(comments, {
      now,
      issueNumber: issue.number,
    });
    allFindings.push(...findings.map((finding) => ({ ...finding, title: issue.title })));
    if (!apply) continue;
    for (const finding of findings) {
      if (finding.status !== 'stale') continue;
      if (posted >= maxPosts) break;
      postComment(
        repo,
        issue.number,
        renderExceptionComment({
          issueNumber: issue.number,
          event: finding.event,
          sourceCommentId: finding.sourceCommentId,
          exceptionId: finding.exceptionId,
        }),
      );
      posted += 1;
      finding.posted = true;
    }
  }
  return { issues: issues.length, findings: allFindings, posted };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isoMinutesAgo(minutes, now) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function runSelfTest() {
  const now = new Date('2026-08-18T16:00:00.000Z');
  const issueNumber = 3188;

  const resolved = evaluateStaleCommunication(
    [
      {
        id: 1,
        createdAt: isoMinutesAgo(20, now),
        body: '## COLLABORATION REQUEST\nTarget: Cursor',
      },
      {
        id: 2,
        createdAt: isoMinutesAgo(15, now),
        body: '## COLLABORATION ACKNOWLEDGED\nAccepted scope: inspect only',
      },
    ],
    { now, issueNumber },
  );
  assert(resolved.some((row) => row.status === 'resolved'), 'request+ack should resolve');

  const stale = evaluateStaleCommunication(
    [
      {
        id: 10,
        createdAt: isoMinutesAgo(20, now),
        body: '## COLLABORATION REQUEST\nTarget: Cursor',
      },
    ],
    { now, issueNumber },
  );
  assert(stale.some((row) => row.status === 'stale' && row.event === 'COLLABORATION REQUEST'), 'unacked request is stale');

  const pending = evaluateStaleCommunication(
    [
      {
        id: 11,
        createdAt: isoMinutesAgo(2, now),
        body: '## PR REVIEW REQUEST\nPR: #1',
      },
    ],
    { now, issueNumber },
  );
  assert(pending.some((row) => row.status === 'pending_not_stale'), 'fresh PR REVIEW REQUEST is not stale');

  const problem = evaluateStaleCommunication(
    [
      {
        id: 12,
        createdAt: isoMinutesAgo(30, now),
        body: '## PROBLEM FOUND\nConflict on allowlist',
      },
    ],
    { now, issueNumber },
  );
  assert(problem.some((row) => row.status === 'stale' && row.event === 'PROBLEM FOUND'), 'PROBLEM FOUND without GUIDANCE is stale');

  const problemAnswered = evaluateStaleCommunication(
    [
      {
        id: 12,
        createdAt: isoMinutesAgo(30, now),
        body: '## PROBLEM FOUND\nConflict on allowlist',
      },
      {
        id: 13,
        createdAt: isoMinutesAgo(20, now),
        body: '## GUIDANCE\nStay on allowlist',
      },
    ],
    { now, issueNumber },
  );
  assert(problemAnswered.some((row) => row.status === 'resolved'), 'PROBLEM FOUND + GUIDANCE resolves');

  const handoff = evaluateStaleCommunication(
    [
      {
        id: 20,
        createdAt: isoMinutesAgo(40, now),
        body: '## IMPLEMENTATION HANDOFF\nPR ready',
      },
    ],
    { now, issueNumber },
  );
  assert(
    handoff.some((row) => row.status === 'stale' && row.event === 'IMPLEMENTATION HANDOFF'),
    'handoff without disposition is stale',
  );

  const id = exceptionId(issueNumber, 30);
  const deduped = evaluateStaleCommunication(
    [
      {
        id: 30,
        createdAt: isoMinutesAgo(40, now),
        body: '## COLLABORATION REQUEST\nTarget: Work',
      },
      {
        id: 31,
        createdAt: isoMinutesAgo(10, now),
        body: renderExceptionComment({
          issueNumber,
          event: 'COLLABORATION REQUEST',
          sourceCommentId: '30',
          exceptionId: id,
        }),
      },
    ],
    { now, issueNumber },
  );
  assert(deduped.some((row) => row.status === 'already_surfaced'), 'existing exception marker must dedupe');

  const protectedFinding = evaluateStaleCommunication(
    [
      {
        id: 40,
        createdAt: isoMinutesAgo(40, now),
        body: '## COLLABORATION REQUEST\nTarget: Product Authority\nNeed a cost and Production decision.',
      },
    ],
    { now, issueNumber },
  );
  assert(
    protectedFinding.some((row) => row.status === 'protected_escalation'),
    'Product Authority protected decision is not stale agent communication',
  );

  const prOnly = evaluateStaleCommunication(
    [
      {
        id: 'pr-1',
        createdAt: isoMinutesAgo(40, now),
        source: 'pr',
        body: '## COLLABORATION REQUEST\nPlease ack',
      },
    ],
    { now, issueNumber },
  );
  assert(
    prOnly.some((row) => row.status === 'pr_not_routing_authority'),
    'PR comments are not source-Issue routing authority',
  );

  const proseMention = evaluateStaleCommunication(
    [
      {
        id: 50,
        createdAt: isoMinutesAgo(40, now),
        body: '## Findings\nPolicy already uses COLLABORATION REQUEST vocabulary.',
      },
    ],
    { now, issueNumber },
  );
  assert(proseMention.length === 0, 'vocabulary mentions are not events');

  assert(mayClaimUnrelatedWork({ pendingRequired: false }).allowed, 'no pending allows claim');
  assert(
    mayClaimUnrelatedWork({ pendingRequired: true, nextIsOpsInterrupt: true }).allowed,
    'ops interrupt may proceed',
  );
  assert(
    mayClaimUnrelatedWork({ pendingRequired: true, pendingOnSameIssue: true }).allowed,
    'same-issue ack work may proceed',
  );
  assert(
    !mayClaimUnrelatedWork({ pendingRequired: true }).allowed,
    'unrelated claim is blocked pending ack',
  );

  let refused = false;
  try {
    resolveRepo('octocat/hello-world');
  } catch {
    refused = true;
  }
  assert(refused, 'non-LGFC repo must be refused');
  assert(resolveRepo(DEFAULT_LGFC_REPO) === DEFAULT_LGFC_REPO, 'live LGFC repo is allowed');

  console.log('detect-stale-communication self-test PASS');
}

function main() {
  const mode = getArg('mode', 'self-test');
  if (mode === 'self-test') {
    runSelfTest();
    return;
  }

  const repo = resolveRepo(getArg('repo', DEFAULT_LGFC_REPO));
  const maxPosts = Number(getArg('max-posts', String(DEFAULT_MAX_POSTS)));
  if (!Number.isFinite(maxPosts) || maxPosts < 0 || maxPosts > 10) {
    fail('--max-posts must be 0–10');
  }

  if (mode === 'scan' || mode === 'apply') {
    const result = runScan(repo, { apply: mode === 'apply', maxPosts });
    const stale = result.findings.filter((row) => row.status === 'stale');
    console.log(
      JSON.stringify(
        {
          repo,
          mode,
          issuesScanned: result.issues,
          findings: result.findings.length,
          stale: stale.length,
          posted: result.posted,
          staleIssues: stale.map((row) => `#${row.issueNumber}:${row.event}`),
        },
        null,
        2,
      ),
    );
    return;
  }

  fail(`Unknown --mode=${mode}. Use self-test, scan, or apply.`);
}

const invokedPath = process.argv[1]
  ? fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('detect-stale-communication.mjs')
  : false;
if (invokedPath) {
  main();
}
