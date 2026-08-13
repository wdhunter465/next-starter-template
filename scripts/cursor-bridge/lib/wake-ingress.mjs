/**
 * Cursor-only wake / packet-ingress routing.
 *
 * Canonical mechanical predicate for whether a trusted repository event may
 * enter the Chromebook Cursor Local Bridge queue. Routing is label-driven
 * only: which agent label an Issue carries, and whether it carries
 * `handoff:ready`. There is no comment-text parsing anywhere in this
 * decision (see docs/reference/ci/cursor-local-bridge-contract.md, "Label
 * and status-driven handoff"). Semantic task readiness — what to actually
 * do — is Cursor's job, evaluated from the live Issue body/comments after
 * launch; this module only answers "is this Cursor-routed and ready?".
 *
 * `.github/workflows/cursor-local-wake.yml` must stay aligned with
 * `shouldDeliverCursorWake`. Claude Code / ChatGPT wakes use separate paths
 * and must never write Chromebook Bridge packets.
 */

export const CURSOR_AGENT_LABEL = 'agent:cursor';
export const CURSOR_HANDOFF_LABEL = 'handoff:ready';

/** Agent labels that route work away from Cursor Local. */
export const NON_CURSOR_AGENT_LABELS = Object.freeze([
  'agent:ChatGPT',
  'agent:chatgpt',
  'agent:engineering',
  'agent:claude',
  'agent:Claude',
  'agent:codex',
  'agent:copilot',
  'agent:atlas',
  'agent:Atlas',
]);

function normalizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
}

/** All `agent:*` routing labels on the Issue, sorted for stable reasons. */
export function listAgentRoutingLabels(labels = []) {
  return normalizeLabels(labels)
    .filter((name) => name.startsWith('agent:'))
    .sort();
}

/**
 * Deterministic conflict reason when more than one `agent:*` label is present.
 * @returns {string|null}
 */
export function conflictingAgentRoutingReason(labels = []) {
  const agents = listAgentRoutingLabels(labels);
  if (agents.length <= 1) return null;
  return `conflicting_agent_routing_labels:${agents.join(',')}`;
}

export function hasConflictingAgentRoutingLabels(labels = []) {
  return listAgentRoutingLabels(labels).length > 1;
}

/** Positive Cursor routing signal on a live Issue: the `agent:cursor` label. */
export function hasCursorRoutingSignal({ labels = [] } = {}) {
  return normalizeLabels(labels).includes(CURSOR_AGENT_LABEL);
}

/**
 * True when the Issue carries a non-Cursor agent label and not `agent:cursor`.
 * Comment bodies are never inspected to make this determination.
 */
export function isNonCursorDirectedTraffic({ labels = [] } = {}) {
  const names = normalizeLabels(labels);
  const hasCursor = names.includes(CURSOR_AGENT_LABEL);
  const hasNonCursorAgent = names.some((name) => NON_CURSOR_AGENT_LABELS.includes(name));
  return hasNonCursorAgent && !hasCursor;
}

/** True when both required labels for delivery are present on the live label set. */
export function hasReadyCursorHandoff({ labels = [] } = {}) {
  const names = normalizeLabels(labels);
  return names.includes(CURSOR_AGENT_LABEL) && names.includes(CURSOR_HANDOFF_LABEL);
}

/**
 * Decide whether cursor-local-wake may write a Chromebook Bridge packet.
 *
 * Every branch reads `event.repository`, `event.eventName`, and
 * `event.issueLabels` — the Issue's complete *current* label set at event
 * time — never a comment body. Because the decision is made from the full
 * current label set rather than "which single label was just added", it
 * does not matter whether `agent:cursor` or `handoff:ready` was applied
 * first: the moment both are present and a `labeled` event fires for
 * either one, delivery proceeds.
 *
 * Mixed/conflicting `agent:*` labels fail closed (#3013 remediation).
 *
 * @param {object} event
 * @returns {{ deliver: boolean, reason: string }}
 */
export function shouldDeliverCursorWake(event = {}) {
  const expectedRepo = event.expectedRepo || 'wdhunter465/next-starter-template';
  if (event.repository !== expectedRepo) {
    return { deliver: false, reason: 'untrusted_repository' };
  }

  const labels = normalizeLabels(event.issueLabels);

  const conflictReason = conflictingAgentRoutingReason(labels);
  if (conflictReason) {
    return { deliver: false, reason: conflictReason };
  }

  if (isNonCursorDirectedTraffic({ labels })) {
    return { deliver: false, reason: 'non_cursor_directed_traffic' };
  }

  if (event.eventName === 'workflow_dispatch') {
    if (event.actor !== 'wdhunter645') {
      return { deliver: false, reason: 'dispatch_actor_not_authorized' };
    }
    if (!labels.includes(CURSOR_AGENT_LABEL)) {
      return { deliver: false, reason: 'absent_cursor_routing' };
    }
    return { deliver: true, reason: 'manual_dispatch_cursor_routed' };
  }

  if (event.eventName === 'issues') {
    const isRoutingLabelEvent =
      event.action === 'labeled' &&
      (event.labelName === CURSOR_HANDOFF_LABEL || event.labelName === CURSOR_AGENT_LABEL);
    if (!isRoutingLabelEvent) {
      return { deliver: false, reason: 'unrelated_issue_label_event' };
    }
    if (!hasReadyCursorHandoff({ labels })) {
      return { deliver: false, reason: 'absent_cursor_routing' };
    }
    return { deliver: true, reason: 'handoff_ready_on_cursor_issue' };
  }

  return { deliver: false, reason: 'unrelated_github_traffic' };
}
