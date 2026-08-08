import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isConsumed, isClaimActive, claimPath } from './claim.mjs';
import { validateEligibility, resolveDeliveryKey, sanitizeDeliveryKey } from './eligibility.mjs';
import { appendBridgeLog } from './notify.mjs';
import { atomicWriteJson } from './atomic-write.mjs';

/**
 * Serial-lane gate for reconcile. Fail-closed when the claim file exists but
 * cannot be read/parsed; otherwise block while any claim is within TTL.
 */
export function activeSerialClaimBlocks(config) {
  const p = claimPath(config);
  if (!fs.existsSync(p)) return { blocks: false };
  try {
    const claim = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { blocks: isClaimActive(claim, config.claimTtlSeconds || 7200), claim };
  } catch (err) {
    return { blocks: true, error: err.message, failClosed: true };
  }
}

const DEFAULT_REPO = 'wdhunter465/next-starter-template';

function ghJson(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return JSON.parse(r.stdout || 'null');
}

export function listQueueAndProcessing(queueDir) {
  if (!fs.existsSync(queueDir)) return [];
  return fs
    .readdirSync(queueDir)
    .filter((f) => f.endsWith('.json') || f.endsWith('.json.processing'))
    .map((f) => path.join(queueDir, f));
}

export function packetMentionsResume(packet, resumeId) {
  if (!packet || !resumeId) return false;
  const id = String(resumeId);
  if (packet.resumeHint != null && String(packet.resumeHint) === id) return true;
  if (packet.resumeCommentId != null && String(packet.resumeCommentId) === id) return true;
  if (packet.deliveryId && String(packet.deliveryId).includes(id)) return true;
  return false;
}

export function hasPendingOrProcessingPacket(queueDir, resumeId) {
  for (const file of listQueueAndProcessing(queueDir)) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const packet = JSON.parse(raw);
      if (packetMentionsResume(packet, resumeId)) return true;
    } catch {
      /* ignore unreadable/partial */
    }
  }
  return false;
}

/**
 * Build a recovery wake packet using the normal packet schema.
 * Does not launch Cursor — only queues for the Bridge drain path.
 */
export function buildRecoveryPacket({
  issueNumber,
  resumeCommentId,
  deliveryKey,
  now = new Date(),
}) {
  const key = sanitizeDeliveryKey(deliveryKey || resumeCommentId);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return {
    schemaVersion: 1,
    issueNumber: Number(issueNumber),
    deliveryId: `reconcile-${key}-${stamp}`,
    eventName: 'reconcile-recovery',
    actor: 'cursor-bridge-reconcile',
    resumeHint: key,
    resumeCommentId: resumeCommentId != null ? sanitizeDeliveryKey(resumeCommentId) : key,
    recovery: true,
    deliveredAt: now.toISOString(),
  };
}

export function writeRecoveryPacket(queueDir, packet) {
  const safeId = sanitizeDeliveryKey(packet.deliveryId);
  const file = path.join(queueDir, `${safeId}.json`);
  if (safeId !== String(packet.deliveryId)) {
    packet = { ...packet, deliveryId: safeId };
  }
  if (fs.existsSync(file)) {
    return { wrote: false, reason: 'delivery_id_exists', file };
  }
  atomicWriteJson(file, packet, 0o600);
  return { wrote: true, reason: 'queued', file };
}

/**
 * Pure decision helper for unit tests: should we queue recovery?
 * eligibilityOk is mechanical-only (#2997). deliveryKey may be a resume
 * comment id or an issue/packet fallback so delivery-first recovery works
 * when semantic resume parsing is incomplete.
 */
export function shouldQueueRecovery({
  eligibilityOk,
  resumeId,
  deliveryKey,
  consumed,
  hasPendingPacket,
  claimBlocks,
}) {
  if (!eligibilityOk) return { queue: false, reason: 'ineligible' };
  const key = deliveryKey || resumeId;
  if (!key) return { queue: false, reason: 'missing_delivery_key' };
  if (consumed) return { queue: false, reason: 'already_consumed' };
  if (hasPendingPacket) return { queue: false, reason: 'packet_pending' };
  if (claimBlocks) return { queue: false, reason: 'serial_lane_busy' };
  return { queue: true, reason: 'missed_eligible_handoff' };
}

