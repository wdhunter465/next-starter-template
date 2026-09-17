/**
 * Codex-only wake / packet-ingress routing (#4052).
 * Mirrors `scripts/cursor-bridge/lib/wake-ingress.mjs` with Codex labels.
 * Label-driven only. No comment-text parsing.
 */

export const CODEX_AGENT_LABEL = 'agent:codex';
export const CODEX_HANDOFF_LABEL = 'handoff:ready';
export const TRUSTED_DISPATCH_ACTORS = Object.freeze(['wdhunter465', 'wdhunter645']);

export const NON_CODEX_AGENT_LABELS = Object.freeze([
  'agent:cursor',
  'agent:ChatGPT',
  'agent:chatgpt',
  'agent:engineering',
  'agent:claude',
  'agent:Claude',
  'agent:copilot',
  'agent:atlas',
  'agent:Atlas'
]);

function normalizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
}

export function listAgentRoutingLabels(labels = []) {
  return normalizeLabels(labels)
    .filter((name) => name.startsWith('agent:'))
    .sort();
}

export function conflictingAgentRoutingReason(labels = []) {
  const agents = listAgentRoutingLabels(labels);
  if (agents.length <= 1) return null;
  return `conflicting_agent_routing_labels:${agents.join(',')}`;
}

export function hasCodexRoutingSignal({ labels = [] } = {}) {
  return normalizeLabels(labels).includes(CODEX_AGENT_LABEL);
}

export function isNonCodexDirectedTraffic({ labels = [] } = {}) {
  const names = normalizeLabels(labels);
  const hasCodex = names.includes(CODEX_AGENT_LABEL);
  const hasNonCodexAgent = names.some((name) => NON_CODEX_AGENT_LABELS.includes(name));
  return hasNonCodexAgent && !hasCodex;
}

export function hasReadyCodexHandoff({ labels = [] } = {}) {
  const names = normalizeLabels(labels);
  return names.includes(CODEX_AGENT_LABEL) && names.includes(CODEX_HANDOFF_LABEL);
}

export function shouldDeliverCodexWake(event = {}) {
  const expectedRepo = event.expectedRepo || 'wdhunter465/next-starter-template';
  if (event.repository !== expectedRepo) {
    return { deliver: false, reason: 'untrusted_repository' };
  }

  const labels = normalizeLabels(event.issueLabels);
  const conflictReason = conflictingAgentRoutingReason(labels);
  if (conflictReason) {
    return { deliver: false, reason: conflictReason };
  }

  if (isNonCodexDirectedTraffic({ labels })) {
    return { deliver: false, reason: 'non_codex_directed_traffic' };
  }

  if (event.eventName === 'workflow_dispatch') {
    if (!TRUSTED_DISPATCH_ACTORS.includes(event.actor)) {
      return { deliver: false, reason: 'dispatch_actor_not_authorized' };
    }
    if (!labels.includes(CODEX_AGENT_LABEL)) {
      return { deliver: false, reason: 'absent_codex_routing' };
    }
    return { deliver: true, reason: 'manual_dispatch_codex_routed' };
  }

  if (event.eventName === 'issues') {
    const isRoutingLabelEvent =
      event.action === 'labeled' &&
      (event.labelName === CODEX_HANDOFF_LABEL || event.labelName === CODEX_AGENT_LABEL);
    if (!isRoutingLabelEvent) {
      return { deliver: false, reason: 'unrelated_issue_label_event' };
    }
    if (!hasReadyCodexHandoff({ labels })) {
      return { deliver: false, reason: 'absent_codex_routing' };
    }
    return { deliver: true, reason: 'handoff_ready_on_codex_issue' };
  }

  return { deliver: false, reason: 'unrelated_github_traffic' };
}
