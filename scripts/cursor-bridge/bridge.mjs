#!/usr/bin/env node
/**
 * Cursor Local Bridge — sole component allowed to start Cursor Local work.
 * Consumes wake packets, revalidates mechanical eligibility, claims lane, launches CLI or falls back.
 * Semantic task-readiness evaluation is delivered to Cursor (#2997 delivery-first).
 * Also writes a local heartbeat and runs a bounded missed-handoff reconciliation sweep.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadConfig, ensureDirs, bridgeHome } from './lib/paths.mjs';
import { validateEligibility, resolveDeliveryKey } from './lib/eligibility.mjs';
import { parentRef } from '../orchestrator/queue-routing.mjs';
import {
  acquireClaim,
  releaseClaim,
  isConsumed,
  markConsumed,
  readClaim,
  isClaimActive,
} from './lib/claim.mjs';
import {
  appendBridgeLog,
  fallbackAcceptedFailure,
  fallbackLaunchRetry,
  fallbackUnclaimed,
  notifyLocal,
} from './lib/notify.mjs';
import { cliAuthPreflight, launchLocalAgent } from './lib/launch.mjs';
import { writeHeartbeat } from './lib/heartbeat.mjs';
import { runReconcileSweep } from './lib/reconcile.mjs';
import { collectStatus } from './lib/status.mjs';
import { atomicWriteJson } from './lib/atomic-write.mjs';
import {
  classifyInterruptedLaunch,
  clearInFlight,
  monitorAgentProcess,
  prepareRetryPacket,
  readInFlight,
  writeInFlight,
} from './lib/launch-transaction.mjs';
import {
  isPreflightAllowingClaim,
  runPreflight,
} from './lib/preflight.mjs';

const REPO = 'wdhunter465/next-starter-template';

function ghJson(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return JSON.parse(r.stdout || 'null');
}

/**
 * Fetch the minimal live state (#2974) needed to validate a task issue's
 * declared parent: number, state, and labels. Returns null if the parent
 * cannot be read (deleted, wrong repo, transient API failure, etc.) so the
 * caller fails closed via the existing missing_or_mismatched_parent path
 * rather than crashing the bridge.
 */
function fetchParentIssueMeta(parentNumber) {
  try {
    return ghJson([
      'issue',
      'view',
      String(parentNumber),
      '--repo',
      REPO,
      '--json',
      'number,state,labels',
    ]);
  } catch {
    return null;
  }
}

function fetchIssueBundle(issueNumber) {
  const issue = ghJson([
    'issue',
    'view',
    String(issueNumber),
    '--repo',
    REPO,
    '--json',
    'number,title,state,labels,url,body',
  ]);
  const comments = ghJson([
    'api',
    `repos/${REPO}/issues/${issueNumber}/comments`,
    '--paginate',
  ]);
  const normalized = (Array.isArray(comments) ? comments : []).map((c) => ({
    id: c.id,
    url: c.html_url,
    body: c.body,
    createdAt: c.created_at,
    author: c.user?.login,
  }));
  return { issue, comments: normalized };
}

