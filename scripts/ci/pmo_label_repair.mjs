#!/usr/bin/env node
/**
 * #5242: repair a PMO issue's lifecycle labels where the defect occurs, instead of collecting it on a report.
 *
 * Runs on issue events. For an issue that carries the `pmo` label:
 * - Closed without `pmo:closed`, or closed but still carrying `pmo:active`, `pmo:pipeline` or `status:active`:
 *   repaired in place (deterministic).
 * - Open but carrying `pmo:closed`, or open with both `pmo:active` and `pmo:pipeline`: not deterministic, so
 *   one comment is posted naming the fix, once per kind (marker `<!-- pmo-label-repair:<kind> -->`).
 * It never closes or reopens an issue and never touches any other label.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PMO_LABEL = 'pmo';
export const CLOSED_LABEL = 'pmo:closed';
export const STALE_ON_CLOSED = ['pmo:active', 'pmo:pipeline', 'status:active'];
export const MARKER_PREFIX = '<!-- pmo-label-repair:';

/** Pure. Returns { action: 'none' | 'repair' | 'comment', addLabels, removeLabels, kind, comment }. */
export function planPmoRepair({ state, labels }) {
  const set = new Set((labels || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean));
  const none = { action: 'none', addLabels: [], removeLabels: [] };
  if (!set.has(PMO_LABEL)) return none;

  if (state === 'closed') {
    const addLabels = set.has(CLOSED_LABEL) ? [] : [CLOSED_LABEL];
    const removeLabels = STALE_ON_CLOSED.filter((l) => set.has(l));
    if (addLabels.length === 0 && removeLabels.length === 0) return none;
    return { action: 'repair', addLabels, removeLabels };
  }

  if (state === 'open') {
    if (set.has(CLOSED_LABEL)) {
      return {
        ...none,
        action: 'comment',
        kind: 'open_with_pmo_closed',
        comment: 'This issue is open but carries `pmo:closed`. Either the issue should be closed, or the label should be removed and the right lifecycle label (`pmo:active` or `pmo:pipeline`) set. It was not changed automatically.',
      };
    }
    if (set.has('pmo:active') && set.has('pmo:pipeline')) {
      return {
        ...none,
        action: 'comment',
        kind: 'conflicting_lifecycle',
        comment: 'This issue carries both `pmo:active` and `pmo:pipeline`. Keep the one that matches its real stage and remove the other. It was not changed automatically.',
      };
    }
  }
  return none;
}

export function hasMarker(comments, kind) {
  const marker = `${MARKER_PREFIX}${kind} -->`;
  return (comments || []).some((c) => typeof c?.body === 'string' && c.body.includes(marker));
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !(method === 'DELETE' && res.status === 404)) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const number = event.issue?.number;
  if (!number || event.issue.pull_request) return;
  // Read the issue fresh: the event payload can be stale by the time this runs.
  const issue = await api(`/issues/${number}`);
  const plan = planPmoRepair({ state: issue.state, labels: issue.labels });
  if (plan.action === 'none') {
    console.log(`#${number}: nothing to repair.`);
    return;
  }
  if (plan.action === 'repair') {
    for (const label of plan.removeLabels) await api(`/issues/${number}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });
    if (plan.addLabels.length) await api(`/issues/${number}/labels`, { method: 'POST', body: { labels: plan.addLabels } });
    console.log(`#${number}: repaired (added ${plan.addLabels.join(', ') || 'none'}; removed ${plan.removeLabels.join(', ') || 'none'}).`);
    return;
  }
  const comments = await api(`/issues/${number}/comments?per_page=100`);
  if (hasMarker(comments, plan.kind)) {
    console.log(`#${number}: ${plan.kind} already commented; not repeating.`);
    return;
  }
  await api(`/issues/${number}/comments`, {
    method: 'POST',
    body: { body: `${MARKER_PREFIX}${plan.kind} -->\n${plan.comment}\n\n---\n_PMO label check (#5242). Posted once per kind._` },
  });
  console.log(`#${number}: commented (${plan.kind}).`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