/**
 * Bounded slow reconciliation sweep. Fail-closed on API or ambiguity.
 * Reconstructs recovery packets only; never launches Cursor directly.
 */
export async function runReconcileSweep(config, dirs, opts = {}) {
  const enabled = config.reconcileEnabled !== false;
  if (!enabled) {
    return { ok: true, skipped: true, reason: 'reconcile_disabled', recovered: [] };
  }

  const repo = config.repository || DEFAULT_REPO;
  const labels = config.requiredLabels || ['agent:cursor', 'handoff:ready'];
  const limit = opts.issueLimit || config.reconcileIssueLimit || 40;
  const gh = opts.ghJson || ghJson;
  const recovered = [];
  const inspected = [];

  let issues;
  try {
    const labelArgs = labels.flatMap((l) => ['--label', l]);
    issues = gh([
      'issue',
      'list',
      '--repo',
      repo,
      '--state',
      'open',
      ...labelArgs,
      '--limit',
      String(limit),
      '--json',
      'number,title,state,labels,url',
    ]);
  } catch (err) {
    appendBridgeLog(config, `reconcile list failed: ${err.message}`);
    return { ok: false, failedClosed: true, reason: `api_list_failed:${err.message}`, recovered: [] };
  }

  if (!Array.isArray(issues)) {
    return { ok: false, failedClosed: true, reason: 'api_list_ambiguous', recovered: [] };
  }

  const claimGate = activeSerialClaimBlocks(config);
  if (claimGate.failClosed) {
    appendBridgeLog(config, `reconcile claim unreadable: ${claimGate.error}`);
    return {
      ok: false,
      failedClosed: true,
      reason: `claim_unreadable:${claimGate.error}`,
      recovered: [],
    };
  }
  const claimBlocks = !!claimGate.blocks;

  for (const summary of issues) {
    const issueNumber = Number(summary.number);
    try {
      const issue = gh([
        'issue',
        'view',
        String(issueNumber),
        '--repo',
        repo,
        '--json',
        'number,title,state,labels,url,body',
      ]);

      // Eligibility is label/state-only; no comment fetch is needed to decide it.
      const eligibility = validateEligibility(issue, [], {
        requiredLabels: labels,
        expectedRepo: repo,
      });
      const deliveryKey = resolveDeliveryKey({ packet: null, issueNumber });
      const consumed = isConsumed(config, deliveryKey);
      const pending = hasPendingOrProcessingPacket(dirs.queue, deliveryKey);

      const decision = shouldQueueRecovery({
        eligibilityOk: eligibility.ok,
        deliveryKey,
        consumed,
        hasPendingPacket: pending,
        claimBlocks,
      });

      inspected.push({
        issueNumber,
        deliveryKey,
        eligibilityOk: eligibility.ok,
        errors: eligibility.errors,
        semanticFindings: eligibility.semanticFindings,
        decision: decision.reason,
      });

      if (!decision.queue) continue;

      const packet = buildRecoveryPacket({
        issueNumber,
        deliveryKey,
      });
      const write = writeRecoveryPacket(dirs.queue, packet);
      if (write.wrote) {
        recovered.push({
          issueNumber,
          deliveryKey,
          deliveryId: packet.deliveryId,
          file: write.file,
        });
        appendBridgeLog(
          config,
          `reconcile queued recovery issue=#${issueNumber} deliveryKey=${deliveryKey} delivery=${packet.deliveryId}`,
        );
      }
    } catch (err) {
      appendBridgeLog(config, `reconcile issue #${issueNumber} failed: ${err.message}`);
      return {
        ok: false,
        failedClosed: true,
        reason: `api_issue_failed:#${issueNumber}:${err.message}`,
        recovered,
        inspected,
      };
    }
  }

  return {
    ok: true,
    failedClosed: false,
    reason: recovered.length ? 'recovered' : 'no_discrepancy',
    recovered,
    inspected,
    at: new Date().toISOString(),
  };
}