function readPacket(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function packetReady(file) {
  try {
    const packet = readPacket(file);
    if (!packet.notBefore) return true;
    const notBefore = new Date(packet.notBefore).getTime();
    return !Number.isFinite(notBefore) || notBefore <= Date.now();
  } catch {
    // Let processPacket produce the durable error/fallback evidence.
    return true;
  }
}

function listPackets(queueDir) {
  if (!fs.existsSync(queueDir)) return [];
  return fs
    .readdirSync(queueDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(queueDir, f))
    .filter(packetReady)
    .sort();
}

function metaPath(config) {
  return path.join(bridgeHome(), config.runtimeMetaPath || 'runtime-meta.json');
}

function readMeta(config) {
  const p = metaPath(config);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function writeMeta(config, patch) {
  const next = { ...readMeta(config), ...patch, updatedAt: new Date().toISOString() };
  atomicWriteJson(metaPath(config), next, 0o600);
  return next;
}

function pulseHeartbeat(config, dirs, serviceMode, extra = {}) {
  const meta = readMeta(config);
  return writeHeartbeat(config, {
    serviceMode,
    queueDepth: listPackets(dirs.queue).length,
    lastInboundPacketAt: meta.lastInboundPacketAt || null,
    lastOutboundGithubAt: meta.lastOutboundGithubAt || null,
    lastPreflight: meta.lastPreflight || null,
    ...extra,
  });
}

function recordPreflight(config, result) {
  writeMeta(config, {
    lastPreflight: {
      result: result.result,
      ready: result.ready,
      invocationReason: result.invocationReason,
      timestamp: result.timestamp,
      allowClaim: result.allowClaim,
      alert: result.alert || null,
    },
  });
  return result;
}

function consumedTarget(dirs, packetPath, suffix) {
  const base = path.join(dirs.consumed, `${path.basename(packetPath)}.${suffix}`);
  if (!fs.existsSync(base)) return base;
  return `${base}.${Date.now()}`;
}

function moveProcessingToConsumed(dirs, packetPath, processing, suffix) {
  if (!processing || !fs.existsSync(processing)) return null;
  const target = consumedTarget(dirs, packetPath, suffix);
  fs.renameSync(processing, target);
  return target;
}

function requeuePreacceptFailure(config, packetPath, processing, packet, issueNumber, reason) {
  const retry = prepareRetryPacket(packet, {
    reason,
    baseDelaySeconds: config.launchRetryBaseSeconds ?? 30,
    maxDelaySeconds: config.launchRetryMaxSeconds ?? 900,
  });
  const shouldNotify = !packet.launchFallbackPosted;
  retry.launchFallbackPosted = packet.launchFallbackPosted || shouldNotify;
  atomicWriteJson(processing, retry, 0o600);
  if (fs.existsSync(packetPath)) {
    fs.unlinkSync(packetPath);
  }
  fs.renameSync(processing, packetPath);
  appendBridgeLog(
    config,
    `requeue preaccept issue=#${issueNumber} reason=${reason} attempt=${retry.launchAttempts} notBefore=${retry.notBefore}`,
  );
  if (shouldNotify) {
    fallbackLaunchRetry(config, issueNumber, reason, retry.notBefore);
    writeMeta(config, { lastOutboundGithubAt: new Date().toISOString() });
  }
  return retry;
}

/**
 * Clear the in-flight transaction only after durable queue/archive mutation completes.
 * If the process crashes during the mutation, restart recovery still has in-flight state.
 */
export function clearInFlightAfterDurable(config, durableMutation) {
  const result = typeof durableMutation === 'function' ? durableMutation() : undefined;
  clearInFlight(config);
  return result;
}

function recoverInterruptedLaunch(config, dirs) {
  const record = readInFlight(config);
  if (!record) return { recovered: false, reason: 'none' };

  const classification = classifyInterruptedLaunch(record);
  const packetPath = record.packetPath || null;
  const processing = record.processingPath || null;
  const issueNumber = Number(record.issueNumber || 0);

  if (classification === 'retry_preaccept') {
    releaseClaim(config);
    clearInFlightAfterDurable(config, () => {
      if (processing && fs.existsSync(processing) && packetPath) {
        let packet = record.packet || null;
        try {
          packet = readPacket(processing);
        } catch {
          /* use recorded packet */
        }
        if (packet) {
          requeuePreacceptFailure(
            config,
            packetPath,
            processing,
            packet,
            issueNumber,
            'bridge_restart_preaccept',
          );
        } else {
          moveProcessingToConsumed(dirs, packetPath, processing, 'corrupt-preaccept');
        }
      }
    });
    appendBridgeLog(config, `recovered interrupted preaccept launch issue=#${issueNumber}`);
    return { recovered: true, reason: 'retry_preaccept', issueNumber };
  }

  releaseClaim(config);
  clearInFlightAfterDurable(config, () => {
    if (processing && fs.existsSync(processing) && packetPath) {
      moveProcessingToConsumed(dirs, packetPath, processing, 'interrupted-after-acceptance');
    }
  });
  appendBridgeLog(config, `held interrupted accepted launch issue=#${issueNumber}`);
  if (issueNumber) {
    fallbackAcceptedFailure(config, issueNumber, 'bridge_restart_after_agent_acceptance');
    writeMeta(config, { lastOutboundGithubAt: new Date().toISOString() });
  }
  return { recovered: true, reason: 'hold_postaccept', issueNumber };
}

async function processPacket(config, dirs, packetPath) {
  let packet = null;
  let processing = null;
  let issueNumber = 0;

  try {
    packet = readPacket(packetPath);
    issueNumber = Number(packet.issueNumber || packet.issue);
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new Error('invalid_issue_number');
    }
    appendBridgeLog(config, `dequeue ${path.basename(packetPath)} issue=#${issueNumber}`);
    writeMeta(config, { lastInboundPacketAt: new Date().toISOString() });

    processing = `${packetPath}.processing`;
    fs.renameSync(packetPath, processing);

    const { issue, comments } = fetchIssueBundle(issueNumber);

    // #2974: a pmo:active/task-shaped issue is routed through
    // classifyQueueCandidate, which requires the live parent project's
    // state (team:pmo / pmo:active / a pmo:priority label) to accept the
    // issue's own declared "Parent Project: #NNNN" reference. Without
    // this, queueContext.parent is always null and every such issue fails
    // closed with missing_or_mismatched_parent regardless of correctness.
    const declaredParentNumber = parentRef(issue?.body);
    const parent = declaredParentNumber ? fetchParentIssueMeta(declaredParentNumber) : null;

    const eligibility = validateEligibility(issue, comments, {
      requiredLabels: config.requiredLabels,
      expectedRepo: REPO,
      queueContext: { parent },
    });

    // Mechanical gates only. Semantic findings (missing/ambiguous resume,
    // action count, queue routing) are passed to Cursor — never discarded here.
    if (!eligibility.ok) {
      fallbackUnclaimed(config, issueNumber, `validation_failed:${eligibility.errors.join(',')}`);
      writeMeta(config, { lastOutboundGithubAt: new Date().toISOString() });
      moveProcessingToConsumed(dirs, packetPath, processing, 'rejected');
      return { ok: false, reason: 'validation_failed' };
    }

    if (eligibility.semanticFindings?.length) {
      appendBridgeLog(
        config,
        `semantic findings issue=#${issueNumber}: ${eligibility.semanticFindings.join(',')}`,
      );
    }

    const resumeId = resolveDeliveryKey({ packet, issueNumber });
    if (isConsumed(config, resumeId)) {
      appendBridgeLog(config, `skip already consumed deliveryKey=${resumeId}`);
      moveProcessingToConsumed(dirs, packetPath, processing, 'dup');
      return { ok: true, reason: 'already_consumed' };
    }

    const auth = cliAuthPreflight(config);
    if (!auth.ok) {
      recordPreflight(
        config,
        runPreflight(config, { reason: 'postfailure', notify: true }),
      );
      requeuePreacceptFailure(config, packetPath, processing, packet, issueNumber, auth.reason);
      return { ok: false, reason: auth.reason };
    }

    const preclaim = recordPreflight(
      config,
      runPreflight(config, { reason: 'preclaim', notify: true }),
    );
    if (!isPreflightAllowingClaim(preclaim)) {
      requeuePreacceptFailure(
        config,
        packetPath,
        processing,
        packet,
        issueNumber,
        `preflight_${preclaim.result}`,
      );
      return { ok: false, reason: `preflight_${preclaim.result}` };
    }

    const claim = acquireClaim(config, {
      issueNumber,
      resumeCommentId: resumeId,
      deliveryId: packet.deliveryId || path.basename(packetPath),
    });
    if (!claim.ok) {
      // Serial lane busy: defer/retry quietly so recovery packets are not discarded.
      if (claim.reason === 'serial_lane_busy') {
        appendBridgeLog(config, `defer serial_lane_busy issue=#${issueNumber}`);
        fs.renameSync(processing, packetPath);
        return { ok: true, reason: 'deferred_serial_lane_busy' };
      }
      // Same event already claimed: quiet duplicate (no fallback comment).
      if (claim.reason === 'already_claimed_same_event') {
        appendBridgeLog(config, `skip already_claimed_same_event resume=${resumeId}`);
        moveProcessingToConsumed(dirs, packetPath, processing, 'dup');
        return { ok: true, reason: 'already_claimed_same_event' };
      }
      fallbackUnclaimed(config, issueNumber, claim.reason);
      writeMeta(config, { lastOutboundGithubAt: new Date().toISOString() });
      moveProcessingToConsumed(dirs, packetPath, processing, 'busy');
      return { ok: false, reason: claim.reason };
    }

    const launched = launchLocalAgent(config, {
      issueNumber,
      issue,
      comments,
      semanticFindings: eligibility.semanticFindings || [],
    });

    if (launched.error) {
      releaseClaim(config);
      recordPreflight(
        config,
        runPreflight(config, { reason: 'postfailure', notify: true }),
      );
      requeuePreacceptFailure(config, packetPath, processing, packet, issueNumber, launched.error);
      return { ok: false, reason: launched.error };
    }

    const { child } = launched;
    let inFlight = writeInFlight(config, {
      state: 'cli_spawned',
      issueNumber,
      resumeCommentId: resumeId,
      deliveryId: packet.deliveryId || path.basename(packetPath),
      packetPath,
      processingPath: processing,
      packet,
      bridgePid: process.pid,
      childPid: child.pid || null,
      spawnedAt: new Date().toISOString(),
      acceptedAt: null,
      sessionId: null,
    });

    const logPath = path.join(dirs.home, `run-${issueNumber}-${resumeId}.log`);
    fs.appendFileSync(logPath, `${new Date().toISOString()} launch_state=cli_spawned\n`, {
      mode: 0o600,
    });

    const lifecycle = await monitorAgentProcess({
      child,
      startupTimeoutMs: (config.launchStartupTimeoutSeconds ?? 60) * 1000,
      executionTimeoutMs: (config.launchExecutionTimeoutSeconds ?? 7200) * 1000,
      heartbeatIntervalMs: (config.launchHeartbeatIntervalSeconds ?? 5) * 1000,
      onAccepted: ({ sessionId, acceptedAt }) => {
        markConsumed(config, resumeId, { issueNumber, packet: path.basename(packetPath), sessionId });
        inFlight = writeInFlight(config, {
          ...inFlight,
          state: 'running',
          acceptedAt,
          sessionId,
        });
        fs.appendFileSync(
          logPath,
          `${new Date().toISOString()} launch_state=agent_accepted session_id=${sessionId}\n`,
          { mode: 0o600 },
        );
        // Shared lifecycle evidence is Issue status + Cursor handoff (#2997).
        // Do not post routine CURSOR BRIDGE STARTED telemetry comments.
      },
      onHeartbeat: ({ accepted, sessionId, state, at }) => {
        pulseHeartbeat(config, dirs, 'agent-running', {
          activeLaunch: {
            issueNumber,
            resumeCommentId: resumeId,
            state,
            accepted,
            sessionId,
            at,
          },
        });
      },
      onDiagnostic: (line) => {
        fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`, { mode: 0o600 });
      },
    });

    if (!lifecycle.accepted) {
      releaseClaim(config);
      clearInFlightAfterDurable(config, () => {
        requeuePreacceptFailure(
          config,
          packetPath,
          processing,
          packet,
          issueNumber,
          lifecycle.reason,
        );
      });
      pulseHeartbeat(config, dirs, 'watch', { activeLaunch: null });
      return { ok: false, reason: lifecycle.reason };
    }

    if (lifecycle.reason !== 'completed') {
      releaseClaim(config);
      fallbackAcceptedFailure(config, issueNumber, lifecycle.reason);
      writeMeta(config, { lastOutboundGithubAt: new Date().toISOString() });
      notifyLocal(config, 'LGFC Cursor Bridge', `Agent failed on #${issueNumber}: ${lifecycle.reason}`);
      clearInFlightAfterDurable(config, () => {
        moveProcessingToConsumed(dirs, packetPath, processing, 'failed-after-acceptance');
      });
      pulseHeartbeat(config, dirs, 'watch', { activeLaunch: null });
      return { ok: false, reason: lifecycle.reason };
    }

    // Shared lifecycle evidence is Issue status + Cursor IMPLEMENTATION HANDOFF (#2997).
    // Do not post routine CURSOR BRIDGE COMPLETED telemetry comments.
    releaseClaim(config);

    clearInFlightAfterDurable(config, () => {
      moveProcessingToConsumed(dirs, packetPath, processing, 'done');
    });
    pulseHeartbeat(config, dirs, 'watch', { activeLaunch: null });
    return { ok: true, reason: 'completed' };
  } catch (err) {
    appendBridgeLog(config, `process error: ${err.message}`);
    const interrupted = readInFlight(config);
    const interruptionClass = classifyInterruptedLaunch(interrupted);
    try {
      releaseClaim(config);
    } catch {
      /* ignore */
    }

    clearInFlightAfterDurable(config, () => {
      if (processing && fs.existsSync(processing) && packetPath && packet) {
        if (interruptionClass === 'hold_postaccept') {
          moveProcessingToConsumed(dirs, packetPath, processing, 'error-after-acceptance');
        } else {
          requeuePreacceptFailure(
            config,
            packetPath,
            processing,
            packet,
            issueNumber,
            `bridge_error:${err.message}`,
          );
        }
      }
    });

    if (issueNumber && interruptionClass === 'hold_postaccept') {
      fallbackAcceptedFailure(config, issueNumber, `bridge_error:${err.message}`);
      writeMeta(config, { lastOutboundGithubAt: new Date().toISOString() });
    }
    pulseHeartbeat(config, dirs, 'watch', { activeLaunch: null });
    return { ok: false, reason: `bridge_error:${err.message}` };
  }
}

async function drainOnce(config, dirs) {
  const files = listPackets(dirs.queue);
  const results = [];
  for (const file of files) {
    results.push(await processPacket(config, dirs, file));
  }
  return {
    at: new Date().toISOString(),
    drained: files.length,
    results,
    ok: results.every((r) => r.ok !== false || r.reason === 'already_consumed'),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const config = loadConfig();
  const dirs = ensureDirs(config);
  appendBridgeLog(config, `bridge start home=${dirs.home} pid=${process.pid}`);
  recoverInterruptedLaunch(config, dirs);

  const mode = process.argv[2] || 'watch';
  if (mode === 'preflight') {
    const result = recordPreflight(
      config,
      runPreflight(config, { reason: 'manual', notify: true }),
    );
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 1;
    return;
  }

  if (mode === 'once') {
    const startup = recordPreflight(
      config,
      runPreflight(config, { reason: 'startup', notify: true }),
    );
    if (!isPreflightAllowingClaim(startup)) {
      appendBridgeLog(config, `startup preflight blocked drain: ${startup.result}`);
      pulseHeartbeat(config, dirs, 'once', {});
      process.exitCode = 1;
      return;
    }
    const drain = await drainOnce(config, dirs);
    pulseHeartbeat(config, dirs, 'once', { lastDrain: drain });
    return;
  }

  if (mode === 'status') {
    console.log(JSON.stringify(collectStatus(config), null, 2));
    return;
  }

  if (mode === 'reconcile') {
    const result = await runReconcileSweep(config, dirs);
    pulseHeartbeat(config, dirs, 'reconcile', { lastReconcile: result });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }

  let lastReconcileAt = 0;
  let lastReconcile = null;
  let lastDrain = null;
  const reconcileIntervalMs = (config.reconcileIntervalSeconds ?? 900) * 1000;

  const startup = recordPreflight(
    config,
    runPreflight(config, { reason: 'startup', notify: true }),
  );
  if (!isPreflightAllowingClaim(startup)) {
    appendBridgeLog(
      config,
      `startup preflight not ready: ${startup.result}; claims remain blocked until recovery`,
    );
  }
  pulseHeartbeat(config, dirs, 'watch', {});

  for (;;) {
    try {
      lastDrain = await drainOnce(config, dirs);
    } catch (err) {
      appendBridgeLog(config, `watch loop error: ${err.message}`);
      lastDrain = { at: new Date().toISOString(), ok: false, error: err.message };
    }

    const now = Date.now();
    if (config.reconcileEnabled !== false && now - lastReconcileAt >= reconcileIntervalMs) {
      try {
        lastReconcile = await runReconcileSweep(config, dirs);
        lastReconcileAt = now;
        // Drain immediately so recovered packets enter the normal path.
        if (lastReconcile.recovered?.length) {
          lastDrain = await drainOnce(config, dirs);
        }
      } catch (err) {
        lastReconcile = {
          ok: false,
          failedClosed: true,
          reason: `reconcile_exception:${err.message}`,
          recovered: [],
          at: new Date().toISOString(),
        };
        lastReconcileAt = now;
        appendBridgeLog(config, `reconcile exception: ${err.message}`);
      }
    }

    pulseHeartbeat(config, dirs, 'watch', {
      lastDrain: lastDrain
        ? {
            at: lastDrain.at,
            drained: lastDrain.drained ?? 0,
            ok: lastDrain.ok !== false,
            error: lastDrain.error || null,
          }
        : null,
      lastReconcile: lastReconcile
        ? {
            at: lastReconcile.at || new Date().toISOString(),
            ok: lastReconcile.ok,
            reason: lastReconcile.reason,
            recovered: (lastReconcile.recovered || []).length,
            failedClosed: !!lastReconcile.failedClosed,
          }
        : null,
      activeLaunch: null,
    });

    await sleep(2000);
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  drainOnce,
  processPacket,
  listPackets,
  fetchIssueBundle,
  fetchParentIssueMeta,
  recoverInterruptedLaunch,
};
