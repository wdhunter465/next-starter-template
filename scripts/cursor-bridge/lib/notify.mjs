import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bridgeHome } from './paths.mjs';

export function appendAlert(config, message) {
  const home = bridgeHome();
  const log = path.join(home, config.alertsLog || 'alerts.log');
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(log, line);
  return log;
}

export function appendBridgeLog(config, message) {
  const home = bridgeHome();
  const log = path.join(home, config.bridgeLog || 'bridge.log');
  fs.appendFileSync(log, `${new Date().toISOString()} ${message}\n`);
}

export function notifyLocal(config, title, body) {
  appendAlert(config, `${title}: ${body}`);
  const r = spawnSync('notify-send', [title, body], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    // Chromebook Linux may lack notify-send; log is enough.
    appendBridgeLog(config, `notify-send unavailable or failed; alert logged`);
  }
}

export function postIssueComment(issueNumber, body) {
  const r = spawnSync(
    'gh',
    ['issue', 'comment', String(issueNumber), '--repo', 'wdhunter465/next-starter-template', '--body', body],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error(`gh issue comment failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout || '').trim();
}

export const FALLBACK_PREFIXES = {
  unclaimed: 'CURSOR BRIDGE FALLBACK: unclaimed',
  launchRetry: 'CURSOR BRIDGE FALLBACK: launch-retry',
  acceptedRunFailure: 'CURSOR BRIDGE FALLBACK: accepted-run-failure',
};

/**
 * Resolve operator-visible fallback classification prefixes.
 * Launch-retry and accepted-run-failure must not reuse the unclaimed prefix.
 */
export function resolveFallbackPrefix(kind, config = {}) {
  if (kind === 'launch-retry') {
    return config.fallbackLaunchRetryCommentPrefix || FALLBACK_PREFIXES.launchRetry;
  }
  if (kind === 'accepted-run-failure') {
    return (
      config.fallbackAcceptedFailureCommentPrefix || FALLBACK_PREFIXES.acceptedRunFailure
    );
  }
  return config.fallbackCommentPrefix || FALLBACK_PREFIXES.unclaimed;
}

export function fallbackUnclaimed(config, issueNumber, reason) {
  const prefix = resolveFallbackPrefix('unclaimed', config);
  const body = `${prefix} — ${reason}\n\nBridge did not claim the serial lane. Manual Cursor pickup remains valid after eligibility is restored.`;
  notifyLocal(config, 'LGFC Cursor Bridge fallback', `Issue #${issueNumber}: ${reason}`);
  try {
    postIssueComment(issueNumber, body);
  } catch (err) {
    appendBridgeLog(config, `fallback comment failed: ${err.message}`);
  }
}

export function fallbackLaunchRetry(config, issueNumber, reason, retryAt) {
  const prefix = resolveFallbackPrefix('launch-retry', config);
  const body = `${prefix} — ${reason}\n\nCursor did not emit an agent-acceptance event. The claim was released, the handoff remains unconsumed, and one local retry is eligible after ${retryAt}.`;
  notifyLocal(config, 'LGFC Cursor Bridge launch retry', `Issue #${issueNumber}: ${reason}`);
  try {
    postIssueComment(issueNumber, body);
  } catch (err) {
    appendBridgeLog(config, `launch retry comment failed: ${err.message}`);
  }
}

export function fallbackAcceptedFailure(config, issueNumber, reason) {
  const prefix = resolveFallbackPrefix('accepted-run-failure', config);
  const body = `${prefix} — ${reason}\n\nCursor accepted this handoff before the failure. Automatic retry is suppressed to prevent duplicate execution; manual verification is required.`;
  notifyLocal(config, 'LGFC Cursor Bridge accepted-run failure', `Issue #${issueNumber}: ${reason}`);
  try {
    postIssueComment(issueNumber, body);
  } catch (err) {
    appendBridgeLog(config, `accepted failure comment failed: ${err.message}`);
  }
}
