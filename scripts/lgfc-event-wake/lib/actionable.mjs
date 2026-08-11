/**
 * Non-AI actionable predicates for LGFC event-wake (#3340).
 * Transport wake only — execution authority remains the live source Issue.
 */

export const BLOCKING_STATUS_LABELS = new Set([
  'status:review',
  'status:complete',
  'status:post-merge-verify',
]);

/**
 * @param {{ labels?: Array<{ name?: string } | string>, state?: string }} issue
 * @returns {string[]}
 */
export function labelNames(issue) {
  const raw = issue?.labels || [];
  return raw
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
    .filter(Boolean)
    .map(String);
}

/**
 * @param {string[]} labels
 * @returns {boolean}
 */
export function isHandedOff(labels) {
  return labels.some((name) => BLOCKING_STATUS_LABELS.has(name));
}

/**
 * @param {{ labels?: Array<{ name?: string } | string>, state?: string, number?: number }} issue
 * @returns {{ actionable: boolean, reason: string | null, issueNumber: number | null }}
 */
export function classifyIssue(issue) {
  const number = Number(issue?.number);
  if (!Number.isInteger(number) || number <= 0) {
    return { actionable: false, reason: null, issueNumber: null };
  }
  if (String(issue?.state || '').toLowerCase() !== 'open') {
    return { actionable: false, reason: null, issueNumber: number };
  }

  const labels = labelNames(issue);
  if (isHandedOff(labels)) {
    return { actionable: false, reason: null, issueNumber: number };
  }

  const hasAgent = labels.includes('agent:cursor');
  const hasHandoff = labels.includes('handoff:ready');
  if (hasAgent && hasHandoff) {
    return { actionable: true, reason: 'cursor-handoff', issueNumber: number };
  }

  if (labels.includes('ops:priority:1')) {
    return { actionable: true, reason: 'ops-priority-1', issueNumber: number };
  }

  if (hasAgent && labels.includes('post-merge-failure')) {
    return { actionable: true, reason: 'post-merge-failure-cursor', issueNumber: number };
  }

  return { actionable: false, reason: null, issueNumber: number };
}

/**
 * Stable wake key for dedupe: issue + reason + updated identity.
 * @param {{ number: number, updated_at?: string, updatedAt?: string }} issue
 * @param {string} reason
 */
export function wakeKey(issue, reason) {
  const updated = issue.updated_at || issue.updatedAt || '';
  return `${issue.number}:${reason}:${updated}`;
}
