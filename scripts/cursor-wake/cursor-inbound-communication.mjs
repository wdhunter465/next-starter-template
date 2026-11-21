/**
 * Cursor Local inbound communication surface (#5379 / #3188).
 *
 * Reuses evaluateStaleCommunication / REQUEST_EVENTS from
 * scripts/ops/detect-stale-communication.mjs. Surfaces unanswered
 * response-required events that name Cursor, even when the Issue claim
 * label is another agent. Does not post COMMUNICATION EXCEPTION comments
 * and does not change the exception-only contract of the detector.
 */
import { execFileSync } from 'node:child_process';
import {
  REQUEST_EVENTS,
  evaluateStaleCommunication,
  primaryEvent,
} from '../ops/detect-stale-communication.mjs';

const DEFAULT_REPO = 'wdhunter465/next-starter-template';
const SEARCH_LIMIT = 50;
// already_surfaced = COMMUNICATION EXCEPTION posted; that is not an ack (#3188).
const OPEN_STATUSES = new Set(['pending_not_stale', 'stale', 'already_surfaced']);

const SOFT_REPLY_HEADINGS = Object.freeze(['AGREE', 'DISSENT']);
const ACCEPTED_REPLY_EVENTS = Object.freeze(
  new Set(Object.values(REQUEST_EVENTS).flat()),
);

/**
 * True when a response-required comment addresses Cursor as the target role.
 */
export function targetsCursorRole(body) {
  const text = String(body || '');
  return (
    /\bto\s+Cursor\b/i.test(text) ||
    /\bfor\s+Cursor\b/i.test(text) ||
    /\bTarget:\s*Cursor\b/i.test(text) ||
    // Standard collaboration vocabulary (#3188 / #5442), e.g.
    // "Target agent / role: Cursor, CMO alternate (secondary)"
    /\bTarget\s+agent\s*\/\s*role:\s*Cursor\b/i.test(text) ||
    /\bCursor\s*\(/i.test(text) ||
    /@cursor\b/i.test(text)
  );
}

/**
 * Cursor-local soft replies used on source Issues (e.g. AGREE / DISSENT).
 * Shared detector vocabulary is unchanged; this only closes the Local surface.
 * Does not treat COMMUNICATION EXCEPTION as a reply.
 */
export function isCursorSoftCollaborationReply(body) {
  const event = primaryEvent(body);
  if (event && ACCEPTED_REPLY_EVENTS.has(event)) return true;
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('<!--'));
  for (const line of lines.slice(0, 12)) {
    const heading = line.replace(/^#+\s*/, '');
    for (const name of SOFT_REPLY_HEADINGS) {
      if (
        heading === name ||
        heading.startsWith(`${name} `) ||
        heading.startsWith(`${name}—`) ||
        heading.startsWith(`${name} -`) ||
        heading.startsWith(`${name}:`)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Unanswered Cursor-targeted inbound events for one Issue's comments.
 */
export function findUnansweredCursorInbound(comments, options = {}) {
  const issueNumber = options.issueNumber ?? 0;
  const findings = evaluateStaleCommunication(comments, options);
  const ordered = [...comments]
    .filter((comment) => (comment.source || 'issue') === 'issue')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const byId = new Map(ordered.map((comment) => [String(comment.id), comment]));

  const open = [];
  for (const finding of findings) {
    if (!OPEN_STATUSES.has(finding.status)) continue;
    const source = byId.get(String(finding.sourceCommentId));
    if (!source || !targetsCursorRole(source.body)) continue;

    const sourceAt = Date.parse(source.createdAt);
    const laterSoft = ordered.some(
      (comment) =>
        Date.parse(comment.createdAt) > sourceAt &&
        isCursorSoftCollaborationReply(comment.body),
    );
    if (laterSoft) continue;

    open.push({
      ...finding,
      issueNumber,
      preview: String(source.body || '')
        .split(/\r?\n/)
        .slice(0, 3)
        .join(' ')
        .slice(0, 180),
    });
  }
  return open;
}

function runGh(ghArgs, execFile = execFileSync) {
  return execFile('gh', ghArgs, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });
}

function searchOpenIssues(repo, phrase, execFile = execFileSync) {
  const output = runGh(
    [
      'search',
      'issues',
      '--repo',
      repo,
      '--state',
      'open',
      '--limit',
      String(SEARCH_LIMIT),
      '--json',
      'number,title,updatedAt',
      phrase,
    ],
    execFile,
  );
  return JSON.parse(output || '[]');
}

function fetchComments(repo, issueNumber, execFile = execFileSync) {
  const output = runGh(
    ['api', `repos/${repo}/issues/${issueNumber}/comments`, '--paginate'],
    execFile,
  );
  const comments = JSON.parse(output || '[]');
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body || '',
    createdAt: comment.created_at,
    source: 'issue',
  }));
}

/**
 * Scan open Issues for Cursor-targeted unanswered inbound events.
 * Read-only: never posts exception comments.
 */
export function collectCursorInboundCommunication({
  repo = DEFAULT_REPO,
  now = new Date(),
  execFile = execFileSync,
  searchIssues = searchOpenIssues,
  loadComments = fetchComments,
} = {}) {
  const seen = new Map();
  for (const phrase of Object.keys(REQUEST_EVENTS)) {
    for (const issue of searchIssues(repo, `"${phrase}"`, execFile)) {
      seen.set(issue.number, issue);
    }
  }

  const actionable = [];
  for (const issue of seen.values()) {
    const comments = loadComments(repo, issue.number, execFile);
    const open = findUnansweredCursorInbound(comments, {
      now,
      issueNumber: issue.number,
    });
    for (const finding of open) {
      actionable.push({
        number: issue.number,
        title: issue.title,
        event: finding.event,
        status: finding.status,
        sourceCommentId: finding.sourceCommentId,
        preview: finding.preview,
      });
    }
  }

  actionable.sort((a, b) => a.number - b.number || String(a.sourceCommentId).localeCompare(String(b.sourceCommentId)));
  return {
    kind: 'cursor-inbound-communication',
    query: 'poller:cursor-inbound-communication (#3188 / #5379)',
    count: actionable.length,
    actionableCount: actionable.length,
    skippedCount: 0,
    first: actionable.slice(0, 5).map((item) => item.number),
    actionable: actionable.slice(0, 8),
    skipped: [],
  };
}

export function formatInboundPromptLine(block) {
  if (!block || !block.actionableCount) return '';
  const refs = (block.actionable || [])
    .slice(0, 5)
    .map((item) => `#${item.number}:${item.event}`)
    .join(',');
  return `Inbound communication checkpoint: ${block.actionableCount} Cursor-targeted unanswered event(s) (${refs}). Acknowledge before unrelated queue work (#3188 / #5379).`;
}
